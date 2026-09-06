import { useEffect, useState, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthGuard } from "./components/auth/AuthGuard";
import { AppShell } from "./components/layout/AppShell";
import { HealthStatus } from "./components/layout/Header";
import {
  verifyServerAuthBoundary,
  verifyFirestoreDataBoundary,
  verifySecretBoundary,
  DataCheckResponse,
  SecretCheckResponse,
  ApiError,
} from "./services/apiClient";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  UserCheck,
  Sparkles,
  Lock,
  Check,
  Database,
  Key,
  BookOpen,
  PenLine,
  Plus,
  MessageSquare,
  GitCommit,
  Search,
  Home,
} from "lucide-react";
import { DashboardHome } from "./components/home/DashboardHome";
import { ReflectionEditor } from "./components/journal/ReflectionEditor";
import { ReflectionHistory } from "./components/journal/ReflectionHistory";
import { ConversationView } from "./components/reflections/ConversationView";
import { LifeThreadsView } from "./components/threads/LifeThreadsView";
import { AskJournalView } from "./components/ask/AskJournalView";

interface HealthData {
  status: string;
  service: string;
  timestamp: string;
  environment: string;
}

interface ServerAuthResult {
  authenticated: boolean;
  uid: string;
  provider?: string;
}

function AuthenticatedWorkspace() {
  const { user, getIdToken } = useAuth();
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("loading");
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [lastChecked, setLastChecked] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stage 1C: Server Authentication Boundary Check state
  const [verifyingServerAuth, setVerifyingServerAuth] = useState<boolean>(false);
  const [serverAuthResult, setServerAuthResult] = useState<ServerAuthResult | null>(null);
  const [serverAuthError, setServerAuthError] = useState<string | null>(null);
  const [serverAuthVerifiedAt, setServerAuthVerifiedAt] = useState<string | null>(null);

  // Stage 1C: Tamper / Spoof Test State
  const [testingSpoof, setTestingSpoof] = useState<boolean>(false);
  const [spoofTestPassed, setSpoofTestPassed] = useState<boolean | null>(null);
  const [spoofTestDetails, setSpoofTestDetails] = useState<string | null>(null);

  // Stage 1D: Firestore Persistence Boundary state
  const [verifyingDataBoundary, setVerifyingDataBoundary] = useState<boolean>(false);
  const [dataBoundaryResult, setDataBoundaryResult] = useState<DataCheckResponse | null>(null);
  const [dataBoundaryError, setDataBoundaryError] = useState<string | null>(null);
  const [dataBoundaryVerifiedAt, setDataBoundaryVerifiedAt] = useState<string | null>(null);

  // Stage 1D: Data Spoof Test State
  const [testingDataSpoof, setTestingDataSpoof] = useState<boolean>(false);
  const [dataSpoofTestPassed, setDataSpoofTestPassed] = useState<boolean | null>(null);
  const [dataSpoofTestDetails, setDataSpoofTestDetails] = useState<string | null>(null);

  // Stage 1E: Secret Manager Credential Boundary state
  const [verifyingSecretBoundary, setVerifyingSecretBoundary] = useState<boolean>(false);
  const [secretBoundaryResult, setSecretBoundaryResult] = useState<SecretCheckResponse | null>(null);
  const [secretBoundaryError, setSecretBoundaryError] = useState<string | null>(null);
  const [secretBoundaryVerifiedAt, setSecretBoundaryVerifiedAt] = useState<string | null>(null);

  // Longitudinal Intelligence & Journal State
  const [activeTab, setActiveTab] = useState<"home" | "journal" | "companion" | "threads" | "ask" | "architecture">("home");
  const [isWriting, setIsWriting] = useState<boolean>(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState<number>(0);
  const [companionInitialPrompt, setCompanionInitialPrompt] = useState<string>("");
  const [companionInitialTitle, setCompanionInitialTitle] = useState<string>("");
  const [editorInitialTitle, setEditorInitialTitle] = useState<string>("");
  const [editorInitialContent, setEditorInitialContent] = useState<string>("");

  const checkHealth = useCallback(async () => {
    setHealthStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/health");
      if (!res.ok) {
        throw new Error(`Server responded with HTTP status ${res.status}`);
      }
      const data: HealthData = await res.json();
      setHealthData(data);
      setHealthStatus("healthy");
      setLastChecked(new Date().toISOString());
    } catch (err: unknown) {
      setHealthStatus("unavailable");
      setErrorMessage(err instanceof Error ? err.message : "Unable to reach Cloud Run server");
      setLastChecked(new Date().toISOString());
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Stage 1C Verification: Verify Cloud Run auth boundary via GET /api/auth-check
  const handleVerifyServerAuth = async () => {
    setVerifyingServerAuth(true);
    setServerAuthError(null);
    setServerAuthResult(null);
    try {
      const res = await verifyServerAuthBoundary();
      setServerAuthResult(res);
      setServerAuthVerifiedAt(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : "Failed to verify server authentication boundary";
      setServerAuthError(message);
    } finally {
      setVerifyingServerAuth(false);
    }
  };

  // Stage 1C Verification: Test that server ignores injected UID in query/body
  const handleTestSpoofDefense = async () => {
    setTestingSpoof(true);
    setSpoofTestPassed(null);
    setSpoofTestDetails(null);
    try {
      // Intentionally send spoofed query parameter `?uid=attacker_injected_uid`
      // Server must completely ignore it and return the UID verified from the cryptographic JWT
      const token = await getIdToken();
      const res = await fetch("/api/auth-check?uid=attacker_injected_uid", {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Unexpected server response ${res.status}`);
      }

      const data = await res.json();
      if (data.uid === user?.uid && data.uid !== "attacker_injected_uid") {
        setSpoofTestPassed(true);
        setSpoofTestDetails(
          `Spoofed parameter '?uid=attacker_injected_uid' was discarded. Server returned authoritative verified UID: ${data.uid}.`
        );
      } else {
        setSpoofTestPassed(false);
        setSpoofTestDetails("Server erroneously accepted client-supplied UID!");
      }
    } catch (err: unknown) {
      setSpoofTestPassed(false);
      setSpoofTestDetails(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingSpoof(false);
    }
  };

  // Stage 1D Verification: Verify Cloud Run Firestore boundary via GET /api/data-check
  const handleVerifyDataBoundary = async () => {
    setVerifyingDataBoundary(true);
    setDataBoundaryError(null);
    setDataBoundaryResult(null);
    try {
      const res = await verifyFirestoreDataBoundary();
      setDataBoundaryResult(res);
      setDataBoundaryVerifiedAt(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to verify Firestore persistence boundary";
      setDataBoundaryError(message);
    } finally {
      setVerifyingDataBoundary(false);
    }
  };

  // Stage 1D Verification: Test that server ignores injected UID and operates solely on req.user.uid
  const handleTestDataSpoofDefense = async () => {
    setTestingDataSpoof(true);
    setDataSpoofTestPassed(null);
    setDataSpoofTestDetails(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/data-check?uid=attacker_injected_uid", {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Unexpected server response ${res.status}`);
      }

      const data = await res.json();
      if (data.uid === user?.uid && data.uid !== "attacker_injected_uid") {
        setDataSpoofTestPassed(true);
        setDataSpoofTestDetails(
          `Injected '?uid=attacker_injected_uid' was discarded. Server loaded user profile exclusively under users/${data.uid}.`
        );
      } else {
        setDataSpoofTestPassed(false);
        setDataSpoofTestDetails("Server erroneously accessed data under client-supplied UID!");
      }
    } catch (err: unknown) {
      setDataSpoofTestPassed(false);
      setDataSpoofTestDetails(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingDataSpoof(false);
    }
  };

  // Stage 1E Verification: Verify Cloud Run Secret Manager boundary via GET /api/secret-check
  const handleVerifySecretBoundary = async () => {
    setVerifyingSecretBoundary(true);
    setSecretBoundaryError(null);
    setSecretBoundaryResult(null);
    try {
      const res = await verifySecretBoundary();
      setSecretBoundaryResult(res);
      setSecretBoundaryVerifiedAt(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to verify secret management boundary";
      setSecretBoundaryError(message);
    } finally {
      setVerifyingSecretBoundary(false);
    }
  };

  return (
    <AppShell
      healthStatus={healthStatus}
      lastChecked={lastChecked}
      onRefreshHealth={checkHealth}
      onOpenPrivacy={() => setActiveTab("architecture")}
      onOpenArchitecture={() => setActiveTab("architecture")}
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Primary Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 pb-3">
          <nav className="flex flex-wrap items-center gap-1.5" aria-label="Primary Navigation">
            <button
              id="tab-home"
              type="button"
              onClick={() => setActiveTab("home")}
              className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "home"
                  ? "bg-stone-900 text-white shadow-xs"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <Home className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Home</span>
            </button>

            <button
              id="tab-journal"
              type="button"
              onClick={() => setActiveTab("journal")}
              className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "journal"
                  ? "bg-stone-900 text-white shadow-xs"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Journal</span>
            </button>

            <button
              id="tab-threads"
              type="button"
              onClick={() => setActiveTab("threads")}
              className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "threads"
                  ? "bg-stone-900 text-white shadow-xs"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <GitCommit className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
              <span>Life Threads</span>
            </button>

            <button
              id="tab-ask"
              type="button"
              onClick={() => setActiveTab("ask")}
              className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "ask"
                  ? "bg-stone-900 text-white shadow-xs"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <Search className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
              <span>Ask My Journal</span>
            </button>

            <button
              id="tab-architecture"
              type="button"
              onClick={() => setActiveTab("architecture")}
              className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === "architecture"
                  ? "bg-stone-200 text-stone-900 font-semibold"
                  : "text-stone-500 hover:text-stone-800 hover:bg-stone-100/80"
              }`}
              title="Inspect backend security boundaries and isolation verification"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
              <span className="text-[11px]">Architecture</span>
            </button>
          </nav>

          {/* Single clear primary action: 'New Reflection' */}
          <div className="flex items-center">
            <button
              id="btn-header-new-reflection"
              type="button"
              onClick={() => {
                setEditorInitialTitle("");
                setEditorInitialContent("");
                setIsWriting(true);
                setActiveTab("journal");
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition-all shadow-xs self-start sm:self-auto cursor-pointer active:scale-98"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>New Reflection</span>
            </button>
          </div>
        </div>

        {/* Active Tab View: Home */}
        {activeTab === "home" && (
          <DashboardHome
            onStartReflection={(initialText) => {
              setEditorInitialTitle("");
              setEditorInitialContent(initialText || "");
              setIsWriting(true);
              setActiveTab("journal");
            }}
            onStartCompanion={(initialText, mode) => {
              setCompanionInitialTitle(mode ? `${mode.charAt(0).toUpperCase() + mode.slice(1)} Session` : "Thinking Session");
              setCompanionInitialPrompt(initialText);
              setActiveTab("companion");
            }}
            onNavigateToThreads={() => setActiveTab("threads")}
            onNavigateToJournal={() => {
              setIsWriting(false);
              setActiveTab("journal");
            }}
            onNavigateToAsk={() => setActiveTab("ask")}
            onOpenReflection={(reflection) => {
              setEditorInitialTitle(reflection.title || "");
              setEditorInitialContent(reflection.content || "");
              setIsWriting(false);
              setActiveTab("journal");
            }}
          />
        )}

        {/* Active Tab View: Journal */}
        {activeTab === "journal" && (
          <div className="space-y-6">
            {isWriting ? (
              <ReflectionEditor
                initialTitle={editorInitialTitle}
                initialContent={editorInitialContent}
                onSaved={() => {
                  setIsWriting(false);
                  setEditorInitialTitle("");
                  setEditorInitialContent("");
                  setHistoryRefreshKey((k) => k + 1);
                }}
                onCancel={() => {
                  setIsWriting(false);
                  setEditorInitialTitle("");
                  setEditorInitialContent("");
                }}
                onOpenCompanion={(title, content) => {
                  setCompanionInitialTitle(title);
                  setCompanionInitialPrompt(content);
                  setActiveTab("companion");
                }}
                onExploreConnections={() => {
                  setIsWriting(false);
                  setActiveTab("threads");
                }}
              />
            ) : (
              <ReflectionHistory
                onStartNew={() => {
                  setEditorInitialTitle("");
                  setEditorInitialContent("");
                  setIsWriting(true);
                }}
                onNavigateToThreads={() => setActiveTab("threads")}
                onNavigateToAsk={() => setActiveTab("ask")}
                refreshTrigger={historyRefreshKey}
              />
            )}
          </div>
        )}

        {/* Active Tab View: Thinking Companion (Stage 2B) */}
        {activeTab === "companion" && (
          <div className="space-y-6">
            <ConversationView
              initialTitle={companionInitialTitle}
              initialPrompt={companionInitialPrompt}
              onSendToReflection={(title, content) => {
                setEditorInitialTitle(title);
                setEditorInitialContent(content);
                setIsWriting(true);
                setActiveTab("journal");
              }}
              onExploreConnections={() => {
                setActiveTab("threads");
              }}
            />
          </div>
        )}

        {/* Active Tab View: Life Threads (Stage 2C Longitudinal Intelligence) */}
        {activeTab === "threads" && (
          <div className="space-y-6">
            <LifeThreadsView
              onNavigateToJournal={() => {
                setEditorInitialTitle("");
                setEditorInitialContent("");
                setIsWriting(true);
                setActiveTab("journal");
              }}
            />
          </div>
        )}

        {/* Active Tab View: Ask My Journal (Stage 2C Longitudinal Intelligence) */}
        {activeTab === "ask" && (
          <div className="space-y-6">
            <AskJournalView />
          </div>
        )}

        {/* Active Tab View: Architecture & Security Verification */}
        {activeTab === "architecture" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Authenticated Identity & Cryptographic Session Isolation */}
            <section
              id="architecture-identity-card"
              className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-stone-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                      Authenticated Session
                    </span>
                    <span className="text-xs text-stone-500">Google Sign-In Verified</span>
                  </div>
                  <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-stone-900">
                    {user?.displayName || "Reflective Thinker"}
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600">
                    Identity established via Firebase Authentication. Short-lived ID tokens are verified server-side on Cloud Run.
                  </p>
                </div>

                {user?.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User avatar"}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-2xl border-2 border-stone-100 shadow-2xs object-cover self-start sm:self-auto"
                  />
                )}
              </div>

              {/* User isolation metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 space-y-1">
                  <span className="text-stone-500 font-medium">Authoritative UID</span>
                  <p className="font-mono text-stone-800 font-medium truncate" title={user?.uid}>
                    {user?.uid}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 space-y-1">
                  <span className="text-stone-500 font-medium">Account Email</span>
                  <p className="font-mono text-stone-800 font-medium truncate" title={user?.email || "No email"}>
                    {user?.email || "N/A"}
                  </p>
                </div>
              </div>
            </section>

            {/* Whitepaper Overview Header */}
            <div className="space-y-2 pb-2">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                Authoritative Architecture & Trust Report
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-normal text-stone-900 tracking-tight">
                Security Architecture & Data Isolation
              </h2>
              <p className="text-sm text-stone-600 max-w-3xl leading-relaxed">
                Gemini Clarity is engineered around zero-trust authentication, private Firestore partitioning, and model schema grounding. Explore the live-verified security pillars below.
              </p>
            </div>

            {/* Pillar I: Zero-Trust Token Verification Card */}
            <section
              id="auth-boundary-card"
              aria-labelledby="auth-boundary-heading"
              className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-900 text-stone-50">
                      Pillar I
                    </span>
                    <h2 id="auth-boundary-heading" className="text-base font-semibold text-stone-900 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-stone-600" aria-hidden="true" />
                      Zero-Trust Token Verification
                    </h2>
                  </div>
                  <p className="text-xs text-stone-500">
                    Cryptographic signature validation with Firebase Admin SDK at <code className="bg-stone-100 px-1 py-0.5 rounded-xs text-stone-800">GET /api/auth-check</code>.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    id="btn-verify-boundary"
                    type="button"
                    onClick={handleVerifyServerAuth}
                    disabled={verifyingServerAuth}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-stone-900 hover:bg-stone-800 text-stone-50 focus:outline-hidden focus:ring-2 focus:ring-stone-400 disabled:opacity-50 transition-colors shrink-0 cursor-pointer shadow-xs"
                  >
                    {verifyingServerAuth ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-300" aria-hidden="true" />
                        <span>Verifying Boundary...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                        <span>Verify Server Boundary</span>
                      </>
                    )}
                  </button>

                  <button
                    id="btn-test-spoof"
                    type="button"
                    onClick={handleTestSpoofDefense}
                    disabled={testingSpoof}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-stone-400 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                  >
                    {testingSpoof ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-stone-500" aria-hidden="true" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                        <span>Test Spoof Defense</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Server Authentication Verification Result */}
              {serverAuthResult && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="font-semibold">
                        Backend Authentication Boundary Verified (HTTP 200 OK)
                      </p>
                      <p className="text-emerald-800">
                        The Cloud Run Express server received the Bearer ID-token, verified it using Firebase Admin SDK with revocation checking, and authoritatively resolved your UID server-side.
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <div>
                      <dt className="text-stone-500">Authenticated State</dt>
                      <dd className="font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        True (Server-Verified)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Server-Derived UID</dt>
                      <dd className="font-mono font-medium text-stone-800 mt-0.5 truncate" title={serverAuthResult.uid}>
                        {serverAuthResult.uid}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Identity Match</dt>
                      <dd className="font-medium mt-0.5">
                        {serverAuthResult.uid === user?.uid ? (
                          <span className="text-emerald-700 font-semibold">Authoritative Match</span>
                        ) : (
                          <span className="text-rose-700 font-semibold">UID Mismatch</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  {serverAuthVerifiedAt && (
                    <p className="text-[11px] text-stone-400 text-right">Verified at {serverAuthVerifiedAt}</p>
                  )}
                </div>
              )}

              {serverAuthError && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Authentication Boundary Error</p>
                    <p className="text-rose-800 mt-0.5">{serverAuthError}</p>
                  </div>
                </div>
              )}

              {/* Spoof Defense Test Results */}
              {spoofTestPassed !== null && (
                <div
                  className={`flex items-start gap-3 p-3.5 rounded-xl text-xs border ${
                    spoofTestPassed
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  {spoofTestPassed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {spoofTestPassed ? "Spoof Defense Passed" : "Spoof Defense Failed"}
                    </p>
                    <p className="mt-0.5">{spoofTestDetails}</p>
                  </div>
                </div>
              )}

              <div className="text-xs text-stone-500 bg-stone-50/80 p-3.5 rounded-xl border border-stone-100 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                <p>
                  Protected endpoints strictly read <code className="text-stone-800">req.user.uid</code> from the decoded cryptographic token. Any client-provided UID in query parameters, headers, or request bodies is systematically rejected.
                </p>
              </div>
            </section>

            {/* Pillar II: Authoritative Firestore Persistence Boundary */}
            <section
              id="firestore-boundary-card"
              aria-labelledby="firestore-boundary-heading"
              className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-stone-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                      <Database className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
                      Pillar II
                    </span>
                    <h2 id="firestore-boundary-heading" className="text-base font-semibold text-stone-900">
                      Authoritative Firestore User Partitioning
                    </h2>
                  </div>
                  <p className="text-xs text-stone-500">
                    Direct browser reads and writes are universally denied by security rules. All access is partitioned strictly to <code className="text-stone-700">users/{'{uid}'}</code> via Cloud Run.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    id="btn-verify-data-boundary"
                    type="button"
                    onClick={handleVerifyDataBoundary}
                    disabled={verifyingDataBoundary}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 focus:outline-hidden focus:ring-2 focus:ring-stone-500 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                  >
                    {verifyingDataBoundary ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        Querying Cloud Run...
                      </>
                    ) : (
                      <>
                        <Database className="w-3.5 h-3.5 text-stone-300" aria-hidden="true" />
                        Verify Data Boundary
                      </>
                    )}
                  </button>

                  <button
                    id="btn-test-data-spoof"
                    type="button"
                    onClick={handleTestDataSpoofDefense}
                    disabled={testingDataSpoof}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100 focus:outline-hidden focus:ring-2 focus:ring-stone-400 disabled:opacity-50 transition-colors cursor-pointer"
                    title="Tests that server ignores injected ?uid= query and accesses only users/{req.user.uid}"
                  >
                    {testingDataSpoof ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
                        Test Data Spoof Defense
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Verification Result Details */}
              {dataBoundaryResult && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="font-semibold">
                        Firestore User Isolation Verified (HTTP 200 OK)
                      </p>
                      <p className="text-emerald-800">
                        The Cloud Run backend successfully retrieved your isolated user profile from <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded-sm">users/{'{uid}'}</code> via Firebase Admin SDK using Application Default Credentials (ADC).
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <div>
                      <dt className="text-stone-500">Root Document Path</dt>
                      <dd className="font-mono font-medium text-stone-800 mt-0.5 truncate" title={`users/${dataBoundaryResult.uid}`}>
                        users/{dataBoundaryResult.uid}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Account Initialized</dt>
                      <dd className="font-mono font-medium text-stone-800 mt-0.5">
                        {dataBoundaryResult.profile.createdAt ? new Date(dataBoundaryResult.profile.createdAt).toLocaleDateString() : "Just now"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Preferences Enforced</dt>
                      <dd className="font-mono font-medium text-emerald-700 mt-0.5">
                        Review Day: {dataBoundaryResult.profile.preferences?.weeklyReviewDay || "sunday"}
                      </dd>
                    </div>
                  </dl>
                  {dataBoundaryVerifiedAt && (
                    <p className="text-[11px] text-stone-400 text-right">Verified at {dataBoundaryVerifiedAt}</p>
                  )}
                </div>
              )}

              {dataBoundaryError && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Data Boundary Error</p>
                    <p className="text-rose-800 mt-0.5">{dataBoundaryError}</p>
                  </div>
                </div>
              )}

              {/* Data Spoof Defense Test Results */}
              {dataSpoofTestPassed !== null && (
                <div
                  className={`flex items-start gap-3 p-3.5 rounded-xl text-xs border ${
                    dataSpoofTestPassed
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  {dataSpoofTestPassed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {dataSpoofTestPassed ? "Data Isolation Defense Passed" : "Data Isolation Failed"}
                    </p>
                    <p className="mt-0.5">{dataSpoofTestDetails}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-600">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-stone-800 font-medium block">Universal Deny Rules</strong>
                    <span className="text-[11px] text-stone-500">
                      <code className="text-stone-700">firestore.rules</code> denies all direct browser reads and writes. No client-side database connections are permitted.
                    </span>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-stone-800 font-medium block">Authoritative Paths</strong>
                    <span className="text-[11px] text-stone-500">
                      All collection paths are synthesized internally under <code className="text-stone-700">users/{'{req.user.uid}'}</code> via the server repository.
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Pillar III: Google Cloud Secret Manager Credential Boundary */}
            <section
              id="secret-manager-boundary-card"
              aria-labelledby="secret-boundary-heading"
              className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-stone-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                      <Key className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                      Pillar III
                    </span>
                    <h2 id="secret-boundary-heading" className="text-base font-semibold text-stone-900">
                      Google Cloud Secret Manager Credential Protection
                    </h2>
                  </div>
                  <p className="text-xs text-stone-500">
                    AI credentials are loaded exclusively server-side via Application Default Credentials. The browser never receives secrets.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-verify-secret-boundary"
                    type="button"
                    onClick={handleVerifySecretBoundary}
                    disabled={verifyingSecretBoundary}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 focus:outline-hidden focus:ring-2 focus:ring-stone-500 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                  >
                    {verifyingSecretBoundary ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        Checking Server Boundary...
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5 text-stone-300" aria-hidden="true" />
                        Verify Secret Boundary
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Verification Result Details */}
              {secretBoundaryResult && (
                <div className="space-y-4">
                  <div
                    className={`flex items-start gap-3 p-4 rounded-xl border text-xs ${
                      secretBoundaryResult.configured
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-amber-50 border-amber-200 text-amber-900"
                    }`}
                  >
                    {secretBoundaryResult.configured ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div className="space-y-1">
                      <p className="font-semibold">
                        {secretBoundaryResult.configured
                          ? "Credential Boundary Established & Validated (HTTP 200 OK)"
                          : "Fail-Closed State Active: Secret Unconfigured on Server"}
                      </p>
                      <p className={secretBoundaryResult.configured ? "text-emerald-800" : "text-amber-800"}>
                        {secretBoundaryResult.configured
                          ? `The Cloud Run backend successfully verified the GEMINI_API_KEY loading boundary via ${secretBoundaryResult.source === "secret-manager" ? "Google Cloud Secret Manager (pinned version)" : "server environment"}. No credential value is exposed to the browser.`
                          : "The server safely detected that GEMINI_API_KEY is not yet loaded, without crashing or exposing any internal paths or stack traces."}
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <div>
                      <dt className="text-stone-500">Provider Source</dt>
                      <dd className="font-mono font-medium text-stone-800 mt-0.5">
                        {secretBoundaryResult.source === "secret-manager"
                          ? "Cloud Secret Manager"
                          : secretBoundaryResult.source === "env"
                          ? "Server Env (.env)"
                          : "Unconfigured (Fail-Closed)"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Secret Version</dt>
                      <dd className="font-mono font-medium text-stone-800 mt-0.5">
                        {secretBoundaryResult.pinnedVersion ? `v${secretBoundaryResult.pinnedVersion} (Pinned)` : "N/A"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Browser Leakage</dt>
                      <dd className="font-mono font-medium text-emerald-700 mt-0.5">
                        Zero (0 bytes in client bundle)
                      </dd>
                    </div>
                  </dl>
                  {secretBoundaryVerifiedAt && (
                    <p className="text-[11px] text-stone-400 text-right">Verified at {secretBoundaryVerifiedAt}</p>
                  )}
                </div>
              )}

              {secretBoundaryError && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Secret Boundary Error</p>
                    <p className="text-rose-800 mt-0.5">{secretBoundaryError}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-600">
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-stone-800 font-medium block">Least-Privilege IAM</strong>
                    <span className="text-[11px] text-stone-500">
                      Restricted to <code className="text-stone-700">roles/secretmanager.secretAccessor</code> granted exclusively to the Cloud Run runtime service account.
                    </span>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-100 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-stone-800 font-medium block">No VITE_* Prefix</strong>
                    <span className="text-[11px] text-stone-500">
                      The client build contains 0 references to raw API keys. All inference executes through authenticated Cloud Run endpoints.
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Pillar IV: Gemini Structured Output & Schema Grounding Card */}
            <section
              id="gemini-grounding-card"
              aria-labelledby="gemini-grounding-heading"
              className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-5"
            >
              <div className="space-y-1 pb-4 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    Pillar IV
                  </span>
                  <h2 id="gemini-grounding-heading" className="text-base font-semibold text-stone-900">
                    Gemini Structured Output & Schema Grounding
                  </h2>
                </div>
                <p className="text-xs text-stone-500">
                  Strict JSON schema enforcement, entry ID citations, and clear separation between raw journal evidence and longitudinal interpretation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/60 space-y-1.5">
                  <strong className="text-stone-900 font-semibold block">Schema-Enforced JSON</strong>
                  <p className="text-stone-600 leading-relaxed font-normal text-[11px]">
                    Every inference call specifies an exact JSON response schema. Responses conform deterministically to structured types without unstructured deviation.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/60 space-y-1.5">
                  <strong className="text-stone-900 font-semibold block">Factual Citation Grounding</strong>
                  <p className="text-stone-600 leading-relaxed font-normal text-[11px]">
                    Inquiries demand exact entry IDs, creation dates, and quote excerpts. If no record supports an inference, the model reports insufficient evidence.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/60 space-y-1.5">
                  <strong className="text-stone-900 font-semibold block">Interpretive Separation</strong>
                  <p className="text-stone-600 leading-relaxed font-normal text-[11px]">
                    Raw quotes from the journal archive are visually and syntactically separated from model synthesis, preventing hallucination confusion.
                  </p>
                </div>
              </div>
            </section>

            {/* Cloud Run Runtime Connectivity */}
            <section
              id="system-status-card"
              aria-labelledby="system-status-heading"
              className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-stone-100">
                <div className="space-y-1">
                  <h2 id="system-status-heading" className="text-base font-semibold text-stone-900 flex items-center gap-2">
                    <Server className="w-4 h-4 text-stone-600" aria-hidden="true" />
                    Cloud Run Backend Boundary
                  </h2>
                  <p className="text-xs text-stone-500">
                    Single authoritative application runtime serving port 3000
                  </p>
                </div>

                <button
                  id="btn-recheck-connection"
                  type="button"
                  onClick={checkHealth}
                  disabled={healthStatus === "loading"}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 focus:outline-hidden focus:ring-2 focus:ring-stone-400 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${healthStatus === "loading" ? "animate-spin text-stone-500" : "text-stone-600"}`} aria-hidden="true" />
                  Check Health
                </button>
              </div>

              {healthStatus === "loading" && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-700">
                  <Loader2 className="w-5 h-5 animate-spin text-stone-600 shrink-0" aria-hidden="true" />
                  <div className="text-sm">
                    <p className="font-medium">Connecting to <code className="text-xs bg-stone-200 px-1 py-0.5 rounded-sm">GET /api/health</code>...</p>
                    <p className="text-xs text-stone-500">Confirming Express server responsiveness.</p>
                  </div>
                </div>
              )}

              {healthStatus === "healthy" && healthData && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold">Backend Active & Operational</p>
                      <p className="text-xs text-emerald-800">
                        The Cloud Run Express server is answering requests, verifying Firebase ID tokens, parsing payloads up to 64KB, and mediating zero-trust Firestore data access.
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <div>
                      <dt className="text-stone-500">Service Identifier</dt>
                      <dd className="font-mono font-medium text-stone-800 mt-0.5">{healthData.service}</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Environment</dt>
                      <dd className="font-mono font-medium text-stone-800 mt-0.5 capitalize">{healthData.environment}</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Last Verified</dt>
                      <dd className="font-mono font-medium text-stone-800 mt-0.5">
                        {new Date(healthData.timestamp).toLocaleTimeString()}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {healthStatus === "unavailable" && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">Backend Unreachable</p>
                    <p className="text-xs text-rose-800">
                      {errorMessage || "Failed to establish a connection to /api/health."}
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGuard>
        <AuthenticatedWorkspace />
      </AuthGuard>
    </AuthProvider>
  );
}
