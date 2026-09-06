import { initializeApp, getApps, getApp, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase Admin SDK using Application Default Credentials (ADC)
// Cloud Run automatically populates ADC from the runtime service account.
const projectId = process.env.GOOGLE_CLOUD_PROJECT || firebaseConfig.projectId;

const app: App = getApps().length > 0 ? getApp() : initializeApp({ projectId });

export const adminAuth: Auth = getAuth(app);
export const adminDb: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export default app;
