// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Helper to resolve env variables across Next.js, Vite, and standard Node/CRA
const getEnv = (key) => {
  if (typeof process !== "undefined" && process.env) {
    return (
      process.env[`NEXT_PUBLIC_${key}`] ||
      process.env[key] ||
      ""
    );
  }
  // @ts-ignore
  if (typeof import.meta !== "undefined" && import.meta.env) {
    // @ts-ignore
    return import.meta.env[`VITE_${key}`] || import.meta.env[key] || "";
  }
  return "";
};

// Your web app's Firebase configuration loaded from environment variables
const firebaseConfig = {
  apiKey: getEnv("FIREBASE_API_KEY") || "AIzaSyB8b8iun4tCAhyUiqaJFLfTErgCue2qMVw",
  authDomain: getEnv("FIREBASE_AUTH_DOMAIN") || "nestobanks-221.firebaseapp.com",
  projectId: getEnv("FIREBASE_PROJECT_ID") || "nestobanks-221",
  storageBucket: getEnv("FIREBASE_STORAGE_BUCKET") || "nestobanks-221.firebasestorage.app",
  messagingSenderId: getEnv("FIREBASE_MESSAGING_SENDER_ID") || "825324148932",
  appId: getEnv("FIREBASE_APP_ID") || "1:825324148932:web:dfe071751bb04c505ad191",
  measurementId: getEnv("FIREBASE_MEASUREMENT_ID") || "G-Z65KBQ67SC"
};

// Initialize Firebase (singleton pattern prevents re-initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize SDK services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Analytics runs only in browser environments supporting IndexedDB
let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, auth, db, storage, analytics, firebaseConfig };
export default app;
