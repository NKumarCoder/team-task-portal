'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import MobileDrawer from '@/components/layout/MobileDrawer';
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Plus, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Task } from '@/types';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [timeoutError, setTimeoutError] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);

  const handleTaskCreated = (newTask: Task) => {
    // Dispatch a custom event to notify tables and statistics to re-fetch
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('task-updated');
      window.dispatchEvent(event);
    }
  };

  useEffect(() => {
    if (!loading) {
      setLocalLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    let timer: any;
    if (localLoading) {
      timer = setTimeout(() => {
        console.error("Dashboard loading timeout - Auth check exceeded 10 seconds.");
        setTimeoutError(true);
        setLocalLoading(false);
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [localLoading]);

  if (timeoutError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden px-4 select-none">
        <div className="bg-glow-purple -top-40 -left-40" />
        <div className="bg-glow-blue -bottom-40 -right-40" />
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center gap-4 max-w-sm w-full text-center border border-destructive/20 relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-destructive/60" />
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive mb-2">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Unable to load dashboard.</h2>
          <p className="text-xs text-muted-foreground">The authentication check timed out or connection was blocked.</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 w-full py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition-all text-xs cursor-pointer shadow-md shadow-primary/20"
          >
            Retry Validation
          </button>
        </div>
      </div>
    );
  }

  if (localLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
        <div className="bg-glow-purple -top-40 -left-40" />
        <div className="bg-glow-blue -bottom-40 -right-40" />
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Verifying secure workspace session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="bg-glow-purple -top-40 -left-40 opacity-70 dark:opacity-100" />
      <div className="bg-glow-blue -bottom-40 -right-40 opacity-70 dark:opacity-100" />

      {/* Desktop Sidebar (Left Panel) */}
      <Sidebar className="hidden lg:flex fixed left-0 top-0 bottom-0 z-20" />

      {/* Main Panel wrapper */}
      <div className="flex-1 flex flex-col lg:pl-64 min-h-screen relative z-10 min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        
        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-28 lg:pb-32 overflow-y-auto overflow-x-hidden w-full min-w-0">
          {children}
        </main>
      </div>

      {/* Mobile Drawer (Left sliding menu overlay) */}
      <MobileDrawer isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Floating Create Task Button */}
      <motion.button
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-primary hover:bg-primary/95 text-white flex items-center justify-center shadow-2xl shadow-primary/30 cursor-pointer border border-white/10"
        title="Create Task"
      >
        <Plus className="h-7 w-7" />
      </motion.button>

      {/* Global Task Creation Dialog */}
      <CreateTaskDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleTaskCreated}
      />
    </div>
  );
}
