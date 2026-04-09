import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  type User
} from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getFirestore,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  addDoc
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from "firebase/messaging";
import { getFunctions, httpsCallable } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const hasFirebaseConfig = Object.values(firebaseConfig).every((value) => typeof value === "string" && value.length > 0);
const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;
export const functions = app ? getFunctions(app, "us-central1") : null;
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const firebaseMissingConfigMessage =
  "Firebase env vars are missing. Configure VITE_FIREBASE_* values to enable auth and cloud data.";

const requireAuth = () => {
  if (!auth) throw new Error(firebaseMissingConfigMessage);
  return auth;
};

const requireDb = () => {
  if (!db) throw new Error(firebaseMissingConfigMessage);
  return db;
};

const requireFunctions = () => {
  if (!functions) throw new Error(firebaseMissingConfigMessage);
  return functions;
};

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider("apple.com");

export const authApi = {
  signUp: (email: string, password: string) => createUserWithEmailAndPassword(requireAuth(), email, password),
  signIn: (email: string, password: string) => signInWithEmailAndPassword(requireAuth(), email, password),
  signInGoogle: () => signInWithPopup(requireAuth(), googleProvider),
  signInApple: () => signInWithPopup(requireAuth(), appleProvider)
};

export const createPhoneVerifier = (containerId: string) =>
  new RecaptchaVerifier(requireAuth(), containerId, {
    size: "invisible"
  });

export const startPhoneVerification = async (
  phoneNumber: string,
  verifier: RecaptchaVerifier
): Promise<string> => {
  const provider = new PhoneAuthProvider(requireAuth());
  return provider.verifyPhoneNumber(phoneNumber, verifier);
};

export const householdsApi = {
  async createHousehold(user: User, name: string, joinCode: string): Promise<void> {
    const firestore = requireDb();
    const householdRef = doc(firestore, "households", user.uid);
    await setDoc(householdRef, {
      name,
      joinCode,
      currency: "ZAR",
      createdBy: user.uid,
      members: [user.uid],
      createdAt: serverTimestamp()
    });
    await setDoc(doc(firestore, "joinCodes", joinCode), {
      householdId: user.uid,
      createdAt: serverTimestamp()
    });
    await setDoc(doc(firestore, "profiles", user.uid), { householdId: user.uid }, { merge: true });
  },
  async joinHousehold(user: User, joinCode: string): Promise<boolean> {
    const firestore = requireDb();
    const householdRef = doc(firestore, "joinCodes", joinCode);
    const joinCodeDoc = await getDoc(householdRef);
    if (!joinCodeDoc.exists()) return false;

    const householdId = joinCodeDoc.data().householdId as string;
    await updateDoc(doc(firestore, "households", householdId), {
      members: arrayUnion(user.uid)
    });
    await setDoc(doc(firestore, "profiles", user.uid), { householdId }, { merge: true });
    return true;
  }
};

export const notificationsApi = {
  isConfigured() {
    return Boolean(app && vapidKey);
  },
  async requestPermissionAndToken(serviceWorkerRegistration?: ServiceWorkerRegistration) {
    if (!app) throw new Error(firebaseMissingConfigMessage);
    if (!vapidKey) throw new Error("Missing VITE_FIREBASE_VAPID_KEY for browser notifications.");
    if (typeof window === "undefined" || !("Notification" in window)) {
      throw new Error("Notifications are not supported in this browser.");
    }
    const supported = await isSupported().catch(() => false);
    if (!supported) throw new Error("Firebase messaging is not supported in this browser.");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { permission, token: null as string | null };
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration
    });

    return { permission, token };
  },
  async persistTokenForCurrentUser(token: string) {
    const user = auth?.currentUser;
    if (!user) throw new Error("User must be signed in to store a notification token.");
    const firestore = requireDb();
    const devicesRef = collection(firestore, "profiles", user.uid, "devices");
    await addDoc(devicesRef, {
      token,
      platform: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      active: true
    });
  },
  async enqueueNotificationForCurrentUser(notification: { title: string; body: string }) {
    const user = auth?.currentUser;
    if (!user) throw new Error("User must be signed in to queue notifications.");
    const firestore = requireDb();
    const queueRef = collection(firestore, "profiles", user.uid, "notificationsQueue");
    await addDoc(queueRef, {
      title: notification.title,
      body: notification.body,
      createdAt: serverTimestamp(),
      status: "pending"
    });
  },
  async sendTestNotification() {
    const callable = httpsCallable(requireFunctions(), "sendTestNotification");
    return callable({});
  },
  async onForegroundMessage(handler: (payload: MessagePayload) => void) {
    if (!app) return () => {};
    const supported = await isSupported().catch(() => false);
    if (!supported) return () => {};
    const messaging = getMessaging(app);
    return onMessage(messaging, handler);
  }
};
