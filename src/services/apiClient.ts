import { auth } from "../lib/firebase";
import type { Conversation, ConversationMode, Message, LifeThread, AskJournalResult } from "../types/journal";

export interface ApiErrorResponse {
  status: "error";
  message: string;
}

export class ApiError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

/**
 * Reusable fetch wrapper that obtains the current short-lived Firebase ID token
 * and attaches Authorization: Bearer <Firebase_ID_TOKEN> securely.
 *
 * Security guarantees:
 * - Tokens are NEVER stored in localStorage, sessionStorage, or client cookies.
 * - Tokens are NEVER passed in URLs, queries, or error logs.
 * - Auto-refreshes token via Firebase Auth SDK if near expiry.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);

  // If auth is still resolving its initial state, await authStateReady()
  if (!auth.currentUser && typeof auth.authStateReady === "function") {
    try {
      await auth.authStateReady();
    } catch {
      // Quiet failover
    }
  }

  // Attach current short-lived ID token
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    } catch {
      // Quiet failover; server will return 401 if unauthenticated
    }
  }

  let response = await fetch(input, {
    ...init,
    headers,
  });

  // Resilient retry on 401: if token expired or was near expiry, force token refresh once
  if (response.status === 401 && auth.currentUser) {
    try {
      const freshToken = await auth.currentUser.getIdToken(true);
      if (freshToken) {
        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set("Authorization", `Bearer ${freshToken}`);
        response = await fetch(input, {
          ...init,
          headers: retryHeaders,
        });
      }
    } catch {
      // Return original response
    }
  }

  return response;
}

/**
 * Safe JSON GET request against authenticated /api/* endpoints.
 */
export async function apiGet<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(endpoint, {
    method: "GET",
    ...options,
  });

  if (!response.ok) {
    let errorMessage = "Request failed";
    try {
      const errJson = (await response.json()) as ApiErrorResponse;
      if (errJson.message) {
        errorMessage = errJson.message;
      }
    } catch {
      errorMessage = `Server returned status ${response.status}`;
    }
    throw new ApiError(errorMessage, response.status);
  }

  return (await response.json()) as T;
}

/**
 * Safe JSON POST request against authenticated /api/* endpoints.
 */
export async function apiPost<T>(
  endpoint: string,
  body?: unknown,
  options?: RequestInit
): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");

  const response = await authenticatedFetch(endpoint, {
    ...options,
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorMessage = "Request failed";
    try {
      const errJson = (await response.json()) as ApiErrorResponse;
      if (errJson.message) {
        errorMessage = errJson.message;
      }
    } catch {
      errorMessage = `Server returned status ${response.status}`;
    }
    throw new ApiError(errorMessage, response.status);
  }

  return (await response.json()) as T;
}

/**
 * Safe JSON DELETE request against authenticated /api/* endpoints.
 */
export async function apiDelete<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(endpoint, {
    method: "DELETE",
    ...options,
  });

  if (!response.ok) {
    let errorMessage = "Request failed";
    try {
      const errJson = (await response.json()) as ApiErrorResponse;
      if (errJson.message) {
        errorMessage = errJson.message;
      }
    } catch {
      errorMessage = `Server returned status ${response.status}`;
    }
    throw new ApiError(errorMessage, response.status);
  }

  return (await response.json()) as T;
}

/**
 * Stage 2A: Reflection domain types & client API functions
 */
export interface ReflectionItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListReflectionsResponse {
  status: "success";
  reflections: ReflectionItem[];
  nextCursor?: string;
}

export interface ReflectionResponse {
  status: "success";
  reflection: ReflectionItem;
}

export interface DeleteReflectionResponse {
  status: "success";
  message: string;
}

export async function createReflection(
  title: string,
  content: string,
  idempotencyKey?: string
): Promise<ReflectionResponse> {
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  const payload: { title: string; content: string; idempotencyKey?: string } = {
    title: trimmedTitle,
    content: trimmedContent,
  };
  if (idempotencyKey) {
    payload.idempotencyKey = idempotencyKey;
  }
  return apiPost<ReflectionResponse>(
    "/api/reflections",
    payload,
    { headers }
  );
}

export async function listReflections(
  limit: number = 20,
  cursor?: string
): Promise<ListReflectionsResponse> {
  let url = `/api/reflections?limit=${encodeURIComponent(limit)}`;
  if (cursor) {
    url += `&cursor=${encodeURIComponent(cursor)}`;
  }
  return apiGet<ListReflectionsResponse>(url);
}

export async function getReflection(id: string): Promise<ReflectionResponse> {
  return apiGet<ReflectionResponse>(`/api/reflections/${encodeURIComponent(id)}`);
}

export async function deleteReflection(id: string): Promise<DeleteReflectionResponse> {
  return apiDelete<DeleteReflectionResponse>(`/api/reflections/${encodeURIComponent(id)}`);
}

/**
 * Stage 2B: Conversation domain types & client API functions
 */
export interface SendConversationParams {
  conversationId?: string;
  message: string;
  mode: ConversationMode;
  title?: string;
  associatedReflectionId?: string | null;
  idempotencyKey?: string;
}

export interface SendConversationResponse {
  status: "success";
  conversationId: string;
  message: Message;
  conversation: Conversation;
}

export interface ListConversationsResponse {
  status: "success";
  conversations: Conversation[];
  nextCursor?: string;
}

export interface GetConversationResponse {
  status: "success";
  conversation: Conversation;
}

export interface DeleteConversationResponse {
  status: "success";
  message: string;
}

export async function sendConversationMessage(
  params: SendConversationParams
): Promise<SendConversationResponse> {
  const headers: Record<string, string> = {};
  if (params.idempotencyKey) {
    headers["Idempotency-Key"] = params.idempotencyKey;
  }
  return apiPost<SendConversationResponse>(
    "/api/conversations",
    params,
    { headers }
  );
}

export async function listConversations(
  limit: number = 20,
  cursor?: string
): Promise<ListConversationsResponse> {
  let url = `/api/conversations?limit=${encodeURIComponent(limit)}`;
  if (cursor) {
    url += `&cursor=${encodeURIComponent(cursor)}`;
  }
  return apiGet<ListConversationsResponse>(url);
}

export async function getConversation(id: string): Promise<GetConversationResponse> {
  return apiGet<GetConversationResponse>(`/api/conversations/${encodeURIComponent(id)}`);
}

export async function deleteConversation(id: string): Promise<DeleteConversationResponse> {
  return apiDelete<DeleteConversationResponse>(`/api/conversations/${encodeURIComponent(id)}`);
}

/**
 * Verifies the Cloud Run authentication boundary by invoking GET /api/auth-check.
 */
export async function verifyServerAuthBoundary(): Promise<{
  authenticated: boolean;
  uid: string;
  provider?: string;
}> {
  return apiGet<{ authenticated: boolean; uid: string; provider?: string }>("/api/auth-check");
}

export interface DataCheckResponse {
  status: "success";
  authenticated: boolean;
  uid: string;
  hasProfile: boolean;
  initialized?: boolean;
  profile: {
    uid: string;
    createdAt: string;
    updatedAt: string;
    preferences: {
      reflectionReminders?: boolean;
      weeklyReviewDay?: "sunday" | "monday" | "friday";
    };
  };
}

/**
 * Verifies the authoritative server-side Firestore boundary by invoking GET /api/data-check.
 * Accesses only the authenticated user's isolated profile document through the Cloud Run backend.
 */
export async function verifyFirestoreDataBoundary(): Promise<DataCheckResponse> {
  return apiGet<DataCheckResponse>("/api/data-check");
}

export interface SecretCheckResponse {
  status: "success";
  configured: boolean;
  source: "secret-manager" | "env" | "unconfigured";
  pinnedVersion?: string;
  timestamp: string;
}

/**
 * Stage 1E: Checks secret configuration boundary on the server.
 * Never receives, requests, or logs the actual secret payload.
 */
export async function verifySecretBoundary(): Promise<SecretCheckResponse> {
  return apiGet<SecretCheckResponse>("/api/secret-check");
}

/**
 * Longitudinal Intelligence: Life Threads client API methods
 */
export interface DiscoverThreadsResponse {
  status: "success";
  threads: LifeThread[];
  count: number;
  message?: string;
}

export interface ListThreadsResponse {
  status: "success";
  threads: LifeThread[];
}

export async function discoverLifeThreads(): Promise<DiscoverThreadsResponse> {
  return apiPost<DiscoverThreadsResponse>("/api/threads/discover", {});
}

export async function getLifeThreads(limit = 20): Promise<ListThreadsResponse> {
  return apiGet<ListThreadsResponse>(`/api/threads?limit=${limit}`);
}

/**
 * Longitudinal Intelligence: Ask My Journal client API methods
 */
export interface AskJournalApiResponse {
  status: "success";
  data: AskJournalResult;
}

export async function askJournal(
  query: string,
  timeRange?: { start?: string; end?: string }
): Promise<AskJournalApiResponse> {
  return apiPost<AskJournalApiResponse>("/api/ask-journal", { query, timeRange });
}

