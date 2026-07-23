import app, { db, auth, storage } from './firebase';

// Since the Firebase configuration is now hardcoded and active in firebase.ts, we always return true.
export const isFirebaseConfigured = () => true;

export { app, db, auth, storage };
