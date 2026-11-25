'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Trash2, 
  AlertTriangle, 
  ShieldAlert, 
  Loader2, 
  Layers, 
  Folder, 
  Sparkles,
  Lock
} from 'lucide-react';
import { ProjectChangeChecklist, getChecklistPoints } from '@/types';
import { dbService } from '@/services/dbService';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

interface DeleteChangeChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  checklist: ProjectChangeChecklist | null;
  onSuccess?: (deletedId: string) => void;
}

export default function DeleteChangeChecklistModal({
  isOpen,
  onClose,
  checklist,
  onSuccess
}: DeleteChangeChecklistModalProps) {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !checklist) return null;

  const pointsCount = getChecklistPoints(checklist).length;

  // Determine if this checklist is linked to a release
  const isReleaseLinked = 
    checklist.status === 'Included in Release' || 
    checklist.status === 'Completed' ||
    Boolean(checklist.currentReleaseId);

  // Check authorization: SuperAdmin, Admin, or creator
  const isCreator = user?.email && checklist.createdBy && checklist.createdBy.toLowerCase() === user.email.toLowerCase();
  const isPrivileged = user?.role === 'SuperAdmin' || user?.role === 'Admin';
  const isAuthorized = isCreator || isPrivileged;

  const handleDelete = async () => {
    if (!checklist.id || isDeleting) return;

    if (!isAuthorized) {
      const msg = "You do not have permission to delete this checklist.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (isReleaseLinked) {
      const msg = "Cannot delete: This checklist is included in a Production Release. Release-linked records are protected to preserve QA and audit history.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setErrorMessage(null);
    setIsDeleting(true);

    try {
      await dbService.deleteProjectChangeChecklist(
        checklist.id,
        user?.email,
        user?.role
      );

      toast.success(`Checklist "${checklist.title}" permanently deleted`);
      if (onSuccess) onSuccess(checklist.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to delete change checklist:', err);
      const msg = err?.message || 'Failed to delete change checklist';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto select-none"
        onClick={() => !isDeleting && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-lg bg-card border border-destructive/30 rounded-2xl shadow-2xl overflow-hidden my-auto text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-card-border bg-destructive/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-destructive/20 border border-destructive/30 flex items-center justify-center text-destructive shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-foreground truncate">
                  Delete Project Change Checklist?
                </h2>
                <p className="text-xs text-destructive font-medium mt-0.5">
                  Permanent deletion of checklist record
                </p>
              </div>
            </div>

            {!isDeleting && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 max-h-[calc(88vh-8rem)] overflow-y-auto custom-scrollbar text-xs">
            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-destructive/15 border border-destructive/30 space-y-1 text-destructive">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Action Blocked</span>
                </div>
                <p className="text-[11px] leading-relaxed text-foreground font-medium pl-6">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Description notice */}
            <p className="text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete this checklist? Its change points, comments and checklist-specific information will no longer be available.
            </p>

            {/* Release Linkage Protection Warning */}
            {isReleaseLinked && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 text-amber-400">
                <div className="flex items-center gap-2 font-bold">
                  <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Release-Linked Checklist Protected</span>
                </div>
                <p className="text-[11px] text-foreground/90 font-medium leading-relaxed pl-6">
                  This checklist is currently linked to <strong>{checklist.currentReleaseName || 'a Production Release'}</strong> (Status: <span className="font-semibold text-amber-300">{checklist.status}</span>).
                </p>
                <p className="text-[10px] text-muted-foreground pl-6">
                  To prevent breaking historical release verification audits and QA tracking, this checklist cannot be deleted through the normal checklist delete action.
                </p>
              </div>
            )}

            {/* Checklist Details Card */}
            <div className="p-4 rounded-xl bg-accent/25 border border-card-border/80 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-card-border/60 pb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Checklist Details
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  checklist.status === 'Completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                  checklist.status === 'Included in Release' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25' :
                  checklist.status === 'Rejected by QA' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' :
                  'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                }`}>
                  {checklist.status}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-foreground">
                  <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-muted-foreground">Project:</span>
                  <span className="font-bold text-primary">{checklist.projectName}</span>
                </div>

                <div className="flex items-start gap-2 text-foreground">
                  <span className="text-muted-foreground mt-0.5">Change:</span>
                  <span className="font-bold leading-snug">{checklist.title}</span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground pt-1 text-[11px]">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Total verification points: <strong className="text-foreground">{pointsCount}</strong></span>
                </div>
              </div>
            </div>

            {/* Safety policy notice */}
            <div className="p-3 rounded-xl bg-card/60 border border-card-border text-[11px] text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground">Authoritative Data Safety Guarantee:</span>
              <p>Original tasks in All Tasks, task comments, projects, users, and production releases will never be altered or deleted.</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-card-border bg-card/70">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isReleaseLinked || !isAuthorized}
              className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-destructive/20"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Checklist</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
