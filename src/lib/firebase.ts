import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App for Authentication only
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Firebase Auth client instance
export const auth = getAuth(app);

// Google Sign-In Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
