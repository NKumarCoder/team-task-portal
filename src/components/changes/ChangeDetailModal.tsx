'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Folder, 
  User, 
  Calendar, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Edit3,
  Layers,
  History,
  Trash2,
  Plus,
  Check,
  Loader2,
  Info,
  ExternalLink,
  MessageSquare,
  Square,
  CheckSquare
} from 'lucide-react';
import { ProjectChangeChecklist, ChangeChecklistItem, getChecklistItems, getChecklistPoints } from '@/types';
import { dbService } from '@/services/dbService';
import { useAuth } from '@/hooks/useAuth';
import { TASK_STATUS_CONFIG } from '@/constants';
import { formatDate } from '@/utils';
import toast from 'react-hot-toast';

interface ChangeDetailModalProps {
  checklist: ProjectChangeChecklist | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (checklist: ProjectChangeChecklist) => void;
  onDeleted?: (checklistId: string) => void;
  onChecklistUpdated?: (updated: ProjectChangeChecklist) => void;
  canEdit?: boolean;
}

export default function ChangeDetailModal({
  checklist,
  isOpen,
  onClose,
  onEdit,
  onDeleted,
  onChecklistUpdated,
  canEdit = true
}: ChangeDetailModalProps) {
  // Inline Point Editing State
  const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null);
  const [editingPointText, setEditingPointText] = useState('');
  const [newPointText, setNewPointText] = useState('');
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [pointActionLoading, setPointActionLoading] = useState(false);

  // Point Deletion Confirmation State
  const [confirmDeletePointIndex, setConfirmDeletePointIndex] = useState<number | null>(null);

  // Entire Change Deletion Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingChange, setIsDeletingChange] = useState(false);

  if (!isOpen || !checklist) return null;

  // Determine release protection status
  const hasReleaseHistory = Boolean(checklist.currentReleaseId) || 
    checklist.status === 'Included in Release' || 
    checklist.status === 'Completed' ||
    Boolean(checklist.rejectionHistory && checklist.rejectionHistory.length > 0);

  const canDeleteChange = !hasReleaseHistory && checklist.status === 'Available for Release';
  const isEditable = canEdit && (checklist.status === 'Available for Release' || checklist.status === 'Rejected by QA');

  const { user } = useAuth();
  const items = getChecklistItems(checklist);
  const points = getChecklistPoints(checklist);

  const [editingCommentIndex, setEditingCommentIndex] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  // Handle direct item completion toggle (Does NOT touch tasks in All Tasks)
  const handleToggleItemComplete = async (itemId: string) => {
    if (!checklist.id || !user || !isEditable) return;
    setPointActionLoading(true);
    try {
      const userEmail = user.email.toLowerCase();
      const userName = user.displayName || user.email.split('@')[0];
      const updatedItems = await dbService.toggleChecklistItemStatus(checklist.id, itemId, userEmail, userName);
      const updatedChecklist = { ...checklist, items: updatedItems, points: updatedItems.map(it => it.text) };
      if (onChecklistUpdated) onChecklistUpdated(updatedChecklist);
      toast.success('Checklist item status updated');
    } catch (err: any) {
      console.error('Failed to toggle item completion:', err);
      toast.error('Failed to update item completion');
    } finally {
      setPointActionLoading(false);
    }
  };

  // Handle direct item comment update
  const handleSaveComment = async (itemId: string, comment: string) => {
    if (!checklist.id || !isEditable) return;
    setPointActionLoading(true);
    try {
      const updatedItems = await dbService.updateChecklistItemComment(checklist.id, itemId, comment);
      const updatedChecklist = { ...checklist, items: updatedItems, points: updatedItems.map(it => it.text) };
      if (onChecklistUpdated) onChecklistUpdated(updatedChecklist);
      setEditingCommentIndex(null);
      setEditingCommentText('');
      toast.success('Comment saved');
    } catch (err: any) {
      console.error('Failed to update comment:', err);
      toast.error('Failed to save comment');
    } finally {
      setPointActionLoading(false);
    }
  };

  // Task status badge helper
  const getTaskStatusBadge = (status?: string) => {
    if (!status) return null;
    const cfg = TASK_STATUS_CONFIG[status] || {
      label: status,
      badgeBg: 'bg-accent/40',
      badgeColor: 'text-muted-foreground',
      badgeBorder: 'border-card-border'
    };
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${cfg.badgeBg} ${cfg.badgeColor} ${cfg.badgeBorder}`}>
        {cfg.label}
      </span>
    );
  };

  // Handle Adding Point directly
  const handleSaveNewPoint = async () => {
    const clean = newPointText.trim();
    if (!clean || !checklist.id) return;

    setPointActionLoading(true);
    try {
      const updatedPoints = await dbService.addChangePoint(checklist.id, clean);
      const updatedChecklist = { ...checklist, points: updatedPoints, changes: updatedPoints };
      if (onChecklistUpdated) onChecklistUpdated(updatedChecklist);
      setNewPointText('');
      setIsAddingPoint(false);
      toast.success('Point added successfully');
    } catch (err: any) {
      console.error('Failed to add point:', err);
      toast.error(err?.message || 'Failed to add point');
    } finally {
      setPointActionLoading(false);
    }
  };

  // Handle Inline Point Edit Save
  const handleSavePointEdit = async (index: number) => {
    const clean = editingPointText.trim();
    if (!clean || !checklist.id) return;

    setPointActionLoading(true);
    try {
      const updatedPoints = await dbService.updateChangePoint(checklist.id, index, clean);
      const updatedChecklist = { ...checklist, points: updatedPoints, changes: updatedPoints };
      if (onChecklistUpdated) onChecklistUpdated(updatedChecklist);
      setEditingPointIndex(null);
      setEditingPointText('');
      toast.success('Point updated successfully');
    } catch (err: any) {
      console.error('Failed to update point:', err);
      toast.error(err?.message || 'Failed to update point');
    } finally {
      setPointActionLoading(false);
    }
  };

  // Handle Point Deletion
  const handleConfirmDeletePoint = async (index: number) => {
    if (!checklist.id) return;
    if (points.length <= 1) {
      toast.error('A change entry must have at least one point.');
      setConfirmDeletePointIndex(null);
      return;
    }

    setPointActionLoading(true);
    try {
      const updatedPoints = await dbService.deleteChangePoint(checklist.id, index);
      const updatedChecklist = { ...checklist, points: updatedPoints, changes: updatedPoints };
      if (onChecklistUpdated) onChecklistUpdated(updatedChecklist);
      setConfirmDeletePointIndex(null);
      toast.success('Point removed');
    } catch (err: any) {
      console.error('Failed to delete point:', err);
      toast.error(err?.message || 'Failed to delete point');
    } finally {
      setPointActionLoading(false);
    }
  };

  // Handle Entire Change Deletion
  const handleDeleteChange = async () => {
    if (!checklist.id || isDeletingChange) return;
    if (!canDeleteChange) {
      toast.error('Cannot delete: This change is part of a production release or has release history.');
      return;
    }

    setIsDeletingChange(true);
    try {
      await dbService.deleteProjectChangeChecklist(checklist.id);
      toast.success('Project change checklist deleted');
      setIsDeleteModalOpen(false);
      onClose();
      if (onDeleted) onDeleted(checklist.id);
    } catch (err: any) {
      console.error('Failed to delete change checklist:', err);
      toast.error(err?.message || 'Failed to delete change checklist');
    } finally {
      setIsDeletingChange(false);
    }
  };

  const getStatusBadge = (status: ProjectChangeChecklist['status']) => {
    switch (status) {
      case 'Available for Release':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-500 border border-blue-500/25">
            <Clock className="h-3 w-3" />
            Available for Release
          </span>
        );
      case 'Included in Release':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/15 text-purple-500 border border-purple-500/25">
            <Layers className="h-3 w-3" />
            Included in Release
          </span>
        );
      case 'Rejected by QA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-500 border border-rose-500/25">
            <AlertCircle className="h-3 w-3" />
            Rejected by QA
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-2xl bg-card border border-card-border rounded-2xl shadow-2xl overflow-hidden my-auto text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-card-border bg-card/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Folder className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                    {checklist.projectName}
                  </span>
                  {getStatusBadge(checklist.status)}
                </div>
                <h2 className="text-base font-bold text-foreground mt-1 truncate">
                  {checklist.title}
                </h2>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {isEditable && onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(checklist);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-xs font-bold transition-all cursor-pointer"
                  title="Edit Entire Change"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </button>
              )}

              {canDeleteChange && (
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  title="Delete Entire Change"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5 max-h-[calc(88vh-8rem)] overflow-y-auto custom-scrollbar">
            {/* Meta info strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-accent/20 border border-card-border/60 text-xs">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                <div className="truncate">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Developer</p>
                  <p className="font-semibold text-foreground truncate">{checklist.createdByName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Created</p>
                  <p className="font-semibold text-foreground">{formatDate(checklist.createdDate)}</p>
                </div>
              </div>
              {checklist.currentReleaseName && (
                <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                  <Layers className="h-4 w-4 text-purple-400 shrink-0" />
                  <div className="truncate">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Release</p>
                    <p className="font-semibold text-purple-400 truncate">{checklist.currentReleaseName}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Notice if change is already in an active release */}
            {checklist.status === 'Included in Release' && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-start gap-2.5 text-xs text-purple-300">
                <Info className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-foreground">Included in Production Release:</span>{' '}
                  This change is currently being verified in <strong className="text-purple-300">{checklist.currentReleaseName || 'an active release'}</strong>. The release snapshot remains locked for QA review.
                </div>
              </div>
            )}

            {/* QA Rejection Warning banner if rejected */}
            {checklist.status === 'Rejected by QA' && checklist.rejectionHistory && checklist.rejectionHistory.length > 0 && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-2">
                <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Rejected by QA in {checklist.rejectionHistory[checklist.rejectionHistory.length - 1].releaseName}</span>
                </div>
                <p className="text-xs text-foreground font-medium pl-6 leading-relaxed bg-card/60 p-2.5 rounded-lg border border-rose-500/20">
                  "{checklist.rejectionHistory[checklist.rejectionHistory.length - 1].reason}"
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pl-6 pt-1">
                  <span>Rejected by: <strong className="text-foreground">{checklist.rejectionHistory[checklist.rejectionHistory.length - 1].rejectedByName}</strong></span>
                  <span>{formatDate(checklist.rejectionHistory[checklist.rejectionHistory.length - 1].rejectedDate)}</span>
                </div>
              </div>
            )}

            {/* Description (Optional) */}
            {checklist.description && (
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Description
                </h3>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap bg-card/40 p-3 rounded-xl border border-card-border/60">
                  {checklist.description}
                </p>
              </div>
            )}

            {/* Unified Section: Changes / Verification Points */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Changes / Verification Points ({points.length} points)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    These points serve as the exact QA verification checklist during production release
                  </p>
                </div>

                {!isAddingPoint && isEditable && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPoint(true);
                      setNewPointText('');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors cursor-pointer border border-primary/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Point</span>
                  </button>
                )}
              </div>

              {/* Point-wise List with Individual Edit & Delete Controls */}
              <div className="space-y-2.5">
                {items.map((item, idx) => {
                  const isEditingThis = editingPointIndex === idx;
                  const isConfirmingDelete = confirmDeletePointIndex === idx;
                  const isEditingComment = editingCommentIndex === idx;
                  const isCompleted = item.status === 'Completed';

                  return (
                    <div 
                      key={item.id || idx} 
                      className={`p-3.5 rounded-xl border text-xs flex flex-col gap-2 transition-all ${
                        isCompleted 
                          ? 'bg-emerald-500/[0.04] border-emerald-500/25' 
                          : 'bg-accent/20 border-card-border/60'
                      }`}
                    >
                      {isEditingThis ? (
                        /* Inline Edit Form */
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={editingPointText}
                            onChange={(e) => setEditingPointText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSavePointEdit(idx);
                              if (e.key === 'Escape') setEditingPointIndex(null);
                            }}
                            autoFocus
                            className="flex-1 px-3 py-1.5 rounded-lg bg-accent/40 border border-card-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                          />
                          <button
                            type="button"
                            disabled={pointActionLoading}
                            onClick={() => handleSavePointEdit(idx)}
                            className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                            title="Save point"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPointIndex(null)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        /* Standard View Row */
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            {/* Numbering */}
                            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>

                            {/* Checkbox to toggle completion */}
                            <button
                              type="button"
                              disabled={!isEditable || pointActionLoading}
                              onClick={() => handleToggleItemComplete(item.id)}
                              className={`mt-0.5 transition-colors shrink-0 ${
                                isEditable ? 'cursor-pointer hover:opacity-80' : 'cursor-default opacity-80'
                              }`}
                              title={isCompleted ? "Completed" : "Pending"}
                            >
                              {isCompleted ? (
                                <CheckSquare className="h-4.5 w-4.5 text-emerald-500" />
                              ) : (
                                <Square className="h-4.5 w-4.5 text-muted-foreground/60" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1 space-y-1">
                              {/* Metadata chips */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {item.taskId ? (
                                  <>
                                    <span className="font-mono font-bold text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                                      {item.taskId}
                                    </span>
                                    {getTaskStatusBadge(item.taskStatus)}
                                    {item.taskModule && (
                                      <span className="text-[10px] font-medium text-muted-foreground bg-accent/40 px-1.5 py-0.5 rounded border border-card-border/60">
                                        {item.taskModule}
                                      </span>
                                    )}
                                    {item.taskDocId && (
                                      <a
                                        href={`/dashboard/tasks/${item.taskDocId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
                                        title="View original task in All Tasks"
                                      >
                                        <span>View Task</span>
                                        <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/25 px-1.5 py-0.5 rounded">
                                    Manual Point
                                  </span>
                                )}

                                {isCompleted && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    <span>Completed</span>
                                  </span>
                                )}
                              </div>

                              {/* Title / Text */}
                              <p className="text-foreground leading-relaxed break-words font-medium text-xs">
                                {item.text}
                              </p>

                              {/* Completion timestamp */}
                              {isCompleted && item.completedByName && (
                                <p className="text-[10px] text-emerald-500 font-medium">
                                  Completed by {item.completedByName} {item.completedDate ? `on ${formatDate(item.completedDate)}` : ''}
                                </p>
                              )}

                              {/* Developer Comment */}
                              {item.comment && !isEditingComment && (
                                <div className="p-2 rounded-lg bg-card/60 border border-card-border/80 text-[11px] text-foreground/90 flex items-start gap-1.5 mt-1">
                                  <MessageSquare className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <span className="font-bold text-muted-foreground text-[10px] block uppercase">Comment:</span>
                                    <span className="break-words">{item.comment}</span>
                                  </div>
                                  {isEditable && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCommentIndex(idx);
                                        setEditingCommentText(item.comment || '');
                                      }}
                                      className="text-muted-foreground hover:text-foreground text-[10px] underline ml-1 shrink-0"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Inline Comment Editing / Adding */}
                              {isEditingComment && (
                                <div className="flex items-center gap-2 mt-1.5">
                                  <input
                                    type="text"
                                    value={editingCommentText}
                                    onChange={(e) => setEditingCommentText(e.target.value)}
                                    placeholder="Enter comment..."
                                    autoFocus
                                    className="flex-1 px-2.5 py-1 rounded bg-accent/40 border border-card-border text-foreground text-xs"
                                  />
                                  <button
                                    type="button"
                                    disabled={pointActionLoading}
                                    onClick={() => handleSaveComment(item.id, editingCommentText)}
                                    className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-bold"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCommentIndex(null)}
                                    className="px-2 py-1 rounded text-muted-foreground text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Point Action Buttons */}
                          {isEditable && (
                            <div className="flex items-center gap-1 shrink-0 self-start ml-2">
                              {/* Option to add comment if none exists */}
                              {!item.comment && !isEditingComment && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCommentIndex(idx);
                                    setEditingCommentText('');
                                  }}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                                  title="Add comment"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1.5 bg-destructive/10 p-1 rounded-lg border border-destructive/20 animate-in fade-in">
                                  <span className="text-[10px] font-bold text-destructive px-1">Delete?</span>
                                  <button
                                    type="button"
                                    disabled={pointActionLoading}
                                    onClick={() => handleConfirmDeletePoint(idx)}
                                    className="px-2 py-0.5 rounded bg-destructive text-destructive-foreground text-[10px] font-bold cursor-pointer"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeletePointIndex(null)}
                                    className="px-1.5 py-0.5 rounded bg-accent/60 text-muted-foreground text-[10px] cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingPointIndex(idx);
                                      setEditingPointText(item.text);
                                      setConfirmDeletePointIndex(null);
                                    }}
                                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                                    title="Edit this point"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeletePointIndex(idx)}
                                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                    title="Delete this point"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Inline Add New Point Form */}
                {isAddingPoint && (
                  <div className="p-3 rounded-xl bg-accent/30 border border-primary/30 flex items-center gap-2 animate-in fade-in">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                      {points.length + 1}
                    </span>
                    <input
                      type="text"
                      value={newPointText}
                      onChange={(e) => setNewPointText(e.target.value)}
                      placeholder="Enter new change / verification point..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveNewPoint();
                        if (e.key === 'Escape') setIsAddingPoint(false);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-card border border-card-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      type="button"
                      disabled={pointActionLoading || !newPointText.trim()}
                      onClick={handleSaveNewPoint}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {pointActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingPoint(false)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Past Rejection History Audit */}
            {checklist.rejectionHistory && checklist.rejectionHistory.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-card-border/60">
                <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  QA Rejection History ({checklist.rejectionHistory.length} record{checklist.rejectionHistory.length > 1 ? 's' : ''})
                </h3>
                <div className="space-y-1.5">
                  {checklist.rejectionHistory.slice().reverse().map((rec, rIdx) => (
                    <div key={rIdx} className="p-2.5 rounded-xl bg-accent/15 border border-card-border/40 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-semibold text-rose-400">{rec.releaseName}</span>
                        <span>{formatDate(rec.rejectedDate)} by {rec.rejectedByName}</span>
                      </div>
                      <p className="text-foreground/90 text-xs italic bg-card/40 p-2 rounded-lg border border-card-border/40">
                        "{rec.reason}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-card-border bg-card/60">
            <span className="text-[11px] text-muted-foreground">
              Last updated {formatDate(checklist.updatedDate)}
            </span>
            <div className="flex items-center gap-2">
              {isEditable && onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(checklist);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-md shadow-primary/20"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{checklist.status === 'Rejected by QA' ? 'Correct & Resubmit' : 'Edit Change'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Confirmation Modal for Deleting Entire Change Entry */}
      {isDeleteModalOpen && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none"
          onClick={() => !isDeletingChange && setIsDeleteModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-card border border-card-border rounded-2xl shadow-2xl p-6 text-left space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-destructive/15 border border-destructive/25 flex items-center justify-center text-destructive shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-foreground">
                  Delete this project change?
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  This action will remove this change entry if it has not been included in a production release.
                </p>
                <div className="mt-2.5 p-2 rounded-lg bg-accent/40 border border-card-border/60 text-xs font-bold text-foreground truncate">
                  {checklist.title}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-card-border/60">
              <button
                type="button"
                disabled={isDeletingChange}
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingChange}
                onClick={handleDeleteChange}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-destructive/20"
              >
                {isDeletingChange ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Change</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
