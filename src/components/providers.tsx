'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import toast, { Toaster } from 'react-hot-toast';
import { authService } from '../services/authService';
import { UserSession } from '../types';
import { Permissions, getPermissionsForRole } from '../utils/permissions';
import { useRouter, usePathname } from 'next/navigation';

// Auth Context with permissions
interface AuthContextType {
  user: UserSession | null;
  permissions: Permissions | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserSession>;
  logout: () => Promise<void>;
  hasPermission: (action: keyof Permissions) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Update permissions when user role changes
  useEffect(() => {
    if (user) {
      const newPermissions = getPermissionsForRole(user.role);
      setPermissions(newPermissions);
    } else {
      setPermissions(null);
    }
  }, [user?.role]);

  useEffect(() => {
    console.log("[Auth] Initializing authentication state listener...");
    const unsubscribe = authService.subscribe((updatedUser) => {
      console.log("[Auth] Auth Ready - State updated");
      if (updatedUser) {
        console.log(`[Auth] Current User: ${updatedUser.displayName}, UID: ${updatedUser.uid}, Email: ${updatedUser.email}, Role: ${updatedUser.role}`);
      } else {
        console.log("[Auth] Current User: null");
      }
      
      setUser(updatedUser);
      setLoading(false);
      
      // Basic client-side route guard:
      if (!updatedUser && pathname !== '/login') {
        console.log("[Auth] Guard redirection: no active session, routing to /login");
        router.push('/login');
      } else if (updatedUser && pathname === '/login') {
        console.log("[Auth] Guard redirection: session found, routing to /dashboard");
        router.push('/dashboard');
      }
    });

    return () => {
      console.log("[Auth] Disposing authentication listener");
      unsubscribe();
    };
  }, [pathname, router]);

  // RBAC Guards - updated for new role system
  useEffect(() => {
    if (loading || !user) return;

    // Only SuperAdmin can access settings
    if (user.role !== 'SuperAdmin') {
      const restrictedRoutes = ['/dashboard/settings'];
      if (restrictedRoutes.some(route => pathname.startsWith(route))) {
        console.warn(`[RBAC] Denied ${user.role} access to: ${pathname}`);
        toast.error(`Permission Denied: ${pathname} is restricted to SuperAdmin only.`);
        router.push('/dashboard');
      }
    }

    // Members cannot access team management and all-tasks
    if (user.role === 'Member') {
      const memberRestricted = ['/dashboard/team', '/dashboard/all-tasks'];
      if (memberRestricted.some(route => pathname.startsWith(route))) {
        console.warn(`[RBAC] Denied Member access to: ${pathname}`);
        toast.error('Permission Denied: This page is restricted to Admin and SuperAdmin.');
        router.push('/dashboard');
      }
    }
  }, [pathname, user, loading, router]);

  const login = async (email: string, password: string) => {
    console.log(`[Auth] Login initiated for email: ${email}`);
    setLoading(true);
    try {
      const loggedUser = await authService.login(email, password);
      console.log(`[Auth] Login success. Logged user:`, loggedUser);
      setUser(loggedUser);
      router.push('/dashboard');
      return loggedUser;
    } catch (error) {
      console.warn("[Auth] Login failed:", error);
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    console.log("[Auth] Logout initiated");
    setLoading(true);
    try {
      await authService.logout();
      console.log("[Auth] Logout success. Session cleared");
      setUser(null);
      setPermissions(null);
      router.push('/login');
    } catch (error) {
      console.error('[Auth] Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (action: keyof Permissions): boolean => {
    return permissions ? permissions[action] : false;
  };

  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthContext.Provider value={{ user, permissions, loading, login, logout, hasPermission }}>
        {children}
        <Toaster 
          position="top-right" 
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f2937',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(8px)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </AuthContext.Provider>
    </NextThemesProvider>
  );
}
