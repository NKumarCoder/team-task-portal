'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Trash2
} from 'lucide-react';
import { cn, formatDate, formatTimeAgo } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '@/services/dbService';
import { NotificationItem, Task } from '@/types';
import toast from 'react-hot-toast';
import TaskDetailDrawer from '../tasks/TaskDetailDrawer';

interface NavbarProps {
  onMenuClick: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Task Details Drawer States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);

  // Subscribe to real-time notifications for the active user
  useEffect(() => {
    if (!user) return;
    const unsubscribe = dbService.subscribeNotifications(user.email, (fetched) => {
      setNotifications(fetched);
    });
    return () => unsubscribe();
  }, [user]);

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
    try {
      await dbService.deleteNotification(id);
      toast.success('Notification deleted');
    } catch (err) {
      toast.error('Failed to delete notification');
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read && notif.id) {
      await dbService.markNotificationRead(notif.id);
    }
    setShowNotifications(false);
    
    // Open Task details drawer instantly
    try {
      const all = await dbService.getTasks();
      const taskObj = all.find(t => t.id === notif.taskId || t.taskId === notif.taskId);
      if (taskObj) {
        setSelectedTask(taskObj);
        setIsTaskDrawerOpen(true);
      } else {
        toast.error("Task not found or deleted");
      }
    } catch (err) {
      console.error("Error opening notification task:", err);
      toast.error("Could not retrieve task details");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return <User className="h-4.5 w-4.5 text-blue-500 shrink-0" />;
      case 'mention':
        return <MessageSquare className="h-4.5 w-4.5 text-purple-500 shrink-0" />;
      case 'due-date':
        return <Calendar className="h-4.5 w-4.5 text-orange-500 shrink-0" />;
      case 'completed':
        return <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />;
      default:
        return <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />;
    }
  };

  return (
    <>
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-card-border backdrop-blur-md flex items-center justify-between px-4 py-3 h-16 select-none">
      {/* Left: Mobile Menu Trigger + brand title */}
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Dark Mode Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2.5 rounded-xl hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-transparent hover:border-card-border"
          aria-label="Toggle Theme"
        >
          <Sun className="h-5 w-5 hidden dark:block text-amber-400" />
          <Moon className="h-5 w-5 dark:hidden text-indigo-600" />
        </button>

        {/* Notifications Center */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="relative p-2.5 rounded-xl hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-transparent hover:border-card-border"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[8px] font-black rounded-full flex items-center justify-center border border-background">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <div className="fixed inset-0 z-50 overflow-hidden select-none">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowNotifications(false)}
                  className="fixed inset-0 bg-black"
                />

                {/* Sliding Drawer */}
                <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                    className="w-screen max-w-sm glass-panel bg-card/95 border-l border-card-border p-5 shadow-2xl flex flex-col h-full overflow-hidden text-left"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-center pb-4 border-b border-card-border mb-4 shrink-0">
                      <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Bell className="h-4.5 w-4.5 text-primary" />
                        Notifications ({unreadCount})
                      </h2>
                      <div className="flex items-center gap-2.5">
                        {unreadCount > 0 && (
                          <button 
                            onClick={handleMarkAllRead}
                            className="text-[10px] text-primary font-bold hover:underline cursor-pointer"
                          >
                            Mark All Read
                          </button>
                        )}
                        <button 
                          onClick={() => setShowNotifications(false)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Scrollable list */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-3.5">
                      {notifications.length > 0 ? (
                        notifications.map((notif, nIdx) => (
                          <div 
                            key={notif.id || notif.notificationId || `notif-${nIdx}`}
                            className={cn(
                              "p-3 rounded-xl border flex flex-col gap-2 relative transition-all duration-200 hover:bg-accent/10 border-card-border",
                              !notif.read ? "bg-primary/[0.03] border-primary/20" : "bg-card/40 opacity-75"
                            )}
                          >
                            <div className="flex gap-2.5 items-start">
                              <div className="mt-0.5 shrink-0">{getNotificationIcon(notif.type)}</div>
                              <div className="flex-1 min-w-0" onClick={() => handleNotificationClick(notif)}>
                                <h4 className="text-xs font-bold text-foreground leading-snug cursor-pointer hover:text-primary transition-colors">
                                  {notif.title}
                                </h4>
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed cursor-pointer select-text">
                                  {notif.message}
                                </p>
                                <span className="text-[8px] text-muted-foreground/80 font-semibold mt-1 block">
                                  {formatTimeAgo(notif.timestamp || notif.createdDate || new Date().toISOString())}
                                </span>
                              </div>

                              {/* Card action controls (Mark read/delete) */}
                              <div className="flex items-center gap-1.5 shrink-0 self-start">
                                {!notif.read && (
                                  <button
                                    onClick={() => handleMarkIndividualRead(notif.id!)}
                                    className="p-1 rounded hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-all cursor-pointer"
                                    title="Mark as Read"
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteNotification(notif.id!)}
                                  className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all cursor-pointer"
                                  title="Delete Notification"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-20 text-center text-xs text-muted-foreground italic">
                          No notifications. You are all caught up!
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile Dropdown */}
        {user && (
          <div className="relative">
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
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                  <motion.div
                    key="navbar-profile-menu-panel"
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2.5 w-56 glass-panel bg-card/98 rounded-2xl border border-card-border shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="px-4 py-2 border-b border-card-border shrink-0">
                      <p className="text-xs font-bold truncate text-foreground">{user.displayName}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{user.email}</p>
                    </div>
                    <div className="p-1 space-y-0.5">
                      <button 
                        onClick={() => { setShowProfileMenu(false); router.push('/dashboard/profile'); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent/40 cursor-pointer text-left"
                      >
                        <User className="h-4 w-4 text-muted-foreground/80 shrink-0" />
                        My Profile
                      </button>
                      {user.role === 'SuperAdmin' && (
                        <button 
                          onClick={() => { setShowProfileMenu(false); router.push('/dashboard/settings'); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent/40 cursor-pointer text-left"
                        >
                          <Settings className="h-4 w-4 text-muted-foreground/80 shrink-0" />
                          Settings
                        </button>
                      )}
                    </div>
                    <div className="p-1 border-t border-card-border mt-1">
                      <button 
                        onClick={() => logout()}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                      >
                        <LogOut className="h-4 w-4 shrink-0" />
                        Logout
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
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
