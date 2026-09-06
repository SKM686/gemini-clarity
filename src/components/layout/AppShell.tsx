import React from "react";
import { Header, HealthStatus } from "./Header";

interface AppShellProps {
  healthStatus: HealthStatus;
  lastChecked?: string;
  onRefreshHealth?: () => void;
  onOpenPrivacy?: () => void;
  onOpenArchitecture?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  healthStatus,
  lastChecked,
  onRefreshHealth,
  onOpenPrivacy,
  onOpenArchitecture,
  children,
}) => {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col antialiased">
      {/* Primary Navigation / Header */}
      <Header
        healthStatus={healthStatus}
        lastChecked={lastChecked}
        onRefreshHealth={onRefreshHealth}
        onOpenPrivacy={onOpenPrivacy}
        onOpenArchitecture={onOpenArchitecture}
      />

      {/* Main Content Area */}
      <main id="main-content" role="main" className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {children}
      </main>

      {/* Subtle, restrained footer */}
      <footer
        id="app-footer"
        role="contentinfo"
        className="w-full border-t border-stone-200 bg-white py-6"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-serif font-medium text-stone-700">Gemini Clarity</span>
            <span>&bull;</span>
            <span>Personal AI Thinking Companion</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-stone-400">Deployed on Google Cloud Run</span>
            <span>&bull;</span>
            <span className="text-stone-400">Zero Client Secrets</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
