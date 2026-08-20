'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Calendar,
  User,
  UserPlus,
  Clock,
  Edit3,
  Trash2,
  Tag,
  FileText,
  Activity,
  Sparkles,
  ClipboardList,
  Paperclip,
  AlertTriangle,
  Edit2,
  AlertCircle,
  FileArchive,
  Image as ImageIcon,
  Download,
  History,
  Lock,
  CheckSquare,
  Square
} from 'lucide-react';
import { Task, ActivityLog, Member, Subtask, TaskStatus } from '@/types';
import PriorityBadge from './PriorityBadge';
import StatusBadge from './StatusBadge';
import StatusUpdateModal from './StatusUpdateModal';
import { ACTIVE_TASK_STATUS_LIST, TASK_STATUS_CONFIG } from '@/constants';
import { formatDate, formatTimeAgo, getTaskAssignees, isUserAssignedToTask } from '@/utils';
import { canAddCoAssignee } from '@/utils/permissions';
import AddCoAssigneePopover from '@/components/ui/AddCoAssigneePopover';
import { useAuth } from '@/hooks/useAuth';
import { dbService } from '@/services/dbService';
import toast from 'react-hot-toast';

// Activity meta helper - moved outside component
const getActivityMeta = (action: string) => {
  const act = action.toLowerCase();
  if (act.includes('created')) return { icon: Plus, color: 'text-blue-400 bg-blue-500/20 border-blue-500/30' };
  if (act.includes('co-assignee') || act.includes('delegate')) return { icon: UserPlus, color: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30' };
  if (act.includes('assigned')) return { icon: User, color: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30' };
  if (act.includes('uat rejected') || act.includes('rejected')) return { icon: AlertCircle, color: 'text-rose-400 bg-rose-500/20 border-rose-500/30' };
  if (act.includes('priority')) return { icon: AlertTriangle, color: 'text-orange-400 bg-orange-500/20 border-orange-500/30' };
  if (act.includes('deleted')) return { icon: Trash2, color: 'text-red-400 bg-red-500/20 border-red-500/30' };
  if (act.includes('restored')) return { icon: History, color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' };
  if (act.includes('completed')) return { icon: CheckSquare, color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' };
  if (act.includes('live') || act.includes('deployed')) return { icon: Sparkles, color: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30' };
  if (act.includes('testing')) return { icon: Clock, color: 'text-purple-400 bg-purple-500/20 border-purple-500/30' };
  if (act.includes('code review')) return { icon: Lock, color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' };
  return { icon: Activity, color: 'text-gray-400 bg-gray-500/20 border-gray-500/30' };
};

interface TaskDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onEditClick?: (task: Task) => void;
  onDeleteClick?: (task: Task) => void;
}

export default function TaskDetailDrawer({ isOpen, onClose, task: initialTask, onEditClick, onDeleteClick }: TaskDetailDrawerProps) {
  const { user } = useAuth();

  const [task, setTask] = useState<Task | null>(initialTask);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAddCoAssigneeOpen, setIsAddCoAssigneeOpen] = useState(false);

  // Status Change Modal State
  const [statusModalTarget, setStatusModalTarget] = useState<TaskStatus | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Refs
  const activitiesEndRef = useRef<HTMLDivElement>(null);

  const isEmployee = user?.role === 'Member';
  const isManager = user?.role === 'Admin' || user?.role === 'SuperAdmin';
  const userCanAddCoAssignee = canAddCoAssignee(task, user);
  const canChangeStatus = isManager || (isEmployee && isUserAssignedToTask(task, user?.email));

  const handleSelectStatus = async (newStatus: TaskStatus) => {
    if (!task || newStatus === task.status) return;
    
    if (newStatus === 'uat-rejected') {
      setStatusModalTarget(newStatus);
      setIsStatusModalOpen(true);
      return;
    }

    try {
      await dbService.updateTask(task.id!, { status: newStatus }, user?.email || '', user?.displayName || '');
      toast.success(`Status updated to ${TASK_STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    }
  };

  const handleConfirmStatusChange = async (targetStatus: TaskStatus, comment: string) => {
    if (!task?.id) return;
    await dbService.updateTask(task.id, { status: targetStatus }, user?.email || '', user?.displayName || '', comment);
    toast.success(`Status updated to ${TASK_STATUS_CONFIG[targetStatus]?.label || targetStatus}`);
  };

  // Real-time task sync
  useEffect(() => {
    if (!initialTask) {
      setTask(null);
      return;
    }
    setTask(initialTask);

    const unsubscribe = dbService.subscribeTasks((fetchedTasks) => {
      const updated = fetchedTasks.find(t => t.id === initialTask.id);
      if (updated) {
        setTask(updated);
      }
    });

    return () => unsubscribe();
  }, [initialTask]);

  // Load supporting data
  useEffect(() => {
    if (!task) return;

    const unsubscribeTasks = dbService.subscribeTasks(setAllTasks);
    const unsubscribeActivities = dbService.subscribeActivities(setActivities);

    return () => {
      unsubscribeTasks();
      unsubscribeActivities();
    };
  }, [task]);

  // Auto scroll activities
  useEffect(() => {
    if (activitiesEndRef.current) {
      activitiesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activities]);

  // Filter activities for this task
  const taskActivities = useMemo(() => {
    if (!task) return [];
    return activities
      .filter(act => act.taskId === task.id || act.taskId === task.taskId || act.taskSeqId === task.taskId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [activities, task]);

  // Subtask calculations
  const subtasks = task?.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.status === 'completed').length;
  const subtasksPercent = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  // Dependency calculations
  const dependenciesList = task?.dependencies || [];
  const isBlocked = useMemo(() => {
    if (!task || dependenciesList.length === 0) return null;
    for (const depId of dependenciesList) {
      const depTask = allTasks.find(t => t.taskId === depId);
      if (depTask) {
        const active = depTask.status !== 'completed' && depTask.status !== 'moved-to-live' && depTask.status !== 'deployed';
        if (active) return depId;
      }
    }
    return null;
  }, [dependenciesList, allTasks, task]);

  // Handle subtask toggle
  const handleToggleSubtask = async (sub: Subtask) => {
    if (!task) return;
    const nextStatus = sub.status === 'completed' ? 'pending' : 'completed';
    try {
      await dbService.toggleSubtask(task.id!, sub.id, nextStatus, user?.email || '', user?.displayName || 'Member');
    } catch (err) {
      toast.error('Failed to toggle checklist item');
    }
  };

  // Handle add subtask
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !task) return;

    const newSub: Subtask = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle,
      status: 'pending'
    };

    try {
      const updatedSubtasks = [...subtasks, newSub];
      await dbService.updateTask(task.id!, { subtasks: updatedSubtasks }, user?.email || '', user?.displayName || 'Member');
      setNewSubtaskTitle('');
      toast.success('Subtask added');
    } catch (err) {
      toast.error('Failed to add subtask');
    }
  };

  // Handle dependency removal
  const handleRemoveDependency = async (depTaskId: string) => {
    if (!task) return;
    try {
      const updated = dependenciesList.filter(d => d !== depTaskId);
      await dbService.updateTask(task.id!, { dependencies: updated }, user?.email || '', user?.displayName || 'Member');
      toast.success('Prerequisite removed');
    } catch (err) {
      toast.error('Failed to remove dependency');
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && task && (
          <div key="task-detail-drawer-container" className="fixed inset-0 z-40 overflow-hidden select-none">
            {/* Backdrop */}
            <motion.div
              key="task-detail-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black"
            />

            {/* Sliding Panel - SOLID DARK BACKGROUND */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                key="task-detail-panel"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="w-screen max-w-lg bg-slate-950 border-l border-slate-800 p-6 shadow-2xl flex flex-col h-full overflow-hidden"
              >
              {/* Header */}
              <div className="flex justify-between items-start pb-4 border-b border-slate-800 shrink-0">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 font-mono uppercase tracking-wider">{task.taskId}</span>
                  <h2 className="text-xl font-semibold text-white mt-1">{task.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  {onEditClick && (!isEmployee || isUserAssignedToTask(task, user?.email)) && (
                    <button
                      onClick={() => onEditClick(task)}
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-all"
                      title="Edit Task"
                    >
                      <Edit3 className="h-4.5 w-4.5" />
                    </button>
                  )}
                  {onDeleteClick && user?.role === 'SuperAdmin' && (
                    <button
                      onClick={() => onDeleteClick(task)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all"
                      title="Delete Task"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-all"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-2">

                {/* Blocked Alert */}
                {isBlocked && (
                  <div className="bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                    <span>Blocked by: <strong className="text-red-200">{isBlocked}</strong></span>
                  </div>
                )}

                {/* Status & Priority */}
                <div className="grid grid-cols-2 gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Status</span>
                      {canChangeStatus && (
                        <select
                          value={task.status}
                          onChange={(e) => handleSelectStatus(e.target.value as TaskStatus)}
                          className="text-[10px] bg-slate-800/90 text-primary border border-slate-700 rounded-md px-1.5 py-0.5 outline-none cursor-pointer hover:border-primary/50 transition-colors"
                        >
                          {ACTIVE_TASK_STATUS_LIST.map((st) => (
                            <option key={st} value={st}>
                              {TASK_STATUS_CONFIG[st]?.label || st}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-2 tracking-wider">Priority</span>
                    <PriorityBadge priority={task.priority} />
                  </div>
                </div>

                {/* UAT Rejection Reason Banner (if UAT Rejected) */}
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

                {/* Task Details */}
                <div className="space-y-4">
                  {/* Project & Module */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1 tracking-wider">Project</label>
                      <p className="text-sm font-semibold text-white">{task.projectName}</p>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1 tracking-wider">Module</label>
                      <p className="text-sm font-semibold text-white">{task.module}</p>
                    </div>
                  </div>

                  {/* Assigned To Multi-List */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 block mb-2 tracking-wider">Assigned To</label>
                    <div className="flex flex-wrap items-center gap-2">
                      {getTaskAssignees(task).map((assignee, aIdx) => (
                        <div key={assignee.id || `assignee-${aIdx}`} className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg shadow-xs">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[9px] shrink-0"
                            style={{ backgroundColor: assignee.color || '#6366f1' }}
                          >
                            {assignee.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold text-gray-300">{assignee.name}</span>
                        </div>
                      ))}
                      {getTaskAssignees(task).length === 0 && (
                        <span className="text-xs text-gray-500">Unassigned</span>
                      )}

                      {/* + Add Co-Assignee Button */}
                      {userCanAddCoAssignee && (
                        <button
                          type="button"
                          onClick={() => setIsAddCoAssigneeOpen(true)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/70 text-primary text-xs font-semibold transition-all cursor-pointer select-none"
                          title="Add Co-Assignee / Delegate"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>Add Co-Assignee</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Estimated Hours & Due Date */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 block mb-2 tracking-wider">Estimated Hours</label>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{task.estimatedHours}h</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 block mb-2 tracking-wider">Due Date</label>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{formatDate(task.expectedCompletionDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Last Updated */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 block mb-2 tracking-wider">Last Updated</label>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                      <Clock className="h-4 w-4" />
                      <span>{formatDate(task.updatedDate)}</span>
                    </div>
                  </div>

                  {/* Assigned By & Created Date */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 block mb-2 tracking-wider">Assigned By</label>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>{task.createdByName || task.createdBy.split('@')[0]}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 block mb-2 tracking-wider">Created Date</label>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(task.createdDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {task.description && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-2 tracking-wider">
                      <FileText className="h-4 w-4 text-gray-400" />
                      Description
                    </label>
                    <p className="text-xs text-gray-300 leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-800 select-text">
                      {task.description}
                    </p>
                  </div>
                )}

                {/* Attachments Section */}
                {task.attachments && task.attachments.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-2 tracking-wider">
                      <Paperclip className="h-4 w-4 text-primary" />
                      Attachments ({task.attachments.length})
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                      {task.attachments.map((att, attIdx) => {
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name);
                        const FileIcon = isImage ? ImageIcon : FileArchive;
                        const sizeMB = (att.size / (1024 * 1024)).toFixed(2);

                        return (
                          <div
                            key={att.id || att.name || `att-${attIdx}`}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800 hover:border-slate-700 transition-colors gap-3 group"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-gray-400 shrink-0">
                                <FileIcon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-gray-300 truncate" title={att.name}>
                                  {att.name}
                                </p>
                                <p className="text-[9px] text-gray-500">
                                  {sizeMB} MB • by {att.uploadedByName || att.uploadedBy.split('@')[0]}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded bg-slate-800 hover:bg-slate-750 text-gray-400 hover:text-white transition-colors cursor-pointer"
                                title="Open in new tab"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Subtasks */}
                {subtasks.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-2 tracking-wider">
                        <CheckSquare className="h-4 w-4 text-emerald-400" />
                        Subtask Checklist
                      </label>
                      <span className="text-[10px] font-bold text-gray-400">{subtasksPercent}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${subtasksPercent}%` }} />
                    </div>

                    {/* Subtask items */}
                    <div className="space-y-1.5 bg-slate-900 p-3 rounded-lg border border-slate-800">
                      {subtasks.map((sub, sIdx) => {
                        const isDone = sub.status === 'completed';
                        const isAssignedToCurrent = isUserAssignedToTask(task, user?.email);
                        const canToggle = isAssignedToCurrent || isManager;

                        return (
                          <div
                            key={sub.id || `sub-${sIdx}`}
                            onClick={() => { if (canToggle) handleToggleSubtask(sub); }}
                            className={`flex items-center gap-2.5 py-2 px-1 text-xs font-medium rounded select-none transition-colors ${canToggle ? 'cursor-pointer hover:bg-slate-800' : ''
                              } ${isDone ? 'text-gray-500' : 'text-gray-300'}`}
                          >
                            {isDone ? (
                              <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 text-gray-600 shrink-0" />
                            )}
                            <span className={isDone ? 'line-through' : ''}>
                              {sub.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add subtask */}
                    {isManager && (
                      <form onSubmit={handleAddSubtask} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add subtask..."
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        />
                        <button
                          type="submit"
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer shrink-0"
                        >
                          Add
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* Dependencies */}
                {dependenciesList.filter(Boolean).length > 0 && (
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-2 tracking-wider">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      Prerequisites
                    </label>

                    <div className="space-y-2">
                      {dependenciesList.filter(Boolean).map((depId, dIdx) => {
                        const depTask = allTasks.find(t => t.taskId === depId);
                        const isDone = depTask ? (depTask.status === 'completed' || depTask.status === 'moved-to-live' || depTask.status === 'deployed') : false;
                        return (
                          <div
                            key={depId || `dep-${dIdx}`}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium ${isDone
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-red-500/15 text-red-300 border-red-500/30'
                              }`}
                          >
                            <span><strong>{depId}</strong> - {isDone ? '✓ Completed' : '⚠ Active'}</span>
                            {isManager && (
                              <button
                                onClick={() => handleRemoveDependency(depId)}
                                className="text-gray-400 hover:text-white shrink-0 cursor-pointer transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ACTIVITY TIMELINE */}
                {taskActivities.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <h3 className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-2 tracking-wider">
                      <Activity className="h-4 w-4 text-gray-400" />
                      Activity Timeline
                    </h3>

                    <div className="space-y-4">
                      {taskActivities.map((activity, idx) => {
                        const { icon: IconComponent, color } = getActivityMeta(activity.action);
                        const isLast = idx === taskActivities.length - 1;

                        return (
                          <div key={activity.id || activity.activityId || `act-${idx}`} className="relative flex gap-3">
                            {/* Timeline connector line */}
                            {!isLast && (
                              <div className="absolute left-[18px] top-11 w-0.5 h-10 bg-slate-700" />
                            )}

                            {/* Icon badge */}
                            <div className={`flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center relative z-10 ${color}`}>
                              <IconComponent className="h-4.5 w-4.5" />
                            </div>

                            {/* Activity details */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-sm font-semibold text-white leading-tight">{activity.action}</p>
                                <span className="text-[11px] font-medium text-gray-500 whitespace-nowrap ml-2">
                                  {formatTimeAgo(activity.timestamp)}
                                </span>
                              </div>

                              <p className="text-xs text-gray-400">
                                by <span className="text-gray-300 font-medium">{activity.performedBy || activity.userName || 'Team Member'}</span>
                              </p>

                              <p className="text-[10px] text-gray-600 mt-1">
                                {new Date(activity.timestamp).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div ref={activitiesEndRef} />
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>

    {/* Add Co-Assignee Modal Popover */}
    {task && (
      <AddCoAssigneePopover
        key="add-coassignee-popover"
        task={task}
        isOpen={isAddCoAssigneeOpen}
        onClose={() => setIsAddCoAssigneeOpen(false)}
        currentUser={user}
        onSuccess={(updatedTask) => {
          setTask(updatedTask);
        }}
      />
    )}

    {/* Status Update & UAT Rejection Modal */}
    {task && (
      <StatusUpdateModal
        key="task-detail-status-modal"
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setStatusModalTarget(null);
        }}
        task={task}
        targetStatus={statusModalTarget}
        onConfirm={handleConfirmStatusChange}
      />
    )}
  </>
  );
}
