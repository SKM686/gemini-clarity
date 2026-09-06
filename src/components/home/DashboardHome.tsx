import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  Sparkles,
  Compass,
  Lightbulb,
  Search,
  Scale,
  GitCommit,
  BookOpen,
  ArrowRight,
  Clock,
  ChevronRight,
  PenLine,
  Loader2,
  Calendar,
} from "lucide-react";
import {
  listReflections,
  getLifeThreads,
  createReflection,
  ReflectionItem,
} from "../../services/apiClient";
import type { LifeThread, ConversationMode } from "../../types/journal";

interface DashboardHomeProps {
  onStartReflection: (initialText?: string, mode?: ConversationMode) => void;
  onStartCompanion: (initialText: string, mode: ConversationMode) => void;
  onNavigateToThreads: () => void;
  onNavigateToJournal: () => void;
  onNavigateToAsk: () => void;
  onOpenReflection: (reflection: ReflectionItem) => void;
}

const MODES: {
  id: ConversationMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: "reflect",
    label: "Reflect",
    description: "Explore feelings, assumptions, and unspoken angles",
    icon: Compass,
  },
  {
    id: "brainstorm",
    label: "Brainstorm",
    description: "Generate possibilities and discover combinations",
    icon: Lightbulb,
  },
  {
    id: "clarify",
    label: "Clarify",
    description: "Untangle complexity and pinpoint the core question",
    icon: Search,
  },
  {
    id: "decide",
    label: "Decide",
    description: "Evaluate tradeoffs and test decision criteria",
    icon: Scale,
  },
];

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  onStartReflection,
  onStartCompanion,
  onNavigateToThreads,
  onNavigateToJournal,
  onNavigateToAsk,
  onOpenReflection,
}) => {
  const { user } = useAuth();
  const [selectedMode, setSelectedMode] = useState<ConversationMode>("reflect");
  const [thoughtText, setThoughtText] = useState<string>(() => {
    return sessionStorage.getItem("gemini_clarity_home_thought") || "";
  });
  const [isSavingQuick, setIsSavingQuick] = useState<boolean>(false);

  // Real data from Firestore API
  const [reflections, setReflections] = useState<ReflectionItem[]>([]);
  const [threads, setThreads] = useState<LifeThread[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Time of day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const firstName = user?.displayName
    ? user.displayName.split(" ")[0]
    : "there";

  // Persist thought canvas draft
  useEffect(() => {
    if (thoughtText.trim()) {
      sessionStorage.setItem("gemini_clarity_home_thought", thoughtText);
    } else {
      sessionStorage.removeItem("gemini_clarity_home_thought");
    }
  }, [thoughtText]);

  // Load real data when user is authenticated
  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setReflections([]);
      setThreads([]);
      setLoadingData(false);
      return;
    }

    const loadOverview = async () => {
      setLoadingData(true);
      try {
        const [reflectionsRes, threadsRes] = await Promise.allSettled([
          listReflections(10),
          getLifeThreads(6),
        ]);

        if (isMounted) {
          if (reflectionsRes.status === "fulfilled") {
            setReflections(reflectionsRes.value.reflections || []);
          }
          if (threadsRes.status === "fulfilled") {
            setThreads(threadsRes.value.threads || []);
          }
        }
      } finally {
        if (isMounted) {
          setLoadingData(false);
        }
      }
    };
    loadOverview();
    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  const handleDeepenWithCompanion = () => {
    if (!thoughtText.trim()) return;
    const text = thoughtText.trim();
    setThoughtText("");
    sessionStorage.removeItem("gemini_clarity_home_thought");
    onStartCompanion(text, selectedMode);
  };

  const handleOpenInEditor = () => {
    const text = thoughtText.trim();
    setThoughtText("");
    sessionStorage.removeItem("gemini_clarity_home_thought");
    onStartReflection(text, selectedMode);
  };

  // Find something worth revisiting based exclusively on real data
  const revisitingThread = threads.length > 0 ? threads[0] : null;
  const oldestReflection =
    reflections.length > 2 ? reflections[reflections.length - 1] : null;

  // Real user intelligence: strictly derived from genuine data, never fabricated
  const openQuestions = threads
    .filter((t) => t.whatRemainsUnresolved && t.whatRemainsUnresolved.trim().length > 0)
    .map((t) => ({
      threadId: t.id,
      threadTitle: t.title,
      question: t.whatRemainsUnresolved!,
    }));

  const recentInsights = threads
    .filter((t) => t.whatChanged && t.whatChanged.trim().length > 0)
    .map((t) => ({
      threadId: t.id,
      threadTitle: t.title,
      insight: t.whatChanged!,
    }));

  return (
    <div id="dashboard-home-view" className="space-y-12 max-w-4xl mx-auto py-2">
      {/* Editorial Personalized Header */}
      <section className="space-y-1.5 pt-2">
        <p className="text-xs uppercase tracking-widest font-semibold text-stone-500">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl text-stone-900 tracking-tight font-normal">
          {getGreeting()}, {firstName}.
        </h1>
        <p className="text-stone-600 text-sm max-w-xl font-normal">
          A living map of your thoughts. Write without friction; understand patterns over time.
        </p>
      </section>

      {/* Primary Hero: Distraction-free Thought Canvas */}
      <section
        id="thought-canvas-section"
        className="bg-[#FCFBF8] border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs transition-all duration-300 hover:border-stone-300/80 focus-within:ring-2 focus-within:ring-stone-300/70 focus-within:border-stone-400/80 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/60 pb-4">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-stone-900 font-normal">
              What’s on your mind?
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Begin a raw thought, question, or decision.
            </p>
          </div>

          {/* Mode Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {MODES.map((mode) => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelectedMode(mode.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "bg-stone-900 text-white shadow-2xs font-semibold ring-1 ring-stone-900"
                      : "bg-white hover:bg-stone-100 text-stone-700 border border-stone-200/80"
                  }`}
                  title={mode.description}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Text Area Canvas with Natural Effortless Expansion */}
        <div className="space-y-4">
          <textarea
            id="home-thought-canvas-input"
            value={thoughtText}
            onChange={(e) => setThoughtText(e.target.value)}
            placeholder={
              selectedMode === "reflect"
                ? "What feeling, observation, or situation is lingering with you today?..."
                : selectedMode === "brainstorm"
                ? "What wild ideas or new angles are you curious to explore?..."
                : selectedMode === "clarify"
                ? "What feels murky, overwhelming, or tangled right now?..."
                : "What choice are you facing, and what are the competing values?..."
            }
            rows={
              thoughtText.trim()
                ? Math.min(10, Math.max(5, thoughtText.split("\n").length + 2))
                : 4
            }
            className="w-full resize-none bg-transparent border-0 text-stone-900 placeholder:text-stone-400/80 focus:outline-hidden focus:ring-0 font-serif text-lg sm:text-xl leading-relaxed font-normal p-0 transition-all duration-200"
          />

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-stone-200/60">
            <span className="text-[11px] text-stone-500">
              {thoughtText.trim()
                ? `${thoughtText.trim().split(/\s+/).length} words • Preserved in session`
                : "Private • Identity verified on Cloud Run"}
            </span>

            <div className="flex items-center gap-2">
              <button
                id="btn-canvas-open-journal"
                type="button"
                onClick={handleOpenInEditor}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/80 transition-colors cursor-pointer"
              >
                <PenLine className="w-3.5 h-3.5 text-stone-600" />
                <span>Open in Journal</span>
              </button>

              <button
                id="btn-canvas-deepen-companion"
                type="button"
                onClick={handleDeepenWithCompanion}
                disabled={!thoughtText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-stone-900 hover:bg-stone-800 active:bg-black text-white transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-98"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Think it through</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial "Something worth revisiting" Section (Only when real data exists) */}
      {revisitingThread && (
        <section
          id="worth-revisiting-section"
          className="p-6 sm:p-7 rounded-3xl bg-amber-50/40 border border-amber-200/70 space-y-3 relative overflow-hidden"
        >
          <div className="flex items-center space-x-2 text-xs font-semibold text-amber-800">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span className="uppercase tracking-wider text-[10px]">
              Something worth revisiting
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-serif text-lg text-stone-900 font-medium">
                Your thinking about "{revisitingThread.title}" has evolved.
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 max-w-xl leading-relaxed">
                {revisitingThread.whatChanged ||
                  revisitingThread.summary ||
                  "Review how your perspective progressed across multiple entries."}
              </p>
            </div>

            <button
              id="btn-revisit-explore"
              type="button"
              onClick={onNavigateToThreads}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-200 shadow-2xs transition-all shrink-0 cursor-pointer"
            >
              <span>Explore Thread</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      )}

      {/* First-Time User Experience (When user has no reflections yet) */}
      {!loadingData && reflections.length === 0 && (
        <section
          id="first-time-journey-card"
          className="bg-white border border-stone-200/90 rounded-3xl p-8 sm:p-10 shadow-xs space-y-6 text-center max-w-xl mx-auto"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-700 mx-auto shadow-2xs">
            <Sparkles className="w-5 h-5" />
          </div>

          <div className="space-y-2">
            <h3 className="font-serif text-2xl text-stone-900 font-normal tracking-tight">
              Your thinking journey starts here.
            </h3>
            <p className="text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
              A single thought is enough. Gemini will help you uncover what connects to it over time.
            </p>
          </div>

          {/* Subtle Conceptual Progression Preview */}
          <div className="py-2.5 px-4 rounded-xl bg-stone-50 border border-stone-200/70 max-w-md mx-auto">
            <div className="flex items-center justify-between text-xs font-medium text-stone-600">
              <span className="text-stone-800 font-medium">Thought</span>
              <span className="text-stone-400 font-light">→</span>
              <span className="text-stone-800 font-medium">Pattern</span>
              <span className="text-stone-400 font-light">→</span>
              <span className="text-stone-800 font-medium">Connection</span>
              <span className="text-stone-400 font-light">→</span>
              <span className="text-emerald-700 font-semibold">Clarity</span>
            </div>
          </div>

          <div className="pt-1">
            <button
              id="btn-first-reflection-cta"
              type="button"
              onClick={() => onStartReflection()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <span>Start your first reflection</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      )}

      {/* Active Threads & Recent Reflections Grid (Real data only) */}
      {(!loadingData ? reflections.length > 0 : true) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: Active Threads */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <GitCommit className="w-4 h-4 text-emerald-600" />
                <h3 className="font-serif text-lg text-stone-900 font-medium">
                  Active Life Threads
                </h3>
              </div>
              {threads.length > 0 && (
                <button
                  type="button"
                  onClick={onNavigateToThreads}
                  className="text-xs text-stone-500 hover:text-stone-900 font-medium transition-colors cursor-pointer"
                >
                  View all ({threads.length}) →
                </button>
              )}
            </div>

            {loadingData ? (
              <div className="p-8 rounded-2xl bg-white border border-stone-200/80 flex items-center justify-center text-xs text-stone-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                <span>Checking life threads...</span>
              </div>
            ) : threads.length > 0 ? (
              <div className="space-y-3">
                {threads.slice(0, 3).map((thread) => (
                  <div
                    key={thread.id}
                    onClick={onNavigateToThreads}
                    className="p-4 rounded-2xl bg-white hover:bg-emerald-50/30 border border-stone-200/80 hover:border-emerald-200 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span className="font-semibold text-stone-700 group-hover:text-emerald-900 transition-colors">
                        {thread.title}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {thread.reflectionCount} entries
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                      {thread.summary}
                    </p>
                    <div className="mt-2.5 flex items-center text-[11px] text-emerald-700 font-medium">
                      <span>Explore chronology</span>
                      <ChevronRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {/* Column 2: Recent Reflections */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-stone-700" />
                <h3 className="font-serif text-lg text-stone-900 font-medium">
                  Recent Reflections
                </h3>
              </div>
              {reflections.length > 0 && (
                <button
                  type="button"
                  onClick={onNavigateToJournal}
                  className="text-xs text-stone-500 hover:text-stone-900 font-medium transition-colors cursor-pointer"
                >
                  View all ({reflections.length}) →
                </button>
              )}
            </div>

            {loadingData ? (
              <div className="p-8 rounded-2xl bg-white border border-stone-200/80 flex items-center justify-center text-xs text-stone-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                <span>Loading reflections...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {reflections.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onOpenReflection(item)}
                    className="p-4 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200/80 hover:border-stone-300 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span className="font-semibold text-stone-800 group-hover:text-stone-950 transition-colors truncate max-w-[200px]">
                        {item.title}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                      {item.content}
                    </p>
                    <div className="mt-2.5 flex items-center text-[11px] text-stone-600 font-medium group-hover:text-stone-900">
                      <span>Read reflection</span>
                      <ChevronRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Real User Intelligence: Open Questions & Recent Insights (Rendered strictly when genuine data exists) */}
      {(openQuestions.length > 0 || recentInsights.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {openQuestions.length > 0 && (
            <section className="p-6 rounded-3xl bg-amber-50/30 border border-amber-200/70 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-amber-900">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <h3 className="font-serif text-base font-normal">Open Questions</h3>
              </div>
              <div className="space-y-2.5">
                {openQuestions.slice(0, 2).map((item, i) => (
                  <div
                    key={i}
                    onClick={onNavigateToThreads}
                    className="p-3.5 bg-white/90 rounded-2xl border border-amber-200/60 hover:border-amber-300 transition-all cursor-pointer group shadow-2xs"
                  >
                    <p className="text-xs text-stone-800 font-normal leading-relaxed italic">
                      "{item.question}"
                    </p>
                    <span className="mt-1.5 inline-block text-[10px] text-amber-800 font-medium group-hover:underline">
                      From thread: {item.threadTitle} &rarr;
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {recentInsights.length > 0 && (
            <section className="p-6 rounded-3xl bg-emerald-50/30 border border-emerald-200/70 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-900">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="font-serif text-base font-normal">Recent Insights</h3>
              </div>
              <div className="space-y-2.5">
                {recentInsights.slice(0, 2).map((item, i) => (
                  <div
                    key={i}
                    onClick={onNavigateToThreads}
                    className="p-3.5 bg-white/90 rounded-2xl border border-emerald-200/60 hover:border-emerald-300 transition-all cursor-pointer group shadow-2xs"
                  >
                    <p className="text-xs text-stone-800 font-normal leading-relaxed">
                      {item.insight}
                    </p>
                    <span className="mt-1.5 inline-block text-[10px] text-emerald-800 font-medium group-hover:underline">
                      From thread: {item.threadTitle} &rarr;
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Grounded Natural Inquiry Quick Bar */}
      <section
        id="home-ask-shortcut"
        onClick={onNavigateToAsk}
        className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200/90 hover:border-indigo-300 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group shadow-xs"
      >
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition-transform">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-serif text-base font-medium text-stone-900 group-hover:text-indigo-950 transition-colors">
                Ask My Journal
              </h4>
              <span className="text-[11px] font-medium text-stone-500">&bull; Ask your own history.</span>
            </div>
            <p className="text-xs text-stone-600 mt-0.5 max-w-lg leading-relaxed">
              "What keeps coming up?" &bull; "What have I changed my mind about?" &bull; Grounded in your real entries.
            </p>
          </div>
        </div>

        <div className="flex items-center text-xs font-semibold text-indigo-700 self-end sm:self-auto">
          <span>Search yourself</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
        </div>
      </section>
    </div>
  );
};
