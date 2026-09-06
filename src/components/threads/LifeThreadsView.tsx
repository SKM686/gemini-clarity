import React, { useState, useEffect } from "react";
import {
  GitCommit,
  Sparkles,
  RefreshCw,
  Clock,
  ArrowRight,
  ChevronRight,
  Calendar,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Compass,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import type { LifeThread } from "../../types/journal";
import { getLifeThreads, discoverLifeThreads } from "../../services/apiClient";
import { ReflectionDetailModal } from "../journal/ReflectionDetailModal";
import { useAuth } from "../../context/AuthContext";

interface LifeThreadsViewProps {
  onNavigateToJournal?: () => void;
}

export const LifeThreadsView: React.FC<LifeThreadsViewProps> = ({
  onNavigateToJournal,
}) => {
  const { user, loading: authLoading } = useAuth();
  const [threads, setThreads] = useState<LifeThread[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [discovering, setDiscovering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const [selectedReflectionId, setSelectedReflectionId] = useState<string | null>(null);
  const [activeTimelineThreadId, setActiveTimelineThreadId] = useState<string | null>(null);

  // Load existing persisted threads
  const fetchThreads = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getLifeThreads(25);
      setThreads(res.threads || []);
      if (res.threads && res.threads.length > 0 && !activeTimelineThreadId) {
        setActiveTimelineThreadId(res.threads[0].id);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your life threads at this time."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!user) {
      setThreads([]);
      setLoading(false);
      return;
    }
    fetchThreads();
  }, [user?.uid, authLoading]);

  // Discover life threads using centralized Gemini service
  const handleDiscover = async () => {
    setDiscovering(true);
    setError(null);
    setDiscoveryMessage(null);
    try {
      const res = await discoverLifeThreads();
      setThreads(res.threads || []);
      if (res.message) {
        setDiscoveryMessage(res.message);
      }
      if (res.threads && res.threads.length > 0) {
        setActiveTimelineThreadId(res.threads[0].id);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to analyze life threads. Please try again."
      );
    } finally {
      setDiscovering(false);
    }
  };

  const activeThread = threads.find((t) => t.id === activeTimelineThreadId) || threads[0];

  return (
    <div id="life-threads-container" className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200/80 pb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              Life Threads
            </span>
            <span className="text-xs text-stone-500 font-medium">&bull; See how your thinking evolves.</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-1 font-normal tracking-tight">
            Life Threads
          </h2>
          <p className="text-sm text-stone-600 mt-0.5 max-w-xl font-normal">
            See how your thinking evolves. Trace why your thoughts connect across weeks and months, what perspective shifted, and what remains open.
          </p>
        </div>

        <button
          id="btn-discover-threads"
          type="button"
          onClick={handleDiscover}
          disabled={discovering || loading}
          className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-2xl bg-stone-900 text-white hover:bg-stone-800 active:scale-[0.98] transition-all text-sm font-medium shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {discovering ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-amber-300" aria-hidden="true" />
              <span>✦ Connecting thoughts across time…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" aria-hidden="true" />
              <span>Discover Life Threads</span>
            </>
          )}
        </button>
      </div>

      {/* Discovery Status / Notification */}
      {discoveryMessage && (
        <div
          id="threads-discovery-banner"
          className="p-4 bg-emerald-50/90 border border-emerald-200/90 rounded-2xl text-xs text-emerald-900 flex items-center justify-between shadow-2xs"
        >
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{discoveryMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setDiscoveryMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-medium ml-4 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div
          id="threads-error-banner"
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs sm:text-sm text-rose-900 flex items-start space-x-3"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Unable to analyze reflections</p>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={fetchThreads}
            className="text-xs font-medium text-rose-700 hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !discovering && (
        <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
          <RefreshCw className="w-6 h-6 text-stone-400 animate-spin" />
          <p className="text-xs text-stone-500 font-medium">Reconstructing your thought constellations…</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && threads.length === 0 && (
        <div
          id="threads-empty-state"
          className="p-10 sm:p-14 border border-stone-200/90 rounded-3xl bg-white text-center flex flex-col items-center max-w-xl mx-auto space-y-5 shadow-xs"
        >
          <div className="w-12 h-12 rounded-2xl bg-stone-100/80 border border-stone-200 flex items-center justify-center text-stone-700 shadow-2xs">
            <GitCommit className="w-6 h-6 text-stone-700" />
          </div>
          <div className="space-y-2">
            <h3 className="font-serif text-2xl font-normal text-stone-900">
              Your thoughts will start connecting as you reflect.
            </h3>
            <p className="text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
              Save a few reflections and Gemini can begin finding meaningful connections across them.
            </p>
          </div>
          <div className="pt-2">
            {onNavigateToJournal && (
              <button
                type="button"
                onClick={onNavigateToJournal}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer shadow-xs active:scale-98"
              >
                <span>Start a reflection</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Threads Content */}
      {!loading && threads.length > 0 && (
        <div className="space-y-8">
          {/* Thread Constellation & Chronology Explorer */}
          {activeThread && activeThread.evidenceList && activeThread.evidenceList.length >= 2 && (
            <div
              id="thread-timeline-explorer"
              className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
            >
              {/* Header with connection emergence moment & "Your thinking has changed." */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between pb-5 border-b border-stone-100 gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200/80">
                    <span>✦ Your thinking has changed</span>
                  </div>
                  <h3 className="font-serif text-xl sm:text-2xl font-normal text-stone-900 tracking-tight mt-1">
                    {activeThread.title}
                  </h3>
                  {(() => {
                    const firstDate = new Date(activeThread.firstObservedAt);
                    const lastDate = new Date(activeThread.lastObservedAt);
                    const diffDays = Math.max(
                      1,
                      Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
                    );
                    const earliestEv = activeThread.evidenceList?.[0];
                    return (
                      <p className="text-xs text-stone-600 font-normal">
                        Earliest reflection: <span className="font-medium text-stone-800">"{earliestEv?.title || 'Initial reflection'}"</span> ({diffDays} {diffDays === 1 ? "day" : "days"} ago).
                        {activeThread.whatChanged ? ` Evolution: "${activeThread.whatChanged.slice(0, 90)}…"` : ""}
                      </p>
                    );
                  })()}
                </div>

                <div className="text-xs text-stone-500 flex items-center space-x-1.5 bg-stone-50 px-3 py-1.5 rounded-full border border-stone-200/70 shrink-0 self-start">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  <span>
                    {new Date(activeThread.firstObservedAt).toLocaleDateString()} &rarr;{" "}
                    {new Date(activeThread.lastObservedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Constellation Chronology: Earliest, Intermediate, Latest */}
              <div className="relative pt-2 pb-4">
                {/* Visual connecting svg line */}
                <div className="hidden sm:block absolute top-9 left-6 right-6 h-0.5 pointer-events-none">
                  <svg className="w-full h-4 overflow-visible" preserveAspectRatio="none">
                    <line
                      x1="2%"
                      y1="2"
                      x2="98%"
                      y2="2"
                      stroke="rgba(16, 185, 129, 0.4)"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      className="animate-draw-line"
                    />
                  </svg>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                  {activeThread.evidenceList.map((ev, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === activeThread.evidenceList!.length - 1;

                    return (
                      <div
                        key={ev.reflectionId}
                        onClick={() => setSelectedReflectionId(ev.reflectionId)}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer group shadow-2xs hover:shadow-xs flex flex-col justify-between ${
                          isLast
                            ? "bg-emerald-50/30 border-emerald-300 hover:border-emerald-400 ring-1 ring-emerald-200/60"
                            : isFirst
                            ? "bg-stone-50/70 border-stone-300 hover:border-stone-400"
                            : "bg-white border-stone-200/80 hover:border-stone-300"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isFirst
                                  ? "bg-stone-200 text-stone-800"
                                  : isLast
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-stone-100 text-stone-600"
                              }`}
                            >
                              {isFirst ? "Earliest Reflection" : isLast ? "Latest Reflection" : "Intermediate"}
                            </span>
                            <span className="text-[11px] text-stone-400">
                              {new Date(ev.date).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>

                          <h4 className="font-serif text-sm font-medium text-stone-900 group-hover:text-emerald-950 transition-colors line-clamp-2">
                            {ev.title || "Untitled Reflection"}
                          </h4>

                          {ev.excerpt && (
                            <p className="text-xs text-stone-600 italic line-clamp-3 leading-relaxed">
                              "{ev.excerpt}…"
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500 group-hover:text-stone-900">
                          <span>Inspect reflection</span>
                          <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70 group-hover:opacity-100" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Editorial Thread Storytelling: Why the points connect */}
              <div className="pt-6 border-t border-stone-100 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                    Thread Story & Evolution
                  </span>
                  <span className="text-[11px] text-stone-500 font-normal">
                    Synthesized from {activeThread.evidenceList.length} reflections
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* What Stayed Consistent */}
                  <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/70 space-y-1.5">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-stone-900">
                      <span className="w-2 h-2 rounded-full bg-stone-400 shrink-0" />
                      <span>What Stayed Consistent</span>
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed font-normal">
                      {activeThread.whatStayedConsistent || "Steady grounding across entries."}
                    </p>
                  </div>

                  {/* What Changed */}
                  <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200/80 space-y-1.5">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-900">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>What Changed</span>
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed font-normal">
                      {activeThread.whatChanged ||
                        "A shift in perspective emerged between early entries and recent thoughts."}
                    </p>
                  </div>

                  {/* Unresolved Point */}
                  <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/80 space-y-1.5">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-amber-900">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span>What Remains Unresolved</span>
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed font-normal italic">
                      {activeThread.whatRemainsUnresolved
                        ? `"${activeThread.whatRemainsUnresolved}"`
                        : "An open question remains about the long-term balance between competing priorities."}
                    </p>
                  </div>

                  {/* Possible Next Step */}
                  <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-200/80 space-y-1.5">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-900">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                      <span>Possible Next Step</span>
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed font-normal">
                      {activeThread.potentialNextStep ||
                        "Explore the tension in an upcoming quiet reflection."}
                    </p>
                  </div>
                </div>

                {/* Supporting Reflections List */}
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-2">
                    Supporting Reflections ({activeThread.evidenceList.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {activeThread.evidenceList.map((ev, i) => (
                      <button
                        key={ev.reflectionId}
                        type="button"
                        onClick={() => setSelectedReflectionId(ev.reflectionId)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200/80 text-stone-700 hover:text-stone-900 text-xs font-medium transition-colors cursor-pointer"
                      >
                        <span className="text-[10px] text-stone-400">#{i + 1}</span>
                        <span className="truncate max-w-[160px]">{ev.title || "Untitled"}</span>
                        <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Life Threads Grid / List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif text-stone-900 font-normal">
                Discovered Threads ({threads.length})
              </h3>
              <p className="text-xs text-stone-500">
                Select any thread to trace its chronology and supporting reflections
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {threads.map((thread) => {
                const isSelected = thread.id === activeTimelineThreadId;
                return (
                  <div
                    key={thread.id}
                    id={`thread-card-${thread.id}`}
                    className={`bg-white border rounded-3xl p-6 sm:p-7 transition-all shadow-xs ${
                      isSelected
                        ? "border-emerald-500 ring-2 ring-emerald-100"
                        : "border-stone-200/90 hover:border-stone-300"
                    }`}
                  >
                    {/* Badge & Title */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200/80 text-emerald-800">
                            ✦ LIFE THREAD
                          </span>
                          <span className="text-xs text-stone-500">
                            Connects {thread.supportingReflectionIds.length} reflections
                          </span>
                        </div>
                        <h4 className="text-xl font-serif font-normal text-stone-900 mt-2">
                          {thread.title}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTimelineThreadId(thread.id)}
                        className={`text-xs font-medium px-4 py-2 rounded-xl border transition-all flex items-center space-x-1.5 cursor-pointer ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isSelected ? "Active in Constellation" : "Trace Constellation"}</span>
                      </button>
                    </div>

                    {/* Summary */}
                    <p className="text-sm text-stone-700 mt-3 leading-relaxed font-normal">
                      {thread.summary}
                    </p>

                    {/* 4 Structured Longitudinal Dimensions */}
                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-4 border-t border-stone-100 text-xs">
                      <div className="p-3.5 bg-stone-50/80 rounded-2xl border border-stone-200/60">
                        <span className="font-semibold uppercase tracking-wider text-[10px] text-stone-500 block mb-1">
                          What Stayed Consistent
                        </span>
                        <p className="text-stone-700 leading-relaxed font-normal">
                          {thread.whatStayedConsistent || "Steady conviction across written reflections."}
                        </p>
                      </div>

                      <div className="p-3.5 bg-emerald-50/30 rounded-2xl border border-emerald-200/60">
                        <span className="font-semibold uppercase tracking-wider text-[10px] text-emerald-800 block mb-1">
                          What Changed
                        </span>
                        <p className="text-stone-800 leading-relaxed font-normal">
                          {thread.whatChanged || "Perspective and framing shifted as circumstances unfolded."}
                        </p>
                      </div>

                      <div className="p-3.5 bg-amber-50/40 rounded-2xl border border-amber-200/60">
                        <span className="font-semibold uppercase tracking-wider text-[10px] text-amber-800 block mb-1">
                          What Remains Unresolved
                        </span>
                        <p className="text-amber-950 leading-relaxed font-normal">
                          {thread.whatRemainsUnresolved || "Open tensions that remain to be navigated."}
                        </p>
                      </div>

                      <div className="p-3.5 bg-indigo-50/40 rounded-2xl border border-indigo-200/60">
                        <span className="font-semibold uppercase tracking-wider text-[10px] text-indigo-800 block mb-1">
                          Possible Next Step
                        </span>
                        <p className="text-indigo-950 leading-relaxed font-normal">
                          {thread.potentialNextStep || "Give yourself permission to explore the next boundary."}
                        </p>
                      </div>
                    </div>

                    {/* Supporting Reflections Evidence Pills */}
                    <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
                        Supporting Entries:
                      </span>
                      {thread.evidenceList && thread.evidenceList.length > 0 ? (
                        thread.evidenceList.map((ev) => (
                          <button
                            key={ev.reflectionId}
                            type="button"
                            onClick={() => setSelectedReflectionId(ev.reflectionId)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-stone-100 hover:bg-stone-200/80 text-stone-700 text-xs transition-colors cursor-pointer"
                          >
                            <span className="font-medium truncate max-w-[180px]">{ev.title}</span>
                            {ev.date && (
                              <span className="text-[10px] text-stone-500">
                                ({new Date(ev.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })})
                              </span>
                            )}
                          </button>
                        ))
                      ) : (
                        thread.supportingReflectionIds.map((id, i) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSelectedReflectionId(id)}
                            className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-stone-100 hover:bg-stone-200/80 text-stone-700 text-xs transition-colors cursor-pointer"
                          >
                            <span>Entry #{i + 1}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reflection Detail Inspector Modal */}
      {selectedReflectionId && (
        <ReflectionDetailModal
          reflectionId={selectedReflectionId}
          onClose={() => setSelectedReflectionId(null)}
          onDeleted={() => {
            setSelectedReflectionId(null);
            fetchThreads();
          }}
        />
      )}
    </div>
  );
};
