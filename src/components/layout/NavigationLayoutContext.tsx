'use client';

import React, { createContext, useContext, useState } from 'react';

export type NavigationLayoutMode = 'top' | 'sidebar';

interface NavigationLayoutContextType {
  layoutMode: NavigationLayoutMode;
  setLayoutMode: (mode: NavigationLayoutMode) => void;
  toggleLayoutMode: () => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
}

const NavigationLayoutContext = createContext<NavigationLayoutContextType | undefined>(undefined);

export function NavigationLayoutProvider({ children }: { children: React.ReactNode }) {
  // STRICT REQUIREMENT:
  // Layout mode defaults to 'top' on every load/reload.
  // Must NOT be stored in localStorage, sessionStorage, cookies, or database.
  const [layoutMode, setLayoutMode] = useState<NavigationLayoutMode>('top');

  // STRICT REQUIREMENT:
  // Sidebar collapsed state defaults to expanded (false) on every load/reload.
  // Must NOT be persisted across reloads.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const toggleLayoutMode = () => {
    setLayoutMode(prev => (prev === 'top' ? 'sidebar' : 'top'));
  };

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  return (
    <NavigationLayoutContext.Provider
      value={{
        layoutMode,
        setLayoutMode,
        toggleLayoutMode,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleSidebarCollapsed,
      }}
    >
      {children}
    </NavigationLayoutContext.Provider>
  );
}

export function useNavigationLayout() {
  const context = useContext(NavigationLayoutContext);
  if (!context) {
    throw new Error('useNavigationLayout must be used within a NavigationLayoutProvider');
  }
  return context;
}
