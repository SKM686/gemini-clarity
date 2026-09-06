import { firestoreRepository, validateId } from "./firestore";
import type { Reflection } from "../../src/types/journal";

export interface BoundedReflectionContext {
  id: string;
  title: string;
  createdAt: string;
  summary?: string;
  keyThemes?: string[];
  contentExcerpt: string;
}

export interface RetrievalTimeRange {
  start?: string;
  end?: string;
}

export interface AskJournalReflectionContext {
  id: string;
  title: string;
  createdAt: string;
  content: string;
}

/**
 * Server-Side RetrievalService
 * 
 * Strict Architectural Guarantees:
 * - Operates EXCLUSIVELY on the server (Cloud Run backend).
 * - Derives user identity strictly from req.user.uid (never client-supplied parameters).
 * - Queries only user-scoped reflections subcollection: /users/{uid}/reflections.
 * - Enforces bounded retrieval ceilings (up to 25 entries) to protect memory & model token limits.
 * - Handles missing derived fields (summaries, themes) without inventing false data.
 * - Validates date ranges and sanitizes query filters.
 */
export const retrievalService = {
  /**
   * Retrieves a bounded set of recent reflections for Life Threads longitudinal analysis.
   * Capped at max 25 reflections.
   */
  async getReflectionsForThreads(
    uid: string,
    limitCount = 25
  ): Promise<BoundedReflectionContext[]> {
    const validUid = validateId(uid, "UID");
    const boundedLimit = Math.min(Math.max(1, limitCount), 25);

    const { reflections } = await firestoreRepository.listReflections(validUid, boundedLimit);

    return reflections.map((r) => {
      // Stage 2A compatibility: gracefully handle missing derived fields without inventing them
      const raw = r as unknown as Record<string, unknown>;
      const summary = typeof raw.summary === "string" && raw.summary.trim().length > 0
        ? raw.summary.trim().slice(0, 500)
        : undefined;

      const keyThemes = Array.isArray(raw.keyThemes)
        ? raw.keyThemes
            .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
            .map((t) => t.trim().slice(0, 50))
            .slice(0, 5)
        : undefined;

      // Provide bounded content excerpt (up to 350 chars) so Gemini can evaluate semantics when summaries are absent
      const contentExcerpt = r.content ? r.content.slice(0, 350).trim() : "";

      return {
        id: r.id,
        title: r.title,
        createdAt: r.createdAt,
        summary,
        keyThemes,
        contentExcerpt,
      };
    });
  },

  /**
   * Retrieves relevant reflections for Ask My Journal question answering.
   * Capped at max 25 reflections, with optional ISO date range filtering.
   */
  async getReflectionsForAskJournal(
    uid: string,
    queryText: string,
    timeRange?: RetrievalTimeRange,
    limitCount = 25
  ): Promise<AskJournalReflectionContext[]> {
    const validUid = validateId(uid, "UID");
    const boundedLimit = Math.min(Math.max(1, limitCount), 25);

    // Fetch reflections within bounds (up to 50 if date filtering in memory)
    const fetchLimit = timeRange?.start || timeRange?.end ? 50 : boundedLimit;
    const { reflections } = await firestoreRepository.listReflections(validUid, fetchLimit);

    let filtered = [...reflections];

    // Optional date range filtering with ISO format validation
    if (timeRange?.start) {
      const startTime = new Date(timeRange.start).getTime();
      if (!isNaN(startTime)) {
        filtered = filtered.filter((r) => new Date(r.createdAt).getTime() >= startTime);
      }
    }
    if (timeRange?.end) {
      const endTime = new Date(timeRange.end).getTime();
      if (!isNaN(endTime)) {
        filtered = filtered.filter((r) => new Date(r.createdAt).getTime() <= endTime);
      }
    }

    // Keyword relevance prioritization: rank reflections mentioning query terms
    const terms = queryText
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ""))
      .filter((t) => t.length > 2);

    if (terms.length > 0) {
      filtered.sort((a, b) => {
        const textA = `${a.title} ${a.content}`.toLowerCase();
        const textB = `${b.title} ${b.content}`.toLowerCase();
        const scoreA = terms.reduce((acc, term) => acc + (textA.includes(term) ? 1 : 0), 0);
        const scoreB = terms.reduce((acc, term) => acc + (textB.includes(term) ? 1 : 0), 0);
        return scoreB - scoreA;
      });
    }

    const bounded = filtered.slice(0, boundedLimit);

    return bounded.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      // Bounded to 1200 chars per reflection to ensure high signal density and prevent context saturation
      content: r.content.slice(0, 1200).trim(),
    }));
  },
};
