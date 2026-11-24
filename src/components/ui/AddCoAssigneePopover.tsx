'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, X, Loader2, Check, AlertCircle, Users, CheckCircle2 } from 'lucide-react';
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
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Load members on open
  useEffect(() => {
    if (isOpen) {
      setLoadingMembers(true);
      setSelectedEmails([]);
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

  const remainingSlots = Math.max(0, MAX_ASSIGNEES - existingIds.length);
  const isMaxReached = existingIds.length >= MAX_ASSIGNEES;

  // Filtered members based on search query
  const searchedMembers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return members;
    return members.filter((member) => {
      const name = (member.name || '').toLowerCase();
      const email = (member.email || '').toLowerCase();
      const role = (member.role || '').toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [members, searchQuery]);

  // Toggle multi-select
  const toggleSelect = (memberEmail: string) => {
    const lower = memberEmail.toLowerCase().trim();
    if (existingIds.includes(lower)) return; // Already assigned

    if (selectedEmails.includes(lower)) {
      setSelectedEmails((prev) => prev.filter((e) => e !== lower));
    } else {
      if (selectedEmails.length >= remainingSlots) {
        toast.error(`Maximum assignee limit reached (${MAX_ASSIGNEES} assignees).`);
        return;
      }
      setSelectedEmails((prev) => [...prev, lower]);
    }
  };

  const handleAdd = async () => {
    if (selectedEmails.length === 0) {
      toast.error('Please select at least one team member to add.');
      return;
    }

    if (!task.id) {
      toast.error('Task document ID not found.');
      return;
    }

    const membersToAdd = members.filter((m) =>
      m.email && selectedEmails.includes(m.email.toLowerCase())
    );

    if (membersToAdd.length === 0) {
      toast.error('No matching member details found for selection.');
      return;
    }

    setSubmitting(true);
    const addedBy = currentUser?.email || 'admin@taskportal.com';
    const addedByName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Team Member';

    try {
      const updated = await dbService.addCoAssignees(
        task.id,
        membersToAdd,
        addedBy,
        addedByName
      );

      const addedCount = membersToAdd.length;
      toast.success(
        addedCount === 1
          ? `${membersToAdd[0].name} added as co-assignee.`
          : `${addedCount} co-assignees added successfully.`
      );

      if (onSuccess) {
        onSuccess(updated);
      }
      onClose();
    } catch (err: any) {
      console.error('[AddCoAssigneePopover] Error adding co-assignees:', err);
      toast.error(err.message || 'Failed to add co-assignees.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          key="add-coassignee-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain"
        >
          <motion.div
            key="add-coassignee-modal-box"
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-none">Add Co-Assignees</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    {task.taskId || 'Task'} &bull; {task.title}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={submitting}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search Box */}
            <div className="p-3 border-b border-slate-800/80 bg-slate-950/30 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or role..."
                  disabled={submitting || isMaxReached}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Member List */}
            <div
              className="flex-1 overflow-y-auto p-2.5 space-y-1 min-h-[220px] max-h-[380px] custom-scrollbar overscroll-contain"
              onWheel={(e) => e.stopPropagation()}
            >
              {loadingMembers ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                  <span className="text-xs font-medium">Loading team roster...</span>
                </div>
              ) : isMaxReached ? (
                <div className="p-6 text-center space-y-2">
                  <AlertCircle className="h-7 w-7 text-amber-400 mx-auto" />
                  <p className="text-xs text-slate-200 font-semibold">Maximum assignees limit reached</p>
                  <p className="text-[11px] text-slate-400">
                    This task already has the maximum of {MAX_ASSIGNEES} assigned members.
                  </p>
                </div>
              ) : searchedMembers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <Users className="h-6 w-6 mx-auto text-slate-500 mb-1" />
                  <p className="text-xs font-medium">No team members found</p>
                  <p className="text-[10px] text-slate-500">
                    {searchQuery ? `No members match "${searchQuery}".` : 'No team members are available.'}
                  </p>
                </div>
              ) : (
                searchedMembers.map((member, idx) => {
                  const memberEmail = (member.email || '').toLowerCase().trim();
                  const memberKey = memberEmail || member.id || `member-${idx}`;
                  const isAlreadyAssigned = existingIds.includes(memberEmail);
                  const isSelected = selectedEmails.includes(memberEmail);

                  return (
                    <div
                      key={memberKey}
                      onClick={() => !submitting && !isAlreadyAssigned && toggleSelect(memberEmail)}
                      className={`flex items-center justify-between p-2 rounded-xl transition-all select-none ${
                        isAlreadyAssigned
                          ? 'bg-slate-900/40 border border-slate-800/60 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-primary/20 border border-primary/50 text-white cursor-pointer shadow-xs'
                          : 'hover:bg-slate-800/80 border border-transparent text-slate-200 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0 shadow-xs border border-slate-700"
                          style={{ backgroundColor: member.avatarColor || '#6366f1' }}
                        >
                          {(member.name || member.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5 truncate">
                            <p className="text-xs font-semibold truncate leading-snug">
                              {member.name || member.email}
                            </p>
                            {member.role && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                                {member.role}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate leading-none mt-0.5">
                            {member.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {isAlreadyAssigned ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3 text-slate-400" />
                            Already Assigned
                          </span>
                        ) : (
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-slate-600 bg-slate-800/50'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40 shrink-0">
              <div className="text-[11px] text-slate-400 font-medium">
                <span>
                  {existingIds.length}/{MAX_ASSIGNEES} assigned
                </span>
                {selectedEmails.length > 0 && (
                  <span className="text-primary font-bold ml-1.5">
                    (+{selectedEmails.length} selected)
                  </span>
                )}
              </div>
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
                  onClick={handleAdd}
                  disabled={selectedEmails.length === 0 || submitting || isMaxReached}
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
                      <span>
                        {selectedEmails.length > 1
                          ? `Add (${selectedEmails.length}) Co-Assignees`
                          : 'Add Co-Assignee'}
                      </span>
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
