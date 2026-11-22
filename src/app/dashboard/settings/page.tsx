'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { dbService } from '@/services/dbService';
import { PortalSettings, NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from '@/types';
import { 
  Settings, 
  Building, 
  UserPlus, 
  Bell, 
  Lock, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  AlertTriangle,
  Layers,
  Eye,
  RotateCcw,
  Save,
  Check,
  User,
  Sliders
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import toast from 'react-hot-toast';

// Settings Zod Schema
const settingsSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  allowMemberSignUp: z.boolean(),
  defaultTaskRole: z.enum(['SuperAdmin', 'Admin', 'Member']),
  notificationsEnabled: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface NotificationOption {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
  icon: any;
  group: 'workflow' | 'collaboration' | 'watchlist';
}

const NOTIFICATION_OPTIONS: NotificationOption[] = [
  // Workflow Group
  {
    key: 'assignments',
    title: 'Task Assignments',
    description: 'When new tasks are assigned to you or you are added as a co-assignee',
    icon: User,
    group: 'workflow',
  },
  {
    key: 'statusChanges',
    title: 'Status Changes',
    description: 'When workflow status changes on tasks you are assigned to or working on',
    icon: CheckCircle2,
    group: 'workflow',
  },
  {
    key: 'taskUpdates',
    title: 'Task Field Updates',
    description: 'When priority, expected completion date, or title/description are updated',
    icon: Layers,
    group: 'workflow',
  },
  {
    key: 'uatRejections',
    title: 'UAT Rejections',
    description: 'When a task you are assigned to is rejected during UAT testing',
    icon: AlertTriangle,
    group: 'workflow',
  },

  // Collaboration Group
  {
    key: 'comments',
    title: 'Task Comments',
    description: 'When team members post new discussion comments on your tasks',
    icon: MessageSquare,
    group: 'collaboration',
  },
  {
    key: 'replies',
    title: 'Comment Replies',
    description: 'When someone replies directly to one of your comments or replies',
    icon: MessageSquare,
    group: 'collaboration',
  },
  {
    key: 'mentions',
    title: '@Mentions',
    description: 'When you are specifically mentioned or tagged in any task discussion',
    icon: Bell,
    group: 'collaboration',
  },

  // Watchlist Group
  {
    key: 'watcherUpdates',
    title: 'Watcher Notifications',
    description: 'When any activity, comment, or status change occurs on tasks that you follow',
    icon: Eye,
    group: 'watchlist',
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'notifications' | 'portal'>('notifications');

  // Global Portal Settings state
  const [loadingPortal, setLoadingPortal] = useState(true);
  const [savingPortal, setSavingPortal] = useState(false);

  // Notification Preferences state (Batch 4)
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [isPrefsDirty, setIsPrefsDirty] = useState(false);

  const isAdmin = user?.role === 'SuperAdmin';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
  });

  // Load Global Portal Settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const globalSettings = await dbService.getSettings();
        reset(globalSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoadingPortal(false);
      }
    }
    loadSettings();
  }, [reset]);

  // Load User Notification Preferences
  useEffect(() => {
    async function loadUserPrefs() {
      if (!user?.email) return;
      try {
        setLoadingPrefs(true);
        const prefs = await dbService.getUserNotificationPreferences(user.email);
        setPreferences(prefs);
        setIsPrefsDirty(false);
      } catch (err) {
        console.error('Failed to load user notification preferences:', err);
      } finally {
        setLoadingPrefs(false);
      }
    }
    loadUserPrefs();
  }, [user?.email]);

  const onPortalSubmit = async (data: SettingsFormValues) => {
    if (!isAdmin) {
      toast.error('Only administrators can update global portal settings');
      return;
    }

    setSavingPortal(true);
    try {
      await dbService.saveSettings(data);
      reset(data);
      toast.success('Portal settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSavingPortal(false);
    }
  };

  const handleTogglePref = (key: keyof NotificationPreferences) => {
    setPreferences(prev => {
      const next = { ...prev, [key]: !prev[key] };
      setIsPrefsDirty(true);
      return next;
    });
  };

  const handleSavePrefs = async () => {
    if (!user?.email) return;
    setSavingPrefs(true);
    try {
      await dbService.saveUserNotificationPreferences(user.email, preferences);
      setIsPrefsDirty(false);
      toast.success('Notification preferences saved successfully!');
    } catch (err) {
      toast.error('Failed to save notification preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleResetDefaults = () => {
    setPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES });
    setIsPrefsDirty(true);
    toast.success('Reset to recommended defaults');
  };

  return (
    <div className="space-y-6 max-w-3xl pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Settings & Preferences
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Customize your personal notification rules and manage workspace configurations.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all cursor-pointer border-b-2 -mb-px ${
            activeTab === 'notifications'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <Bell className="h-4 w-4" />
          <span>Notification Preferences</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('portal')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all cursor-pointer border-b-2 -mb-px ${
            activeTab === 'portal'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <Building className="h-4 w-4" />
          <span>Portal Settings</span>
        </button>
      </div>

      {/* TAB 1: NOTIFICATION PREFERENCES */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Personal Notification Settings</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose which notifications you wish to receive in your dashboard bell.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={savingPrefs || loadingPrefs}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-all cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Defaults</span>
              </button>

              <button
                type="button"
                onClick={handleSavePrefs}
                disabled={savingPrefs || !isPrefsDirty || loadingPrefs}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPrefs ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Preferences</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {loadingPrefs ? (
            <div className="flex h-48 items-center justify-center glass-panel rounded-2xl">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Group 1: Task Workflows */}
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="border-b border-border/50 pb-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Task Workflow Notifications
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Updates regarding task status, assignment handovers, and testing verification.
                  </p>
                </div>

                <div className="space-y-3">
                  {NOTIFICATION_OPTIONS.filter(o => o.group === 'workflow').map((opt) => {
                    const isEnabled = preferences[opt.key] !== false;
                    const Icon = opt.icon;
                    return (
                      <div
                        key={opt.key}
                        onClick={() => handleTogglePref(opt.key)}
                        className="flex items-start justify-between p-3 rounded-xl border border-border/60 bg-background/40 hover:bg-background/80 hover:border-primary/40 transition-all cursor-pointer select-none gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-foreground">{opt.title}</h4>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${isEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                                {isEnabled ? 'ENABLED' : 'MUTED'}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                              {opt.description}
                            </p>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center cursor-pointer mt-1 shrink-0">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleTogglePref(opt.key)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: Discussion & Collaboration */}
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="border-b border-border/50 pb-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Discussions & Mentions
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Comments, threaded replies, and direct @mentions in task discussions.
                  </p>
                </div>

                <div className="space-y-3">
                  {NOTIFICATION_OPTIONS.filter(o => o.group === 'collaboration').map((opt) => {
                    const isEnabled = preferences[opt.key] !== false;
                    const Icon = opt.icon;
                    return (
                      <div
                        key={opt.key}
                        onClick={() => handleTogglePref(opt.key)}
                        className="flex items-start justify-between p-3 rounded-xl border border-border/60 bg-background/40 hover:bg-background/80 hover:border-primary/40 transition-all cursor-pointer select-none gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-foreground">{opt.title}</h4>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${isEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                                {isEnabled ? 'ENABLED' : 'MUTED'}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                              {opt.description}
                            </p>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center cursor-pointer mt-1 shrink-0">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleTogglePref(opt.key)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Group 3: Task Watchlist */}
              <div className="glass-panel p-5 rounded-2xl space-y-4">
                <div className="border-b border-border/50 pb-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Followed Tasks (Watchlist)
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Notifications about tasks you are actively watching or following without being assigned.
                  </p>
                </div>

                <div className="space-y-3">
                  {NOTIFICATION_OPTIONS.filter(o => o.group === 'watchlist').map((opt) => {
                    const isEnabled = preferences[opt.key] !== false;
                    const Icon = opt.icon;
                    return (
                      <div
                        key={opt.key}
                        onClick={() => handleTogglePref(opt.key)}
                        className="flex items-start justify-between p-3 rounded-xl border border-border/60 bg-background/40 hover:bg-background/80 hover:border-primary/40 transition-all cursor-pointer select-none gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-foreground">{opt.title}</h4>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${isEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                                {isEnabled ? 'ENABLED' : 'MUTED'}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                              {opt.description}
                            </p>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center cursor-pointer mt-1 shrink-0">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleTogglePref(opt.key)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GLOBAL PORTAL SETTINGS */}
      {activeTab === 'portal' && (
        <div className="space-y-6">
          {/* Non-Admin Notice */}
          {!isAdmin && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 text-amber-500 text-xs font-semibold leading-relaxed">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span>
                You are currently viewing portal settings as a <span className="underline">{user?.role}</span>. 
                Only administrators can modify system configurations and save updates.
              </span>
            </div>
          )}

          {/* Settings Form Card */}
          <div className="glass-panel p-6 rounded-2xl">
            <form onSubmit={handleSubmit(onPortalSubmit)} className="space-y-6">
              
              {/* Company Name */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <label>Organization Name</label>
                </div>
                <input
                  type="text"
                  disabled={!isAdmin || savingPortal}
                  className={`w-full px-3.5 py-2 border rounded-xl bg-background/50 outline-none text-sm focus:ring-2 focus:ring-primary/25 disabled:opacity-60 disabled:cursor-not-allowed ${
                    errors.companyName ? 'border-destructive' : 'border-border focus:border-primary'
                  }`}
                  placeholder="e.g. Acme Corporation"
                  {...register('companyName')}
                />
                {errors.companyName && (
                  <p className="text-xs text-destructive font-medium mt-1">{errors.companyName.message}</p>
                )}
              </div>

              {/* Member Sign Up Toggle */}
              <div className="flex items-center justify-between border-t border-border/40 pt-4">
                <div className="flex gap-3">
                  <UserPlus className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <label className="text-sm font-semibold block">Allow Public SignUp</label>
                    <span className="text-xs text-muted-foreground mt-0.5 block">
                      Enable new users to register and join the portal workspace.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!isAdmin || savingPortal}
                  className="h-5 w-5 rounded border-border focus:ring-primary text-primary transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  {...register('allowMemberSignUp')}
                />
              </div>

              {/* Default Assignment Role */}
              <div className="space-y-2 border-t border-border/40 pt-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <label>Default Task Role mapping</label>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Automatically assigns this role to newly created members.
                </p>
                <select
                  disabled={!isAdmin || savingPortal}
                  className="w-full sm:w-64 px-3.5 py-2 border border-border rounded-xl bg-background/50 text-sm outline-none cursor-pointer focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  {...register('defaultTaskRole')}
                >
                  <option value="Member">Member</option>
                  <option value="Admin">Admin</option>
                  <option value="SuperAdmin">Super Admin</option>
                </select>
              </div>

              {/* System Notifications Toggle */}
              <div className="flex items-center justify-between border-t border-border/40 pt-4">
                <div className="flex gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <label className="text-sm font-semibold block">Global System Notifications</label>
                    <span className="text-xs text-muted-foreground mt-0.5 block">
                      Enable the global notification hub across the application.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!isAdmin || savingPortal}
                  className="h-5 w-5 rounded border-border focus:ring-primary text-primary transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  {...register('notificationsEnabled')}
                />
              </div>

              {/* Save Button (Visible for admins only) */}
              {isAdmin && (
                <div className="border-t border-border/40 pt-5 flex justify-end">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={savingPortal || !isDirty}
                    className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {savingPortal ? (
                      <>
                        <Loader2 className="h-4.5 w-4.5 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </motion.button>
                </div>
              )}

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
