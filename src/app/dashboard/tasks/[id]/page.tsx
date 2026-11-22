'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  UserPlus,
  CheckSquare,
  Square,
  AlertCircle,
  FileText,
  Paperclip,
  Activity,
  Edit3,
  Trash2,
  Copy,
  Check,
  Plus,
  Download,
  FileArchive,
  Image as ImageIcon,
  ExternalLink,
  Layers,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  History,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { Task, ActivityLog, Subtask, TaskStatus } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { dbService } from '@/services/dbService';
import IssueTypeBadge from '@/components/tasks/IssueTypeBadge';
import PriorityBadge from '@/components/tasks/PriorityBadge';
import StatusBadge from '@/components/tasks/StatusBadge';
import StatusUpdateModal from '@/components/tasks/StatusUpdateModal';
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog';
import TaskCommentsSection from '@/components/tasks/TaskCommentsSection';
import AddCoAssigneePopover from '@/components/ui/AddCoAssigneePopover';
import { ACTIVE_TASK_STATUS_LIST, TASK_STATUS_CONFIG } from '@/constants';
import {
  formatDate,
  formatTimeAgo,
  getTaskAssignees,
  isUserAssignedToTask,
  getTaskEstimatedDays,
  formatEstimatedDays
} from '@/utils';
import { canAddCoAssignee, getAllowedStatusTransitions, canTransitionToStatus, isTaskQaOwner } from '@/utils/permissions';
import toast from 'react-hot-toast';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const rawId = (params?.id as string) || '';

  const [task, setTask] = useState<Task | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Tab & pagination state for activity & audit
  const [historyViewTab, setHistoryViewTab] = useState<'timeline' | 'audit'>('timeline');
  const [activityPageSize, setActivityPageSize] = useState<number>(10);

  // Subtask creation state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);

  // Dialog states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddChildOpen, setIsAddChildOpen] = useState(false);
  const [isAddCoAssigneeOpen, setIsAddCoAssigneeOpen] = useState(false);
  const [copiedTaskId, setCopiedTaskId] = useState(false);

  // Status Change Modal State (for UAT rejection remarks)
  const [statusModalTarget, setStatusModalTarget] = useState<TaskStatus | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Watcher State (Batch 4)
  const [isTogglingWatch, setIsTogglingWatch] = useState(false);

  const isWatching = useMemo(() => {
    if (!user?.email || !task) return false;
    const email = user.email.toLowerCase();
    return Boolean(
      task.watcherIds?.includes(email) ||
      task.watchers?.some(w => (w.email || w.id || '').toLowerCase() === email)
    );
  }, [user?.email, task]);

  const handleToggleWatch = async () => {
    if (!task?.id || !user?.email) return;
    setIsTogglingWatch(true);
    try {
      if (isWatching) {
        await dbService.unwatchTask(task.id, user.email, user.displayName);
        toast.success(`You stopped watching ${task.taskId}`);
      } else {
        await dbService.watchTask(task.id, {
          email: user.email,
          name: user.displayName,
          avatarColor: user.avatarColor,
          uid: user.uid
        });
        toast.success(`You are now watching ${task.taskId}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update watch status');
    } finally {
      setIsTogglingWatch(false);
    }
  };

  const isEmployee = user?.role === 'Member';
  const isManager = user?.role === 'Admin' || user?.role === 'SuperAdmin';
  const userCanAddCoAssignee = canAddCoAssignee(task, user);

  const allowedStatuses = useMemo(() => {
    return getAllowedStatusTransitions(task, user);
  }, [task, user]);

  const canChangeStatus = isManager || allowedStatuses.length > 0;

  // Initial load
  useEffect(() => {
    let isMounted = true;

    async function loadInitialTask() {
      if (!rawId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const found = await dbService.getTaskById(rawId);
        if (isMounted) {
          if (found) {
            setTask(found);
            setNotFound(false);
          } else {
            setNotFound(true);
          }
        }
      } catch (err) {
        console.error('Failed to load task:', err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialTask();

    return () => {
      isMounted = false;
    };
  }, [rawId]);

  // Real-time synchronization
  useEffect(() => {
    const unsubscribeTasks = dbService.subscribeTasks((fetchedTasks) => {
      setAllTasks(fetchedTasks);
      if (rawId) {
        const updated = fetchedTasks.find(
          t => t.id === rawId || t.taskId?.toUpperCase() === rawId.toUpperCase()
        );
        if (updated) {
          setTask(updated);
          setNotFound(false);
        }
      }
    });

    const unsubscribeActivities = dbService.subscribeActivities(setActivities);

    return () => {
      unsubscribeTasks();
      unsubscribeActivities();
    };
  }, [rawId]);

  // Parent task resolution
  const parentTask = useMemo(() => {
    if (!task?.parentTaskId) return null;
    return allTasks.find(
      t => t.id === task.parentTaskId || t.taskId?.toUpperCase() === task.parentTaskId?.toUpperCase()
    ) || null;
  }, [task?.parentTaskId, allTasks]);

  // Child tasks resolution
  const childTasks = useMemo(() => {
    if (!task) return [];
    const taskIdKey = task.id || '';
    const seqKey = task.taskId || '';
    return allTasks.filter(
      t => t.parentTaskId && (t.parentTaskId === taskIdKey || t.parentTaskId === seqKey)
    );
  }, [allTasks, task]);

  const completedChildTasks = childTasks.filter(t =>
    ['completed', 'moved-to-live', 'prod-deployed', 'deployed'].includes(t.status)
  ).length;
  const childProgress = childTasks.length > 0 ? Math.round((completedChildTasks / childTasks.length) * 100) : 0;

  // Subtask calculations
  const subtasks = task?.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.status === 'completed').length;
  const subtasksPercent = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  // Filter activities for this task
  const taskActivities = useMemo(() => {
    if (!task) return [];
    return activities
      .filter(act => act.taskId === task.id || act.taskId === task.taskId || act.taskSeqId === task.taskId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities, task]);

  // Copy Task ID
  const handleCopyId = () => {
    if (!task?.taskId) return;
    navigator.clipboard.writeText(task.taskId);
    setCopiedTaskId(true);
    toast.success(`Copied ${task.taskId}`);
    setTimeout(() => setCopiedTaskId(false), 2000);
  };

  // Status transitions
  const handleSelectStatus = async (newStatus: TaskStatus) => {
    if (!task || newStatus === task.status) return;

    const check = canTransitionToStatus(task, newStatus, user);
    if (!check.allowed) {
      toast.error(check.reason || 'You do not have permission to transition to this status.');
      return;
    }

    if (newStatus === 'uat-rejected') {
      setStatusModalTarget(newStatus);
      setIsStatusModalOpen(true);
      return;
    }

    try {
      await dbService.updateTask(task.id!, { status: newStatus }, user?.email || '', user?.displayName || '', undefined, user?.role);
      toast.success(`Status updated to ${TASK_STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    }
  };

  const handleConfirmStatusChange = async (targetStatus: TaskStatus, comment: string) => {
    if (!task?.id) return;

    const check = canTransitionToStatus(task, targetStatus, user);
    if (!check.allowed) {
      toast.error(check.reason || 'You do not have permission to transition to this status.');
      return;
    }

    try {
      await dbService.updateTask(task.id, { status: targetStatus }, user?.email || '', user?.displayName || '', comment, user?.role);
      toast.success(`Status updated to ${TASK_STATUS_CONFIG[targetStatus]?.label || targetStatus}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    }
  };

  // Subtask toggle
  const handleToggleSubtask = async (sub: Subtask) => {
    if (!task?.id) return;
    const nextStatus = sub.status === 'completed' ? 'pending' : 'completed';
    try {
      await dbService.toggleSubtask(task.id, sub.id, nextStatus, user?.email || '', user?.displayName || 'Member');
    } catch (err) {
      toast.error('Failed to toggle subtask');
    }
  };

  // Add subtask
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !task?.id) return;

    setAddingSubtask(true);
    const newSub: Subtask = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      status: 'pending'
    };

    try {
      const updatedSubtasks = [...subtasks, newSub];
      await dbService.updateTask(task.id, { subtasks: updatedSubtasks }, user?.email || '', user?.displayName || 'Member');
      setNewSubtaskTitle('');
      toast.success('Subtask added');
    } catch (err) {
      toast.error('Failed to add subtask');
    } finally {
      setAddingSubtask(false);
    }
  };

  // Delete task
  const handleDeleteTask = async () => {
    if (!task?.id) return;
    if (confirm(`Are you sure you want to delete ${task.taskId}?`)) {
      try {
        await dbService.deleteTask(task.id, user?.email || 'nm@i2space.com');
        toast.success('Task deleted');
        router.push('/dashboard/all-tasks');
      } catch (err) {
        toast.error('Failed to delete task');
      }
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-card rounded-md" />
        <div className="h-10 w-96 bg-card rounded-md" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-32 bg-card rounded-xl border border-card-border" />
            <div className="h-64 bg-card rounded-xl border border-card-border" />
          </div>
          <div className="space-y-4">
            <div className="h-80 bg-card rounded-xl border border-card-border" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !task) {
    return (
      <div className="p-12 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Task Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The requested task could not be found or may have been deleted.
        </p>
        <Link
          href="/dashboard/all-tasks"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to All Tasks
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/dashboard/all-tasks" className="hover:text-foreground transition-colors">
            Tasks
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-mono font-semibold text-foreground">{task.taskId}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Watch / Unwatch Button (Batch 4) */}
          <button
            type="button"
            onClick={handleToggleWatch}
            disabled={isTogglingWatch}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
              isWatching
                ? 'bg-primary/15 border-primary/40 text-primary hover:bg-primary/25'
                : 'bg-card border-border hover:bg-accent text-muted-foreground hover:text-foreground'
            }`}
            title={isWatching ? 'You are watching this task. Click to stop watching.' : 'Watch this task to receive updates.'}
          >
            {isWatching ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                <span>Watching ({task.watchers?.length || 0})</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                <span>Watch ({task.watchers?.length || 0})</span>
              </>
            )}
          </button>

          {(!isEmployee || isUserAssignedToTask(task, user?.email)) && (
            <button
              onClick={() => setIsEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              <Edit3 className="h-3.5 w-3.5 text-primary" />
              <span>Edit Task</span>
            </button>
          )}

          {user?.role === 'SuperAdmin' && (
            <button
              onClick={handleDeleteTask}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold transition-all cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: 2/3 Content + 1/3 Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Header Card */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="font-mono text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 bg-accent/60 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  title="Click to copy task ID"
                >
                  <span>{task.taskId}</span>
                  {copiedTaskId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
                <IssueTypeBadge issueType={task.issueType} />
                <PriorityBadge priority={task.priority} />
              </div>
              <StatusBadge status={task.status} />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {task.title}
            </h1>

            {/* Parent Task Banner */}
            {task.parentTaskId && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Parent Task
                    </span>
                    <Link
                      href={`/dashboard/tasks/${parentTask?.id || parentTask?.taskId || task.parentTaskId}`}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 mt-0.5"
                    >
                      {parentTask ? (
                        <>
                          <span className="font-mono">[{parentTask.taskId}]</span>
                          <span>{parentTask.title}</span>
                          <span className="text-[10px] text-muted-foreground">({parentTask.issueType || 'Task'})</span>
                        </>
                      ) : (
                        <span>{task.parentTaskTitle || task.parentTaskId}</span>
                      )}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* UAT Rejection Reason Banner */}
          {task.status === 'uat-rejected' && (
            <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 space-y-2 shadow-inner">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span className="uppercase tracking-wider text-[10px]">UAT Rejection Reason</span>
              </div>
              <p className="text-xs text-rose-200 leading-relaxed whitespace-pre-wrap pl-6 font-medium">
                {task.latestRejectionReason ||
                  (task.statusHistory && [...task.statusHistory].reverse().find(h => h.status === 'uat-rejected')?.comment) ||
                  task.remarks ||
                  'No rejection reason recorded.'}
              </p>
            </div>
          )}

          {/* Description Section */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span>Description</span>
            </div>
            {task.description ? (
              <div className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap bg-background/50 p-4 rounded-lg border border-border/60 select-text">
                {task.description}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No description provided for this task.</p>
            )}
          </div>

          {/* Child Tasks Section */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Child Tasks ({completedChildTasks}/{childTasks.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddChildOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Child Task</span>
              </button>
            </div>

            {childTasks.length > 0 ? (
              <div className="space-y-3">
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground font-semibold">
                    <span>Hierarchy Progress</span>
                    <span className="text-primary font-bold">{childProgress}%</span>
                  </div>
                  <div className="w-full bg-accent h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300 rounded-full"
                      style={{ width: `${childProgress}%` }}
                    />
                  </div>
                </div>

                {/* List of child tasks */}
                <div className="space-y-2 pt-1">
                  {childTasks.map(child => (
                    <Link
                      key={child.id || child.taskId}
                      href={`/dashboard/tasks/${child.id || child.taskId}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-accent/60 border border-border transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                        <IssueTypeBadge issueType={child.issueType} />
                        <span className="font-mono text-xs text-muted-foreground font-bold shrink-0">
                          {child.taskId}
                        </span>
                        <span className="text-xs text-foreground font-medium truncate group-hover:text-primary transition-colors">
                          {child.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {child.qaOwner && (
                          <span className="hidden sm:inline text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            QA: {child.qaOwner.name}
                          </span>
                        )}
                        <StatusBadge status={child.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-border rounded-lg bg-background/20 space-y-2">
                <p className="text-xs text-muted-foreground">No child tasks linked yet.</p>
                <button
                  type="button"
                  onClick={() => setIsAddChildOpen(true)}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  + Create the first child task
                </button>
              </div>
            )}
          </div>

          {/* Subtask Checklist */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-foreground">
                  Checklist ({completedSubtasks}/{subtasks.length})
                </h3>
              </div>
              {subtasks.length > 0 && (
                <span className="text-xs font-bold text-emerald-400">{subtasksPercent}%</span>
              )}
            </div>

            {subtasks.length > 0 && (
              <div className="w-full bg-accent h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${subtasksPercent}%` }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {subtasks.map((sub) => {
                const isDone = sub.status === 'completed';
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleToggleSubtask(sub)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-background/50 hover:bg-accent/50 border border-border/80 text-left transition-colors cursor-pointer group"
                  >
                    {isDone ? (
                      <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                    )}
                    <span
                      className={`text-xs flex-1 transition-all ${
                        isDone ? 'line-through text-muted-foreground' : 'text-foreground font-medium'
                      }`}
                    >
                      {sub.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Add Subtask input */}
            <form onSubmit={handleAddSubtask} className="flex gap-2 pt-1">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                placeholder="Add checklist item..."
                disabled={addingSubtask}
                className="flex-1 px-3 py-1.5 border border-border rounded-lg bg-background/50 text-xs outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={addingSubtask || !newSubtaskTitle.trim()}
                className="px-3 py-1.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/90 transition-all disabled:opacity-50 cursor-pointer"
              >
                Add
              </button>
            </form>
          </div>

          {/* Attachments Section */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                <Paperclip className="h-4 w-4 text-primary" />
                <span>Attachments ({task.attachments.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {task.attachments.map((att, attIdx) => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name);
                  const FileIcon = isImage ? ImageIcon : FileArchive;
                  const sizeMB = (att.size / (1024 * 1024)).toFixed(2);
                  return (
                    <div
                      key={att.id || att.name || `att-${attIdx}`}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border hover:border-primary/40 transition-colors gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-muted-foreground shrink-0">
                          <FileIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate" title={att.name}>
                            {att.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {sizeMB} MB • by {att.uploadedByName || att.uploadedBy.split('@')[0]}
                          </p>
                        </div>
                      </div>
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md bg-accent hover:bg-accent/80 text-foreground transition-colors cursor-pointer shrink-0"
                        title="Download / View"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* UAT Rejection History Section (Batch 3) */}
          {task.rejectionHistory && task.rejectionHistory.length > 0 && (
            <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>UAT Rejection History</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                  {task.rejectionHistory.length === 1 ? '1 rejection recorded' : `${task.rejectionHistory.length} rejections recorded`}
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {task.rejectionHistory.slice().reverse().map((rej, idx) => (
                  <div key={rej.id || `rej-${idx}`} className="p-3.5 rounded-lg bg-slate-900/70 border border-rose-900/30 space-y-2">
                    <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-rose-200">
                          {rej.rejectedByName || rej.rejectedBy}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({rej.rejectedBy})
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(rej.rejectedAt)} • {formatTimeAgo(rej.rejectedAt)}
                      </span>
                    </div>
                    {rej.previousStatus && (
                      <div className="text-[10px] text-muted-foreground">
                        Transitioned from: <span className="font-semibold text-slate-300 capitalize">{rej.previousStatus.replace(/-/g, ' ')}</span>
                      </div>
                    )}
                    <div className="text-xs text-rose-100 bg-rose-950/40 border-l-2 border-rose-500 px-3 py-2 rounded-r-md leading-relaxed whitespace-pre-wrap">
                      {rej.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments & Discussion Section */}
          <TaskCommentsSection task={task} />

          {/* Activity Timeline & Field Audit History (Batch 3) */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-foreground font-bold text-sm">
                  History & Audit ({taskActivities.length})
                </span>
              </div>
              <div className="flex items-center bg-background/80 p-0.5 rounded-lg border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setHistoryViewTab('timeline')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    historyViewTab === 'timeline'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Activity Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryViewTab('audit')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    historyViewTab === 'audit'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Field Audit Log
                </button>
              </div>
            </div>

            {taskActivities.length > 0 ? (
              <div className="space-y-3">
                {historyViewTab === 'timeline' ? (
                  // Activity Timeline View
                  <div className="space-y-3">
                    {taskActivities.slice(0, activityPageSize).map((act) => {
                      const displayName = act.userName || act.performedBy || (act.user ? act.user.split('@')[0] : 'Team Member');
                      const hasValues = (act.oldValue && act.oldValue !== 'None') || (act.newValue && act.newValue !== '');
                      return (
                        <div
                          key={act.id || act.activityId}
                          className="flex items-start gap-3 p-3 rounded-lg bg-background/40 border border-border/60 hover:border-border transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-foreground">
                                {displayName}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatTimeAgo(act.timestamp)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-foreground">
                                {act.action}
                              </span>
                              {act.fieldName && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-accent/60 text-muted-foreground font-mono">
                                  {act.fieldName}
                                </span>
                              )}
                            </div>
                            {hasValues && (
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap pt-0.5">
                                {act.oldValue && (
                                  <span className="line-through text-muted-foreground/70 bg-background/60 px-1.5 py-0.5 rounded border border-border/40">
                                    {act.oldValue}
                                  </span>
                                )}
                                {act.oldValue && act.newValue && <span>→</span>}
                                {act.newValue && (
                                  <span className="font-medium text-foreground bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                                    {act.newValue}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Field-Level Audit Log View
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-background/80 text-[10px] uppercase font-bold text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2.5 px-3">Timestamp</th>
                          <th className="py-2.5 px-3">Field</th>
                          <th className="py-2.5 px-3">Action</th>
                          <th className="py-2.5 px-3">Previous Value</th>
                          <th className="py-2.5 px-3">New Value</th>
                          <th className="py-2.5 px-3">Changed By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50 font-mono text-[11px]">
                        {taskActivities.slice(0, activityPageSize).map((act) => {
                          const performer = act.userName || act.performedBy || (act.user ? act.user.split('@')[0] : 'Member');
                          return (
                            <tr key={act.id || act.activityId} className="hover:bg-accent/30 transition-colors">
                              <td className="py-2.5 px-3 text-[10px] text-muted-foreground whitespace-nowrap">
                                {formatDate(act.timestamp)} {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-sans font-semibold">
                                  {act.fieldName || 'General'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-foreground font-sans font-medium whitespace-nowrap">
                                {act.action}
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground max-w-[150px] truncate" title={act.oldValue || '—'}>
                                {act.oldValue || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-emerald-400 font-semibold max-w-[150px] truncate" title={act.newValue || '—'}>
                                {act.newValue || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap font-sans">
                                {performer}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination / Load More Button */}
                {taskActivities.length > activityPageSize && (
                  <button
                    type="button"
                    onClick={() => setActivityPageSize(prev => prev + 10)}
                    className="w-full py-2 bg-accent/50 hover:bg-accent text-foreground text-xs font-semibold rounded-lg border border-border transition-colors cursor-pointer text-center"
                  >
                    Load More ({taskActivities.length - activityPageSize} remaining)
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No activity recorded yet.</p>
            )}
          </div>
        </div>

        {/* Right Column / Sidebar (1/3) */}
        <div className="space-y-6">

          {/* Status Change Control (Role-Based Restrictions) */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Status Transition
              </label>
              {user?.role && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Role: <span className="font-semibold text-foreground">{user.role}</span>
                </span>
              )}
            </div>

            {canChangeStatus ? (
              <div className="space-y-1.5">
                <select
                  value={task.status}
                  onChange={(e) => handleSelectStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-semibold text-foreground outline-none cursor-pointer focus:border-primary"
                >
                  {ACTIVE_TASK_STATUS_LIST.map((st) => {
                    const isCurrent = st === task.status;
                    const isAllowed = isManager || allowedStatuses.includes(st) || isCurrent;
                    let suffix = '';
                    if (!isAllowed) {
                      if (['uat-deployed', 'prod-deployed', 'completed'].includes(st)) suffix = ' (Admin Only)';
                      else if (['uat-testing', 'uat-rejected', 'ready-for-production-deploy'].includes(st)) suffix = ' (QA Only)';
                      else suffix = ' (Dev Only)';
                    }
                    return (
                      <option key={st} value={st} disabled={!isAllowed}>
                        {TASK_STATUS_CONFIG[st]?.label || st}{suffix}
                      </option>
                    );
                  })}
                </select>
                {!isManager && (
                  <p className="text-[10px] text-muted-foreground">
                    {isTaskQaOwner(task, user?.email)
                      ? 'You are assigned as QA Owner for this task.'
                      : isUserAssignedToTask(task, user?.email)
                      ? 'Allowed transitions: Assigned, In Progress, Supplier Pending, Code Review.'
                      : 'Status changes are restricted.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-background/50 border border-border">
                  <StatusBadge status={task.status} />
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Status updates restricted to assigned developers, QA owner, or admin.
                </p>
              </div>
            )}
          </div>

          {/* Details Card */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Classification
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Project</span>
                <span className="font-semibold text-foreground">{task.projectName}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Module</span>
                <span className="font-semibold text-foreground">{task.module}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Issue Type</span>
                <IssueTypeBadge issueType={task.issueType} />
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Priority</span>
                <PriorityBadge priority={task.priority} />
              </div>
            </div>
          </div>

          {/* People Card */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              People
            </h3>

            <div className="space-y-3.5 text-xs">
              {/* Assignees */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Assigned To</span>
                  {userCanAddCoAssignee && (
                    <button
                      type="button"
                      onClick={() => setIsAddCoAssigneeOpen(true)}
                      className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="h-3 w-3" />
                      <span>Add</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {getTaskAssignees(task).map((assignee, aIdx) => (
                    <div
                      key={assignee.id || `assignee-${aIdx}`}
                      className="inline-flex items-center gap-2 bg-background border border-border px-2.5 py-1 rounded-lg"
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[9px] shrink-0"
                        style={{ backgroundColor: assignee.color || '#6366f1' }}
                      >
                        {assignee.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-foreground">{assignee.name}</span>
                    </div>
                  ))}
                  {getTaskAssignees(task).length === 0 && (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  )}
                </div>
              </div>

              {/* Dedicated QA Owner */}
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1.5">QA Owner</span>
                {task.qaOwner ? (
                  <div className="inline-flex items-center gap-2 bg-background border border-border px-2.5 py-1.5 rounded-lg">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[9px] shrink-0"
                      style={{ backgroundColor: task.qaOwner.color || '#10b981' }}
                    >
                      {task.qaOwner.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-foreground">{task.qaOwner.name}</span>
                    <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      QA
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">None assigned</span>
                )}
              </div>

              {/* Reporter */}
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Reporter</span>
                <span className="text-xs font-medium text-foreground">
                  {task.createdByName || task.createdBy.split('@')[0]}
                </span>
              </div>

              {/* Watchers Section (Batch 4) */}
              <div className="pt-2.5 border-t border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Watchers ({task.watchers?.length || 0})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleWatch}
                    disabled={isTogglingWatch}
                    className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                  >
                    {isWatching ? 'Stop Watching' : '+ Watch Task'}
                  </button>
                </div>

                {task.watchers && task.watchers.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {task.watchers.map((w, idx) => (
                      <div
                        key={w.id || w.email || `watcher-${idx}`}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-background/50 border border-border/60 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[9px] shrink-0"
                            style={{ backgroundColor: w.avatarColor || '#3b82f6' }}
                          >
                            {(w.name || w.email).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate" title={w.name || w.email}>
                              {w.name || w.email.split('@')[0]}
                              {user?.email && w.email.toLowerCase() === user.email.toLowerCase() && (
                                <span className="text-[9px] text-primary ml-1 font-bold">(You)</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                          {formatTimeAgo(w.watchedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No watchers yet. Click Watch to receive updates.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Dates & Estimates Card */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Dates & Estimates
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Start Date
                </span>
                <span className="font-semibold text-foreground">
                  {task.startDate ? formatDate(task.startDate) : 'Not specified'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Due Date
                </span>
                <span className="font-semibold text-foreground">
                  {task.expectedCompletionDate ? formatDate(task.expectedCompletionDate) : 'Not specified'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Estimated Effort
                </span>
                <span className="font-mono font-bold text-primary">
                  {formatEstimatedDays(getTaskEstimatedDays(task))}
                </span>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Created</span>
                <span>{formatDate(task.createdDate)}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Updated</span>
                <span>{formatDate(task.updatedDate)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Task Modal */}
      <CreateTaskDialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        taskToEdit={task}
        onSuccess={(updatedTask) => {
          setTask(updatedTask);
          setIsEditOpen(false);
          toast.success('Task updated');
        }}
      />

      {/* Add Child Task Modal */}
      <CreateTaskDialog
        isOpen={isAddChildOpen}
        onClose={() => setIsAddChildOpen(false)}
        initialParentTaskId={task.id || task.taskId}
        initialProjectName={task.projectName}
        initialIssueType="Task"
        onSuccess={() => {
          setIsAddChildOpen(false);
          toast.success('Child task created successfully');
        }}
      />

      {/* Add Co-Assignee Popover */}
      {task && (
        <AddCoAssigneePopover
          task={task}
          isOpen={isAddCoAssigneeOpen}
          onClose={() => setIsAddCoAssigneeOpen(false)}
          currentUser={user}
          onSuccess={(updated) => {
            setTask(updated);
            setIsAddCoAssigneeOpen(false);
          }}
        />
      )}

      {/* Status Rejection Modal */}
      {statusModalTarget && (
        <StatusUpdateModal
          isOpen={isStatusModalOpen}
          task={task}
          targetStatus={statusModalTarget}
          onClose={() => {
            setIsStatusModalOpen(false);
            setStatusModalTarget(null);
          }}
          onConfirm={handleConfirmStatusChange}
        />
      )}
    </div>
  );
}
