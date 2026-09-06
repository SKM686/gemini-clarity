import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Calendar,
  Clock,
  Trash2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
  PenLine,
  GitCommit,
  Search,
  Sparkles,
} from "lucide-react";
import {
  listReflections,
  deleteReflection,
  ReflectionItem,
} from "../../services/apiClient";
import { useAuth } from "../../context/AuthContext";
import { ReflectionDetailModal } from "./ReflectionDetailModal";

interface ReflectionHistoryProps {
  onStartNew: () => void;
  onNavigateToThreads?: () => void;
  onNavigateToAsk?: () => void;
  refreshTrigger?: number;
}

export const ReflectionHistory: React.FC<ReflectionHistoryProps> = ({
  onStartNew,
  onNavigateToThreads,
  onNavigateToAsk,
  refreshTrigger = 0,
}) => {
  const { user, loading: authLoading } = useAuth();
  const [reflections, setReflections] = useState<ReflectionItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected reflection for detail view
  const [selectedReflectionId, setSelectedReflectionId] = useState<string | null>(null);

  // In-line delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchReflections = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await listReflections(15);
      setReflections(res.reflections);
      setNextCursor(res.nextCursor);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load reflections from server"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wait until Firebase Auth has resolved before issuing request
    if (authLoading) {
      setLoading(true);
      return;
    }

    // When signed out, securely clear in-memory reflections
    if (!user) {
      setReflections([]);
      setNextCursor(undefined);
      setError(null);
      setLoading(false);
      return;
    }

    // User is authenticated: load reflection history
    fetchReflections(true);
  }, [user?.uid, authLoading, fetchReflections, refreshTrigger]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await listReflections(15, nextCursor);
      setReflections((prev) => [...prev, ...res.reflections]);
      setNextCursor(res.nextCursor);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load more reflections"
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteReflection(id);
      setReflections((prev) => prev.filter((r) => r.id !== id));
      setConfirmDeleteId(null);
      if (selectedReflectionId === id) {
        setSelectedReflectionId(null);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete reflection");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div id="reflection-history-section" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/80">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-serif text-stone-900 font-normal tracking-tight">
              Journal Reflections
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 font-medium border border-stone-200/60">
              {reflections.length} {reflections.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 font-normal">
            A chronological personal archive of your reflections, questions, and decisions.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="btn-refresh-history"
            type="button"
            onClick={() => fetchReflections(true)}
            disabled={loading}
            className="p-2 text-stone-500 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
            title="Refresh reflections"
            aria-label="Refresh reflections"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-stone-400" : ""}`} />
          </button>

          <button
            id="btn-new-reflection"
            type="button"
            onClick={onStartNew}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition-all shadow-xs cursor-pointer active:scale-98"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New Reflection</span>
          </button>
        </div>
      </div>

      {/* Longitudinal Intelligence Quick Access Cards */}
      {(onNavigateToThreads || onNavigateToAsk) && reflections.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {onNavigateToThreads && (
            <div
              id="dashboard-threads-card"
              onClick={onNavigateToThreads}
              className="p-4 rounded-xl bg-stone-50/80 hover:bg-emerald-50/40 border border-stone-200/80 hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center space-x-2 text-xs text-stone-500 mb-1">
                  <GitCommit className="w-4 h-4 text-emerald-600 group-hover:scale-105 transition-transform" />
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-stone-600">
                    Life Threads
                  </span>
                </div>
                <h4 className="text-sm font-medium text-stone-900 group-hover:text-emerald-900 transition-colors">
                  Synthesize Themes Across Time
                </h4>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Discover how your thoughts connect, what stayed consistent, and what changed across entries.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-end text-xs font-medium text-emerald-700">
                <span>Explore Threads →</span>
              </div>
            </div>
          )}

          {onNavigateToAsk && (
            <div
              id="dashboard-ask-card"
              onClick={onNavigateToAsk}
              className="p-4 rounded-xl bg-stone-50/80 hover:bg-indigo-50/40 border border-stone-200/80 hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center space-x-2 text-xs text-stone-500 mb-1">
                  <Search className="w-4 h-4 text-indigo-600 group-hover:scale-105 transition-transform" />
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-stone-600">
                    Ask My Journal
                  </span>
                </div>
                <h4 className="text-sm font-medium text-stone-900 group-hover:text-indigo-900 transition-colors">
                  Grounded Natural Q&A
                </h4>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Inquire into past decisions, doubts, or reflections with verified quotes and Gemini analysis.
                </p>
              </div>
              <div className="mt-3 flex items-center justify-end text-xs font-medium text-indigo-700">
                <span>Ask Question →</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          id="history-error-banner"
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start space-x-2.5 text-xs"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold">Unable to fetch reflection history</p>
            <p className="text-rose-800 mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchReflections(true)}
            className="text-xs font-semibold text-rose-700 underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 text-stone-500 text-sm">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" aria-hidden="true" />
          <p>Retrieving your reflections...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && reflections.length === 0 && (
        <div
          id="empty-reflections-card"
          className="bg-white border border-stone-200/90 rounded-3xl p-10 sm:p-14 text-center space-y-4 shadow-xs"
        >
          <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto text-stone-500">
            <BookOpen className="w-6 h-6 text-stone-600" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-xl font-serif font-normal text-stone-900">
              No reflections yet
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Begin your personal archive with a quiet thought, dilemma, or observation. Everything you write is cryptographically isolated to your private account.
            </p>
          </div>
          <button
            id="btn-empty-start-reflection"
            type="button"
            onClick={onStartNew}
            className="inline-flex items-center space-x-1.5 px-5 py-2.5 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-2xl transition-all shadow-xs cursor-pointer active:scale-98"
          >
            <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Write First Reflection</span>
          </button>
        </div>
      )}

      {/* Populated List */}
      {!loading && reflections.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {reflections.map((ref) => {
            const dateStr = new Date(ref.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const timeStr = new Date(ref.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            const preview =
              ref.content.length > 200
                ? `${ref.content.slice(0, 200)}…`
                : ref.content;

            const isConfirming = confirmDeleteId === ref.id;
            const isDeleting = deletingId === ref.id;

            return (
              <div
                key={ref.id}
                id={`reflection-card-${ref.id}`}
                onClick={() => setSelectedReflectionId(ref.id)}
                className="group bg-white hover:bg-stone-50/70 border border-stone-200/90 hover:border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-serif font-normal text-stone-900 group-hover:text-stone-950 truncate">
                      {ref.title}
                    </h3>
                    <div className="flex items-center space-x-2 text-[11px] text-stone-500 font-normal">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-stone-400" />
                        <span>{dateStr}</span>
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-stone-400" />
                        <span>{timeStr}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center space-x-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isConfirming ? (
                      <div className="flex items-center space-x-1 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg text-xs">
                        <span className="text-[11px] text-rose-800 font-medium">Delete?</span>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(ref.id, e)}
                          disabled={isDeleting}
                          className="text-rose-700 hover:text-rose-950 font-bold px-1"
                        >
                          {isDeleting ? "…" : "Yes"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="text-stone-500 hover:text-stone-800 px-1"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(ref.id);
                        }}
                        className="p-1.5 text-stone-300 hover:text-rose-600 rounded-lg hover:bg-stone-100 transition-colors"
                        title="Delete reflection"
                        aria-label={`Delete ${ref.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-500 transition-colors" />
                  </div>
                </div>

                {/* Content preview */}
                <p className="text-xs text-stone-600 leading-relaxed line-clamp-2">
                  {preview}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination / Load More */}
      {nextCursor && (
        <div className="pt-2 flex justify-center">
          <button
            id="btn-load-more-reflections"
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading older reflections…</span>
              </>
            ) : (
              <span>Load More Reflections</span>
            )}
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedReflectionId && (
        <ReflectionDetailModal
          reflectionId={selectedReflectionId}
          onClose={() => setSelectedReflectionId(null)}
          onDeleted={(deletedId) => {
            setReflections((prev) => prev.filter((r) => r.id !== deletedId));
            setSelectedReflectionId(null);
          }}
        />
      )}
    </div>
  );
};
