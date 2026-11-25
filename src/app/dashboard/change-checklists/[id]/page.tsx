'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Folder,
  User,
  Calendar,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  Layers,
  Trash2,
  Plus,
  Check,
  Loader2,
  Info,
  ExternalLink,
  MessageSquare,
  Square,
  CheckSquare,
  X,
  RefreshCw,
  Lock
} from 'lucide-react';
import { 
  ProjectChangeChecklist, 
  ChangeChecklistItem, 
  getChecklistItems, 
  getChecklistPoints 
} from '@/types';
import { dbService } from '@/services/dbService';
import { useAuth } from '@/hooks/useAuth';
import { TASK_STATUS_CONFIG } from '@/constants';
import { formatDate } from '@/utils';
import CreateChangeDialog from '@/components/changes/CreateChangeDialog';
import DeleteChangeChecklistModal from '@/components/changes/DeleteChangeChecklistModal';
import toast from 'react-hot-toast';

export default function ChecklistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  const [checklist, setChecklist] = useState<ProjectChangeChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Point action states
  const [pointActionLoading, setPointActionLoading] = useState(false);
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [newPointText, setNewPointText] = useState('');
  const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null);
  const [editingPointText, setEditingPointText] = useState('');
  const [editingCommentIndex, setEditingCommentIndex] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  // Fetch checklist with live subscription
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Invalid checklist identifier.');
      return;
    }

    setLoading(true);
    setError(null);

    let isMounted = true;

    const unsubscribe = dbService.subscribeProjectChangeChecklist(id, (item) => {
      if (!isMounted) return;
      if (item) {
        setChecklist(item);
        setError(null);
      } else {
        // Fallback single query check
        dbService.getProjectChangeChecklist(id)
          .then((fallbackItem) => {
            if (!isMounted) return;
            if (fallbackItem) {
              setChecklist(fallbackItem);
              setError(null);
            } else {
              setChecklist(null);
              setError('Project Change Checklist not found.');
            }
          })
          .catch((err) => {
            if (!isMounted) return;
            console.error('Failed to load checklist:', err);
            setError(err?.message || 'Failed to retrieve checklist.');
          })
          .finally(() => {
            if (isMounted) setLoading(false);
          });
        return;
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [id]);

  const items = useMemo(() => {
    if (!checklist) return [];
    return getChecklistItems(checklist);
  }, [checklist]);

  const points = useMemo(() => {
    if (!checklist) return [];
    return getChecklistPoints(checklist);
  }, [checklist]);

  // Authorization & Release status
  const isReleaseLinked = useMemo(() => {
    if (!checklist) return false;
    return (
      checklist.status === 'Included in Release' ||
      checklist.status === 'Completed' ||
      Boolean(checklist.currentReleaseId)
    );
  }, [checklist]);

  const isCreator = user?.email && checklist?.createdBy && checklist.createdBy.toLowerCase() === user.email.toLowerCase();
  const isPrivileged = user?.role === 'SuperAdmin' || user?.role === 'Admin';
  const isAuthorized = isCreator || isPrivileged;
  const isEditable = isAuthorized && (checklist?.status === 'Available for Release' || checklist?.status === 'Rejected by QA');

  // Handle direct item completion toggle
  const handleToggleItemComplete = async (itemId: string) => {
    if (!checklist?.id || !user || !isEditable) return;
    setPointActionLoading(true);
    try {
      const userEmail = user.email.toLowerCase();
      const userName = user.displayName || user.email.split('@')[0];
      const updatedItems = await dbService.toggleChecklistItemStatus(checklist.id, itemId, userEmail, userName);
      setChecklist(prev => prev ? { ...prev, items: updatedItems, points: updatedItems.map(it => it.text) } : null);
      toast.success('Checklist item status updated');
    } catch (err: any) {
      console.error('Failed to toggle item completion:', err);
      toast.error('Failed to update item completion');
    } finally {
      setPointActionLoading(false);
    }
  };

  // Handle saving item comment
  const handleSaveComment = async (itemId: string, comment: string) => {
    if (!checklist?.id || !isEditable) return;
    setPointActionLoading(true);
    try {
      const updatedItems = await dbService.updateChecklistItemComment(checklist.id, itemId, comment);
      setChecklist(prev => prev ? { ...prev, items: updatedItems, points: updatedItems.map(it => it.text) } : null);
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

  // Handle adding point
  const handleSaveNewPoint = async () => {
    const clean = newPointText.trim();
    if (!clean || !checklist?.id) return;
    setPointActionLoading(true);
    try {
      const updatedPoints = await dbService.addChangePoint(checklist.id, clean);
      setChecklist(prev => prev ? { ...prev, points: updatedPoints, changes: updatedPoints } : null);
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

  // Handle editing point text
  const handleSavePointEdit = async (index: number) => {
    const clean = editingPointText.trim();
    if (!clean || !checklist?.id) return;
    setPointActionLoading(true);
    try {
      const updatedPoints = await dbService.updateChangePoint(checklist.id, index, clean);
      setChecklist(prev => prev ? { ...prev, points: updatedPoints, changes: updatedPoints } : null);
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

  // Handle deleting individual point
  const handleDeletePoint = async (index: number) => {
    if (!checklist?.id) return;
    if (points.length <= 1) {
      toast.error('A change entry must have at least one point.');
      return;
    }
    setPointActionLoading(true);
    try {
      const updatedPoints = await dbService.deleteChangePoint(checklist.id, index);
      setChecklist(prev => prev ? { ...prev, points: updatedPoints, changes: updatedPoints } : null);
      toast.success('Point removed');
    } catch (err: any) {
      console.error('Failed to delete point:', err);
      toast.error(err?.message || 'Failed to delete point');
    } finally {
      setPointActionLoading(false);
    }
  };

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

  const getStatusBadge = (status: ProjectChangeChecklist['status']) => {
    switch (status) {
      case 'Available for Release':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">
            <Clock className="h-3.5 w-3.5" />
            Available for Release
          </span>
        );
      case 'Included in Release':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/25">
            <Layers className="h-3.5 w-3.5" />
            Included in Release
          </span>
        );
      case 'Rejected by QA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25">
            <AlertCircle className="h-3.5 w-3.5" />
            Rejected by QA
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/change-checklists"
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Change Checklists</span>
          </Link>
        </div>

        <div className="p-8 rounded-2xl glass-panel bg-card/60 border border-card-border flex flex-col items-center justify-center min-h-[350px] space-y-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-bold text-foreground">Loading Project Change Checklist...</p>
          <p className="text-xs text-muted-foreground">Retrieving document verification data from database</p>
        </div>
      </div>
    );
  }

  // Not Found or Error State
  if (error || !checklist) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/change-checklists"
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Change Checklists</span>
          </Link>
        </div>

        <div className="p-8 sm:p-12 rounded-2xl glass-panel bg-card/60 border border-card-border text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-destructive/15 border border-destructive/25 flex items-center justify-center text-destructive mx-auto">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {error || 'Project Change Checklist Not Found'}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
              The change checklist document you requested does not exist or has been removed. Check the URL or return to the checklists overview.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard/change-checklists"
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-md shadow-primary/20"
            >
              Back to Checklists
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent/40 hover:bg-accent/70 text-foreground text-xs font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard/change-checklists"
          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Change Checklists</span>
        </Link>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isEditable && (
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-xs font-bold transition-all cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{checklist.status === 'Rejected by QA' ? 'Correct & Resubmit' : 'Edit Change'}</span>
            </button>
          )}

          {isAuthorized && (
            <button
              type="button"
              onClick={() => setIsDeleteOpen(true)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isReleaseLinked
                  ? 'bg-accent/30 text-muted-foreground border-card-border/60 hover:bg-accent/50'
                  : 'bg-destructive/10 text-destructive border-destructive/25 hover:bg-destructive/20'
              }`}
              title={isReleaseLinked ? "Checklist is linked to a release" : "Delete Checklist"}
            >
              {isReleaseLinked ? <Lock className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Checklist Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-card-border bg-card/60 shadow-lg space-y-6">
        {/* Header Strip */}
        <div className="space-y-3 border-b border-card-border/60 pb-6">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20">
              <Folder className="h-3.5 w-3.5" />
              {checklist.projectName}
            </span>
            {getStatusBadge(checklist.status)}
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-snug">
            {checklist.title}
          </h1>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-accent/20 border border-card-border/60 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="truncate">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Developer</p>
              <p className="font-semibold text-foreground truncate">{checklist.createdByName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Created</p>
              <p className="font-semibold text-foreground">{formatDate(checklist.createdDate)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Last Updated</p>
              <p className="font-semibold text-foreground">{formatDate(checklist.updatedDate)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div className="truncate">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Release Inclusion</p>
              <p className="font-semibold text-purple-400 truncate">
                {checklist.currentReleaseName || (isReleaseLinked ? 'Included in Release' : 'Not Included')}
              </p>
            </div>
          </div>
        </div>

        {/* Release Notice Banner */}
        {checklist.status === 'Included in Release' && (
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-start gap-3 text-xs text-purple-300">
            <Info className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-foreground">Included in Production Release:</span>
              <p className="leading-relaxed">
                This change is currently scheduled and being verified under <strong className="text-purple-300">{checklist.currentReleaseName || 'an active release'}</strong>. The checklist structure is locked for QA review.
              </p>
            </div>
          </div>
        )}

        {/* QA Rejection Warning Banner */}
        {checklist.status === 'Rejected by QA' && checklist.rejectionHistory && checklist.rejectionHistory.length > 0 && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-rose-500 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Rejected by QA in {checklist.rejectionHistory[checklist.rejectionHistory.length - 1].releaseName}</span>
            </div>
            <p className="text-xs text-foreground font-medium pl-6 leading-relaxed bg-card/60 p-3 rounded-xl border border-rose-500/20">
              "{checklist.rejectionHistory[checklist.rejectionHistory.length - 1].reason}"
            </p>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pl-6 pt-1">
              <span>Rejected by: <strong className="text-foreground">{checklist.rejectionHistory[checklist.rejectionHistory.length - 1].rejectedByName}</strong></span>
              <span>{formatDate(checklist.rejectionHistory[checklist.rejectionHistory.length - 1].rejectedDate)}</span>
            </div>
          </div>
        )}

        {/* Description Section */}
        {checklist.description && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Change Description
            </h2>
            <div className="p-4 rounded-xl bg-card/40 border border-card-border/60 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {checklist.description}
            </div>
          </div>
        )}

        {/* Unified Changes / Verification Points */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Changes / Verification Points ({points.length})</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exact verification checklist points to be tested during production release QA
              </p>
            </div>

            {!isAddingPoint && isEditable && (
              <button
                type="button"
                onClick={() => {
                  setIsAddingPoint(true);
                  setNewPointText('');
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors cursor-pointer border border-primary/20"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Point</span>
              </button>
            )}
          </div>

          {/* Points List */}
          <div className="space-y-3">
            {items.map((item, idx) => {
              const isEditingThis = editingPointIndex === idx;
              const isEditingComment = editingCommentIndex === idx;
              const isCompleted = item.status === 'Completed';

              return (
                <div
                  key={item.id || idx}
                  className={`p-4 rounded-xl border text-xs flex flex-col gap-2.5 transition-all ${
                    isCompleted
                      ? 'bg-emerald-500/[0.04] border-emerald-500/25'
                      : 'bg-accent/20 border-card-border/60'
                  }`}
                >
                  {isEditingThis ? (
                    /* Inline Edit Mode */
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
                    /* Standard Row */
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded-full bg-primary/15 text-primary font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>

                        {/* Completion Checkbox */}
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
                            <CheckSquare className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Task Badges if Linked */}
                          {item.type === 'task' && item.taskId && (
                            <div className="flex items-center gap-1.5 flex-wrap pb-0.5">
                              <Link
                                href={`/dashboard/tasks/${item.taskDocId || item.taskId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
                              >
                                <span>{item.taskId}</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                              {item.taskModule && (
                                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-card/60 border border-card-border">
                                  {item.taskModule}
                                </span>
                              )}
                              {getTaskStatusBadge(item.taskStatus)}
                              {item.taskTitle && (
                                <span className="text-[11px] text-muted-foreground truncate">
                                  &bull; {item.taskTitle}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Point Text */}
                          <p className={`text-xs leading-relaxed ${isCompleted ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
                            {item.text}
                          </p>

                          {/* Completed metadata */}
                          {isCompleted && item.completedByName && (
                            <p className="text-[10px] text-emerald-500 font-medium">
                              Marked completed by {item.completedByName} {item.completedDate ? `on ${formatDate(item.completedDate)}` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Row Actions */}
                      {isEditable && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentIndex(isEditingComment ? null : idx);
                              setEditingCommentText(item.comment || '');
                            }}
                            className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                            title="Add/Edit Comment"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPointIndex(idx);
                              setEditingPointText(item.text);
                            }}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                            title="Edit Point"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePoint(idx)}
                            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title="Delete Point"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comment Bubble & Editor */}
                  {isEditingComment ? (
                    <div className="mt-1 pt-2 border-t border-card-border/60 space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">
                        Developer Note / Verification Instructions
                      </label>
                      <textarea
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        placeholder="Add specific notes, credentials or URLs for QA..."
                        rows={2}
                        className="w-full px-3 py-1.5 rounded-lg bg-card/60 border border-card-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-normal"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingCommentIndex(null)}
                          className="px-2.5 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={pointActionLoading}
                          onClick={() => handleSaveComment(item.id, editingCommentText)}
                          className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  ) : item.comment ? (
                    <div className="mt-1 pl-8 text-[11px] text-muted-foreground flex items-start gap-1.5 bg-card/40 p-2.5 rounded-lg border border-card-border/40">
                      <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span className="leading-relaxed"><strong className="text-foreground">Dev Note:</strong> {item.comment}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Add Point Form */}
          {isAddingPoint && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/[0.03] space-y-2 mt-3">
              <label className="text-xs font-bold text-foreground">
                Add New Change / Verification Point
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newPointText}
                  onChange={(e) => setNewPointText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNewPoint();
                    if (e.key === 'Escape') setIsAddingPoint(false);
                  }}
                  placeholder="e.g. Added Trace ID to all Web APIs..."
                  autoFocus
                  className="flex-1 px-3.5 py-2 rounded-lg bg-card border border-card-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                />
                <button
                  type="button"
                  disabled={pointActionLoading || !newPointText.trim()}
                  onClick={handleSaveNewPoint}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingPoint(false)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <CreateChangeDialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        initialData={checklist}
      />

      {/* Delete Confirmation Modal */}
      <DeleteChangeChecklistModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        checklist={checklist}
        onSuccess={() => {
          router.push('/dashboard/change-checklists');
        }}
      />
    </div>
  );
}
