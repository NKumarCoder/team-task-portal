'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Search, 
  CheckSquare, 
  Square, 
  Loader2, 
  Folder, 
  CheckCircle2, 
  AlertCircle,
  Tag,
  User,
  ExternalLink,
  Layers
} from 'lucide-react';
import { Task, TaskPriority } from '@/types';
import { dbService } from '@/services/dbService';
import { TASK_STATUS_CONFIG } from '@/constants';
import toast from 'react-hot-toast';

interface TaskSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  alreadySelectedTaskIds: string[]; // e.g. ['TASK-000154', ...]
  onSelectTasks: (selectedTasks: Task[]) => void;
}

// Statuses that are completed or already ready for production release
const EXCLUDED_STATUSES = new Set([
  'completed',
  'prod-deployed',
  'moved-to-live',
  'deployed',
  'ready-for-production-deploy',
  'ready-for-deployment',
  'cancelled'
]);

export default function TaskSelectionModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  alreadySelectedTaskIds,
  onSelectTasks
}: TaskSelectionModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Fetch all tasks and filter by project & eligibility
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setSelectedTaskIds(new Set());
    setSearchTerm('');

    dbService.getTasks()
      .then((allTasks) => {
        // Filter strictly by the selected project
        const projectTasks = allTasks.filter(t => {
          if (t.isDeleted) return false;
          if (!projectName) return false;
          return t.projectName?.toLowerCase() === projectName.toLowerCase();
        });
        setTasks(projectTasks);
      })
      .catch((err) => {
        console.error('Failed to load project tasks:', err);
        toast.error('Failed to load tasks for the selected project');
      })
      .finally(() => setLoading(false));
  }, [isOpen, projectName]);

  // Separate eligible vs excluded tasks
  const eligibleTasks = useMemo(() => {
    return tasks.filter(t => !EXCLUDED_STATUSES.has(t.status));
  }, [tasks]);

  // Filter eligible tasks by search query (Task ID, Title, Module, Assignee)
  const filteredTasks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return eligibleTasks;

    return eligibleTasks.filter(t => {
      const matchId = t.taskId?.toLowerCase().includes(q);
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchModule = t.module?.toLowerCase().includes(q);
      const matchAssignee = t.assigneeName?.toLowerCase().includes(q) ||
        t.assignees?.some(a => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
      return matchId || matchTitle || matchModule || matchAssignee;
    });
  }, [eligibleTasks, searchTerm]);

  // Set of task IDs already in the parent checklist to prevent duplicates
  const alreadyInChecklistSet = useMemo(() => {
    return new Set(alreadySelectedTaskIds.map(id => id.toUpperCase()));
  }, [alreadySelectedTaskIds]);

  // Toggle selection for a single task
  const toggleTaskSelection = (task: Task) => {
    if (alreadyInChecklistSet.has(task.taskId.toUpperCase())) return;

    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(task.taskId)) {
        next.delete(task.taskId);
      } else {
        next.add(task.taskId);
      }
      return next;
    });
  };

  // Select all selectable filtered tasks
  const handleSelectAll = () => {
    const next = new Set(selectedTaskIds);
    filteredTasks.forEach(t => {
      if (!alreadyInChecklistSet.has(t.taskId.toUpperCase())) {
        next.add(t.taskId);
      }
    });
    setSelectedTaskIds(next);
  };

  // Deselect all
  const handleClearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  // Confirm selection
  const handleConfirm = () => {
    const selectedList = tasks.filter(t => selectedTaskIds.has(t.taskId));
    if (selectedList.length === 0) {
      toast.error('Please select at least one task');
      return;
    }
    onSelectTasks(selectedList);
    onClose();
  };

  // Helper for status badge styling
  const getStatusBadge = (status: string) => {
    const cfg = TASK_STATUS_CONFIG[status] || {
      label: status,
      badgeBg: 'bg-accent/40',
      badgeColor: 'text-muted-foreground',
      badgeBorder: 'border-card-border'
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.badgeBg} ${cfg.badgeColor} ${cfg.badgeBorder}`}>
        {cfg.label}
      </span>
    );
  };

  // Helper for priority badge
  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'critical':
        return <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 rounded">Critical</span>;
      case 'high':
        return <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded">High</span>;
      case 'medium':
        return <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">Medium</span>;
      default:
        return <span className="text-[10px] font-medium text-slate-400 bg-slate-500/10 border border-slate-500/20 px-1.5 py-0.5 rounded">Low</span>;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-3xl bg-card border border-card-border rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-card-border bg-card/70 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">Select Tasks from All Tasks</h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-primary/15 text-primary border border-primary/25">
                    {projectName}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select eligible in-progress and testing tasks to convert into change checklist items
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search & Actions Bar */}
          <div className="p-4 sm:px-6 border-b border-card-border/60 bg-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Task ID, title, module, or assigned developer..."
                className="w-full pl-9.5 pr-4 py-2 rounded-xl bg-card border border-card-border text-foreground text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0 text-xs">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={filteredTasks.length === 0}
                className="px-2.5 py-1.5 rounded-lg bg-accent/50 hover:bg-accent text-foreground font-semibold border border-card-border transition-colors cursor-pointer disabled:opacity-40"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                disabled={selectedTaskIds.size === 0}
                className="px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40 font-medium transition-colors cursor-pointer disabled:opacity-40"
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Tasks List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 custom-scrollbar">
            {loading ? (
              <div className="py-16 text-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p className="text-xs text-muted-foreground">Loading tasks for project {projectName}...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-bold text-foreground">No tasks found for {projectName}</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  There are no tasks logged under project "{projectName}" in All Tasks.
                </p>
              </div>
            ) : eligibleTasks.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/50 mx-auto" />
                <p className="text-sm font-bold text-foreground">All tasks in {projectName} are Completed or in Production</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Only active, in-progress, code review, or UAT tasks can be selected for change verification.
                </p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Search className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-bold text-foreground">No matching tasks</p>
                <p className="text-xs text-muted-foreground">
                  No tasks matched your search term "{searchTerm}".
                </p>
              </div>
            ) : (
              filteredTasks.map((t) => {
                const isAlreadyInChecklist = alreadyInChecklistSet.has(t.taskId.toUpperCase());
                const isSelected = selectedTaskIds.has(t.taskId) || isAlreadyInChecklist;

                return (
                  <div
                    key={t.taskId}
                    onClick={() => {
                      if (!isAlreadyInChecklist) toggleTaskSelection(t);
                    }}
                    className={`p-3 sm:p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3 select-none ${
                      isAlreadyInChecklist
                        ? 'opacity-60 bg-accent/20 border-card-border/50 cursor-not-allowed'
                        : isSelected
                          ? 'bg-primary/[0.08] border-primary/40 shadow-xs cursor-pointer'
                          : 'bg-card/60 hover:bg-accent/40 border-card-border cursor-pointer'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="mt-0.5 shrink-0 text-primary">
                      {isSelected ? (
                        <CheckSquare className="h-4.5 w-4.5 text-primary" />
                      ) : (
                        <Square className="h-4.5 w-4.5 text-muted-foreground/60" />
                      )}
                    </div>

                    {/* Task Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono font-bold text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                          {t.taskId}
                        </span>
                        {getStatusBadge(t.status)}
                        {t.module && (
                          <span className="text-[10px] font-semibold text-muted-foreground bg-accent/50 px-2 py-0.5 rounded border border-card-border/60">
                            {t.module}
                          </span>
                        )}
                        {getPriorityBadge(t.priority)}

                        {isAlreadyInChecklist && (
                          <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded ml-auto">
                            Already in Checklist
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-foreground leading-snug">
                        {t.title}
                      </h4>

                      {/* Assignee Footer */}
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground/70" />
                          <span>{t.assigneeName || 'Unassigned'}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:px-6 border-t border-card-border bg-card/80 flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{selectedTaskIds.size}</span> task{selectedTaskIds.size === 1 ? '' : 's'} selected
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedTaskIds.size === 0}
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-primary/20"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Add Selected Tasks ({selectedTaskIds.size})</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
