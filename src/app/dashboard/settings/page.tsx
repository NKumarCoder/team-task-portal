'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { dbService } from '@/services/dbService';
import { PortalSettings, UserRole } from '@/types';
import { 
  Settings, 
  Building, 
  UserPlus, 
  Bell, 
  Lock,
  Loader2,
  AlertCircle
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

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'SuperAdmin';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const globalSettings = await dbService.getSettings();
        reset(globalSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
        toast.error('Failed to load portal settings');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [reset]);

  const onSubmit = async (data: SettingsFormValues) => {
    if (!isAdmin) {
      toast.error('Only administrators can update global portal settings');
      return;
    }

    setSaving(true);
    try {
      await dbService.saveSettings(data);
      reset(data); // reset dirty state
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Portal Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure company preferences, system rules, and email targets.</p>
      </div>

      {/* Non-Admin Notice */}
      {!isAdmin && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 text-amber-500 text-xs font-semibold leading-relaxed">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          <span>
            You are currently viewing settings as a <span className="underline">{user?.role}</span>. 
            Only administrators can modify system configurations and save updates.
          </span>
        </div>
      )}

      {/* Settings Form Card */}
      <div className="glass-panel p-6 rounded-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Company Name */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Building className="h-4 w-4 text-muted-foreground" />
              <label>Organization Name</label>
            </div>
            <input
              type="text"
              disabled={!isAdmin || saving}
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
              disabled={!isAdmin || saving}
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
              disabled={!isAdmin || saving}
              className="w-full sm:w-64 px-3.5 py-2 border border-border rounded-xl bg-background/50 text-sm outline-none cursor-pointer focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              {...register('defaultTaskRole')}
            >
              <option value="Member">Member</option>
              <option value="Admin">Admin</option>
              <option value="SuperAdmin">Super Admin</option>
            </select>
          </div>

          {/* Notifications Toggle */}
          <div className="flex items-center justify-between border-t border-border/40 pt-4">
            <div className="flex gap-3">
              <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <label className="text-sm font-semibold block">System Notifications</label>
                <span className="text-xs text-muted-foreground mt-0.5 block">
                  Send system alert logs and task reminders to the dashboard notification bell.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              disabled={!isAdmin || saving}
              className="h-5 w-5 rounded border-border focus:ring-primary text-primary transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              {...register('notificationsEnabled')}
            />
          </div>

          {/* Save Button (Visible for admins only, and disabled if form not dirty) */}
          {isAdmin && (
            <div className="border-t border-border/40 pt-5 flex justify-end">
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={saving || !isDirty}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {saving ? (
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
  );
}
