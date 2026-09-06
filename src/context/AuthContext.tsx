import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  AuthError,
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { AuthUser, AuthContextValue } from "../types/auth";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // onIdTokenChanged fires on sign-in, sign-out, and whenever token is automatically refreshed
    const unsubscribe = onIdTokenChanged(
      auth,
      (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          });
        } else {
          setUser(null);
          try {
            sessionStorage.clear();
          } catch {
            // Ignore storage access restrictions in certain iframe/sandboxed modes
          }
        }
        setLoading(false);
      },
      (_err) => {
        // Safe user-facing error without leaking internal details
        setError("Authentication service temporarily unavailable. Please try again.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const authError = err as AuthError;
      // Handle user cancellation gracefully without error state
      if (
        authError.code === "auth/popup-closed-by-user" ||
        authError.code === "auth/cancelled-popup-request"
      ) {
        setLoading(false);
        return;
      }
      setError("Sign-in couldn't be completed. Please try again.");
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      try {
        sessionStorage.clear();
      } catch {
        // Ignore storage access restrictions
      }
    } catch (_err) {
      setError("Unable to sign out completely. Please try again.");
    }
  }, []);

  const getIdToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    if (!auth.currentUser) {
      return null;
    }
    try {
      return await auth.currentUser.getIdToken(forceRefresh);
    } catch (_err) {
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    signInWithGoogle,
    signOut,
    getIdToken,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
