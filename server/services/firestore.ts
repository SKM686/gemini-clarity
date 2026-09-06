import { adminDb } from "../lib/firebaseAdmin";
import type {
  UserProfile,
  UserPreferences,
  Reflection,
  Conversation,
  ConversationMode,
  Message,
  Decision,
  DecisionOption,
  DecisionStatus,
  LifeThread,
  Insight,
  WeeklyReview,
} from "../../src/types/journal";

export class ValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

const ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function validateId(id: string, fieldName = "ID"): string {
  if (!id || typeof id !== "string" || !ID_REGEX.test(id)) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
  return id;
}

function cleanUndefined<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        result[key] = cleanUndefined(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result as T;
}

export function toIsoDateString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object" && val !== null) {
    if ("toDate" in val && typeof (val as { toDate: () => Date }).toDate === "function") {
      return (val as { toDate: () => Date }).toDate().toISOString();
    }
    if ("_seconds" in val && typeof (val as { _seconds: number })._seconds === "number") {
      return new Date((val as { _seconds: number })._seconds * 1000).toISOString();
    }
    if ("seconds" in val && typeof (val as { seconds: number }).seconds === "number") {
      return new Date((val as { seconds: number }).seconds * 1000).toISOString();
    }
  }
  return String(val);
}

function formatReflection(id: string, uid: string, data: any): Reflection {
  return {
    id: typeof data?.id === "string" && data.id ? data.id : id,
    userId: typeof data?.userId === "string" && data.userId ? data.userId : uid,
    title: String(data?.title || "").trim(),
    content: String(data?.content || "").trim(),
    summary: typeof data?.summary === "string" ? data.summary : undefined,
    keyThemes: Array.isArray(data?.keyThemes)
      ? data.keyThemes.filter((t: any) => typeof t === "string")
      : undefined,
    createdAt: toIsoDateString(data?.createdAt),
    updatedAt: toIsoDateString(data?.updatedAt),
  };
}

// Internal Reference Helpers - constructing authorized paths only
const getUserRef = (uid: string) =>
  adminDb.collection("users").doc(validateId(uid, "UID"));

const getReflectionsCol = (uid: string) =>
  getUserRef(uid).collection("reflections");

const getReflectionRef = (uid: string, reflectionId: string) =>
  getReflectionsCol(uid).doc(validateId(reflectionId, "reflectionId"));

const getConversationsCol = (uid: string) =>
  getUserRef(uid).collection("conversations");

const getConversationRef = (uid: string, conversationId: string) =>
  getConversationsCol(uid).doc(validateId(conversationId, "conversationId"));

const getDecisionsCol = (uid: string) =>
  getUserRef(uid).collection("decisions");

const getDecisionRef = (uid: string, decisionId: string) =>
  getDecisionsCol(uid).doc(validateId(decisionId, "decisionId"));

const getThreadsCol = (uid: string) =>
  getUserRef(uid).collection("threads");

const getThreadRef = (uid: string, threadId: string) =>
  getThreadsCol(uid).doc(validateId(threadId, "threadId"));

const getInsightsCol = (uid: string) =>
  getUserRef(uid).collection("insights");

const getInsightRef = (uid: string, insightId: string) =>
  getInsightsCol(uid).doc(validateId(insightId, "insightId"));

const getWeeklyReviewsCol = (uid: string) =>
  getUserRef(uid).collection("weeklyReviews");

const getWeeklyReviewRef = (uid: string, reviewId: string) =>
  getWeeklyReviewsCol(uid).doc(validateId(reviewId, "reviewId"));

export const firestoreRepository = {
  // --------------------------------------------------------------------------
  // USER PROFILE
  // --------------------------------------------------------------------------
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docSnap = await getUserRef(uid).get();
    if (!docSnap.exists) {
      return null;
    }
    const data = docSnap.data();
    return {
      uid,
      email: data?.email ?? null,
      displayName: data?.displayName ?? null,
      preferences: {
        reflectionReminders: data?.preferences?.reflectionReminders ?? false,
        weeklyReviewDay: data?.preferences?.weeklyReviewDay ?? "sunday",
      },
      createdAt: data?.createdAt ?? new Date().toISOString(),
      updatedAt: data?.updatedAt ?? new Date().toISOString(),
    };
  },

  async createInitialUserProfile(
    uid: string,
    data: { email?: string | null; displayName?: string | null }
  ): Promise<UserProfile> {
    const existing = await this.getUserProfile(uid);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const newProfile: UserProfile = {
      uid: validateId(uid, "UID"),
      email: data.email ? String(data.email).slice(0, 320) : null,
      displayName: data.displayName ? String(data.displayName).slice(0, 100) : null,
      preferences: {
        reflectionReminders: false,
        weeklyReviewDay: "sunday",
      },
      createdAt: now,
      updatedAt: now,
    };

    await getUserRef(uid).set(cleanUndefined(newProfile));
    return newProfile;
  },

  async updateUserPreferences(
    uid: string,
    preferences: UserPreferences
  ): Promise<UserProfile> {
    const profile = await this.getUserProfile(uid);
    if (!profile) {
      throw new NotFoundError("User profile does not exist");
    }

    // Restrict strictly to permitted preferences
    const validWeeklyDays = ["sunday", "monday", "friday"] as const;
    const cleanPrefs: UserPreferences = {};

    if (preferences.reflectionReminders !== undefined) {
      cleanPrefs.reflectionReminders = Boolean(preferences.reflectionReminders);
    }
    if (preferences.weeklyReviewDay !== undefined) {
      if (validWeeklyDays.includes(preferences.weeklyReviewDay)) {
        cleanPrefs.weeklyReviewDay = preferences.weeklyReviewDay;
      } else {
        throw new ValidationError("Invalid weeklyReviewDay value");
      }
    }

    const now = new Date().toISOString();
    const updatedPreferences = {
      ...profile.preferences,
      ...cleanPrefs,
    };

    await getUserRef(uid).update({
      preferences: updatedPreferences,
      updatedAt: now,
    });

    return {
      ...profile,
      preferences: updatedPreferences,
      updatedAt: now,
    };
  },

  // --------------------------------------------------------------------------
  // REFLECTIONS
  // --------------------------------------------------------------------------
  async createReflection(
    uid: string,
    data: {
      title: string;
      content: string;
      idempotencyKey?: string;
    }
  ): Promise<Reflection> {
    if (!data.title || typeof data.title !== "string" || data.title.trim().length === 0) {
      throw new ValidationError("Title is required");
    }
    if (data.title.length > 200) {
      throw new ValidationError("Title must not exceed 200 characters");
    }
    if (!data.content || typeof data.content !== "string" || data.content.trim().length === 0) {
      throw new ValidationError("Content is required");
    }
    if (data.content.length > 65536) {
      throw new ValidationError("Content must not exceed 64KB (65,536 characters)");
    }

    let ref;
    if (data.idempotencyKey) {
      const safeKey = validateId(data.idempotencyKey, "idempotencyKey");
      ref = getReflectionsCol(uid).doc(safeKey);
      const existingSnap = await ref.get();
      if (existingSnap.exists) {
        // Return existing reflection on duplicate / retry request
        return existingSnap.data() as Reflection;
      }
    } else {
      ref = getReflectionsCol(uid).doc();
    }

    const now = new Date().toISOString();
    const reflection: Reflection = {
      id: ref.id,
      userId: uid,
      title: data.title.trim(),
      content: data.content.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(cleanUndefined(reflection));
    return reflection;
  },

  async getReflection(uid: string, reflectionId: string): Promise<Reflection | null> {
    const docSnap = await getReflectionRef(uid, reflectionId).get();
    if (!docSnap.exists) {
      return null;
    }
    return formatReflection(docSnap.id, uid, docSnap.data());
  },

  async listReflections(
    uid: string,
    limitCount = 20,
    cursor?: string
  ): Promise<{ reflections: Reflection[]; nextCursor?: string }> {
    const boundLimit = Math.min(Math.max(1, limitCount), 50);
    let query = getReflectionsCol(uid)
      .orderBy("createdAt", "desc")
      .limit(boundLimit + 1);

    if (cursor) {
      const cursorDoc = await getReflectionRef(uid, cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    const docs = snapshot.docs;
    const hasMore = docs.length > boundLimit;
    const resultDocs = hasMore ? docs.slice(0, boundLimit) : docs;

    const reflections = resultDocs.map((doc) => formatReflection(doc.id, uid, doc.data()));
    const nextCursor = hasMore ? resultDocs[resultDocs.length - 1].id : undefined;

    return { reflections, nextCursor };
  },

  async updateReflection(
    uid: string,
    reflectionId: string,
    data: {
      title?: string;
      content?: string;
      summary?: string;
      keyThemes?: string[];
    }
  ): Promise<Reflection> {
    const existing = await this.getReflection(uid, reflectionId);
    if (!existing) {
      throw new NotFoundError("Reflection not found");
    }

    const updates: Partial<Reflection> = {
      updatedAt: new Date().toISOString(),
    };

    if (data.title !== undefined) {
      if (typeof data.title !== "string" || data.title.trim().length === 0) {
        throw new ValidationError("Title cannot be empty");
      }
      if (data.title.length > 200) {
        throw new ValidationError("Title must not exceed 200 characters");
      }
      updates.title = data.title.trim();
    }

    if (data.content !== undefined) {
      if (typeof data.content !== "string" || data.content.trim().length === 0) {
        throw new ValidationError("Content cannot be empty");
      }
      if (data.content.length > 50000) {
        throw new ValidationError("Content must not exceed 50,000 characters");
      }
      updates.content = data.content.trim();
    }

    if (data.summary !== undefined) {
      updates.summary = String(data.summary).slice(0, 2000);
    }

    if (data.keyThemes !== undefined) {
      updates.keyThemes = Array.isArray(data.keyThemes)
        ? data.keyThemes.slice(0, 10).map((t) => String(t).slice(0, 50))
        : [];
    }

    await getReflectionRef(uid, reflectionId).update(cleanUndefined(updates));
    return { ...existing, ...updates };
  },

  async deleteReflection(uid: string, reflectionId: string): Promise<boolean> {
    const ref = getReflectionRef(uid, reflectionId);
    const snap = await ref.get();
    if (!snap.exists) {
      return false;
    }
    await ref.delete();
    return true;
  },

  // --------------------------------------------------------------------------
  // STAGE 2B: CONVERSATIONS
  // --------------------------------------------------------------------------
  async createConversation(
    uid: string,
    data: {
      title: string;
      mode: ConversationMode;
      associatedReflectionId?: string | null;
      messages?: Message[];
      lastIdempotencyKey?: string;
    }
  ): Promise<Conversation> {
    if (!data.title || typeof data.title !== "string" || data.title.trim().length === 0) {
      throw new ValidationError("Conversation title is required");
    }
    if (data.title.length > 200) {
      throw new ValidationError("Title must not exceed 200 characters");
    }

    const validModes: ConversationMode[] = ["reflect", "brainstorm", "clarify", "decide"];
    if (!data.mode || !validModes.includes(data.mode)) {
      throw new ValidationError("Valid mode (reflect, brainstorm, clarify, decide) is required");
    }

    const now = new Date().toISOString();
    const ref = getConversationsCol(uid).doc();
    const conversation: Conversation = {
      id: ref.id,
      userId: uid,
      title: data.title.trim(),
      mode: data.mode,
      associatedReflectionId: data.associatedReflectionId
        ? validateId(data.associatedReflectionId, "associatedReflectionId")
        : null,
      messages: Array.isArray(data.messages) ? data.messages.slice(0, 100) : [],
      lastIdempotencyKey: data.lastIdempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(cleanUndefined(conversation));
    return conversation;
  },

  async getConversation(uid: string, conversationId: string): Promise<Conversation | null> {
    const validId = validateId(conversationId, "conversationId");
    const docSnap = await getConversationRef(uid, validId).get();
    if (!docSnap.exists) {
      return null;
    }
    return docSnap.data() as Conversation;
  },

  async appendTurn(
    uid: string,
    conversationId: string,
    userMessage: Message,
    modelMessage: Message,
    idempotencyKey?: string
  ): Promise<Conversation> {
    const existing = await this.getConversation(uid, conversationId);
    if (!existing) {
      throw new NotFoundError("Conversation not found");
    }

    // Idempotency defense: If the key matches the last saved key and the last user message matches,
    // return existing conversation without adding duplicate messages
    if (
      idempotencyKey &&
      existing.lastIdempotencyKey === idempotencyKey &&
      existing.messages.length >= 2
    ) {
      const lastUserMsg = existing.messages[existing.messages.length - 2];
      if (lastUserMsg && lastUserMsg.content === userMessage.content) {
        return existing;
      }
    }

    const updatedMessages = [
      ...existing.messages,
      userMessage,
      modelMessage,
    ].slice(-100); // Cap conversation length to prevent unbounded growth

    const now = new Date().toISOString();
    const updates: Partial<Conversation> = {
      messages: updatedMessages,
      lastIdempotencyKey: idempotencyKey || existing.lastIdempotencyKey,
      updatedAt: now,
    };

    await getConversationRef(uid, conversationId).update(cleanUndefined(updates));
    return { ...existing, ...updates };
  },

  async listConversations(
    uid: string,
    limit = 20,
    cursor?: string
  ): Promise<{ conversations: Conversation[]; nextCursor?: string }> {
    const safeLimit = Math.min(Math.max(1, limit), 50);
    let query = getConversationsCol(uid)
      .orderBy("updatedAt", "desc")
      .limit(safeLimit + 1);

    if (cursor) {
      const cursorDoc = await getConversationRef(uid, cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > safeLimit;
    const docs = hasMore ? snapshot.docs.slice(0, safeLimit) : snapshot.docs;

    const conversations = docs.map((doc) => doc.data() as Conversation);
    const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : undefined;

    return { conversations, nextCursor };
  },

  async deleteConversation(uid: string, conversationId: string): Promise<boolean> {
    const ref = getConversationRef(uid, conversationId);
    const snap = await ref.get();
    if (!snap.exists) {
      return false;
    }
    await ref.delete();
    return true;
  },

  // --------------------------------------------------------------------------
  // DECISIONS
  // --------------------------------------------------------------------------
  async createDecision(
    uid: string,
    data: {
      title: string;
      context: string;
      options: DecisionOption[];
      status?: DecisionStatus;
      chosenOption?: string | null;
      revisitDate?: string | null;
    }
  ): Promise<Decision> {
    if (!data.title || typeof data.title !== "string" || data.title.trim().length === 0) {
      throw new ValidationError("Decision title is required");
    }
    if (data.title.length > 200) {
      throw new ValidationError("Decision title must not exceed 200 characters");
    }
    if (!data.context || typeof data.context !== "string") {
      throw new ValidationError("Decision context is required");
    }
    if (data.context.length > 10000) {
      throw new ValidationError("Context must not exceed 10,000 characters");
    }
    if (!Array.isArray(data.options) || data.options.length === 0) {
      throw new ValidationError("At least one decision option is required");
    }

    const validStatuses: DecisionStatus[] = ["deliberating", "decided", "revisiting"];
    const status: DecisionStatus = data.status && validStatuses.includes(data.status)
      ? data.status
      : "deliberating";

    const now = new Date().toISOString();
    const ref = getDecisionsCol(uid).doc();
    const decision: Decision = {
      id: ref.id,
      userId: uid,
      title: data.title.trim(),
      context: data.context.trim(),
      options: data.options.slice(0, 10).map((opt) => ({
        name: String(opt.name || "").slice(0, 100),
        pros: Array.isArray(opt.pros) ? opt.pros.slice(0, 10).map((p) => String(p).slice(0, 200)) : [],
        cons: Array.isArray(opt.cons) ? opt.cons.slice(0, 10).map((c) => String(c).slice(0, 200)) : [],
      })),
      status,
      chosenOption: data.chosenOption ? String(data.chosenOption).slice(0, 100) : null,
      revisitDate: data.revisitDate ? String(data.revisitDate).slice(0, 50) : null,
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(cleanUndefined(decision));
    return decision;
  },

  async getDecision(uid: string, decisionId: string): Promise<Decision | null> {
    const docSnap = await getDecisionRef(uid, decisionId).get();
    if (!docSnap.exists) {
      return null;
    }
    return docSnap.data() as Decision;
  },

  async updateDecision(
    uid: string,
    decisionId: string,
    data: {
      title?: string;
      context?: string;
      options?: DecisionOption[];
      status?: DecisionStatus;
      chosenOption?: string | null;
      revisitDate?: string | null;
      revisitReflection?: string | null;
    }
  ): Promise<Decision> {
    const existing = await this.getDecision(uid, decisionId);
    if (!existing) {
      throw new NotFoundError("Decision not found");
    }

    const updates: Partial<Decision> = {
      updatedAt: new Date().toISOString(),
    };

    if (data.title !== undefined) {
      if (typeof data.title !== "string" || data.title.trim().length === 0) {
        throw new ValidationError("Title cannot be empty");
      }
      updates.title = data.title.trim().slice(0, 200);
    }

    if (data.context !== undefined) {
      updates.context = String(data.context).slice(0, 10000);
    }

    if (data.options !== undefined) {
      if (!Array.isArray(data.options)) {
        throw new ValidationError("Options must be an array");
      }
      updates.options = data.options.slice(0, 10).map((opt) => ({
        name: String(opt.name || "").slice(0, 100),
        pros: Array.isArray(opt.pros) ? opt.pros.slice(0, 10).map((p) => String(p).slice(0, 200)) : [],
        cons: Array.isArray(opt.cons) ? opt.cons.slice(0, 10).map((c) => String(c).slice(0, 200)) : [],
      }));
    }

    if (data.status !== undefined) {
      const validStatuses: DecisionStatus[] = ["deliberating", "decided", "revisiting"];
      if (!validStatuses.includes(data.status)) {
        throw new ValidationError("Invalid status value");
      }
      updates.status = data.status;
    }

    if (data.chosenOption !== undefined) {
      updates.chosenOption = data.chosenOption ? String(data.chosenOption).slice(0, 100) : null;
    }

    if (data.revisitDate !== undefined) {
      updates.revisitDate = data.revisitDate ? String(data.revisitDate).slice(0, 50) : null;
    }

    if (data.revisitReflection !== undefined) {
      updates.revisitReflection = data.revisitReflection
        ? String(data.revisitReflection).slice(0, 5000)
        : null;
    }

    await getDecisionRef(uid, decisionId).update(cleanUndefined(updates));
    return { ...existing, ...updates };
  },

  async listDecisions(uid: string, limitCount = 20): Promise<Decision[]> {
    const boundLimit = Math.min(Math.max(1, limitCount), 50);
    const snapshot = await getDecisionsCol(uid)
      .orderBy("updatedAt", "desc")
      .limit(boundLimit)
      .get();
    return snapshot.docs.map((doc) => doc.data() as Decision);
  },

  // --------------------------------------------------------------------------
  // DERIVED RESOURCES (READ-ONLY ACCESS FOR CLIENTS)
  // --------------------------------------------------------------------------
  async getThread(uid: string, threadId: string): Promise<LifeThread | null> {
    const docSnap = await getThreadRef(uid, threadId).get();
    if (!docSnap.exists) {
      return null;
    }
    return docSnap.data() as LifeThread;
  },

  async listThreads(uid: string, limitCount = 20): Promise<LifeThread[]> {
    const boundLimit = Math.min(Math.max(1, limitCount), 50);
    const snapshot = await getThreadsCol(uid)
      .orderBy("updatedAt", "desc")
      .limit(boundLimit)
      .get();
    return snapshot.docs.map((doc) => doc.data() as LifeThread);
  },

  async upsertThread(uid: string, thread: LifeThread): Promise<LifeThread> {
    const validUid = validateId(uid, "UID");
    const threadId = validateId(thread.id, "threadId");
    const ref = getThreadRef(validUid, threadId);

    const existingSnap = await ref.get();
    const now = new Date().toISOString();

    let toSave: LifeThread;
    if (existingSnap.exists) {
      const existing = existingSnap.data() as LifeThread;
      toSave = {
        ...thread,
        userId: validUid,
        createdAt: existing.createdAt || thread.createdAt || now,
        updatedAt: now,
      };
    } else {
      toSave = {
        ...thread,
        userId: validUid,
        createdAt: thread.createdAt || now,
        updatedAt: now,
      };
    }

    await ref.set(cleanUndefined(toSave));
    return toSave;
  },

  async batchUpsertThreads(uid: string, threads: LifeThread[]): Promise<LifeThread[]> {
    const saved: LifeThread[] = [];
    for (const t of threads) {
      const res = await this.upsertThread(uid, t);
      saved.push(res);
    }
    return saved;
  },

  async getInsight(uid: string, insightId: string): Promise<Insight | null> {
    const docSnap = await getInsightRef(uid, insightId).get();
    if (!docSnap.exists) {
      return null;
    }
    return docSnap.data() as Insight;
  },

  async listInsights(uid: string, limitCount = 20): Promise<Insight[]> {
    const boundLimit = Math.min(Math.max(1, limitCount), 50);
    const snapshot = await getInsightsCol(uid)
      .orderBy("createdAt", "desc")
      .limit(boundLimit)
      .get();
    return snapshot.docs.map((doc) => doc.data() as Insight);
  },

  async getWeeklyReview(uid: string, reviewId: string): Promise<WeeklyReview | null> {
    const docSnap = await getWeeklyReviewRef(uid, reviewId).get();
    if (!docSnap.exists) {
      return null;
    }
    return docSnap.data() as WeeklyReview;
  },

  async listWeeklyReviews(uid: string, limitCount = 20): Promise<WeeklyReview[]> {
    const boundLimit = Math.min(Math.max(1, limitCount), 50);
    const snapshot = await getWeeklyReviewsCol(uid)
      .orderBy("createdAt", "desc")
      .limit(boundLimit)
      .get();
    return snapshot.docs.map((doc) => doc.data() as WeeklyReview);
  },
};
