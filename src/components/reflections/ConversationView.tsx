import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  RotateCcw,
  Shield,
  MessageSquare,
  Compass,
  Lightbulb,
  Search,
  Scale,
  Plus,
  History,
  Trash2,
  BookOpen,
  X,
  CheckCircle2,
  GitCommit,
  BookmarkPlus,
  CornerDownRight,
} from "lucide-react";
import {
  sendConversationMessage,
  listConversations,
  getConversation,
  deleteConversation,
  ApiError,
} from "../../services/apiClient";
import type { Conversation, ConversationMode, Message } from "../../types/journal";

interface ConversationViewProps {
  initialPrompt?: string;
  initialTitle?: string;
  initialMode?: ConversationMode;
  onSendToReflection?: (title: string, content: string) => void;
  onExploreConnections?: (reflectionId?: string) => void;
  onClose?: () => void;
}

const MODE_CONFIG: Record<
  ConversationMode,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  }
> = {
  reflect: {
    label: "Reflect",
    description: "Explore feelings, assumptions, and unspoken angles without rushing to solutions",
    icon: Compass,
    accentColor: "text-amber-700 bg-amber-50 border-amber-200",
  },
  brainstorm: {
    label: "Brainstorm",
    description: "Generate, broaden, and creatively combine possibilities and ideas",
    icon: Lightbulb,
    accentColor: "text-sky-700 bg-sky-50 border-sky-200",
  },
  clarify: {
    label: "Clarify",
    description: "Untangle complexity, articulate priorities, and pinpoint the core dilemma",
    icon: Search,
    accentColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  decide: {
    label: "Decide",
    description: "Structure trade-offs, examine criteria, and evaluate decisions conversationally",
    icon: Scale,
    accentColor: "text-purple-700 bg-purple-50 border-purple-200",
  },
};

const DRAFT_CONVERSATION_KEY = "gemini_clarity_conversation_draft";

export const ConversationView: React.FC<ConversationViewProps> = ({
  initialPrompt = "",
  initialTitle = "",
  initialMode = "reflect",
  onSendToReflection,
  onExploreConnections,
  onClose,
}) => {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>(() => {
    if (initialPrompt) return initialPrompt;
    return sessionStorage.getItem(DRAFT_CONVERSATION_KEY) || "";
  });
  const [mode, setMode] = useState<ConversationMode>(initialMode);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAttemptedMessage, setLastAttemptedMessage] = useState<string | null>(null);
  const [lastAttemptedIdempotencyKey, setLastAttemptedIdempotencyKey] = useState<string | null>(null);

  // History Drawer / Modal state
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [savedConversations, setSavedConversations] = useState<Conversation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [transferredToJournal, setTransferredToJournal] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Save draft input to sessionStorage
  useEffect(() => {
    if (inputMessage.trim()) {
      sessionStorage.setItem(DRAFT_CONVERSATION_KEY, inputMessage);
    } else {
      sessionStorage.removeItem(DRAFT_CONVERSATION_KEY);
    }
  }, [inputMessage]);

  // Adjust textarea height dynamically
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 240)}px`;
    }
  };

  // Generate safe idempotency key
  const generateIdempotencyKey = () =>
    `turn_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  const handleSendMessage = async (retryMessage?: string, retryKey?: string) => {
    const textToSend = (retryMessage || inputMessage).trim();
    if (!textToSend || isLoading) return;

    setError(null);
    setIsLoading(true);
    setLastAttemptedMessage(textToSend);

    const idempotencyKey = retryKey || generateIdempotencyKey();
    setLastAttemptedIdempotencyKey(idempotencyKey);

    // Optimistically create temporary user message in UI
    const tempUserMsg: Message = {
      id: `temp_${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    if (!retryMessage) {
      setInputMessage("");
      sessionStorage.removeItem(DRAFT_CONVERSATION_KEY);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }

    try {
      const response = await sendConversationMessage({
        conversationId: activeConversation?.id,
        message: textToSend,
        mode,
        title: activeConversation ? undefined : initialTitle || textToSend.slice(0, 40),
        idempotencyKey,
      });

      // Update authoritative state from server
      setActiveConversation(response.conversation);
      setMessages(response.conversation.messages);
      setLastAttemptedMessage(null);
      setLastAttemptedIdempotencyKey(null);
    } catch (err: unknown) {
      // Remove optimistic message so user can retry cleanly
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      // Restore input message if it was cleared
      setInputMessage(textToSend);

      let userMsg = "The thinking companion encountered a temporary disruption. Your thought is saved.";
      if (err instanceof ApiError) {
        userMsg = err.message;
      } else if (err instanceof Error) {
        userMsg = err.message;
      }
      setError(userMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartNewConversation = () => {
    setActiveConversation(null);
    setMessages([]);
    setInputMessage("");
    setError(null);
    setTransferredToJournal(false);
    sessionStorage.removeItem(DRAFT_CONVERSATION_KEY);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const loadHistoryList = async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await listConversations(50);
      setSavedConversations(res.conversations);
    } catch (err: unknown) {
      setHistoryError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenHistory = () => {
    setShowHistoryModal(true);
    loadHistoryList();
  };

  const handleSelectConversation = async (conv: Conversation) => {
    setShowHistoryModal(false);
    setError(null);
    setIsLoading(true);
    try {
      const res = await getConversation(conv.id);
      setActiveConversation(res.conversation);
      setMessages(res.conversation.messages);
      setMode(res.conversation.mode || "reflect");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load conversation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this private conversation?")) {
      return;
    }
    setDeletingId(convId);
    try {
      await deleteConversation(convId);
      setSavedConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversation?.id === convId) {
        handleStartNewConversation();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete conversation");
    } finally {
      setDeletingId(null);
    }
  };

  const handleTransferToReflection = () => {
    if (!onSendToReflection) return;
    const title = activeConversation?.title || "Reflection from Thinking Dialogue";
    const dialogueSummary = messages
      .map((m) => `${m.role === "user" ? "My Thought:" : "Companion Insight:"}\n${m.content}`)
      .join("\n\n---\n\n");

    onSendToReflection(title, dialogueSummary);
    setTransferredToJournal(true);
  };

  const CurrentModeIcon = MODE_CONFIG[mode].icon;

  return (
    <div
      id="conversation-view-container"
      className="flex flex-col h-[calc(100vh-14rem)] min-h-[580px] bg-stone-50 border border-stone-200/90 rounded-2xl shadow-xs overflow-hidden"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-white border-b border-stone-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-stone-900 text-stone-100 flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-stone-900 tracking-tight font-serif">
                {activeConversation ? activeConversation.title : "Gemini Thinking Companion"}
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-full">
                <Shield className="w-3 h-3 text-emerald-600" />
                Private Reflection
              </span>
            </div>
            <p className="text-xs text-stone-600">
              Multi-turn dialogue exploring internal thoughts with zero credential exposure
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          {messages.length > 0 && onSendToReflection && (
            <button
              id="transfer-to-reflection-btn"
              onClick={handleTransferToReflection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 border border-stone-200 rounded-lg transition-colors cursor-pointer"
              title="Transfer conversation to Reflection Editor"
            >
              {transferredToJournal ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Transferred
                </>
              ) : (
                <>
                  <BookOpen className="w-3.5 h-3.5 text-stone-600" />
                  Save to Journal
                </>
              )}
            </button>
          )}

          <button
            id="start-new-dialogue-btn"
            onClick={handleStartNewConversation}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>

          <button
            id="open-history-btn"
            onClick={handleOpenHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-stone-600" />
            History
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mode Selector Strip */}
      <div className="px-5 py-2.5 bg-stone-100/60 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-stone-600 font-medium mr-1">Thinking Mode:</span>
          {(Object.keys(MODE_CONFIG) as ConversationMode[]).map((m) => {
            const cfg = MODE_CONFIG[m];
            const Icon = cfg.icon;
            const isSelected = mode === m;
            return (
              <button
                key={m}
                id={`mode-btn-${m}`}
                onClick={() => setMode(m)}
                disabled={isLoading}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? `${cfg.accentColor} shadow-xs font-semibold ring-1 ring-stone-300`
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/70 border border-transparent"
                }`}
              >
                <Icon className="w-3 h-3" />
                {cfg.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-stone-600 italic hidden sm:block">
          {MODE_CONFIG[mode].description}
        </p>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-100/60 border border-amber-200/80 flex items-center justify-center text-amber-800 mb-4">
              <CurrentModeIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif font-medium text-stone-900 mb-1">
              Begin a Thinking Dialogue
            </h3>
            <p className="text-xs text-stone-600 mb-6 leading-relaxed">
              Share a thought, a swirling question, or an unrefined reflection. Gemini Clarity will
              help you unpack assumptions without rushing to superficial advice.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-left">
              <button
                onClick={() =>
                  setInputMessage("I'm feeling ambivalent about a major decision at work...")
                }
                className="p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-100/80 text-xs text-stone-700 transition-colors text-left"
              >
                "I'm feeling ambivalent about a major decision..."
              </button>
              <button
                onClick={() =>
                  setInputMessage("I notice a recurring hesitation whenever I try to speak up...")
                }
                className="p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-100/80 text-xs text-stone-700 transition-colors text-left"
              >
                "I notice a recurring hesitation when..."
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col w-full my-4 ${isUser ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-1.5 px-2 text-xs text-stone-500">
                  {isUser ? (
                    <span className="font-medium text-stone-700">My Thought</span>
                  ) : (
                    <span className="flex items-center gap-1.5 font-medium text-stone-800">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Gemini Clarity • {MODE_CONFIG[mode].label}</span>
                    </span>
                  )}
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>

                {isUser ? (
                  <div className="max-w-xl bg-stone-900 text-stone-50 rounded-3xl rounded-tr-xs px-6 py-4 text-sm sm:text-base leading-relaxed whitespace-pre-wrap shadow-xs">
                    {msg.content}
                  </div>
                ) : (
                  <div className="w-full max-w-2xl bg-white border border-stone-200/90 rounded-3xl rounded-tl-xs p-6 sm:p-7 shadow-xs text-stone-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-normal space-y-4">
                    <div>{msg.content}</div>

                    {/* Contextual actions below Gemini responses */}
                    <div className="pt-4 border-t border-stone-100 flex flex-wrap items-center gap-2 text-xs">
                      {onExploreConnections && (
                        <button
                          type="button"
                          onClick={() => onExploreConnections()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 transition-all font-medium cursor-pointer"
                        >
                          <GitCommit className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Explore connection</span>
                        </button>
                      )}

                      {onSendToReflection && (
                        <button
                          type="button"
                          onClick={() => {
                            const title = activeConversation?.title || `Reflection: ${MODE_CONFIG[mode].label}`;
                            onSendToReflection(title, msg.content);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200/80 text-stone-700 border border-stone-200/80 transition-all font-medium cursor-pointer"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5 text-stone-600" />
                          <span>Save reflection</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setInputMessage("Regarding this perspective, ");
                          textareaRef.current?.focus();
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200/60 transition-all font-medium cursor-pointer sm:ml-auto"
                      >
                        <CornerDownRight className="w-3.5 h-3.5 text-stone-400" />
                        <span>Continue thinking</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Thinking Indicator */}
        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-stone-600 font-medium">
              <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" />
              Gemini Clarity is thinking...
            </div>
            <div className="bg-white border border-stone-200/90 rounded-2xl rounded-tl-xs p-4 shadow-xs flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-stone-600 animate-spin" />
              <span className="text-xs text-stone-600 font-serif italic">
                Reflecting on nuance and internal tensions...
              </span>
            </div>
          </div>
        )}

        {/* Error notification & retry button */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50/80 border border-red-200 text-red-800 text-xs flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Unable to complete turn</p>
                <p className="text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
            {lastAttemptedMessage && (
              <button
                id="retry-turn-btn"
                onClick={() =>
                  handleSendMessage(
                    lastAttemptedMessage,
                    lastAttemptedIdempotencyKey || undefined
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-900 rounded-lg transition-colors shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 bg-white border-t border-stone-200">
        <div className="relative border border-stone-300 focus-within:border-stone-500 rounded-2xl bg-white shadow-2xs transition-all">
          <textarea
            ref={textareaRef}
            id="companion-message-input"
            value={inputMessage}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder={`Reflect with Gemini in ${MODE_CONFIG[mode].label} mode... (Enter to send, Shift+Enter for newline)`}
            rows={2}
            maxLength={10000}
            disabled={isLoading}
            className="w-full px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 bg-transparent resize-none focus:outline-none"
          />

          <div className="flex items-center justify-between px-3 py-2 border-t border-stone-100 text-xs text-stone-600">
            <span className="text-[11px]">
              {inputMessage.length > 0 && `${inputMessage.length}/10,000`}
            </span>

            <div className="flex items-center gap-2">
              <button
                id="send-companion-message-btn"
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isLoading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-stone-100 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Reflecting...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-stone-700" />
                <h3 className="text-base font-semibold text-stone-900 font-serif">
                  Saved Thinking Dialogues
                </h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 divide-y divide-stone-100">
              {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-stone-600 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs">Loading authorized conversations...</span>
                </div>
              ) : historyError ? (
                <div className="py-8 text-center text-red-600 text-xs">{historyError}</div>
              ) : savedConversations.length === 0 ? (
                <div className="py-12 text-center text-stone-600 text-xs">
                  No saved conversations yet. Start a dialogue above.
                </div>
              ) : (
                savedConversations.map((conv) => {
                  const modeCfg = MODE_CONFIG[conv.mode || "reflect"];
                  const Icon = modeCfg.icon;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-stone-50 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 shrink-0 border ${modeCfg.accentColor}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-stone-900 truncate">
                            {conv.title}
                          </h4>
                          <p className="text-[11px] text-stone-600 mt-0.5">
                            {conv.messages?.length || 0} turns •{" "}
                            {new Date(conv.updatedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        disabled={deletingId === conv.id}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete conversation"
                      >
                        {deletingId === conv.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 text-right">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
