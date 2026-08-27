'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { dbService } from '@/services/dbService';
import { authService } from '@/services/authService';
import { Member, UserRole } from '@/types';
import { 
  Plus, 
  Mail, 
  Calendar, 
  ShieldAlert, 
  UserCheck, 
  Sparkles,
  User,
  Clock,
  X,
  Eye,
  EyeOff,
  Loader2,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate } from '@/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import toast from 'react-hot-toast';

// Color Palette for avatars
const AVATAR_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
];

// Zod Schema for Adding Member
const addMemberSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  role: z.enum(['SuperAdmin', 'Admin', 'Member']),
  avatarColor: z.string().min(1, 'Please select an avatar color'),
});

type MemberFormValues = z.infer<typeof addMemberSchema>;

export default function TeamMembersPage() {
  const { user, hasPermission } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showPasswordInModal, setShowPasswordInModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function loadMembers() {
      try {
        const fetched = await dbService.getMembers();
        setMembers(fetched);
      } catch (error) {
        console.error('Error loading team members:', error);
      } finally {
        setLoading(false);
      }
    }
    loadMembers();
  }, []);

  const canAdd = hasPermission('canAddMember');

  const handleCopyCredentials = (member: Member) => {
    const text = `Team Portal Access:
Name: ${member.name}
Email: ${member.email}
Role: ${member.role === 'SuperAdmin' ? 'Super Admin' : member.role}
Password: ${member.password || 'Not Set'}
Login Link: ${window.location.origin}/login`;

    navigator.clipboard.writeText(text);
    toast.success('Credentials copied to clipboard!');
  };

  // React Hook Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      role: 'Member',
      avatarColor: AVATAR_COLORS[0],
    }
  });

  const selectedColor = watch('avatarColor');

  const onSubmit = async (data: MemberFormValues) => {
    setActionLoading(true);
    try {
      // 1. Generate an automatic password
      const generatedPassword = `pass${Math.floor(100000 + Math.random() * 900000)}`;

      // 2. Create the user credentials in Firebase Auth programmatically
      const uid = await authService.createMemberAuth(data.email, generatedPassword, data.name);

      // 3. Save profile document in Firestore
      const newMember: Omit<Member, 'id'> = {
        uid,
        name: data.name,
        email: data.email,
        role: data.role,
        avatarColor: data.avatarColor,
        password: generatedPassword,
        createdDate: new Date().toISOString(),
      };

      const created = await dbService.addMember(newMember);
      setMembers(prev => [...prev.filter(m => m.email.toLowerCase() !== created.email.toLowerCase()), created]);
      setIsModalOpen(false);
      reset();
      toast.success(`Team member added successfully! Temp Password: ${generatedPassword}`);
    } catch (error: any) {
      console.error('Error creating member:', error);
      toast.error(error.message || 'Failed to add team member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    if (!editingMember.name || editingMember.name.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    if (!editingMember.password || editingMember.password.trim().length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setActionLoading(true);
    try {
      const original = members.find(m => m.id === editingMember.id);
      if (!original) return;

      const updates: Partial<Member> = {
        name: editingMember.name,
        role: editingMember.role,
        avatarColor: editingMember.avatarColor,
      };

      const passwordChanged = editingMember.password !== original.password;
      if (passwordChanged) {
        await authService.updateMemberAuthPassword(
          original.email,
          original.password || 'password123',
          editingMember.password
        );
        updates.password = editingMember.password;
      }

      await dbService.updateMemberProfile(original.email, updates);
      setMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...updates } : m));
      setEditingMember(null);
      toast.success('Member profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating member:', error);
      toast.error(error.message || 'Failed to update member profile');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMember = async (member: Member) => {
    if (!confirm(`Are you sure you want to delete ${member.name} (${member.email})? This will delete their Auth credentials and Firestore records.`)) {
      return;
    }

    setActionLoading(true);
    try {
      await authService.deleteMemberAuth(member.email, member.password || 'password123');
      await dbService.deleteMember(member.email);
      setMembers(prev => prev.filter(m => m.id !== member.id));
      setEditingMember(null);
      toast.success('Member deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting member:', error);
      toast.error(error.message || 'Failed to delete member');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SuperAdmin': return 'bg-violet-500/10 text-violet-500 border-violet-500/20';
      case 'Admin': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Member': return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
      default: return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Team Roster</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage profiles, directory roles, and credentials.</p>
        </div>
        {canAdd && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-all cursor-pointer shadow-lg shadow-primary/20"
          >
            <Plus className="h-5 w-5" />
            <span>Add Member</span>
          </button>
        )}
      </div>

      {/* Roster display */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Clock className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        /* Team Members Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {members.map((member, idx) => (
            <motion.div
              key={member.id || member.email || `member-${idx}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              onClick={() => {
                if (user?.role === 'SuperAdmin') {
                  setEditingMember(member);
                  setShowPasswordInModal(false);
                }
              }}
              className={`glass-panel p-5 rounded-2xl flex flex-col justify-between hover:border-primary/20 transition-all text-center relative overflow-hidden group ${
                user?.role === 'SuperAdmin' ? 'cursor-pointer hover:shadow-lg' : ''
              }`}
            >
              {/* Dynamic decorative backdrop card color indicator */}
              <div 
                className="absolute top-0 left-0 right-0 h-1.5 opacity-70 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: member.avatarColor }}
              />

              {user?.role === 'SuperAdmin' && (
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyCredentials(member);
                    }}
                    className="p-1 rounded bg-accent/60 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    title="Copy Access Details"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <span className="text-[9px] bg-accent/60 text-muted-foreground px-2 py-0.5 rounded-md font-semibold select-none">
                    Manage / View
                  </span>
                </div>
              )}

              <div className="flex flex-col items-center pt-2">
                {/* Colored Avatar */}
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center font-extrabold text-white text-xl shadow-lg mb-4 cursor-default select-none transition-transform group-hover:scale-105"
                  style={{ backgroundColor: member.avatarColor }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>

                <h3 className="font-extrabold text-base leading-tight tracking-tight mb-1">{member.name}</h3>
                
                {/* Role Badge */}
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border mb-4 ${getRoleBadge(member.role)}`}>
                  {member.role === 'SuperAdmin' ? 'Super Admin' : member.role}
                </span>

                {/* Email Address */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 select-all">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground/80" />
                  <span>{member.email}</span>
                </div>
              </div>

              {/* Date Joined */}
              <div className="border-t border-border/40 mt-5 pt-3.5 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/85" />
                <span>Joined {formatDate(member.createdDate)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Modal backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md glass-panel bg-card/90 rounded-2xl p-6 shadow-2xl border border-card-border overflow-hidden backdrop-blur-lg"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4.5 right-4.5 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 cursor-pointer"
                disabled={actionLoading}
              >
                <X className="h-4.5 w-4.5" />
              </button>
              
              <h2 className="text-xl font-bold tracking-tight mb-5">Add Team Member</h2>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Full Name</label>
                  <input
                    type="text"
                    className={`w-full px-3 py-2 border rounded-xl bg-background/50 outline-none text-sm focus:ring-2 focus:ring-primary/25 ${
                      errors.name ? 'border-destructive' : 'border-border focus:border-primary'
                    }`}
                    placeholder="John Doe"
                    disabled={actionLoading}
                    {...register('name')}
                  />
                  {errors.name && <p className="text-[11px] text-destructive font-medium">{errors.name.message}</p>}
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Email Address</label>
                  <input
                    type="email"
                    className={`w-full px-3 py-2 border rounded-xl bg-background/50 outline-none text-sm focus:ring-2 focus:ring-primary/25 ${
                      errors.email ? 'border-destructive' : 'border-border focus:border-primary'
                    }`}
                    placeholder="john@company.com"
                    disabled={actionLoading}
                    {...register('email')}
                  />
                  {errors.email && <p className="text-[11px] text-destructive font-medium">{errors.email.message}</p>}
                </div>

                {/* Role selection */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Role</label>
                  <select
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background/50 text-sm outline-none cursor-pointer focus:border-primary animate-in fade-in"
                    disabled={actionLoading}
                    {...register('role')}
                  >
                    <option value="Member">Member</option>
                    <option value="Admin">Admin</option>
                    <option value="SuperAdmin">Super Admin</option>
                  </select>
                </div>

                {/* Avatar Color Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Avatar Theme Color</label>
                  <div className="flex gap-2.5 pt-1">
                    {AVATAR_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setValue('avatarColor', color)}
                        className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer hover:scale-110 ${
                          selectedColor === color ? 'border-foreground scale-105' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        disabled={actionLoading}
                      />
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={actionLoading}
                    className="px-4 py-2 border border-border hover:bg-accent/40 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-all rounded-xl text-sm shadow-md shadow-primary/20 cursor-pointer flex items-center gap-1.5"
                  >
                    {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Profile
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Member Modal */}
      <AnimatePresence>
        {editingMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Modal backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingMember(null)}
              className="fixed inset-0 bg-black"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md glass-panel bg-card/90 rounded-2xl p-6 shadow-2xl border border-card-border overflow-hidden backdrop-blur-lg"
            >
              <button 
                type="button"
                onClick={() => setEditingMember(null)}
                className="absolute top-4.5 right-4.5 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 cursor-pointer z-10"
                disabled={actionLoading}
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="flex justify-between items-center mb-5 pr-8">
                <h2 className="text-xl font-bold tracking-tight font-extrabold text-white">Edit Team Member</h2>
                {editingMember.password && (
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(editingMember)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-accent/40 text-xs font-bold transition-all cursor-pointer text-muted-foreground hover:text-foreground"
                    title="Copy credentials to share with member"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveMember} className="space-y-4">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Full Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background/50 outline-none text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary"
                    value={editingMember.name}
                    onChange={e => setEditingMember({ ...editingMember, name: e.target.value })}
                    disabled={actionLoading}
                  />
                </div>

                {/* Email (Read-Only) */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Email Address (Read-Only)</label>
                  <input
                    type="email"
                    readOnly
                    className="w-full px-3 py-2 border border-border/40 rounded-xl bg-background/20 outline-none text-sm text-muted-foreground cursor-not-allowed"
                    value={editingMember.email}
                  />
                </div>

                {/* Role selection */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Role</label>
                  <select
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background/50 text-sm outline-none cursor-pointer focus:border-primary"
                    value={editingMember.role}
                    onChange={e => setEditingMember({ ...editingMember, role: e.target.value as UserRole })}
                    disabled={actionLoading}
                  >
                    <option value="Member">Member</option>
                    <option value="Admin">Admin</option>
                    <option value="SuperAdmin">Super Admin</option>
                  </select>
                </div>

                {/* Password display & change */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Password</label>
                  <div className="relative">
                    <input
                      type={showPasswordInModal ? 'text' : 'password'}
                      required
                      className="w-full pl-3 pr-20 py-2 border border-border rounded-xl bg-background/50 outline-none text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary font-mono"
                      value={editingMember.password || ''}
                      onChange={e => setEditingMember({ ...editingMember, password: e.target.value })}
                      disabled={actionLoading}
                    />
                    <div className="absolute inset-y-0 right-0 pr-1 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const gen = `pass${Math.floor(100000 + Math.random() * 900000)}`;
                          setEditingMember({ ...editingMember, password: gen });
                          setShowPasswordInModal(true);
                          toast.success('Password auto-generated!');
                        }}
                        className="p-1 text-primary hover:text-primary/80 text-[10px] font-extrabold transition-colors cursor-pointer"
                        title="Auto-Generate password"
                      >
                        Generate
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPasswordInModal(!showPasswordInModal)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors pr-2 cursor-pointer"
                      >
                        {showPasswordInModal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Avatar Color Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Avatar Theme Color</label>
                  <div className="flex gap-2.5 pt-1">
                    {AVATAR_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditingMember({ ...editingMember, avatarColor: color })}
                        className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer hover:scale-110 ${
                          editingMember.avatarColor === color ? 'border-foreground scale-105' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        disabled={actionLoading}
                      />
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex justify-between items-center pt-3">
                  <button
                    type="button"
                    onClick={() => handleDeleteMember(editingMember)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 rounded-xl text-sm font-semibold text-destructive transition-all cursor-pointer disabled:opacity-50"
                  >
                    Delete Member
                  </button>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingMember(null)}
                      disabled={actionLoading}
                      className="px-4 py-2 border border-border hover:bg-accent/40 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-all rounded-xl text-sm shadow-md shadow-primary/20 cursor-pointer flex items-center gap-1.5"
                    >
                      {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      Save Profile
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
