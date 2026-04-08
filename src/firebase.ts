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
import { getFirestore, doc, getDoc, serverTimestamp, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider("apple.com");

export const authApi = {
  signUp: (email: string, password: string) => createUserWithEmailAndPassword(auth, email, password),
  signIn: (email: string, password: string) => signInWithEmailAndPassword(auth, email, password),
  signInGoogle: () => signInWithPopup(auth, googleProvider),
  signInApple: () => signInWithPopup(auth, appleProvider)
};

export const createPhoneVerifier = (containerId: string) =>
  new RecaptchaVerifier(auth, containerId, {
    size: "invisible"
  });

export const startPhoneVerification = async (
  phoneNumber: string,
  verifier: RecaptchaVerifier
): Promise<string> => {
  const provider = new PhoneAuthProvider(auth);
  return provider.verifyPhoneNumber(phoneNumber, verifier);
};

export const householdsApi = {
  async createHousehold(user: User, name: string, joinCode: string): Promise<void> {
    const householdRef = doc(db, "households", user.uid);
    await setDoc(householdRef, {
      name,
      joinCode,
      currency: "ZAR",
      createdBy: user.uid,
      members: [user.uid],
      createdAt: serverTimestamp()
    });
    await setDoc(doc(db, "joinCodes", joinCode), {
      householdId: user.uid,
      createdAt: serverTimestamp()
    });
    await setDoc(doc(db, "profiles", user.uid), { householdId: user.uid }, { merge: true });
  },
  async joinHousehold(user: User, joinCode: string): Promise<boolean> {
    const householdRef = doc(db, "joinCodes", joinCode);
    const joinCodeDoc = await getDoc(householdRef);
    if (!joinCodeDoc.exists()) return false;

    const householdId = joinCodeDoc.data().householdId as string;
    await updateDoc(doc(db, "households", householdId), {
      members: arrayUnion(user.uid)
    });
    await setDoc(doc(db, "profiles", user.uid), { householdId }, { merge: true });
    return true;
  }
};
