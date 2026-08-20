'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { dbService } from '@/services/dbService';
import { authService } from '@/services/authService';
import { Task, ActivityLog } from '@/types';
import { 
  UserCircle, 
  Mail, 
  Lock, 
  Layers, 
  CheckCircle, 
  Clock, 
  Award, 
  Loader2, 
  Shield, 
  Palette, 
  Save, 
  KeyRound,
  History
} from 'lucide-react';
import { formatDate, isUserAssignedToTask } from '@/utils';
import toast from 'react-hot-toast';

const AVATAR_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
];

export default function ProfilePage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit forms state
  const [displayName, setDisplayName] = useState('');
  const [avatarColor, setAvatarColor] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setAvatarColor(user.avatarColor || '#3b82f6');
    }
  }, [user]);

  // Read tasks & activity log
  useEffect(() => {
    setLoading(true);
    const unsubscribeTasks = dbService.subscribeTasks((fetchedTasks) => {
      setTasks(fetchedTasks);
      setLoading(false);
    });

    const unsubscribeActivities = dbService.subscribeActivities((fetchedActivities) => {
      setActivities(fetchedActivities);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeActivities();
    };
  }, []);

  // Compute profile statistics
  const profileStats = useMemo(() => {
    if (!user) return { total: 0, completed: 0, pending: 0, workloadPoints: 0, workloadLabel: 'Light', avgDays: 'No tasks completed' };

    const email = user.email.toLowerCase();
    const myTasks = tasks.filter(t => isUserAssignedToTask(t, email));
    
    const total = myTasks.length;
    const completedTasks = myTasks.filter(t => t.status === 'completed' || t.status === 'moved-to-live');
    const completed = completedTasks.length;
    
    const activeTasks = myTasks.filter(t => t.status !== 'completed' && t.status !== 'moved-to-live' && t.status !== 'cancelled');
    const pending = activeTasks.length;

    // Workload calculation
    const workloadPoints = activeTasks.reduce((acc, t) => {
      const weight = t.priority === 'critical' ? 5 
                   : t.priority === 'high' ? 3 
                   : t.priority === 'medium' ? 2 
                   : 1;
      return acc + weight;
    }, 0);

    let workloadLabel = 'Light';
    if (workloadPoints >= 3 && workloadPoints <= 6) workloadLabel = 'Medium';
    else if (workloadPoints >= 7 && workloadPoints <= 10) workloadLabel = 'Busy';
    else if (workloadPoints > 10) workloadLabel = 'Overloaded';

    // Average completion speed
    const times = completedTasks.map(t => {
      const created = new Date(t.createdDate).getTime();
      const completedHistory = t.statusHistory?.find(h => h.status === 'completed' || h.status === 'moved-to-live');
      const completedTime = completedHistory ? new Date(completedHistory.updatedAt).getTime() : new Date(t.updatedDate).getTime();
      return Math.max(0, completedTime - created);
    });

    let avgDays = 'No tasks completed';
    if (times.length > 0) {
      const avgMs = times.reduce((acc, t) => acc + t, 0) / times.length;
      const avgHrs = avgMs / (1000 * 60 * 60);
      if (avgHrs < 24) {
        avgDays = `${avgHrs.toFixed(1)} Hours`;
      } else {
        avgDays = `${(avgHrs / 24).toFixed(1)} Days`;
      }
    }

    return { total, completed, pending, workloadPoints, workloadLabel, avgDays };
  }, [tasks, user]);

  // Filter activities done by current user
  const myActivities = useMemo(() => {
    if (!user) return [];
    return activities
      .filter(act => act.user.toLowerCase() === user.email.toLowerCase())
      .slice(0, 6);
  }, [activities, user]);

  // Form submit handler: update info
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error('Display Name cannot be empty.');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await authService.updateProfileInfo(displayName, avatarColor);
      toast.success('Profile details updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile info');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Form submit handler: update password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await authService.changePassword(newPassword);
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none max-w-4xl mx-auto pb-12">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <UserCircle className="h-7 w-7 text-primary" />
          My Profile
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your personal settings, customize your avatar, and track workloads.</p>
      </div>

      {/* Main Grid: Info card and metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Card: Profile Avatar and Roles */}
        <div className="glass-panel p-6 rounded-3xl border border-card-border flex flex-col items-center justify-center text-center space-y-4">
          <div 
            className="w-24 h-24 rounded-full flex items-center justify-center font-bold text-white text-3xl shadow-inner relative border-4 border-card-border"
            style={{ backgroundColor: user.avatarColor || '#3b82f6' }}
          >
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground leading-snug">{user.displayName}</h2>
            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider bg-accent/60 px-2 py-0.5 rounded-md mt-1 inline-block border border-card-border">
              {user.role}
            </span>
          </div>
          <div className="w-full border-t border-card-border/60 pt-3 text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>
        </div>

        {/* Right Section: Core Metrics summary */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          
          <div className="glass-panel p-4.5 rounded-2xl border border-card-border flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-500" />
              Assigned Tasks
            </span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black">{profileStats.total}</span>
              <span className="text-xs text-muted-foreground">items</span>
            </div>
          </div>

          <div className="glass-panel p-4.5 rounded-2xl border border-card-border flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              Completed Tasks
            </span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-500">{profileStats.completed}</span>
              <span className="text-xs text-muted-foreground">items</span>
            </div>
          </div>

          <div className="glass-panel p-4.5 rounded-2xl border border-card-border flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Active Capacity
            </span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl font-black uppercase text-amber-500">{profileStats.workloadLabel}</span>
              <span className="text-xs text-muted-foreground">({profileStats.workloadPoints} pts)</span>
            </div>
          </div>

          <div className="glass-panel p-4.5 rounded-2xl border border-card-border flex flex-col justify-between">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wide flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-purple-500" />
              Completion Rate
            </span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-purple-500">
                {profileStats.total > 0 ? Math.round((profileStats.completed / profileStats.total) * 100) : 0}%
              </span>
              <span className="text-xs text-muted-foreground">done rate</span>
            </div>
          </div>

        </div>

      </div>

      {/* Editing section panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Form 1: Edit profile name and color */}
        <div className="glass-panel p-5.5 rounded-3xl border border-card-border space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
            <Palette className="h-4.5 w-4.5 text-primary" />
            Customize Profile Details
          </h3>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-background/50 border border-card-border rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Avatar Theme Color</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {AVATAR_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    className="w-8 h-8 rounded-full border border-card-border cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center relative shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {avatarColor === color && (
                      <span className="absolute w-2.5 h-2.5 bg-white rounded-full shadow-md" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary disabled:opacity-50 text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition-all text-xs cursor-pointer shadow-md shadow-primary/20"
            >
              {isUpdatingProfile ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Save className="h-4.5 w-4.5" />}
              Save Profile changes
            </button>
          </form>
        </div>

        {/* Form 2: Change Password */}
        <div className="glass-panel p-5.5 rounded-3xl border border-card-border space-y-4">
          <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
            <KeyRound className="h-4.5 w-4.5 text-primary" />
            Update Password
          </h3>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">New Password</label>
              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-background/50 border border-card-border rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-background/50 border border-card-border rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-primary disabled:opacity-50 text-primary-foreground font-bold rounded-xl hover:bg-primary/95 transition-all text-xs cursor-pointer shadow-md shadow-primary/20"
            >
              {isUpdatingPassword ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Save className="h-4.5 w-4.5" />}
              Change Password
            </button>
          </form>
        </div>

      </div>

      {/* User recent Activity log stream */}
      <div className="glass-panel p-5.5 rounded-3xl border border-card-border space-y-4">
        <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
          <History className="h-4.5 w-4.5 text-primary" />
          My Recent Activities
        </h3>

        <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
          {myActivities.length > 0 ? (
            myActivities.map((act) => (
              <div key={act.id} className="flex gap-3 text-xs border-b border-border/20 pb-3 last:border-b-0 last:pb-0">
                <div className="w-7 h-7 rounded-lg bg-accent/80 flex items-center justify-center shrink-0 font-black text-muted-foreground">
                  {act.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-foreground leading-normal font-semibold">
                    You {act.action}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                    Task ID: <strong className="text-foreground">{act.taskSeqId}</strong> • Project: {act.taskTitle} • {formatDate(act.timestamp)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic text-center py-4">No activities logged yet.</p>
          )}
        </div>
      </div>

    </div>
  );
}
