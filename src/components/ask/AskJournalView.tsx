import React, { useState } from "react";
import {
  Search,
  BookOpen,
  Calendar,
  Sparkles,
  Quote,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
} from "lucide-react";
import type { AskJournalResult, AskJournalEvidence } from "../../types/journal";
import { askJournal } from "../../services/apiClient";
import { ReflectionDetailModal } from "../journal/ReflectionDetailModal";

const STARTER_QUESTIONS = [
  "What keeps coming up?",
  "What have I changed my mind about?",
  "What am I avoiding?",
  "What did I decide?",
  "When did I feel most confident about a decision?",
  "What recurring doubts or hesitations have I written about?",
];

export const AskJournalView: React.FC = () => {
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AskJournalResult | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Optional date filter toggle
  const [showDateFilter, setShowDateFilter] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Reflection inspection modal
  const [selectedReflectionId, setSelectedReflectionId] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);

    const timeRange =
      startDate || endDate
        ? {
            start: startDate ? new Date(startDate).toISOString() : undefined,
            end: endDate ? new Date(endDate).toISOString() : undefined,
          }
        : undefined;

    try {
      const res = await askJournal(query.trim(), timeRange);
      setResult(res.data);
      setLastQuery(query.trim());
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete journal inquiry at this time. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSampleClick = (sample: string) => {
    setQuery(sample);
  };

  return (
    <div id="ask-journal-container" className="max-w-4xl mx-auto space-y-10 py-2">
      {/* View Header */}
      <div className="border-b border-stone-200/80 pb-6">
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-900 border border-indigo-200/80">
            Natural-Language Retrieval
          </span>
          <span className="text-xs text-stone-500">• Searching Yourself</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-1 font-normal tracking-tight">
          Your own thoughts, answered.
        </h2>
        <p className="text-sm text-stone-600 mt-0.5 max-w-2xl leading-relaxed font-normal">
          Inquire into your reflection history. Answers are grounded strictly in your personal writings,
          with explicit evidence citations and a clear distinction between what your journal recorded and Gemini's interpretation.
        </p>
      </div>

      {/* Query Formulation Card */}
      <div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              id="ask-journal-query-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What question are you asking your journal today? e.g. What keeps coming up when I make big choices?"
              rows={3}
              maxLength={1000}
              className="w-full px-5 py-4 text-base text-stone-900 placeholder:text-stone-400 bg-stone-50/50 border border-stone-200/80 rounded-2xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 transition-all resize-none leading-relaxed font-normal"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-stone-400 px-1">
              <span>{query.length} / 1000 characters</span>
              <button
                type="button"
                onClick={() => setShowDateFilter(!showDateFilter)}
                className="text-xs font-medium text-stone-600 hover:text-stone-900 flex items-center space-x-1 cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5 text-stone-500" />
                <span>{showDateFilter ? "Hide Date Range" : "Filter by Date Range"}</span>
              </button>
            </div>
          </div>

          {/* Optional Date Range Filter */}
          {showDateFilter && (
            <div className="p-4 bg-stone-50/80 rounded-2xl border border-stone-200/80 flex flex-col sm:flex-row items-center gap-3 text-xs">
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <span className="text-stone-500 font-medium">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-stone-800 text-xs focus:outline-hidden focus:border-stone-400"
                />
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <span className="text-stone-500 font-medium">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-stone-800 text-xs focus:outline-hidden focus:border-stone-400"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="text-xs text-stone-500 hover:text-stone-800 underline ml-auto cursor-pointer"
                >
                  Clear dates
                </button>
              )}
            </div>
          )}

          {/* Submit Button & Inspiration */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <div className="flex items-center space-x-1.5 text-xs text-stone-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Private • Isolated strictly to your authenticated records.</span>
            </div>

            <button
              id="btn-ask-journal-submit"
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-2xl bg-stone-900 text-white hover:bg-stone-800 active:scale-[0.98] transition-all text-sm font-medium shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Searching your reflections…</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 text-amber-300" />
                  <span>Search Reflections</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Suggested Queries */}
        <div className="pt-4 border-t border-stone-100">
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-2.5">
            Starter Inquiries:
          </span>
          <div className="flex flex-wrap gap-2">
            {STARTER_QUESTIONS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => handleSampleClick(sample)}
                className="text-xs px-3.5 py-1.5 rounded-full bg-stone-100/80 hover:bg-stone-200/70 text-stone-700 transition-colors text-left cursor-pointer border border-stone-200/60"
              >
                "{sample}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs sm:text-sm text-rose-900 flex items-start space-x-3">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Unable to complete inquiry</p>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="p-10 border border-stone-200/80 rounded-3xl bg-white shadow-xs space-y-4 text-center">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mx-auto animate-pulse">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h4 className="text-sm font-medium text-stone-800">
              Examining journal entries for evidence…
            </h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Retrieving relevant reflections, isolating direct evidence citations, and framing longitudinal insight.
            </p>
          </div>
        </div>
      )}

      {/* Results Display */}
      {!loading && result && (
        <div id="ask-journal-result-container" className="space-y-6 animate-fadeIn">
          {/* Query Recap */}
          <div className="text-xs text-stone-500 flex items-center space-x-2 px-1">
            <span className="font-medium uppercase tracking-wider text-[10px] text-stone-400">Inquiry:</span>
            <span className="font-normal text-stone-800 italic">"{lastQuery}"</span>
          </div>

          {/* Section 1: DIRECT ANSWER */}
          <div
            id="ask-journal-answer-section"
            className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-stone-900" />
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-800">
                  ANSWER
                </span>
              </div>
              <span className="text-[11px] text-stone-400">
                {result.sufficientEvidenceFound
                  ? "✓ Grounded in factual records"
                  : "Insufficient evidence found in entries"}
              </span>
            </div>

            <p className="font-serif text-lg sm:text-xl text-stone-900 leading-relaxed font-normal">
              {result.directAnswer}
            </p>
          </div>

          {/* Section 2: EVIDENCE (Supporting Entries with Quotes) */}
          <div
            id="ask-journal-evidence-section"
            className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center space-x-2">
                <Quote className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-800">
                  EVIDENCE ({result.evidence.length} {result.evidence.length === 1 ? "Citation" : "Citations"})
                </span>
              </div>
              <span className="text-xs text-stone-400">Click card to open full entry</span>
            </div>

            {result.evidence.length === 0 ? (
              <p className="text-xs text-stone-500 italic py-2">
                No direct citations or matching excerpts found for this specific inquiry.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {result.evidence.map((ev) => (
                  <div
                    key={ev.entryId}
                    onClick={() => setSelectedReflectionId(ev.entryId)}
                    className="cursor-pointer p-5 rounded-2xl bg-stone-50/60 hover:bg-emerald-50/20 border border-stone-200/80 hover:border-emerald-300 transition-all flex flex-col justify-between group shadow-2xs"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-900 group-hover:text-emerald-950 truncate max-w-[180px]">
                          {ev.title || "Reflection"}
                        </span>
                        <div className="flex items-center space-x-1 text-stone-400 group-hover:text-emerald-700">
                          <span>{new Date(ev.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      <blockquote className="text-xs text-stone-600 italic border-l-2 border-emerald-300 pl-2.5 py-0.5 leading-relaxed">
                        "{ev.quote}"
                      </blockquote>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-stone-200/60 flex items-center justify-end text-[11px] text-stone-600 group-hover:text-stone-950 font-medium">
                      <span>Open Entry &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: GEMINI INTERPRETATION (Distinguished Synthesis) */}
          <div
            id="ask-journal-interpretation-section"
            className="bg-amber-50/50 border border-amber-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-amber-200/60">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-200 text-amber-900">
                  ✦ GEMINI INTERPRETATION
                </span>
                <span className="text-xs text-amber-900 font-medium">Longitudinal Synthesis</span>
              </div>
              <span className="text-[11px] text-amber-700 hidden sm:inline">
                Analytical inference • Not raw journal text
              </span>
            </div>

            <p className="text-sm text-stone-800 leading-relaxed font-normal">
              {result.interpretation ||
                "No additional longitudinal interpretation required for this factual retrieval."}
            </p>
          </div>
        </div>
      )}

      {/* Reflection Detail Modal */}
      {selectedReflectionId && (
        <ReflectionDetailModal
          reflectionId={selectedReflectionId}
          onClose={() => setSelectedReflectionId(null)}
          onDeleted={() => setSelectedReflectionId(null)}
        />
      )}
    </div>
  );
};
