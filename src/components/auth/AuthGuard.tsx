import React from "react";
import { useAuth } from "../../context/AuthContext";
import { ShieldCheck, Sparkles, Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, loading, error, signInWithGoogle, clearError } = useAuth();

  // Polished loading state preventing flash of unauthenticated or protected content
  if (loading && !user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-stone-50 shadow-sm">
            <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="font-serif font-semibold text-lg text-stone-900">Gemini Clarity</p>
            <p className="text-xs text-stone-500 flex items-center justify-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600" aria-hidden="true" />
              Initializing secure session...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If user is authenticated, render protected application children
  if (user) {
    return <>{children}</>;
  }

  // Unauthenticated experience: Gemini Clarity Sign-In
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col justify-between antialiased selection:bg-amber-100 selection:text-stone-900">
      {/* Top minimal editorial header */}
      <header className="w-full border-b border-stone-200/70 bg-[#FAF8F5]/80 backdrop-blur-md sticky top-0 z-30 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-stone-50 shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-300" aria-hidden="true" />
            </div>
            <div>
              <span className="font-serif font-semibold text-lg text-stone-900 tracking-tight">
                Gemini Clarity
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-stone-600">
                Write anything. Understand everything.
              </span>
            </div>
          </div>

          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50/80 text-emerald-800 border border-emerald-200/80">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>🔒 Private</span>
          </div>
        </div>
      </header>

      {/* Main Hero & Living Thought Map Presentation */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 lg:py-16 max-w-5xl mx-auto w-full">
        {/* Subtle Animated Thought Constellation */}
        <div className="w-full max-w-3xl mb-8 relative hidden sm:block">
          <div className="relative h-44 w-full flex items-center justify-center">
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 600 160"
              fill="none"
              aria-hidden="true"
            >
              {/* Delicate connection curves */}
              <path
                d="M 110 80 Q 200 30, 300 80 T 490 80"
                stroke="rgba(168, 162, 158, 0.45)"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                className="animate-pulse-glow"
              />
              <path
                d="M 110 80 Q 220 130, 380 120 T 490 80"
                stroke="rgba(16, 185, 129, 0.35)"
                strokeWidth="1"
              />
              <path
                d="M 300 80 L 380 120"
                stroke="rgba(217, 119, 6, 0.3)"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            </svg>

            {/* Constellation Nodes */}
            <div className="absolute left-[8%] top-[38%] -translate-y-1/2 flex items-center gap-2 group cursor-default">
              <span className="w-2.5 h-2.5 rounded-full bg-stone-400 ring-4 ring-stone-200/60" />
              <span className="text-[11px] font-medium tracking-wide uppercase text-stone-500 bg-white/90 px-2.5 py-1 rounded-full border border-stone-200/70 shadow-2xs">
                First Hesitation
              </span>
            </div>

            <div className="absolute left-[34%] top-[15%] flex items-center gap-2 group cursor-default">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-4 ring-amber-100" />
              <span className="text-[11px] font-medium tracking-wide uppercase text-stone-600 bg-white/95 px-2.5 py-1 rounded-full border border-amber-200/80 shadow-2xs">
                Unexamined Tradeoff
              </span>
            </div>

            <div className="absolute left-[50%] top-[45%] -translate-y-1/2 flex items-center gap-2 group cursor-default">
              <span className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-900 bg-emerald-50/95 px-3 py-1 rounded-full border border-emerald-300 shadow-xs">
                ✦ Emerging Clarity
              </span>
            </div>

            <div className="absolute left-[62%] bottom-[12%] flex items-center gap-2 group cursor-default">
              <span className="w-2 h-2 rounded-full bg-indigo-400 ring-4 ring-indigo-100" />
              <span className="text-[11px] font-medium tracking-wide uppercase text-stone-500 bg-white/90 px-2.5 py-1 rounded-full border border-stone-200/70 shadow-2xs">
                Consistent Value
              </span>
            </div>

            <div className="absolute right-[6%] top-[38%] -translate-y-1/2 flex items-center gap-2 group cursor-default">
              <span className="w-2.5 h-2.5 rounded-full bg-stone-900 ring-4 ring-stone-200" />
              <span className="text-[11px] font-medium tracking-wide uppercase text-stone-800 bg-white/95 px-2.5 py-1 rounded-full border border-stone-300 shadow-2xs">
                Next Horizon
              </span>
            </div>
          </div>
        </div>

        {/* Primary Authentication Card */}
        <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-3xl p-7 sm:p-9 shadow-xs space-y-7 transition-all">
          {/* Header & Typography */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-stone-100 text-stone-800 mb-1 border border-stone-200/60">
              <Sparkles className="w-5 h-5 text-amber-500" aria-hidden="true" />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-stone-900 leading-snug">
              Your thoughts deserve more than a text box.
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed font-normal">
              A living map of your thoughts. Reflect freely, uncover evolving themes across time with Life Threads, and ask your journal grounded questions.
            </p>
          </div>

          {/* Authentication Error Notification */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5 text-xs"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 space-y-1">
                <p className="font-medium">{error}</p>
                <button
                  type="button"
                  onClick={clearError}
                  className="text-rose-700 underline hover:text-rose-900 focus:outline-hidden"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Primary Action Button: Google Sign-In */}
          <div className="space-y-3 pt-1">
            <button
              id="btn-continue-with-google"
              type="button"
              onClick={signInWithGoogle}
              disabled={loading}
              aria-label="Continue with Google"
              className="w-full h-12 flex items-center justify-center gap-3 px-5 rounded-2xl border border-stone-300/90 bg-stone-900 hover:bg-stone-800 active:bg-black text-white text-sm font-medium transition-all shadow-xs hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-stone-300" aria-hidden="true" />
                  <span>Connecting securely...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {error && (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 py-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 text-stone-500" aria-hidden="true" />
                <span>Retry Sign-In</span>
              </button>
            )}
          </div>

          {/* Privacy & Architecture Commitments */}
          <div className="pt-4 border-t border-stone-100 space-y-2 text-center">
            <p className="text-xs text-stone-500 font-normal">
              Your journals are strictly private and isolated to your account.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-stone-400">
              <span>Firebase Verified</span>
              <span>&bull;</span>
              <span>Server-Side Cloud Run</span>
              <span>&bull;</span>
              <span>Zero Client Secrets</span>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-stone-200/70 bg-white/40 py-4 px-4 text-center text-xs text-stone-500">
        <p>Gemini Clarity &bull; Write anything. Understand everything.</p>
      </footer>
    </div>
  );
};
