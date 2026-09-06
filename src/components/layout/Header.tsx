import React from "react";
import { useAuth } from "../../context/AuthContext";
import {
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  LogOut,
  User as UserIcon,
} from "lucide-react";

export type HealthStatus = "loading" | "healthy" | "unavailable";

interface HeaderProps {
  healthStatus: HealthStatus;
  lastChecked?: string;
  onRefreshHealth?: () => void;
  onOpenPrivacy?: () => void;
  onOpenArchitecture?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  healthStatus,
  lastChecked,
  onRefreshHealth,
  onOpenPrivacy,
  onOpenArchitecture,
}) => {
  const { user, signOut } = useAuth();

  return (
    <header
      id="app-header"
      role="banner"
      className="w-full border-b border-stone-200/80 bg-[#FAF8F5]/90 backdrop-blur-md sticky top-0 z-40 transition-colors"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center text-stone-50 shadow-xs shrink-0">
            <Sparkles className="w-4 h-4 text-amber-300" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-serif font-semibold text-lg text-stone-900 tracking-tight">
                Gemini Clarity
              </span>
            </div>
            <p className="text-[11px] text-stone-500 hidden md:block">
              Write anything. Understand everything.
            </p>
          </div>
        </div>

        {/* Right side controls: Private badge, User menu & Sign Out */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Privacy badge / trigger */}
          <button
            id="btn-header-privacy"
            type="button"
            onClick={onOpenPrivacy}
            className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white hover:bg-stone-50 text-stone-700 border border-stone-200/90 shadow-2xs transition-all cursor-pointer"
            title="Your reflections are encrypted and strictly isolated to your account."
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>Private</span>
          </button>

          {/* User Profile & Sign-out Control */}
          {user && (
            <div className="flex items-center space-x-2 pl-2 border-l border-stone-200">
              <div
                className="flex items-center space-x-2 cursor-pointer group"
                onClick={onOpenPrivacy}
                title="View Privacy & Account Details"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User avatar"}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full border border-stone-300 object-cover shrink-0 ring-2 ring-transparent group-hover:ring-stone-300 transition-all"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-semibold shrink-0">
                    {user.displayName ? (
                      user.displayName.charAt(0).toUpperCase()
                    ) : (
                      <UserIcon className="w-3.5 h-3.5 text-stone-600" aria-hidden="true" />
                    )}
                  </div>
                )}
                {user.displayName && (
                  <span className="hidden md:inline text-xs font-medium text-stone-800 max-w-[120px] truncate">
                    {user.displayName}
                  </span>
                )}
              </div>

              <button
                id="btn-sign-out"
                type="button"
                onClick={signOut}
                aria-label="Sign out of Gemini Clarity"
                title="Sign out of your session"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
