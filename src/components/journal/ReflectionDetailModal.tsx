import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Trash2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  FileText,
} from "lucide-react";
import {
  getReflection,
  deleteReflection,
  ReflectionItem,
} from "../../services/apiClient";

interface ReflectionDetailModalProps {
  reflectionId: string;
  onClose: () => void;
  onDeleted?: (deletedId: string) => void;
}

export const ReflectionDetailModal: React.FC<ReflectionDetailModalProps> = ({
  reflectionId,
  onClose,
  onDeleted,
}) => {
  const [reflection, setReflection] = useState<ReflectionItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Deletion state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getReflection(reflectionId);
        if (mounted) {
          setReflection(res.reflection);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to retrieve reflection. It may have been deleted or does not exist."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [reflectionId]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteReflection(reflectionId);
      if (onDeleted) {
        onDeleted(reflectionId);
      } else {
        onClose();
      }
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete reflection"
      );
      setIsDeleting(false);
    }
  };

  return (
    <div
      id="reflection-detail-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reflection-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onClose();
        }
      }}
    >
      <div
        id="reflection-detail-card"
        className="bg-white border border-stone-200/90 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/40">
          <div className="flex items-center space-x-2 text-stone-500 text-xs">
            <FileText className="w-4 h-4 text-stone-600" aria-hidden="true" />
            <span>Journal Entry</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              id="btn-close-reflection-detail"
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              aria-label="Close reflection details"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-stone-500 text-sm">
              <Loader2 className="w-6 h-6 animate-spin text-stone-400" aria-hidden="true" />
              <p>Loading reflection from Firestore...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start space-x-2.5 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Unable to load reflection</p>
                <p className="text-rose-800 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!loading && reflection && (
            <>
              {/* Title & Metadata */}
              <div className="space-y-2 border-b border-stone-100 pb-4">
                <h2
                  id="reflection-detail-title"
                  className="text-2xl sm:text-3xl font-serif font-medium text-stone-900"
                >
                  {reflection.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{new Date(reflection.createdAt).toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}</span>
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{new Date(reflection.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</span>
                  </span>
                </div>
              </div>

              {/* Reflection Content Body */}
              <div className="prose prose-stone max-w-none text-stone-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-normal">
                {reflection.content}
              </div>

              {/* Delete confirmation bar */}
              {isConfirmingDelete ? (
                <div
                  id="delete-confirmation-banner"
                  className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3 text-xs"
                >
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">Permanently delete this reflection?</p>
                      <p className="text-rose-800 mt-0.5">
                        This cannot be undone. It will be removed from your Firestore database immediately.
                      </p>
                    </div>
                  </div>
                  {deleteError && (
                    <p className="text-rose-700 text-[11px] font-medium">{deleteError}</p>
                  )}
                  <div className="flex items-center space-x-2 justify-end">
                    <button
                      id="btn-cancel-delete"
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 text-stone-600 hover:text-stone-900 text-xs font-medium rounded-lg hover:bg-rose-100/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-confirm-delete"
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg transition-colors shadow-xs disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                          <span>Deleting…</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>Yes, Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!loading && reflection && (
          <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <div className="flex items-center space-x-1.5 text-[11px] text-stone-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>Isolated to your authenticated UID</span>
            </div>

            {!isConfirmingDelete && (
              <button
                id="btn-start-delete-reflection"
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="inline-flex items-center space-x-1 text-stone-400 hover:text-rose-600 text-xs transition-colors p-1"
                title="Delete reflection"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
