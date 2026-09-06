import express, { Request, Response, NextFunction } from "express";
import path from "path";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { verifyFirebaseAuth } from "./server/middleware/auth";
import { firestoreRepository, ValidationError, NotFoundError } from "./server/services/firestore";
import { checkSecretStatus } from "./server/config/secrets";
import {
  generateConversationResponse,
  discoverLifeThreads,
  askMyJournal,
  ConversationTurn,
} from "./server/services/gemini";
import { retrievalService } from "./server/services/retrieval";
import type { ConversationMode, Message, LifeThread, AskJournalResult } from "./src/types/journal";
import "./server/types/express";

// Load local environment variables in non-production mode if available
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

async function startServer() {
  const app = express();
  // AI Studio reverse proxy routes external traffic exclusively to port 3000
  const PORT = 3000;
  const HOST = "0.0.0.0";

  // Request body parsing with strict 64KB ceiling
  app.use(express.json({ limit: "64kb" }));

  // Safe handling of malformed JSON payloads and oversized payloads
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({
        status: "error",
        message: "Malformed JSON payload",
      });
      return;
    }
    if (
      typeof err === "object" &&
      err !== null &&
      ("type" in err && (err as { type: string }).type === "entity.too.large" ||
        "status" in err && (err as { status: number }).status === 413)
    ) {
      res.status(413).json({
        status: "error",
        message: "Payload exceeds 64KB limit",
      });
      return;
    }
    next(err);
  });

  // Basic security and diagnostic headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    const reqId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
    (req as any).id = reqId;
    res.setHeader("X-Request-ID", reqId);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // Safe server-side error diagnostic logger: logs route, status, error class & message without credentials/payloads
  function logSafeServerError(req: Request, routeName: string, statusCode: number, err: unknown) {
    const reqId = (req as any).id || "unknown";
    const errorType = err instanceof Error ? err.constructor.name : typeof err;
    const sanitizedMessage = err instanceof Error ? err.message : String(err);
    console.error(
      `[API_DIAGNOSTIC] reqId=${reqId} route="${routeName}" status=${statusCode} errorType="${errorType}" errorMsg="${sanitizedMessage}"`
    );
  }

  // Public health check endpoint for Cloud Run monitoring (no authentication required)
  app.get("/api/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "gemini-clarity-api",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
    });
  });

  // Protected Stage 1C authentication boundary check endpoint
  // Requires valid Firebase ID-token in Authorization: Bearer <token>
  app.get("/api/auth-check", verifyFirebaseAuth, (req: Request, res: Response) => {
    // Only return non-sensitive verification status and authoritative server-derived UID
    res.status(200).json({
      authenticated: true,
      uid: req.user?.uid,
      provider: "firebase",
    });
  });

  // Protected Stage 1D Firestore data-check endpoint
  // Validates authoritative Firestore persistence boundary for the authenticated user only
  app.get("/api/data-check", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      // Check if profile exists; initialize if missing using verified identity metadata
      let profile = await firestoreRepository.getUserProfile(uid);
      let wasInitialized = false;

      if (!profile) {
        profile = await firestoreRepository.createInitialUserProfile(uid, {
          email: req.user?.email ?? null,
          displayName: null,
        });
        wasInitialized = true;
      }

      // Return minimal, non-sensitive verification response (no private journal data)
      res.status(200).json({
        status: "success",
        authenticated: true,
        uid: profile.uid,
        hasProfile: true,
        initialized: wasInitialized,
        profile: {
          uid: profile.uid,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
          preferences: profile.preferences,
        },
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        res.status(400).json({ status: "error", message: err.message });
        return;
      }
      if (err instanceof NotFoundError) {
        res.status(404).json({ status: "error", message: err.message });
        return;
      }
      logSafeServerError(req, "GET /api/data-check", 500, err);
      // Never expose raw Firestore or internal stack traces to users
      res.status(500).json({
        status: "error",
        message: "Unable to retrieve user data at this time",
      });
    }
  });

  // Protected Stage 1D User Preferences Update
  // Permits updating only explicit user preference fields
  app.patch("/api/user/preferences", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      const updated = await firestoreRepository.updateUserPreferences(
        uid,
        req.body?.preferences || {}
      );

      res.status(200).json({
        status: "success",
        preferences: updated.preferences,
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        res.status(400).json({ status: "error", message: err.message });
        return;
      }
      if (err instanceof NotFoundError) {
        res.status(404).json({ status: "error", message: err.message });
        return;
      }
      res.status(500).json({
        status: "error",
        message: "Unable to update preferences",
      });
    }
  });

  // Protected Stage 1E Secret Manager credential-boundary verification endpoint
  // Never returns secret contents, API keys, or raw GCP errors
  app.get("/api/secret-check", verifyFirebaseAuth, async (_req: Request, res: Response) => {
    try {
      const status = await checkSecretStatus();
      res.status(200).json({
        status: "success",
        configured: status.configured,
        source: status.source,
        pinnedVersion: status.pinnedVersion,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Safe fallback - fail closed without exposing error or internal details
      res.status(200).json({
        status: "success",
        configured: false,
        source: "unconfigured",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // --------------------------------------------------------------------------
  // STAGE 2A: REFLECTIONS API
  // --------------------------------------------------------------------------

  // POST /api/reflections - Create new reflection with idempotency protection
  app.post("/api/reflections", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        res.status(400).json({ status: "error", message: "Malformed request payload" });
        return;
      }

      // Disallow arbitrary extra security-sensitive fields
      const allowedKeys = new Set(["title", "content", "idempotencyKey"]);
      const bodyKeys = Object.keys(req.body);
      const invalidKeys = bodyKeys.filter((k) => !allowedKeys.has(k));
      if (invalidKeys.length > 0) {
        res.status(400).json({
          status: "error",
          message: `Unexpected fields in payload: ${invalidKeys.join(", ")}`,
        });
        return;
      }

      const { title, content } = req.body;
      if (typeof title !== "string" || title.trim().length === 0) {
        res.status(400).json({ status: "error", message: "Title is required" });
        return;
      }
      if (title.length > 200) {
        res.status(400).json({ status: "error", message: "Title must not exceed 200 characters" });
        return;
      }

      if (typeof content !== "string" || content.trim().length === 0) {
        res.status(400).json({ status: "error", message: "Content is required" });
        return;
      }
      if (content.length > 65536) {
        res.status(400).json({ status: "error", message: "Content must not exceed 64KB (65,536 characters)" });
        return;
      }

      // Safe idempotency key handling
      const headerKey = req.headers["idempotency-key"] as string | undefined;
      const rawIdempotencyKey = (headerKey || req.body.idempotencyKey)?.trim();
      let idempotencyKey: string | undefined = undefined;
      if (rawIdempotencyKey) {
        const ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;
        if (!ID_REGEX.test(rawIdempotencyKey)) {
          res.status(400).json({ status: "error", message: "Invalid idempotency key format" });
          return;
        }
        idempotencyKey = rawIdempotencyKey;
      }

      const reflection = await firestoreRepository.createReflection(uid, {
        title: title.trim(),
        content: content.trim(),
        idempotencyKey,
      });

      res.status(201).json({
        status: "success",
        reflection,
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        res.status(400).json({ status: "error", message: err.message });
        return;
      }
      // Never log full reflection content
      console.error("Failed to persist reflection for user");
      res.status(500).json({
        status: "error",
        message: "Failed to persist reflection",
      });
    }
  });

  // GET /api/reflections - List authenticated user's reflections with bounded pagination
  app.get("/api/reflections", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      const rawLimit = Number(req.query.limit);
      const limit = Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 50 ? rawLimit : 20;
      const rawCursor = req.query.cursor as string | undefined;
      const cursor = rawCursor && /^[a-zA-Z0-9_-]{1,128}$/.test(rawCursor) ? rawCursor : undefined;

      const result = await firestoreRepository.listReflections(uid, limit, cursor);

      res.status(200).json({
        status: "success",
        reflections: result.reflections,
        nextCursor: result.nextCursor,
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        res.status(400).json({ status: "error", message: err.message });
        return;
      }
      logSafeServerError(req, "GET /api/reflections", 500, err);
      res.status(500).json({
        status: "error",
        message: "Failed to retrieve reflections",
      });
    }
  });

  // GET /api/reflections/:id - Get specific reflection (strictly scoped to req.user.uid)
  app.get("/api/reflections/:id", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      const id = req.params.id;
      if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
        res.status(400).json({ status: "error", message: "Invalid reflection ID format" });
        return;
      }

      const reflection = await firestoreRepository.getReflection(uid, id);
      if (!reflection) {
        res.status(404).json({ status: "error", message: "Reflection not found" });
        return;
      }

      res.status(200).json({
        status: "success",
        reflection,
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        res.status(400).json({ status: "error", message: err.message });
        return;
      }
      console.error("Failed to retrieve reflection");
      res.status(500).json({
        status: "error",
        message: "Failed to retrieve reflection",
      });
    }
  });

  // DELETE /api/reflections/:id - Delete specific reflection (strictly scoped to req.user.uid)
  app.delete("/api/reflections/:id", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      const id = req.params.id;
      if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
        res.status(400).json({ status: "error", message: "Invalid reflection ID format" });
        return;
      }

      const deleted = await firestoreRepository.deleteReflection(uid, id);
      if (!deleted) {
        res.status(404).json({ status: "error", message: "Reflection not found" });
        return;
      }

      res.status(200).json({
        status: "success",
        message: "Reflection deleted",
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        res.status(400).json({ status: "error", message: err.message });
        return;
      }
      console.error("Failed to delete reflection");
      res.status(500).json({
        status: "error",
        message: "Failed to delete reflection",
      });
    }
  });

  // --------------------------------------------------------------------------
  // STAGE 2B: CONVERSATIONS & GEMINI THINKING COMPANION API
  // --------------------------------------------------------------------------

  // POST /api/conversations - Send a turn to the thinking companion and persist
  app.post("/api/conversations", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        res.status(400).json({ status: "error", message: "Malformed request payload" });
        return;
      }

      // Strict field containment to prevent prompt injection / UID smuggling
      const allowedKeys = new Set([
        "conversationId",
        "message",
        "mode",
        "title",
        "associatedReflectionId",
        "idempotencyKey",
      ]);
      const bodyKeys = Object.keys(req.body);
      const invalidKeys = bodyKeys.filter((k) => !allowedKeys.has(k));
      if (invalidKeys.length > 0) {
        res.status(400).json({
          status: "error",
          message: `Unexpected fields in payload: ${invalidKeys.join(", ")}`,
        });
        return;
      }

      const { conversationId, message, mode, title, associatedReflectionId } = req.body;

      if (typeof message !== "string" || message.trim().length === 0) {
        res.status(400).json({ status: "error", message: "Message is required" });
        return;
      }
      if (message.length > 10000) {
        res.status(400).json({
          status: "error",
          message: "Message must not exceed 10,000 characters",
        });
        return;
      }

      const validModes: ConversationMode[] = ["reflect", "brainstorm", "clarify", "decide"];
      if (!mode || typeof mode !== "string" || !validModes.includes(mode as ConversationMode)) {
        res.status(400).json({
          status: "error",
          message: "Valid mode (reflect, brainstorm, clarify, decide) is required",
        });
        return;
      }

      // Idempotency key from header or body
      const headerKey = req.headers["idempotency-key"] as string | undefined;
      const rawIdempotencyKey = (headerKey || req.body.idempotencyKey)?.trim();
      let idempotencyKey: string | undefined = undefined;
      if (rawIdempotencyKey) {
        const ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;
        if (!ID_REGEX.test(rawIdempotencyKey)) {
          res.status(400).json({ status: "error", message: "Invalid idempotency key format" });
          return;
        }
        idempotencyKey = rawIdempotencyKey;
      }

      let activeConversationId = conversationId;
      let conversationHistory: ConversationTurn[] = [];

      if (activeConversationId) {
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(activeConversationId)) {
          res.status(400).json({ status: "error", message: "Invalid conversation ID format" });
          return;
        }

        // Must exist strictly under req.user.uid
        const existing = await firestoreRepository.getConversation(uid, activeConversationId);
        if (!existing) {
          res.status(404).json({ status: "error", message: "Conversation not found" });
          return;
        }

        // Idempotency check: If this exact turn was already processed, return existing without re-calling Gemini
        if (
          idempotencyKey &&
          existing.lastIdempotencyKey === idempotencyKey &&
          existing.messages.length >= 2
        ) {
          const lastUserMsg = existing.messages[existing.messages.length - 2];
          const lastModelMsg = existing.messages[existing.messages.length - 1];
          if (lastUserMsg && lastUserMsg.content === message.trim() && lastModelMsg) {
            res.status(200).json({
              status: "success",
              conversationId: existing.id,
              message: lastModelMsg,
              conversation: existing,
            });
            return;
          }
        }

        conversationHistory = existing.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      } else {
        // Create new conversation under authenticated user's hierarchy
        const initialTitle =
          typeof title === "string" && title.trim().length > 0
            ? title.trim().slice(0, 100)
            : message.trim().slice(0, 40) + (message.trim().length > 40 ? "…" : "");

        const newConv = await firestoreRepository.createConversation(uid, {
          title: initialTitle,
          mode: mode as ConversationMode,
          associatedReflectionId: associatedReflectionId || null,
          messages: [],
          lastIdempotencyKey: idempotencyKey,
        });
        activeConversationId = newConv.id;
      }

      // Invoke centralized server-side Gemini service with bounded history
      const geminiResponseText = await generateConversationResponse({
        history: conversationHistory,
        message: message.trim(),
        mode: mode as ConversationMode,
      });

      const now = new Date().toISOString();
      const userMessage: Message = {
        id: `msg_user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        role: "user",
        content: message.trim(),
        timestamp: now,
      };

      const modelMessage: Message = {
        id: `msg_model_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        role: "model",
        content: geminiResponseText,
        timestamp: new Date().toISOString(),
      };

      // Persist turn atomically
      const updatedConversation = await firestoreRepository.appendTurn(
        uid,
        activeConversationId,
        userMessage,
        modelMessage,
        idempotencyKey
      );

      res.status(200).json({
        status: "success",
        conversationId: activeConversationId,
        message: modelMessage,
        conversation: updatedConversation,
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        res.status(400).json({ status: "error", message: err.message });
        return;
      }
      if (err instanceof NotFoundError) {
        res.status(404).json({ status: "error", message: err.message });
        return;
      }
      console.error("Conversation turn failed:", err instanceof Error ? err.message : "Unknown error");
      const userFacingMessage = err instanceof Error ? err.message : "Failed to process conversation";
      res.status(500).json({
        status: "error",
        message: userFacingMessage,
      });
    }
  });

  // GET /api/conversations - List authenticated user's conversations
  app.get("/api/conversations", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      const rawLimit = Number(req.query.limit);
      const limit = Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 50 ? rawLimit : 20;
      const rawCursor = req.query.cursor as string | undefined;
      const cursor = rawCursor && /^[a-zA-Z0-9_-]{1,128}$/.test(rawCursor) ? rawCursor : undefined;

      const result = await firestoreRepository.listConversations(uid, limit, cursor);

      res.status(200).json({
        status: "success",
        conversations: result.conversations,
        nextCursor: result.nextCursor,
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        res.status(400).json({ status: "error", message: err.message });
        return;
      }
      console.error("Failed to list conversations");
      res.status(500).json({
        status: "error",
        message: "Failed to retrieve conversations",
      });
    }
  });

  // GET /api/conversations/:id - Get single conversation
  app.get("/api/conversations/:id", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      const id = req.params.id;
      if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
        res.status(400).json({ status: "error", message: "Invalid conversation ID format" });
        return;
      }

      const conversation = await firestoreRepository.getConversation(uid, id);
      if (!conversation) {
        res.status(404).json({ status: "error", message: "Conversation not found" });
        return;
      }

      res.status(200).json({
        status: "success",
        conversation,
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        res.status(400).json({ status: "error", message: err.message });
        return;
      }
      console.error("Failed to retrieve conversation");
      res.status(500).json({
        status: "error",
        message: "Failed to retrieve conversation",
      });
    }
  });

  // DELETE /api/conversations/:id - Delete single conversation
  app.delete("/api/conversations/:id", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      const id = req.params.id;
      if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
        res.status(400).json({ status: "error", message: "Invalid conversation ID format" });
        return;
      }

      const deleted = await firestoreRepository.deleteConversation(uid, id);
      if (!deleted) {
        res.status(404).json({ status: "error", message: "Conversation not found" });
        return;
      }

      res.status(200).json({
        status: "success",
        message: "Conversation deleted",
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        res.status(400).json({ status: "error", message: err.message });
        return;
      }
      console.error("Failed to delete conversation");
      res.status(500).json({
        status: "error",
        message: "Failed to delete conversation",
      });
    }
  });

  // --------------------------------------------------------------------------
  // LONGITUDINAL INTELLIGENCE: LIFE THREADS
  // --------------------------------------------------------------------------

  // POST /api/threads/discover - Discover and persist life threads across reflections
  app.post("/api/threads/discover", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      // Step 1: Bounded retrieval via server-side RetrievalService
      const boundedReflections = await retrievalService.getReflectionsForThreads(uid, 25);

      if (boundedReflections.length < 2) {
        res.status(200).json({
          status: "success",
          threads: [],
          count: 0,
          message: "Your thoughts will start connecting as you reflect. Add at least two reflections to discover threads.",
        });
        return;
      }

      // Step 2: Longitudinal analysis with Gemini
      const candidates = await discoverLifeThreads(boundedReflections);

      // Step 3: Server-side evidence validation
      const validReflectionIdSet = new Set(boundedReflections.map((r) => r.id));
      const reflectionMetaMap = new Map(boundedReflections.map((r) => [r.id, r]));

      const validatedThreads: LifeThread[] = [];

      for (const candidate of candidates) {
        if (!candidate.title || !candidate.summary) continue;

        // Verify every cited ID exists in the authorized retrieved set; discard invalid IDs
        const validSupportingIds = (candidate.supportingReflectionIds || []).filter(
          (id: string) => typeof id === "string" && validReflectionIdSet.has(id)
        );

        // Discard thread if fewer than 2 valid supporting IDs remain
        if (validSupportingIds.length < 2) {
          continue;
        }

        // Determine first and last observed timestamps from authentic reflection dates
        const dates = validSupportingIds
          .map((id) => reflectionMetaMap.get(id)?.createdAt)
          .filter((d): d is string => Boolean(d))
          .sort();

        const firstObservedAt = dates[0] || new Date().toISOString();
        const lastObservedAt = dates[dates.length - 1] || new Date().toISOString();

        // Build evidence list with authentic titles and dates
        const evidenceList = validSupportingIds.map((id) => {
          const r = reflectionMetaMap.get(id);
          return {
            reflectionId: id,
            title: r?.title || "Reflection",
            date: r?.createdAt || "",
            excerpt: r?.contentExcerpt || "",
          };
        });

        // Deterministic, collision-resistant thread ID to prevent duplicate proliferation on repeated runs
        const idSeed = `${candidate.title.trim().toLowerCase()}:${[...validSupportingIds].sort().join(",")}`;
        const threadId = "thread_" + crypto.createHash("sha256").update(idSeed).digest("hex").slice(0, 16);

        const now = new Date().toISOString();
        validatedThreads.push({
          id: threadId,
          userId: uid,
          title: String(candidate.title).trim().slice(0, 150),
          themeName: String(candidate.title).trim().slice(0, 150),
          summary: String(candidate.summary).trim().slice(0, 1000),
          narrativeSummary: String(candidate.summary).trim().slice(0, 1000),
          supportingReflectionIds: validSupportingIds,
          evidenceList,
          whatStayedConsistent: String(candidate.whatStayedConsistent || "").trim().slice(0, 1000),
          whatChanged: String(candidate.whatChanged || "").trim().slice(0, 1000),
          whatRemainsUnresolved: String(candidate.whatRemainsUnresolved || "").trim().slice(0, 1000),
          potentialNextStep: String(candidate.potentialNextStep || "").trim().slice(0, 1000),
          firstObservedAt,
          lastObservedAt,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Step 4: Persist validated threads under users/{uid}/threads/{threadId}
      const persistedThreads = await firestoreRepository.batchUpsertThreads(uid, validatedThreads);

      res.status(200).json({
        status: "success",
        threads: persistedThreads,
        count: persistedThreads.length,
        message:
          persistedThreads.length > 0
            ? `Discovered ${persistedThreads.length} life thread${persistedThreads.length === 1 ? "" : "s"}`
            : "No meaningful longitudinal connections found yet.",
      });
    } catch (err: unknown) {
      logSafeServerError(req, "POST /api/threads/discover", 500, err);
      res.status(500).json({ status: "error", message: "Unable to discover life threads at this time" });
    }
  });

  // GET /api/threads - List authenticated user's discovered life threads
  app.get("/api/threads", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      const rawLimit = Number(req.query.limit);
      const limit = Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 50 ? rawLimit : 20;

      const threads = await firestoreRepository.listThreads(uid, limit);

      res.status(200).json({
        status: "success",
        threads,
      });
    } catch (err: unknown) {
      logSafeServerError(req, "GET /api/threads", 500, err);
      res.status(500).json({ status: "error", message: "Failed to retrieve life threads" });
    }
  });

  // --------------------------------------------------------------------------
  // LONGITUDINAL INTELLIGENCE: ASK MY JOURNAL
  // --------------------------------------------------------------------------

  // POST /api/ask-journal - Natural language question answering over user's reflection history
  app.post("/api/ask-journal", verifyFirebaseAuth, async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        res.status(401).json({ status: "error", message: "Authentication required" });
        return;
      }

      const { query, timeRange } = req.body || {};

      // Input validation
      if (!query || typeof query !== "string" || query.trim().length === 0) {
        res.status(400).json({ status: "error", message: "Query string is required" });
        return;
      }
      if (query.length > 1000) {
        res.status(400).json({ status: "error", message: "Query must not exceed 1,000 characters" });
        return;
      }

      // Validate optional time range
      let validatedTimeRange: { start?: string; end?: string } | undefined = undefined;
      if (timeRange && typeof timeRange === "object") {
        const { start, end } = timeRange;
        if (start && (typeof start !== "string" || isNaN(new Date(start).getTime()))) {
          res.status(400).json({ status: "error", message: "Invalid start date format (must be ISO string)" });
          return;
        }
        if (end && (typeof end !== "string" || isNaN(new Date(end).getTime()))) {
          res.status(400).json({ status: "error", message: "Invalid end date format (must be ISO string)" });
          return;
        }
        if (start && end && new Date(start).getTime() > new Date(end).getTime()) {
          res.status(400).json({ status: "error", message: "Start date must be before or equal to end date" });
          return;
        }
        validatedTimeRange = {
          start: start ? new Date(start).toISOString() : undefined,
          end: end ? new Date(end).toISOString() : undefined,
        };
      }

      // Step 1: Bounded retrieval of user's authorized reflections
      const excerpts = await retrievalService.getReflectionsForAskJournal(
        uid,
        query.trim(),
        validatedTimeRange,
        25
      );

      // Step 2: Answer generation via centralized Gemini service
      const rawResult = await askMyJournal(query.trim(), excerpts);

      // Step 3: Server-side evidence validation
      const validReflectionIdSet = new Set(excerpts.map((e) => e.id));
      const reflectionMetaMap = new Map(excerpts.map((e) => [e.id, e]));

      const validatedEvidence = (rawResult.evidence || [])
        .filter((ev) => typeof ev.entryId === "string" && validReflectionIdSet.has(ev.entryId))
        .map((ev) => {
          const original = reflectionMetaMap.get(ev.entryId);
          return {
            entryId: ev.entryId,
            title: original?.title || "Reflection",
            date: original?.createdAt || ev.date,
            quote: String(ev.quote || "").slice(0, 500),
          };
        });

      // If model claimed sufficient evidence but zero valid evidence citations survived validation,
      // downgrade safely
      const sufficientEvidence =
        rawResult.sufficientEvidenceFound &&
        (validatedEvidence.length > 0 || excerpts.length > 0);

      const responseData: AskJournalResult = {
        directAnswer: rawResult.directAnswer || (sufficientEvidence ? "" : "I couldn't find enough evidence in your journal to answer that."),
        evidence: validatedEvidence,
        interpretation: rawResult.interpretation || "",
        sufficientEvidenceFound: sufficientEvidence,
      };

      res.status(200).json({
        status: "success",
        data: responseData,
      });
    } catch (err: unknown) {
      console.error("Ask my journal query failed:", err instanceof Error ? err.message : "Unknown error");
      const userFacing = err instanceof Error ? err.message : "Unable to answer journal query at this time";
      res.status(500).json({ status: "error", message: userFacing });
    }
  });

  // Vite middleware in development; static distribution in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled server error:", err instanceof Error ? err.message : "Unknown error");
    res.status(500).json({
      status: "error",
      message: "An internal server error occurred",
    });
  });

  app.listen(PORT, HOST, () => {
    console.log(`[Gemini Clarity] Server active on http://${HOST}:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
