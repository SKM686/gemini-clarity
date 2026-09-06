import React, { useState, useEffect, useRef } from "react";
import {
  PenLine,
  Save,
  RotateCcw,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  ShieldCheck,
  GitCommit,
} from "lucide-react";
import { createReflection, ReflectionItem } from "../../services/apiClient";

interface ReflectionEditorProps {
  onSaved: (reflection: ReflectionItem) => void;
  onCancel: () => void;
  onOpenCompanion?: (title: string, content: string) => void;
  onExploreConnections?: (reflectionId?: string) => void;
  initialTitle?: string;
  initialContent?: string;
}

const DRAFT_SESSION_KEY = "gemini_clarity_active_draft";

export const ReflectionEditor: React.FC<ReflectionEditorProps> = ({
  onSaved,
  onCancel,
  onOpenCompanion,
  onExploreConnections,
  initialTitle = "",
  initialContent = "",
}) => {
  // Load draft from session memory if present
  const [title, setTitle] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title) return parsed.title;
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
    return initialTitle;
  });

  const [content, setContent] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.content) return parsed.content;
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
    return initialContent;
  });

  // Client-generated stable idempotency key for this draft session
  // Retrying the save with the same key guarantees no duplicate records are created
  const idempotencyKeyRef = useRef<string>("");
  if (!idempotencyKeyRef.current) {
    try {
      const saved = sessionStorage.getItem(DRAFT_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.idempotencyKey && typeof parsed.idempotencyKey === "string") {
          idempotencyKeyRef.current = parsed.idempotencyKey;
        }
      }
    } catch {
      // ignore
    }
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }
  }

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; content?: string }>({});
  const [savedReflection, setSavedReflection] = useState<ReflectionItem | null>(null);

  // In-session draft persistence (sessionStorage only - never localStorage or persistent tracking)
  useEffect(() => {
    if (status === "saved") return;
    try {
      if (title.trim() || content.trim()) {
        sessionStorage.setItem(
          DRAFT_SESSION_KEY,
          JSON.stringify({
            title,
            content,
            idempotencyKey: idempotencyKeyRef.current,
            updatedAt: new Date().toISOString(),
          })
        );
      } else {
        sessionStorage.removeItem(DRAFT_SESSION_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [title, content, status]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    const errors: { title?: string; content?: string } = {};
    if (!trimmedTitle) {
      errors.title = "Title is required.";
    } else if (trimmedTitle.length > 200) {
      errors.title = "Title is too long (maximum 200 characters).";
    }

    if (!trimmedContent) {
      errors.content = "Reflection content cannot be empty.";
    } else if (trimmedContent.length > 65536) {
      errors.content = "Content exceeds maximum size (64KB).";
    }

    if (errors.title || errors.content) {
      setFieldErrors(errors);
      setErrorMessage(errors.title || errors.content || "Validation error");
      return;
    }

    setFieldErrors({});
    setStatus("saving");
    setErrorMessage(null);

    try {
      // Idempotent save using stable client key
      const key = idempotencyKeyRef.current;
      const response = await createReflection(trimmedTitle, trimmedContent, key);

      // Persistence confirmed by Cloud Run & Firestore
      setStatus("saved");
      setSavedReflection(response.reflection);

      // Safe draft cleanup now that write is verified
      try {
        sessionStorage.removeItem(DRAFT_SESSION_KEY);
      } catch {
        // ignore
      }

      // Notify parent after brief confirmation window
      setTimeout(() => {
        onSaved(response.reflection);
      }, 900);
    } catch (err: unknown) {
      // Persistence guarantee: Never clear user's input on failure
      setStatus("error");
      const errorText =
        err instanceof Error ? err.message : "Network or server communication error";
      setErrorMessage(errorText);
    }
  };

  const handleCancel = () => {
    const hasUnsavedWork = (title.trim().length > 0 || content.trim().length > 0) && status !== "saved";
    if (hasUnsavedWork) {
      let confirmDiscard = true;
      try {
        confirmDiscard = window.confirm(
          "You have an unsaved reflection draft. Are you sure you want to leave? Your draft will remain saved in this browser session until cleared."
        );
      } catch {
        confirmDiscard = true;
      }
      if (!confirmDiscard) return;
    }
    onCancel();
  };

  const handleClearDraft = () => {
    let confirmClear = true;
    try {
      confirmClear = window.confirm("Are you sure you want to discard this entire draft?");
    } catch {
      confirmClear = true;
    }
    if (confirmClear) {
      setTitle("");
      setContent("");
      setStatus("idle");
      setErrorMessage(null);
      try {
        sessionStorage.removeItem(DRAFT_SESSION_KEY);
      } catch {
        // ignore
      }
    }
  };

  const handleExploreConnections = async () => {
    if (!onExploreConnections) return;

    if (title.trim() && content.trim() && status !== "saved") {
      try {
        setStatus("saving");
        const key = idempotencyKeyRef.current;
        const response = await createReflection(title.trim(), content.trim(), key);
        setStatus("saved");
        setSavedReflection(response.reflection);
        try {
          sessionStorage.removeItem(DRAFT_SESSION_KEY);
        } catch {
          // ignore
        }
        onSaved(response.reflection);
        onExploreConnections(response.reflection.id);
      } catch (err: unknown) {
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to save reflection before exploring connections"
        );
      }
    } else {
      onExploreConnections(savedReflection?.id);
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div
      id="reflection-editor"
      aria-label="Reflection Editor"
      className="bg-white border border-stone-200/90 rounded-3xl shadow-xs overflow-hidden transition-all"
    >
      {/* Editor Header */}
      <div className="px-6 sm:px-8 py-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/40">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center text-stone-50 shadow-2xs">
            <PenLine className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-serif font-medium text-stone-900 tracking-tight">Thought Journal</h2>
            <div className="flex items-center space-x-2 text-[11px] text-stone-500">
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Private</span>
              </span>
              <span>&bull;</span>
              <span>Distraction-free notebook</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          {(title.trim() || content.trim()) && status !== "saving" && status !== "saved" && (
            <button
              id="btn-clear-draft"
              type="button"
              onClick={handleClearDraft}
              className="text-xs text-stone-400 hover:text-stone-700 px-2.5 py-1.5 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}

          <button
            id="btn-cancel-reflection"
            type="button"
            onClick={handleCancel}
            disabled={status === "saving"}
            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Close</span>
          </button>

          {onOpenCompanion && (title.trim() || content.trim()) && (
            <button
              id="btn-explore-with-gemini"
              type="button"
              onClick={() => onOpenCompanion(title, content)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 rounded-xl transition-colors cursor-pointer"
              title="Transition reflection to deepen with Gemini"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
              <span>Deepen with Gemini</span>
            </button>
          )}

          {onExploreConnections && (
            <button
              id="btn-explore-connections"
              type="button"
              onClick={handleExploreConnections}
              disabled={status === "saving"}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/90 rounded-xl transition-colors cursor-pointer"
              title="Connect this reflection with Life Threads"
            >
              <GitCommit className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>Connect with Life Threads</span>
            </button>
          )}

          <button
            id="btn-save-reflection"
            type="button"
            onClick={handleSave}
            disabled={status === "saving" || status === "saved" || !title.trim() || !content.trim()}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-medium bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {status === "saving" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-300" aria-hidden="true" />
                <span>Saving…</span>
              </>
            ) : status === "saved" ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-stone-300" aria-hidden="true" />
                <span>Save Reflection</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Persistence / Error Banner */}
      {status === "error" && (
        <div
          id="editor-error-banner"
          role="alert"
          className="mx-6 mt-4 p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn"
        >
          <div className="flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-amber-950">Couldn't save your reflection.</p>
              <p className="text-amber-800 mt-0.5">
                Your writing is still here and has not been cleared. {errorMessage || "Please check connection and retry."}
              </p>
            </div>
          </div>
          <button
            id="btn-retry-save"
            type="button"
            onClick={handleSave}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-900 hover:bg-amber-800 text-amber-50 font-medium shrink-0 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry Save</span>
          </button>
        </div>
      )}

      {/* Success Banner */}
      {status === "saved" && (
        <div
          id="editor-success-banner"
          role="status"
          className="mx-6 mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center space-x-2 text-xs"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <span className="font-medium">
            Saved to your private journal in Firestore.
          </span>
        </div>
      )}

      {/* Writing Surface */}
      <div className="p-8 sm:p-12 space-y-6">
        {/* Title Input */}
        <div className="space-y-1">
          <input
            id="reflection-title-input"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) {
                setFieldErrors((prev) => ({ ...prev, title: undefined }));
              }
            }}
            disabled={status === "saving" || status === "saved"}
            placeholder="Title of this reflection..."
            maxLength={200}
            className={`w-full text-2xl sm:text-3xl font-serif font-normal text-stone-900 placeholder:text-stone-300 border-0 border-b ${
              fieldErrors.title
                ? "border-rose-400 focus:border-rose-500"
                : "border-transparent hover:border-stone-200 focus:border-stone-400"
            } focus:outline-hidden px-0 py-2 bg-transparent transition-colors tracking-tight`}
          />
          {fieldErrors.title && (
            <p id="reflection-title-error" className="text-xs text-rose-600 font-medium">
              {fieldErrors.title}
            </p>
          )}
          {title.length > 160 && (
            <p className="text-[11px] text-stone-400 text-right">
              {200 - title.length} characters left
            </p>
          )}
        </div>

        {/* Content Textarea */}
        <div className="relative space-y-1">
          <textarea
            id="reflection-content-input"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (fieldErrors.content) {
                setFieldErrors((prev) => ({ ...prev, content: undefined }));
              }
            }}
            disabled={status === "saving" || status === "saved"}
            rows={14}
            maxLength={65536}
            placeholder="Write freely. Unpack doubts, moments of clarity, dilemmas, or subtle changes in how you think. Everything is private to you."
            className="w-full text-base sm:text-lg leading-relaxed text-stone-800 placeholder:text-stone-300 border-0 focus:outline-hidden p-0 bg-transparent resize-y font-normal selection:bg-amber-100"
          />
          {fieldErrors.content && (
            <p id="reflection-content-error" className="text-xs text-rose-600 font-medium">
              {fieldErrors.content}
            </p>
          )}
        </div>
      </div>

      {/* Editor Footer / Word Count & Safety Indicators */}
      <div className="px-8 py-3.5 bg-stone-50/50 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-stone-400">
        <div className="flex items-center space-x-3">
          <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
          <span>&bull;</span>
          <span>{charCount} characters</span>
          {title.trim() || content.trim() ? (
            <>
              <span>&bull;</span>
              <span className="flex items-center space-x-1 text-stone-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Auto-saved in session</span>
              </span>
            </>
          ) : null}
        </div>

        <div className="flex items-center space-x-1.5 text-[11px] text-stone-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
          <span>🔒 Private • End-to-end user isolation</span>
        </div>
      </div>
    </div>
  );
};
