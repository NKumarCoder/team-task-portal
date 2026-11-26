'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Folder, 
  FileText, 
  ListChecks, 
  Sparkles,
  ExternalLink,
  MessageSquare,
  Square,
  CheckSquare,
  Layers,
  ChevronDown,
  ChevronUp,
  ListPlus,
  Maximize2
} from 'lucide-react';
import { dbService } from '@/services/dbService';
import { Project, ProjectChangeChecklist, ChangeChecklistItem, Task, getChecklistItems } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { TASK_STATUS_CONFIG } from '@/constants';
import TaskSelectionModal from './TaskSelectionModal';
import BulkAddPointsModal from './BulkAddPointsModal';
import toast from 'react-hot-toast';

interface CreateChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: ProjectChangeChecklist | null;
  onSuccess?: (checklistId: string) => void;
}

export default function CreateChangeDialog({
  isOpen,
  onClose,
  initialData,
  onSuccess
}: CreateChangeDialogProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State: Project (mandatory), Title (mandatory), Description (optional)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Rich Checklist Items (Task-linked & Manual)
  const [checklistItems, setChecklistItems] = useState<ChangeChecklistItem[]>([]);

  // Task Selection Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Bulk Add Points Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Expanded comment boxes state (set of item ids)
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(new Set());

  // Viewing full text popover state (item id)
  const [viewingFullTextId, setViewingFullTextId] = useState<string | null>(null);

  // Scroll ref to bring newly added points smoothly into view
  const itemsEndRef = useRef<HTMLDivElement>(null);

  // Load existing projects from Apex Tasks
  useEffect(() => {
    if (!isOpen) return;
    setLoadingProjects(true);
    dbService.getProjects()
      .then((projs) => {
        setProjects(projs);
        if (projs.length > 0 && !selectedProjectId && !initialData) {
          setSelectedProjectId(projs[0].id || '');
        }
      })
      .catch((err) => {
        console.error('Failed to load projects:', err);
        toast.error('Failed to load projects');
      })
      .finally(() => setLoadingProjects(false));
  }, [isOpen, initialData]);

  // Populate initial data when editing or correcting
  useEffect(() => {
    if (initialData) {
      setSelectedProjectId(initialData.projectId);
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      const existingItems = getChecklistItems(initialData);
      setChecklistItems(existingItems.length > 0 ? existingItems : []);
      // Auto-expand comments for items that already have comments
      const withComments = new Set<string>();
      existingItems.forEach(it => {
        if (it.comment) withComments.add(it.id);
      });
      setExpandedCommentIds(withComments);
    } else {
      setTitle('');
      setDescription('');
      setChecklistItems([]);
      setExpandedCommentIds(new Set());
    }
  }, [initialData, isOpen]);

  // Selected project object
  const currentProject = projects.find(p => p.id === selectedProjectId);
  const currentProjectName = currentProject ? currentProject.name : '';

  // Handle changing project
  const handleProjectChange = (newProjectId: string) => {
    if (checklistItems.some(it => it.type === 'task') && newProjectId !== selectedProjectId) {
      if (confirm('Changing the project will clear tasks selected from the previous project. Do you want to proceed?')) {
        setChecklistItems(prev => prev.filter(it => it.type === 'manual'));
        setSelectedProjectId(newProjectId);
      }
    } else {
      setSelectedProjectId(newProjectId);
    }
  };

  // Open Task Selection Modal
  const handleOpenTaskPicker = () => {
    if (!selectedProjectId) {
      toast.error('Please select an existing project first');
      return;
    }
    setIsTaskModalOpen(true);
  };

  // Handle tasks selected from TaskSelectionModal
  const handleSelectTasks = (selectedTasks: Task[]) => {
    setChecklistItems(prev => {
      const existingTaskIds = new Set(
        prev.filter(it => it.taskId).map(it => it.taskId!.toUpperCase())
      );

      const newItems: ChangeChecklistItem[] = [];

      selectedTasks.forEach(task => {
        if (!existingTaskIds.has(task.taskId.toUpperCase())) {
          const taskItem: ChangeChecklistItem = {
            id: `task-${task.taskId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            text: `${task.taskId} – ${task.title || ''}`,
            type: 'task',
            taskId: task.taskId,
            taskTitle: task.title || '',
            taskStatus: task.status || 'in-progress',
            status: 'Pending',
            comment: ''
          };
          if (task.id) taskItem.taskDocId = task.id;
          if (task.module) taskItem.taskModule = task.module;
          if (task.priority) taskItem.taskPriority = task.priority;
          newItems.push(taskItem);
        }
      });

      return [...prev, ...newItems];
    });

    setTimeout(() => {
      itemsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);

    toast.success(`Added ${selectedTasks.length} task(s) to checklist`);
  };

  // Add Manual Point
  const handleAddManualPoint = () => {
    const newId = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newItem: ChangeChecklistItem = {
      id: newId,
      text: '',
      type: 'manual',
      status: 'Pending',
      comment: ''
    };
    setChecklistItems(prev => [...prev, newItem]);
    setTimeout(() => {
      itemsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  // Bulk Add Verification Points
  const handleBulkAddPoints = (newPointTexts: string[]) => {
    if (newPointTexts.length === 0) return;

    const newItems: ChangeChecklistItem[] = newPointTexts.map(text => ({
      id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text,
      type: 'manual',
      status: 'Pending',
      comment: ''
    }));

    setChecklistItems(prev => [...prev, ...newItems]);
    setIsBulkModalOpen(false);

    setTimeout(() => {
      itemsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);

    toast.success(`Added ${newPointTexts.length} verification point(s)`);
  };

  // Update Manual Point Text
  const handleUpdateManualText = (id: string, text: string) => {
    setChecklistItems(prev => prev.map(it => it.id === id ? { ...it, text } : it));
  };

  // Toggle Item Completion (Separate from original task in All Tasks!)
  const handleToggleItemComplete = (id: string) => {
    if (!user) return;
    setChecklistItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const willBeCompleted = it.status !== 'Completed';
      const now = new Date().toISOString();
      const updated: ChangeChecklistItem = {
        ...it,
        status: willBeCompleted ? 'Completed' : 'Pending'
      };
      if (willBeCompleted) {
        updated.completedBy = user.email.toLowerCase();
        updated.completedByName = user.displayName || user.email.split('@')[0];
        updated.completedDate = now;
      } else {
        delete updated.completedBy;
        delete updated.completedByName;
        delete updated.completedDate;
      }
      return updated;
    }));
  };

  // Update Item Comment
  const handleUpdateItemComment = (id: string, comment: string) => {
    setChecklistItems(prev => prev.map(it => it.id === id ? { ...it, comment } : it));
  };

  // Toggle Comment Area Visibility
  const toggleCommentBox = (id: string) => {
    setExpandedCommentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Remove Item from Checklist
  const handleRemoveItem = (id: string) => {
    setChecklistItems(prev => prev.filter(it => it.id !== id));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be logged in to create a change checklist');
      return;
    }

    const cleanTitle = title.trim();
    const cleanDesc = description.trim();
    const validItems = checklistItems.filter(it => it.text.trim() !== '');

    if (!selectedProjectId) {
      toast.error('Please select an existing project');
      return;
    }

    if (!cleanTitle) {
      toast.error('Please provide a Change Title');
      return;
    }

    if (validItems.length === 0) {
      toast.error('Please add at least one checklist item (either from All Tasks or as a manual point)');
      return;
    }

    const projectName = currentProjectName || 'General Project';
    const cleanPoints = validItems.map(it => it.text.trim());

    setSubmitting(true);
    try {
      if (initialData?.id) {
        if (initialData.status === 'Rejected by QA') {
          await dbService.reopenRejectedChangeChecklist(initialData.id, {
            title: cleanTitle,
            description: cleanDesc,
            items: validItems,
            points: cleanPoints,
            changes: cleanPoints
          });
          toast.success('Change checklist corrected and made Available for Release!');
        } else {
          await dbService.updateProjectChangeChecklist(initialData.id, {
            projectId: selectedProjectId,
            projectName,
            title: cleanTitle,
            description: cleanDesc,
            items: validItems,
            points: cleanPoints,
            changes: cleanPoints
          });
          toast.success('Change checklist updated successfully');
        }
        if (onSuccess) onSuccess(initialData.id);
      } else {
        const id = await dbService.createProjectChangeChecklist({
          projectId: selectedProjectId,
          projectName,
          title: cleanTitle,
          description: cleanDesc,
          items: validItems,
          points: cleanPoints,
          createdBy: user.email.toLowerCase(),
          createdByName: user.displayName || user.email.split('@')[0]
        });
        toast.success('Project change checklist submitted successfully!');
        if (onSuccess) onSuccess(id);
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to save change checklist:', err);
      toast.error(err?.message || 'Failed to submit change checklist');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for status badge
  const getStatusBadge = (status?: string) => {
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

  if (!isOpen) return null;

  return (
    <>
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
            className="relative w-full max-w-2xl bg-card border border-card-border rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-card-border bg-card/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <ListChecks className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {initialData ? (initialData.status === 'Rejected by QA' ? 'Correct Rejected Change' : 'Edit Change Checklist') : 'Create Project Change Checklist'}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select tasks directly from All Tasks or add manual points for QA verification
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

            {/* Form wrapping scrollable content and fixed bottom footer */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Content Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar pb-8">
                {/* Rejection notice if correcting */}
                {initialData?.status === 'Rejected by QA' && (
                  <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 space-y-1.5 text-left">
                    <div className="flex items-center gap-2 text-destructive font-bold text-xs">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>QA Rejection Feedback</span>
                    </div>
                    {initialData.rejectionHistory && initialData.rejectionHistory.length > 0 && (
                      <p className="text-xs text-foreground/90 leading-relaxed font-medium pl-6">
                        "{initialData.rejectionHistory[initialData.rejectionHistory.length - 1].reason}"
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground pl-6">
                      Update your selected tasks or comments below and submit to make it available for release.
                    </p>
                  </div>
                )}

                {/* 1. Project Selector (Mandatory) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Folder className="h-3.5 w-3.5 text-primary" />
                    Project <span className="text-destructive">*</span>
                  </label>
                  {loadingProjects ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      Loading existing projects...
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500">
                      No existing projects found. Please create a project first under Projects menu.
                    </div>
                  ) : (
                    <select
                      value={selectedProjectId}
                      onChange={(e) => handleProjectChange(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all cursor-pointer"
                    >
                      <option value="" disabled>Select an existing project...</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id} className="bg-card text-foreground">
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 2. Change Title (Mandatory) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Change Title <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. BCI Production Changes or Trace ID Implementation"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  />
                </div>

                {/* 3. Description (Optional) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground">
                      Description <span className="text-[11px] font-normal text-muted-foreground">(Optional)</span>
                    </label>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Implemented Trace ID logic across all services and verified API response mapping."
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
                  />
                </div>

                {/* 4. Select Tasks from All Tasks / Changes & Verification Points */}
                <div className="pt-4 border-t border-card-border/60 space-y-2.5">
                  {/* Row 1: Heading on Left, 3 Compact Action Buttons on Right */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Changes / Verification Points <span className="text-destructive">*</span></span>
                    </label>

                    {/* Action buttons: compact, consistent height & spacing */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleOpenTaskPicker}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all cursor-pointer shadow-xs shadow-primary/20"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>+ Select Tasks</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAddManualPoint}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/40 hover:bg-accent/80 text-foreground text-xs font-semibold transition-colors cursor-pointer border border-card-border"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Add Manual Point</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsBulkModalOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/40 hover:bg-accent/80 text-foreground text-xs font-semibold transition-colors cursor-pointer border border-card-border"
                      >
                        <ListPlus className="h-3.5 w-3.5 text-primary" />
                        <span>+ Bulk Add Points</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Helper description below heading with subtle bottom divider */}
                  <div className="pb-3 border-b border-card-border/60">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Select tasks from All Tasks or add manual points. Mark completed and add developer notes.
                    </p>
                  </div>

                  {/* Checklist Items Display */}
                  {checklistItems.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-card-border bg-accent/10 space-y-2">
                      <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                      <p className="text-xs font-bold text-foreground">No tasks or points added yet</p>
                      <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                        Click <strong className="text-primary font-semibold">+ Select Tasks</strong> to pick from All Tasks, click <strong className="text-foreground font-semibold">+ Add Manual Point</strong> to enter points manually, or use <strong className="text-primary font-semibold">+ Bulk Add Points</strong> to paste multiple items.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {checklistItems.map((item, index) => {
                        const isCompleted = item.status === 'Completed';
                        const isCommentExpanded = expandedCommentIds.has(item.id) || Boolean(item.comment);
                        const displayText = item.type === 'task' ? (item.taskTitle || item.text) : item.text;
                        const isLongText = displayText.length > 45;
                        const isFullTextOpen = viewingFullTextId === item.id;

                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border text-xs transition-all space-y-2 ${
                              isCompleted 
                                ? 'bg-emerald-500/[0.04] border-emerald-500/25' 
                                : 'bg-card/70 border-card-border hover:border-card-border/90'
                            }`}
                          >
                            {/* Row 1: Item Header with Checkbox, Label/Input, Actions */}
                            <div className="flex items-start gap-2">
                              {/* Numbering */}
                              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {index + 1}
                              </span>

                              {/* Completion Checkbox */}
                              <button
                                type="button"
                                onClick={() => handleToggleItemComplete(item.id)}
                                className="mt-0.5 text-primary hover:text-primary/80 transition-colors cursor-pointer shrink-0"
                                title={isCompleted ? "Mark as Pending" : "Mark as Completed"}
                              >
                                {isCompleted ? (
                                  <CheckSquare className="h-4.5 w-4.5 text-emerald-500" />
                                ) : (
                                  <Square className="h-4.5 w-4.5 text-muted-foreground/60" />
                                )}
                              </button>

                              {/* Content based on type - with widened input and truncation indicators */}
                              <div className="flex-1 min-w-0">
                                {item.type === 'task' ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono font-bold text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                                        {item.taskId}
                                      </span>
                                      {getStatusBadge(item.taskStatus)}
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
                                    </div>
                                    <div className="flex items-start justify-between gap-1.5">
                                      <p 
                                        className="text-xs font-semibold leading-relaxed text-foreground select-text break-words"
                                        title={displayText}
                                      >
                                        {displayText}
                                      </p>
                                      {isLongText && (
                                        <button
                                          type="button"
                                          onClick={() => setViewingFullTextId(isFullTextOpen ? null : item.id)}
                                          className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors cursor-pointer flex items-center gap-0.5"
                                          title="Text exceeds standard width. Click to view full description"
                                        >
                                          <span>{isFullTextOpen ? 'Less' : '...'}</span>
                                          <Maximize2 className="h-2.5 w-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/25 px-1.5 py-0.5 rounded">
                                        Manual Point
                                      </span>
                                    </div>
                                    <div className="relative flex items-center w-full">
                                      <input
                                        type="text"
                                        value={item.text}
                                        onChange={(e) => handleUpdateManualText(item.id, e.target.value)}
                                        placeholder="Enter technical change or verification point..."
                                        title={item.text}
                                        className={`w-full py-1.5 rounded-lg bg-accent/30 border border-card-border text-foreground text-xs font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all ${
                                          isLongText ? 'pl-3 pr-12' : 'px-3'
                                        }`}
                                      />
                                      {isLongText && (
                                        <button
                                          type="button"
                                          onClick={() => setViewingFullTextId(isFullTextOpen ? null : item.id)}
                                          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer flex items-center gap-0.5"
                                          title="Text exceeds standard width. Click to view full description"
                                        >
                                          <span>...</span>
                                          <Maximize2 className="h-2.5 w-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Expanded Full Text View on Click/Touch */}
                                {isFullTextOpen && displayText && (
                                  <div className="mt-2 p-2.5 rounded-lg bg-accent/60 border border-card-border text-foreground text-xs leading-relaxed space-y-1 animate-in fade-in zoom-in-95 duration-100">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                                      <span>Full Verification Description</span>
                                      <button
                                        type="button"
                                        onClick={() => setViewingFullTextId(null)}
                                        className="text-muted-foreground hover:text-foreground cursor-pointer text-[10px]"
                                      >
                                        Close
                                      </button>
                                    </div>
                                    <p className="select-text break-words font-medium text-foreground">
                                      {displayText}
                                    </p>
                                  </div>
                                )}

                                {/* Completed info stamp */}
                                {isCompleted && item.completedByName && (
                                  <p className="text-[10px] text-emerald-500 font-medium mt-1">
                                    Completed by {item.completedByName}
                                  </p>
                                )}
                              </div>

                              {/* Right action controls */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => toggleCommentBox(item.id)}
                                  className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                    item.comment 
                                      ? 'text-primary bg-primary/10 hover:bg-primary/20' 
                                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                                  }`}
                                  title={item.comment ? "Edit comment" : "Add comment"}
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                                  title="Remove item from checklist"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Row 2: Developer Comment Field (Shown when toggled or comment exists) */}
                            {isCommentExpanded && (
                              <div className="pl-9 pr-1 pt-1">
                                <input
                                  type="text"
                                  value={item.comment || ''}
                                  onChange={(e) => handleUpdateItemComment(item.id, e.target.value)}
                                  placeholder="Developer comment (e.g. Verified API response and Trace ID in logs)..."
                                  className="w-full px-3 py-1.5 rounded-lg bg-accent/40 border border-card-border text-foreground text-[11px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div ref={itemsEndRef} />
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Modal Footer: always visible regardless of point count */}
              <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-t border-card-border bg-card/95 backdrop-blur-md shrink-0">
                <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                  <span className="font-semibold text-foreground/80">{checklistItems.length}</span>
                  <span>verification point{checklistItems.length !== 1 ? 's' : ''}</span>
                  {checklistItems.length > 0 && (
                    <span className="text-emerald-500 font-semibold ml-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      {checklistItems.filter(i => i.status === 'Completed').length} completed
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || projects.length === 0}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-primary/20"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>
                          {initialData 
                            ? (initialData.status === 'Rejected by QA' ? 'Submit Corrected Change' : 'Update Change') 
                            : 'Submit Project Change'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Task Selection Modal */}
      <TaskSelectionModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        projectId={selectedProjectId}
        projectName={currentProjectName}
        alreadySelectedTaskIds={
          checklistItems.filter(it => it.taskId).map(it => it.taskId!)
        }
        onSelectTasks={handleSelectTasks}
      />

      {/* Bulk Add Points Modal */}
      <BulkAddPointsModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onAddPoints={handleBulkAddPoints}
        existingPoints={checklistItems}
      />
    </>
  );
}
