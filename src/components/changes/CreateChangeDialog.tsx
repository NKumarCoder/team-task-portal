'use client';

import React, { useState, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import { dbService } from '@/services/dbService';
import { Project, ProjectChangeChecklist, getChecklistPoints } from '@/types';
import { useAuth } from '@/hooks/useAuth';
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

  // Form State: Project (mandatory), Title (mandatory), Description (optional), Points (mandatory)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState<string[]>(['']);

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

  // Populate initial data when editing
  useEffect(() => {
    if (initialData) {
      setSelectedProjectId(initialData.projectId);
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      const existingPoints = getChecklistPoints(initialData);
      setPoints(existingPoints.length > 0 ? [...existingPoints] : ['']);
    } else {
      setTitle('');
      setDescription('');
      setPoints(['']);
    }
  }, [initialData, isOpen]);

  // Point Management Handlers
  const handleAddPoint = () => {
    setPoints(prev => [...prev, '']);
  };

  const handleUpdatePoint = (index: number, val: string) => {
    setPoints(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleRemovePoint = (index: number) => {
    if (points.length <= 1) {
      setPoints(['']);
      return;
    }
    setPoints(prev => prev.filter((_, i) => i !== index));
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
    const cleanPoints = points.map(p => p.trim()).filter(Boolean);

    if (!selectedProjectId) {
      toast.error('Please select an existing project');
      return;
    }

    if (!cleanTitle) {
      toast.error('Please provide a Change Title');
      return;
    }

    if (cleanPoints.length === 0) {
      toast.error('Please add at least one change point in "Changes / Verification Points"');
      return;
    }

    const selectedProj = projects.find(p => p.id === selectedProjectId);
    const projectName = selectedProj ? selectedProj.name : 'General Project';

    setSubmitting(true);
    try {
      if (initialData?.id) {
        if (initialData.status === 'Rejected by QA') {
          await dbService.reopenRejectedChangeChecklist(initialData.id, {
            title: cleanTitle,
            description: cleanDesc,
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
          className="relative w-full max-w-2xl bg-card border border-card-border rounded-2xl shadow-2xl overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-card-border bg-card/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <ListChecks className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {initialData ? (initialData.status === 'Rejected by QA' ? 'Correct Rejected Change' : 'Edit Change Checklist') : 'Create Project Change Checklist'}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Document technical changes as individual points for the project and release QA
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[calc(88vh-8rem)] overflow-y-auto custom-scrollbar">
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
                  Update your points or description below and submit to make it available for the next release.
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
                  onChange={(e) => setSelectedProjectId(e.target.value)}
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
                placeholder="e.g. Trace ID Implementation"
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
                placeholder="e.g. Implemented Trace ID logic across all four services."
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
              />
            </div>

            {/* 4. Single Common Section: Changes / Verification Points (Mandatory) */}
            <div className="space-y-2.5 pt-2 border-t border-card-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Changes / Verification Points <span className="text-destructive">*</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Enter each change point. These exact points will be verified by the QA team upon release.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddPoint}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors cursor-pointer border border-primary/20 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Point</span>
                </button>
              </div>

              <div className="space-y-2">
                {points.map((point, index) => (
                  <div key={`point-${index}`} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={point}
                      onChange={(e) => handleUpdatePoint(index, e.target.value)}
                      placeholder={
                        index === 0 ? "e.g. Added Trace ID to all four services at Web API level." :
                        index === 1 ? "e.g. Verified Trace ID in API responses." :
                        index === 2 ? "e.g. Added Trace ID to MongoDB logging." :
                        "e.g. Verified booking flow across all four services."
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && index === points.length - 1 && point.trim()) {
                          e.preventDefault();
                          handleAddPoint();
                        }
                      }}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePoint(index)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Remove point"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-card-border/60">
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
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
