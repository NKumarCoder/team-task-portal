'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, X, Loader2, Check, AlertCircle, Users } from 'lucide-react';
import { Member, Task } from '@/types';
import { dbService } from '@/services/dbService';
import { getTaskAssigneeIds } from '@/utils';
import { MAX_ASSIGNEES } from '@/constants';
import toast from 'react-hot-toast';

interface AddCoAssigneePopoverProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updatedTask: Task) => void;
  currentUser: { email?: string | null; displayName?: string | null } | null;
}

export default function AddCoAssigneePopover({
  task,
  isOpen,
  onClose,
  onSuccess,
  currentUser
}: AddCoAssigneePopoverProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load members on open
  useEffect(() => {
    if (isOpen) {
      setLoadingMembers(true);
      setSelectedMember(null);
      setSearchQuery('');
      dbService.getMembers()
        .then((fetched) => {
          setMembers(fetched || []);
        })
        .catch((err) => {
          console.error('[AddCoAssigneePopover] Failed to load members:', err);
          toast.error('Failed to load team members.');
        })
        .finally(() => {
          setLoadingMembers(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        });
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        if (!submitting) {
          onClose();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, submitting, onClose]);

  const existingIds = useMemo(() => {
    return getTaskAssigneeIds(task);
  }, [task]);

  const isMaxReached = existingIds.length >= MAX_ASSIGNEES;

  // Filter eligible members: Active AND not already assigned
  const eligibleMembers = useMemo(() => {
    return members.filter((member) => {
      // Must be active
      if (member.isActive === false) return false;
      
      const memberEmail = (member.email || member.id || '').toLowerCase().trim();
      // Must NOT already be assigned
      if (existingIds.includes(memberEmail)) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = member.name.toLowerCase().includes(q);
        const matchesEmail = memberEmail.includes(q);
        return matchesName || matchesEmail;
      }

      return true;
    });
  }, [members, existingIds, searchQuery]);

  const handleAdd = async (memberToAdd?: Member) => {
    const target = memberToAdd || selectedMember;
    if (!target) {
      toast.error('Please select a team member to add.');
      return;
    }

    if (isMaxReached) {
      toast.error(`Maximum assignee limit reached (${MAX_ASSIGNEES} assignees).`);
      return;
    }

    if (!task.id) {
      toast.error('Task document ID not found.');
      return;
    }

    setSubmitting(true);
    const addedBy = currentUser?.email || 'admin@taskportal.com';
    const addedByName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Team Member';

    try {
      const updated = await dbService.addCoAssignee(
        task.id,
        target,
        addedBy,
        addedByName
      );

      toast.success(`${target.name} added as co-assignee.`);
      if (onSuccess) {
        onSuccess(updated);
      }
      onClose();
    } catch (err: any) {
      console.error('[AddCoAssigneePopover] Error adding co-assignee:', err);
      toast.error(err.message || 'Failed to add co-assignee.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="add-coassignee-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            key="add-coassignee-modal-box"
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-900/90">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-none">Add Co-Assignee</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{task.taskId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/30">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team members..."
                disabled={submitting || isMaxReached}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Member List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[160px] max-h-[260px]">
            {loadingMembers ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin text-primary mb-2" />
                <span className="text-xs">Loading team roster...</span>
              </div>
            ) : isMaxReached ? (
              <div className="p-4 text-center space-y-2">
                <AlertCircle className="h-6 w-6 text-amber-400 mx-auto" />
                <p className="text-xs text-slate-300 font-semibold">Maximum assignees limit reached</p>
                <p className="text-[11px] text-slate-400">This task already has {MAX_ASSIGNEES} assigned members.</p>
              </div>
            ) : eligibleMembers.length === 0 ? (
              <div className="p-6 text-center text-slate-400 space-y-1">
                <Users className="h-5 w-5 mx-auto text-slate-500 mb-1" />
                <p className="text-xs font-medium">No available team members</p>
                <p className="text-[10px] text-slate-500">
                  {searchQuery ? 'No members match your search.' : 'All active members are already assigned.'}
                </p>
              </div>
            ) : (
              eligibleMembers.map((member, idx) => {
                const memberKey = member.id || member.email || `member-${idx}`;
                const isSelected = selectedMember?.id === member.id || (member.email && selectedMember?.email === member.email);
                return (
                  <div
                    key={memberKey}
                    onClick={() => !submitting && setSelectedMember(member)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-primary/20 border border-primary/40 text-white'
                        : 'hover:bg-slate-800/80 border border-transparent text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0 shadow-sm border border-slate-700"
                        style={{ backgroundColor: member.avatarColor || '#6366f1' }}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold truncate leading-snug">{member.name}</p>
                        <p className="text-[10px] text-slate-400 truncate leading-none">{member.email}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white shrink-0 ml-2">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40">
            <span className="text-[10px] text-slate-400">
              {existingIds.length}/{MAX_ASSIGNEES} assigned
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAdd()}
                disabled={!selectedMember || submitting || isMaxReached}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Add Co-Assignee</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
