import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyB7avdiTCzEoQsNKEh4djTcaPhCCfbeEiE",
  authDomain: "team-task-portal-54206.firebaseapp.com",
  projectId: "team-task-portal-54206",
  storageBucket: "team-task-portal-54206.firebasestorage.app",
  messagingSenderId: "1073125579563",
  appId: "1:1073125579563:web:7efec94fb0343f1b53836e",
  measurementId: "G-3L3PTCB6Q3"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

if (typeof window !== "undefined") {
    getAnalytics(app);
}

export default app;
