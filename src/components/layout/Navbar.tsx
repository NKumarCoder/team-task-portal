'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { 
  Sun, 
  Moon, 
  Bell, 
  Search, 
  Menu, 
  ChevronDown,
  User,
  Settings,
  LogOut,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Calendar,
  AlertTriangle,
  X,
  Check,
  Trash2,
  Eye,
  Loader2,
  Sparkles,
  PanelLeft,
  PanelTop
} from 'lucide-react';
import { cn, formatDate, formatTimeAgo } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '@/services/dbService';
import { NotificationItem, Task } from '@/types';
import toast from 'react-hot-toast';
import TaskDetailDrawer from '../tasks/TaskDetailDrawer';
import HorizontalNav from './HorizontalNav';
import { useNavigationLayout } from './NavigationLayoutContext';

interface NavbarProps {
  onMenuClick: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { layoutMode, toggleLayoutMode } = useNavigationLayout();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // References for outside click detection
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Task Details Drawer States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle click outside to close dropdowns without conflicting backdrops
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // While Delete All confirmation is open, let the confirmation modal handle clicks
      if (isDeleteAllConfirmOpen) return;

      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
    };

    if (showNotifications || showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications, showProfileMenu, isDeleteAllConfirmOpen]);

  // Handle Escape key to close open dialogs or dropdowns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDeleteAllConfirmOpen) {
          if (!isDeletingAll) setIsDeleteAllConfirmOpen(false);
        } else if (showNotifications) {
          setShowNotifications(false);
        } else if (showProfileMenu) {
          setShowProfileMenu(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeleteAllConfirmOpen, isDeletingAll, showNotifications, showProfileMenu]);

  // Lock body scroll when Delete All confirmation modal is open
  useEffect(() => {
    if (isDeleteAllConfirmOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isDeleteAllConfirmOpen]);

  // Subscribe to real-time notifications for the active user
  useEffect(() => {
    if (!user?.email) return;
    const cleanEmail = user.email.toLowerCase().trim();
    const unsubscribe = dbService.subscribeNotifications(cleanEmail, (fetched) => {
      setNotifications(fetched);
    });
    return () => unsubscribe();
  }, [user?.email]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read && !n.isRead).length;
  }, [notifications]);

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.read && !n.isRead);
    if (unread.length === 0) return;
    
    try {
      for (const notif of unread) {
        if (notif.id) {
          await dbService.markNotificationRead(notif.id);
        }
      }
      toast.success('All notifications marked read');
    } catch (err) {
      toast.error('Failed to mark notifications read');
    }
  };

  const handleMarkIndividualRead = async (id: string) => {
    try {
      await dbService.markNotificationRead(id);
      toast.success('Notification marked as read');
    } catch (err) {
      toast.error('Failed to mark notification read');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!id || deletingId) return;
    setDeletingId(id);
    try {
      await dbService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id && n.notificationId !== id));
      toast.success('Notification deleted');
    } catch (err) {
      console.error('Failed to delete notification:', err);
      toast.error('Failed to delete notification');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAllNotifications = async () => {
    if (!user?.email || isDeletingAll) return;
    setIsDeletingAll(true);
    try {
      const res = await dbService.deleteAllNotifications(user.email);
      setNotifications([]);
      setIsDeleteAllConfirmOpen(false);
      toast.success(res.deletedCount > 0 ? `Deleted ${res.deletedCount} notification(s)` : 'All notifications cleared');
    } catch (err: any) {
      console.error('Failed to delete all notifications:', err);
      toast.error(err?.message || 'Failed to delete all notifications');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read && notif.id) {
      await dbService.markNotificationRead(notif.id);
    }
    setShowNotifications(false);
    
    // Navigate to dedicated task detail page and anchor to comment if present
    try {
      const all = await dbService.getTasks();
      const taskObj = all.find(t => t.id === notif.taskId || t.taskId === notif.taskId);
      if (taskObj) {
        const targetUrl = `/dashboard/tasks/${taskObj.id || taskObj.taskId}${notif.commentId ? `?commentId=${notif.commentId}` : ''}`;
        router.push(targetUrl);
      } else {
        toast.error("Task not found or deleted");
      }
    } catch (err) {
      console.error("Error opening notification task:", err);
      toast.error("Could not retrieve task details");
    }
  };

  const getNotificationIcon = (type: string, isWatcher?: boolean) => {
    if (isWatcher || type === 'watcher-update' || type === 'watcher') {
      return <Eye className="h-4.5 w-4.5 text-indigo-400 shrink-0" />;
    }
    switch (type) {
      case 'assignment':
      case 'reassignment':
      case 'co-assignee-added':
        return <User className="h-4.5 w-4.5 text-blue-500 shrink-0" />;
      case 'mention':
        return <MessageSquare className="h-4.5 w-4.5 text-purple-500 shrink-0" />;
      case 'comment-added':
      case 'reply-added':
        return <MessageSquare className="h-4.5 w-4.5 text-blue-500 shrink-0" />;
      case 'due-date':
        return <Calendar className="h-4.5 w-4.5 text-orange-500 shrink-0" />;
      case 'completed':
        return <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />;
      case 'uat-rejected':
        return <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0" />;
      default:
        return <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />;
    }
  };

  return (
    <>
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-card-border backdrop-blur-md select-none overflow-visible">
      {/* First row – Application header */}
      <div className="flex items-center justify-between px-4 lg:px-8 py-2.5 h-14">
        {/* Left: Mobile Menu Trigger + Brand Logo */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button 
            type="button"
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            aria-label="Open mobile menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/dashboard" className="flex items-center gap-2.5 group cursor-pointer select-none">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm shadow-primary/20 group-hover:scale-105 transition-transform duration-150">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm leading-tight tracking-tight text-foreground group-hover:text-primary transition-colors">Apex Tasks</span>
              <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">Enterprise</span>
            </div>
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Navigation Layout Toggle (Top Navigation <-> Left Sidebar) */}
          <button
            type="button"
            onClick={toggleLayoutMode}
            className="p-2.5 rounded-xl hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-transparent hover:border-card-border group"
            title={layoutMode === 'top' ? "Switch to Left Sidebar" : "Switch to Top Navigation"}
            aria-label={layoutMode === 'top' ? "Switch to Left Sidebar" : "Switch to Top Navigation"}
          >
            {layoutMode === 'top' ? (
              <PanelLeft className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            ) : (
              <PanelTop className="h-5 w-5 text-primary transition-colors" />
            )}
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 rounded-xl hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-transparent hover:border-card-border"
            aria-label="Toggle Theme"
          >
            <Sun className="h-5 w-5 hidden dark:block text-amber-400" />
            <Moon className="h-5 w-5 dark:hidden text-indigo-600" />
          </button>

        {/* Notifications Center */}
        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="relative p-2.5 rounded-xl hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-transparent hover:border-card-border"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-destructive text-destructive-foreground text-[8px] font-black rounded-full flex items-center justify-center border border-background shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                key="navbar-notifications-panel"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute right-[-64px] sm:right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-[380px] sm:max-w-sm glass-panel bg-card/98 border border-card-border shadow-2xl z-50 flex flex-col overflow-hidden text-left rounded-2xl transition-opacity duration-150",
                  isDeleteAllConfirmOpen && "opacity-50 pointer-events-none"
                )}
                style={{ maxHeight: 'min(500px, calc(100vh - 5rem))' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-card-border bg-card/80 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bell className="h-4 w-4 text-primary shrink-0" />
                    <h3 className="text-xs font-bold text-foreground truncate">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-primary/15 text-primary border border-primary/25 leading-none shrink-0">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {unreadCount > 0 && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAllRead();
                        }}
                        className="text-[11px] text-primary font-bold hover:underline cursor-pointer transition-colors"
                      >
                        Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDeleteAllConfirmOpen(true);
                        }}
                        className="text-[11px] text-destructive font-bold hover:underline cursor-pointer transition-colors flex items-center gap-1"
                        title="Delete all notifications"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete all</span>
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer ml-0.5"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Scrollable List */}
                <div
                  className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar overscroll-contain"
                  onWheel={(e) => e.stopPropagation()}
                >
                  {notifications.length > 0 ? (
                    notifications.map((notif, nIdx) => (
                      <div 
                        key={notif.id || notif.notificationId || `notif-${nIdx}`}
                        className={cn(
                          "p-2.5 rounded-xl border flex flex-col gap-1.5 relative transition-all duration-150 hover:bg-accent/20 cursor-pointer select-none",
                          !notif.read ? "bg-primary/[0.05] border-primary/25" : "bg-card/40 border-card-border/60 opacity-80"
                        )}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className="flex gap-2.5 items-start">
                          <div className="mt-0.5 shrink-0">{getNotificationIcon(notif.type, notif.isWatcherNotification)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-xs font-bold text-foreground leading-snug hover:text-primary transition-colors truncate">
                                {notif.title}
                              </h4>
                              <span className="text-[9px] text-muted-foreground/80 shrink-0 font-medium">
                                {formatTimeAgo(notif.timestamp || notif.createdDate || new Date().toISOString())}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed break-words line-clamp-3">
                              {notif.message}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 self-start ml-1" onClick={(e) => e.stopPropagation()}>
                            {!notif.read && (
                              <button
                                type="button"
                                onClick={() => handleMarkIndividualRead(notif.id!)}
                                className="p-1 rounded hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-all cursor-pointer"
                                title="Mark as Read"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={deletingId === notif.id}
                              onClick={() => handleDeleteNotification(notif.id!)}
                              className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all cursor-pointer disabled:opacity-50"
                              title="Delete Notification"
                            >
                              {deletingId === notif.id ? (
                                <Loader2 className="h-3 w-3 animate-spin text-destructive" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 px-4 text-center space-y-2">
                      <Bell className="h-7 w-7 text-muted-foreground/30 mx-auto" />
                      <p className="text-xs font-semibold text-foreground">No notifications yet</p>
                      <p className="text-[10px] text-muted-foreground">You are all caught up!</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile Dropdown */}
        {user && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
              }}
              className="flex items-center gap-1.5 p-1 sm:pr-2.5 sm:pl-1.5 rounded-xl hover:bg-accent/50 cursor-pointer transition-all border border-transparent hover:border-card-border"
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-inner"
                style={{ backgroundColor: user.avatarColor || '#3b82f6' }}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
            </button>

            <AnimatePresence>
              {showProfileMenu && (
                <div key="navbar-profile-menu-container">
                  <motion.div
                    key="navbar-profile-menu-panel"
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2.5 w-56 glass-panel bg-card/98 rounded-2xl border border-card-border shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="px-4 py-2.5 border-b border-card-border shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold truncate text-foreground">{user.displayName}</p>
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                          {user.role === 'SuperAdmin' ? 'Super Admin' : user.role}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{user.email}</p>
                    </div>
                    <div className="p-1 space-y-0.5">
                      <button 
                        onClick={() => { setShowProfileMenu(false); router.push('/dashboard/profile'); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent/40 cursor-pointer text-left transition-colors"
                      >
                        <User className="h-4 w-4 text-muted-foreground/80 shrink-0" />
                        Profile
                      </button>
                      {user.role === 'SuperAdmin' && (
                        <button 
                          onClick={() => { setShowProfileMenu(false); router.push('/dashboard/settings'); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent/40 cursor-pointer text-left transition-colors"
                        >
                          <Settings className="h-4 w-4 text-muted-foreground/80 shrink-0" />
                          Settings
                        </button>
                      )}
                    </div>
                    <div className="p-1 border-t border-card-border mt-1">
                      <button 
                        onClick={() => logout()}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors"
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      </div>

      {/* Second row – Horizontal Navigation (Desktop & Tablet) - Visible only when Top Navigation is active */}
      {layoutMode === 'top' && (
        <div className="hidden md:flex items-center px-4 lg:px-8 h-11 border-t border-card-border/50 bg-card/35 backdrop-blur-md overflow-visible">
          <HorizontalNav />
        </div>
      )}
    </header>

    {/* Delete All Confirmation Modal portaled directly to document.body */}
    {mounted && isDeleteAllConfirmOpen && typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        <div
          role="presentation"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            if (!isDeletingAll) setIsDeleteAllConfirmOpen(false);
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-all-notifications-dialog-title"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-sm sm:max-w-md bg-card border border-card-border rounded-2xl shadow-2xl p-6 text-left space-y-5 relative z-[101]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-destructive/15 border border-destructive/25 flex items-center justify-center text-destructive shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 
                  id="delete-all-notifications-dialog-title" 
                  className="text-sm sm:text-base font-bold text-foreground"
                >
                  Delete all notifications?
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  This will remove all notifications from your inbox. Your tasks, comments, assignments, and activity history will remain unchanged.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-card-border/60">
              <button
                type="button"
                disabled={isDeletingAll}
                onClick={() => setIsDeleteAllConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingAll}
                onClick={handleDeleteAllNotifications}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-destructive/20"
              >
                {isDeletingAll ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete All</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>,
      document.body
    )}
    {selectedTask && (
      <TaskDetailDrawer 
        task={selectedTask} 
        isOpen={isTaskDrawerOpen} 
        onClose={() => {
          setIsTaskDrawerOpen(false);
          setSelectedTask(null);
        }} 
      />
    )}
    </>
  );
}
