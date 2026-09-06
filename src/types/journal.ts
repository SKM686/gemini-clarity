/**
 * Gemini Clarity - Core Journal Domain Types
 * Strict type definitions for reflections, conversations, Life Threads, decisions, and weekly reviews.
 */

export interface UserPreferences {
  reflectionReminders?: boolean;
  weeklyReviewDay?: "sunday" | "monday" | "friday";
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface ReflectionSummary {
  summary: string;
  keyThemes: string[];
}

export interface Reflection {
  id: string;
  userId: string;
  title: string;
  content: string;
  summary?: string;
  keyThemes?: string[];
  createdAt: string;
  updatedAt: string;
}

export type ConversationMode = "reflect" | "brainstorm" | "clarify" | "decide";

export interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  mode: ConversationMode;
  associatedReflectionId?: string | null;
  messages: Message[];
  lastIdempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadEvidence {
  reflectionId: string;
  title: string;
  date: string;
  excerpt?: string;
}

export interface LifeThread {
  id: string;
  userId: string;
  title: string;
  themeName?: string;
  summary: string;
  narrativeSummary?: string;
  supportingReflectionIds: string[];
  evidenceList?: ThreadEvidence[];
  whatStayedConsistent: string;
  whatChanged: string;
  whatRemainsUnresolved: string;
  potentialNextStep: string;
  firstObservedAt: string;
  lastObservedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AskJournalEvidence {
  entryId: string;
  title?: string;
  quote: string;
  date: string;
}

export interface AskJournalResult {
  directAnswer: string;
  evidence: AskJournalEvidence[];
  interpretation: string;
  sufficientEvidenceFound: boolean;
}

export interface AskJournalRequest {
  query: string;
  timeRange?: {
    start?: string;
    end?: string;
  };
}

export interface Insight {
  id: string;
  userId: string;
  reflectionId?: string | null;
  title: string;
  content: string;
  keyObservations: string[];
  createdAt: string;
}

export interface DecisionOption {
  name: string;
  pros: string[];
  cons: string[];
}

export type DecisionStatus = "deliberating" | "decided" | "revisiting";

export interface Decision {
  id: string;
  userId: string;
  title: string;
  context: string;
  options: DecisionOption[];
  chosenOption?: string | null;
  status: DecisionStatus;
  revisitDate?: string | null;
  revisitReflection?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReview {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  reflectionCount: number;
  summarySynthesis: string;
  recurringThemes: string[];
  growthObservations: string[];
  supportingReflectionIds: string[];
  createdAt: string;
}

export interface ApiResponse<T> {
  status: "success" | "error";
  data?: T;
  message?: string;
}

export interface ApiError {
  status: "error";
  message: string;
  code?: string;
}
