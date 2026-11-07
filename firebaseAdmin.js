// Server-side Firebase Admin SDK initialization helper
// (Use ONLY in server-side contexts like API routes, server actions, or backend services)

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

let adminDb;
let adminAuth;
let adminStorage;

const formatPrivateKey = (key) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n');
};

export const getFirebaseAdmin = async () => {
  if (!getApps().length) {
    const projectId =
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      'nestobanks-221';
    const storageBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      `${projectId}.firebasestorage.app`;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

    if (clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket,
      });
    } else {
      initializeApp({
        projectId,
        storageBucket,
      });
    }
  }

  adminDb = getFirestore();
  adminAuth = getAuth();
  adminStorage = getStorage();

  const adminCompat = {
    apps: getApps(),
    initializeApp,
    credential: { cert },
    firestore: Object.assign(() => adminDb, { FieldValue, Timestamp }),
    auth: () => adminAuth,
    storage: () => adminStorage,
  };

  return {
    admin: adminCompat,
    adminDb,
    adminAuth,
    adminStorage,
    FieldValue,
    Timestamp,
  };
};

export default getFirebaseAdmin;
