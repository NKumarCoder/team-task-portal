import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  createUserWithEmailAndPassword,
  User as FirebaseUser
} from 'firebase/auth';
import { getDocs, query, where, addDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, isFirebaseConfigured } from '../firebase/config';
import { usersCollection } from '../firebase/firestore';
import { dbService } from './dbService';
import { UserSession, UserRole, Member, User } from '../types';
import { isSuperAdminEmail } from '../utils/permissions';

// Helper to prevent Firestore from hanging forever when offline or unconfigured
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`[Auth-Firestore] Request exceeded timeout of ${timeoutMs}ms. Resolving with fallback.`);
      resolve(fallbackValue);
    }, timeoutMs);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        console.error("[Auth-Firestore] Request failed during execution:", err);
        clearTimeout(timer);
        resolve(fallbackValue);
      });
  });
}

class AuthService {
  private listeners: ((user: UserSession | null) => void)[] = [];

  constructor() {
    // Constructor is now minimal - all user data comes from Firebase
  }

  private async findUserDocByEmail(email: string): Promise<any> {
    const q = query(usersCollection, where('email', '==', email));
    const snap = await withTimeout(getDocs(q), 3500, { empty: true, docs: [] } as any);
    if (snap && !snap.empty) return snap.docs[0];

    const q2 = query(usersCollection, where('email', '==', email.toLowerCase()));
    const snap2 = await withTimeout(getDocs(q2), 3500, { empty: true, docs: [] } as any);
    if (snap2 && !snap2.empty) return snap2.docs[0];

    const allSnap = await withTimeout(getDocs(usersCollection), 3500, { empty: true, docs: [] } as any);
    if (allSnap && allSnap.docs) {
      return allSnap.docs.find((d: any) => d.data().email?.toLowerCase() === email.toLowerCase()) || null;
    }
    return null;
  }

  // Subscribe to auth state changes
  subscribe(callback: (user: UserSession | null) => void) {
    this.listeners.push(callback);

    if (isFirebaseConfigured()) {
      const unsubscribeFirebase = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            console.log("[Auth] User session detected in auth listener:", firebaseUser.email);
            const email = firebaseUser.email || '';

            // Read user profile from Firestore (case-insensitive)
            const userDoc = await this.findUserDocByEmail(email);

            let role: UserRole = 'Member';
            let displayName = firebaseUser.displayName || email.split('@')[0] || 'Team Member';
            let avatarColor = '#3b82f6';

            if (userDoc) {
              // User document exists
              const userData = userDoc.data() as any;
              role = userData.role || 'Member';

              // Force SuperAdmin role if it is the SuperAdmin email but doesn't have the role in DB
              if (isSuperAdminEmail(email) && role !== 'SuperAdmin') {
                console.log(`[Auth] Forcing SuperAdmin role for ${email} in Firestore`);
                role = 'SuperAdmin';
                const userDocRef = doc(usersCollection, userDoc.id);
                // Non-blocking update
                updateDoc(userDocRef, { role: 'SuperAdmin', updatedAt: new Date().toISOString() })
                  .catch(err => console.error('[Auth] Failed to auto-correct SuperAdmin role in Firestore:', err));
              }

              displayName = userData.name || displayName;
              avatarColor = userData.avatarColor || avatarColor;
            } else {
              // First time user - auto-create user document
              console.log('[Auth] Creating new user document for:', email);

              // Check if this is the SuperAdmin email
              const isSuperAdmin = isSuperAdminEmail(email);
              const defaultRole = isSuperAdmin ? 'SuperAdmin' : 'Member';

              const newUser: User = {
                uid: firebaseUser.uid,
                name: displayName,
                email: email,
                role: defaultRole,
                isActive: true,
                avatarColor: '#' + Math.floor(Math.random() * 16777215).toString(16),
                createdAt: new Date().toISOString(),
                createdBy: 'system@firebase.auth',
                updatedAt: new Date().toISOString()
              };

              try {
                await setDoc(doc(usersCollection, firebaseUser.uid), newUser);
                console.log('[Auth] User document created successfully');
                role = defaultRole;
              } catch (err) {
                console.error('[Auth] Failed to create user document:', err);
              }
            }

            const sessionUser: UserSession = {
              uid: firebaseUser.uid,
              email: email,
              displayName,
              role,
              avatarColor,
            };
            callback(sessionUser);
          } catch (err) {
            console.error("[Auth] Error loading user from Firestore:", err);
            // Fallback with minimal info
            callback({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Team Member',
              role: 'Member', // Default to Member if anything fails
              avatarColor: '#3b82f6'
            });
          }
        } else {
          callback(null);
        }
      });
      return () => {
        this.listeners = this.listeners.filter(l => l !== callback);
        unsubscribeFirebase();
      };
    } else {
      // Firebase not configured - callback with null
      callback(null);
      return () => {
        this.listeners = this.listeners.filter(l => l !== callback);
      };
    }
  }

  async login(email: string, password: string): Promise<UserSession> {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase is not configured');
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;

      // Fetch Firestore profile (case-insensitive)
      const userDoc = await this.findUserDocByEmail(email);

      let role: UserRole = 'Member';
      let displayName = user.displayName || email.split('@')[0] || 'Team Member';
      let avatarColor = '#3b82f6';

      if (userDoc) {
        const userData = userDoc.data() as any;
        role = userData.role || 'Member';

        // Force SuperAdmin role if it is the SuperAdmin email but doesn't have the role in DB
        if (isSuperAdminEmail(email) && role !== 'SuperAdmin') {
          console.log(`[Auth] Forcing SuperAdmin role for ${email} in Firestore`);
          role = 'SuperAdmin';
          const userDocRef = doc(usersCollection, userDoc.id);
          // Non-blocking update
          updateDoc(userDocRef, { role: 'SuperAdmin', updatedAt: new Date().toISOString() })
            .catch(err => console.error('[Auth] Failed to auto-correct SuperAdmin role in Firestore:', err));
        }

        displayName = userData.name || displayName;
        avatarColor = userData.avatarColor || avatarColor;
      }

      return {
        uid: user.uid,
        email: user.email || '',
        displayName,
        role,
        avatarColor,
      };
    } catch (err: any) {
      if (err && (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-email'
      )) {
        throw new Error('Invalid email or password');
      }
      throw new Error(err.message || 'Login failed');
    }
  }

  async signup(email: string, password: string, displayName: string): Promise<UserSession> {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase is not configured');
    }

    try {
      // Create Firebase Auth account
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = credential.user;

      // Update profile
      await updateProfile(firebaseUser, { displayName });

      // Determine role: SuperAdmin for nm@i2space.com, Member for others
      const isSuperAdmin = isSuperAdminEmail(email);
      const role: UserRole = isSuperAdmin ? 'SuperAdmin' : 'Member';
      const avatarColor = '#' + Math.floor(Math.random() * 16777215).toString(16);

      // Check if user document already exists in Firestore for this email
      const cleanEmail = email.toLowerCase().trim();
      const existingUserDoc = await this.findUserDocByEmail(cleanEmail);
      const userDocRef = existingUserDoc 
        ? doc(usersCollection, existingUserDoc.id) 
        : doc(usersCollection, firebaseUser.uid);

      const userPayload = {
        uid: firebaseUser.uid,
        name: displayName,
        email: cleanEmail,
        role: existingUserDoc?.data()?.role || role,
        isActive: true,
        avatarColor: existingUserDoc?.data()?.avatarColor || avatarColor,
        createdAt: existingUserDoc?.data()?.createdAt || existingUserDoc?.data()?.createdDate || new Date().toISOString(),
        createdBy: existingUserDoc?.data()?.createdBy || 'self',
        updatedAt: new Date().toISOString()
      };

      await setDoc(userDocRef, userPayload, { merge: true });

      return {
        uid: firebaseUser.uid,
        email: cleanEmail,
        displayName,
        role: userPayload.role as UserRole,
        avatarColor: userPayload.avatarColor
      };
    } catch (err: any) {
      throw new Error(err.message || 'Signup failed');
    }
  }

  async logout(): Promise<void> {
    if (isFirebaseConfigured()) {
      await signOut(auth);
    } else {
      throw new Error('Firebase is not configured');
    }
  }

  async updateProfileInfo(displayName: string, avatarColor?: string): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase is not configured');
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user logged in');
    }

    // Update Firebase Auth profile
    await updateProfile(user, { displayName });

    // Update user document in Firestore
    const userDocRef = doc(usersCollection, user.uid);
    await updateDoc(userDocRef, {
      name: displayName,
      ...(avatarColor && { avatarColor }),
      updatedAt: new Date().toISOString()
    });
  }

  async changePassword(newPassword: string): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase is not configured');
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user logged in');
    }

    await updatePassword(user, newPassword);

    // Sync password to the Firestore user profile
    if (user.email) {
      try {
        await dbService.updateMemberProfile(user.email, { password: newPassword });
        console.log(`[Auth] Password successfully synced to Firestore for: ${user.email}`);
      } catch (dbErr) {
        console.error(`[Auth] Failed to sync password to Firestore for ${user.email}:`, dbErr);
      }
    }
  }

  async createMemberAuth(email: string, password: string, displayName: string): Promise<string> {
    const { firebaseConfig } = await import('../firebase/firebase');
    const { initializeApp, deleteApp } = await import('firebase/app');
    const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
    
    const secondaryAppName = `TempApp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const tempApp = initializeApp(firebaseConfig, secondaryAppName);
    const tempAuth = getAuth(tempApp);
    
    try {
      const credential = await createUserWithEmailAndPassword(tempAuth, email, password);
      const user = credential.user;
      
      const { updateProfile } = await import('firebase/auth');
      await updateProfile(user, { displayName });
      
      await signOut(tempAuth);
      return user.uid;
    } catch (err: any) {
      console.error("[Auth] createMemberAuth error:", err);
      throw err;
    } finally {
      await deleteApp(tempApp);
    }
  }

  async updateMemberAuthPassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
    const { firebaseConfig } = await import('../firebase/firebase');
    const { initializeApp, deleteApp } = await import('firebase/app');
    const { getAuth, signInWithEmailAndPassword, updatePassword, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
    
    const secondaryAppName = `TempApp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const tempApp = initializeApp(firebaseConfig, secondaryAppName);
    const tempAuth = getAuth(tempApp);
    
    try {
      try {
        const credential = await signInWithEmailAndPassword(tempAuth, email, currentPassword);
        if (credential.user) {
          await updatePassword(credential.user, newPassword);
        }
      } catch (signInErr: any) {
        console.warn("[Auth] signInWithEmailAndPassword failed, attempting to create account instead. Error:", signInErr.message);
        try {
          const credential = await createUserWithEmailAndPassword(tempAuth, email, newPassword);
          const user = credential.user;
          const { updateProfile } = await import('firebase/auth');
          await updateProfile(user, { displayName: email.split('@')[0] });
        } catch (createErr: any) {
          throw new Error(`Failed to update or create Auth credentials: ${createErr.message || signInErr.message}`);
        }
      }
      await signOut(tempAuth);
    } catch (err: any) {
      console.error("[Auth] updateMemberAuthPassword error:", err);
      throw err;
    } finally {
      await deleteApp(tempApp);
    }
  }

  async deleteMemberAuth(email: string, currentPassword: string): Promise<void> {
    const { firebaseConfig } = await import('../firebase/firebase');
    const { initializeApp, deleteApp } = await import('firebase/app');
    const { getAuth, signInWithEmailAndPassword, deleteUser, signOut } = await import('firebase/auth');
    
    const secondaryAppName = `TempApp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const tempApp = initializeApp(firebaseConfig, secondaryAppName);
    const tempAuth = getAuth(tempApp);
    
    try {
      const credential = await signInWithEmailAndPassword(tempAuth, email, currentPassword);
      if (credential.user) {
        await deleteUser(credential.user);
      }
      await signOut(tempAuth);
    } catch (err: any) {
      console.error("[Auth] deleteMemberAuth error:", err);
      // Log only, don't block
    } finally {
      await deleteApp(tempApp);
    }
  }

  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }
}

export const authService = new AuthService();
