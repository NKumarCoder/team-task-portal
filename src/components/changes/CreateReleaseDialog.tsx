'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Layers, 
  Calendar, 
  Folder, 
  CheckSquare, 
  Square, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  User,
  Sparkles
} from 'lucide-react';
import { dbService } from '@/services/dbService';
import { Project, ProjectChangeChecklist, ProductionRelease, ReleaseType, getChecklistPoints } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

interface CreateReleaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultReleaseType?: ReleaseType;
  parentRelease?: ProductionRelease | null;
  onSuccess?: (releaseId: string) => void;
}

export default function CreateReleaseDialog({
  isOpen,
  onClose,
  defaultReleaseType = 'Production',
  parentRelease = null,
  onSuccess
}: CreateReleaseDialogProps) {
  const { user } = useAuth();
  const [releaseType, setReleaseType] = useState<ReleaseType>(defaultReleaseType);
  const [releaseName, setReleaseName] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [availableChecklists, setAvailableChecklists] = useState<ProjectChangeChecklist[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize today's date in YYYY-MM-DD
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      const effectiveType = parentRelease?.releaseType || defaultReleaseType;
      setReleaseType(effectiveType);

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const formattedDate = `${yyyy}-${mm}-${dd}`;
      setReleaseDate(formattedDate);

      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      
      if (parentRelease) {
        setReleaseName(`Follow-up ${effectiveType} Release – ${parentRelease.name.replace(/^(Follow-up\s+)?(UAT|Production|Hotfix)\s+Release\s*–?\s*/i, '')}`);
        setSelectedIds(new Set(parentRelease.changeChecklistIds));
      } else {
        setReleaseName(`${effectiveType} Release – ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`);
        setSelectedIds(new Set());
      }

      setSelectedProjectFilter('all');

      // Fetch projects & checklists
      setLoading(true);
      Promise.all([
        dbService.getProjects(),
        dbService.getProjectChangeChecklists()
      ])
        .then(([projs, checklists]) => {
          setProjects(projs);
          setAvailableChecklists(checklists);
        })
        .catch((err) => {
          console.error('Failed to load release data:', err);
          toast.error('Failed to load change checklists');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, defaultReleaseType, parentRelease]);

  // Filter checklists according to releaseType & project
  const eligibleChecklists = useMemo(() => {
    if (parentRelease) {
      const parentIds = new Set(parentRelease.changeChecklistIds);
      return availableChecklists.filter(c => c.id && parentIds.has(c.id));
    }

    return availableChecklists.filter(c => {
      if (releaseType === 'UAT') {
        return (
          c.status === 'Available for UAT' ||
          c.status === 'Available for Release' ||
          c.status === 'Failed in UAT – Developer Action Required' ||
          c.status === 'Rejected by QA'
        );
      } else if (releaseType === 'Production') {
        return (
          c.status === 'UAT Approved' ||
          c.status === 'Available for Production' ||
          c.status === 'Available for Release' ||
          c.status === 'Failed in Production – Developer Action Required'
        );
      } else if (releaseType === 'Hotfix') {
        return (
          c.status === 'Available for Hotfix' ||
          c.status === 'Failed in Hotfix – Developer Action Required' ||
          c.status === 'Available for Release' ||
          c.isHotfix === true
        );
      }
      return false;
    });
  }, [availableChecklists, releaseType, parentRelease]);

  const filteredChecklists = useMemo(() => {
    if (selectedProjectFilter === 'all') return eligibleChecklists;
    return eligibleChecklists.filter(c => c.projectId === selectedProjectFilter);
  }, [eligibleChecklists, selectedProjectFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredChecklists.forEach(c => {
        if (c.id) next.add(c.id);
      });
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredChecklists.forEach(c => {
        if (c.id) next.delete(c.id);
      });
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMessage(null);

    const cleanName = releaseName.trim();
    if (!cleanName) {
      const msg = 'Please enter a Release Name';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (!releaseDate) {
      const msg = 'Please choose a Release Date';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    const idsArray = Array.from(selectedIds);
    if (idsArray.length === 0) {
      const msg = 'Please select at least one project change entry to include';
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setSubmitting(true);
    try {
      const releaseId = await dbService.createRelease({
        name: cleanName,
        releaseDate,
        releaseType,
        changeChecklistIds: idsArray,
        createdBy: user.email.toLowerCase(),
        createdByName: user.displayName || user.email.split('@')[0],
        parentReleaseId: parentRelease?.id || null,
        isFollowUp: Boolean(parentRelease)
      });

      toast.success(`${releaseType} release created with ${idsArray.length} project change(s)!`);
      if (onSuccess) onSuccess(releaseId);
      onClose();
    } catch (err: any) {
      console.error('Failed to create release:', err);
      const errMsg = err?.message || 'Failed to create release';
      setErrorMessage(errMsg);
      toast.error(errMsg);
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
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                releaseType === 'UAT' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' :
                releaseType === 'Hotfix' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                'bg-purple-500/10 border-purple-500/20 text-purple-400'
              }`}>
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {parentRelease ? `Create Follow-up ${releaseType} Release` : `Create ${releaseType} Release`}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {parentRelease 
                    ? `Retry release for ${parentRelease.name} – Includes only failed verification points`
                    : releaseType === 'UAT'
                      ? 'Package ready changes for comprehensive UAT testing & QA verification'
                      : releaseType === 'Production'
                        ? 'Package fully UAT-approved changes for production deployment & verification'
                        : 'Package urgent hotfix changes for dedicated hotfix QA & expedited release'}
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
            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-destructive/15 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Cannot Create Release</p>
                  <p className="text-[11px] text-foreground font-medium leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Release Type Selection (disabled if follow-up) */}
            {!parentRelease && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Release Type <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReleaseType('UAT');
                      const today = new Date();
                      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                      setReleaseName(`UAT Release – ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`);
                      setSelectedIds(new Set());
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      releaseType === 'UAT'
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-xs'
                        : 'bg-accent/20 border-card-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    UAT Release
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReleaseType('Production');
                      const today = new Date();
                      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                      setReleaseName(`Production Release – ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`);
                      setSelectedIds(new Set());
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      releaseType === 'Production'
                        ? 'bg-purple-500/15 border-purple-500/40 text-purple-400 shadow-xs'
                        : 'bg-accent/20 border-card-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Production Release
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReleaseType('Hotfix');
                      const today = new Date();
                      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                      setReleaseName(`Hotfix Release – ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`);
                      setSelectedIds(new Set());
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      releaseType === 'Hotfix'
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 shadow-xs'
                        : 'bg-accent/20 border-card-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Hotfix Release
                  </button>
                </div>
              </div>
            )}

            {/* Follow-up Banner */}
            {parentRelease && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-400 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Follow-up Release for: {parentRelease.name}
                </p>
                <p className="text-[11px] text-foreground font-medium pl-5.5">
                  This release automatically includes only the failed verification points that have been marked ready for retesting by developers. Previously passed points are excluded from retesting.
                </p>
              </div>
            )}

            {/* 1. Release Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                Release Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={releaseName}
                onChange={(e) => setReleaseName(e.target.value)}
                placeholder={`e.g. ${releaseType} Release – 24 November 2026`}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>

            {/* 2. Release Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                Release Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>

            {/* 3. Select Project Changes */}
            <div className="space-y-3 pt-2 border-t border-card-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Select Project Changes <span className="text-destructive">*</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      ({selectedIds.size} selected)
                    </span>
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    {releaseType === 'Production' 
                      ? 'Only changes approved by UAT are eligible for Production Releases'
                      : releaseType === 'UAT'
                        ? 'Showing changes available for UAT verification'
                        : 'Showing urgent fixes available for Hotfix verification'}
                  </p>
                </div>

                {/* Project Filter */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedProjectFilter}
                    onChange={(e) => setSelectedProjectFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-accent/40 border border-card-border text-[11px] font-medium text-foreground cursor-pointer focus:outline-none"
                  >
                    <option value="all">All Projects</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {filteredChecklists.length > 0 && (
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className={`text-[11px] hover:underline font-semibold cursor-pointer ${
                        releaseType === 'UAT' ? 'text-cyan-400' : releaseType === 'Hotfix' ? 'text-rose-400' : 'text-purple-400'
                      }`}
                    >
                      Select all
                    </button>
                  )}
                  {selectedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={deselectAllFiltered}
                      className="text-[11px] text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
                  <Loader2 className={`h-5 w-5 animate-spin mx-auto ${
                    releaseType === 'UAT' ? 'text-cyan-400' : releaseType === 'Hotfix' ? 'text-rose-400' : 'text-purple-400'
                  }`} />
                  <p>Loading eligible change checklists...</p>
                </div>
              ) : filteredChecklists.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-xl bg-accent/15 border border-dashed border-card-border space-y-2">
                  <AlertCircle className="h-6 w-6 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-semibold text-foreground">No available project changes found</p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                    All submitted changes are either already included in another release or no changes have been submitted yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar p-0.5">
                  {filteredChecklists.map((checklist) => {
                    const isSelected = checklist.id ? selectedIds.has(checklist.id) : false;
                    const pointsCount = getChecklistPoints(checklist).length;

                    return (
                      <div
                        key={checklist.id}
                        onClick={() => checklist.id && toggleSelect(checklist.id)}
                        className={`p-3 rounded-xl border flex items-start gap-3 transition-all cursor-pointer select-none ${
                          isSelected 
                            ? releaseType === 'UAT'
                              ? 'bg-cyan-500/10 border-cyan-500/40 shadow-xs'
                              : releaseType === 'Hotfix'
                              ? 'bg-rose-500/10 border-rose-500/40 shadow-xs'
                              : 'bg-purple-500/10 border-purple-500/40 shadow-xs'
                            : 'bg-card/40 border-card-border hover:bg-accent/25'
                        }`}
                      >
                        <div className={`mt-0.5 shrink-0 ${
                          isSelected
                            ? releaseType === 'UAT' ? 'text-cyan-400' : releaseType === 'Hotfix' ? 'text-rose-400' : 'text-purple-400'
                            : 'text-muted-foreground/60'
                        }`}>
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              releaseType === 'UAT'
                                ? 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20'
                                : releaseType === 'Hotfix'
                                ? 'text-rose-400 bg-rose-500/15 border-rose-500/20'
                                : 'text-purple-400 bg-purple-500/15 border-purple-500/20'
                            }`}>
                              {checklist.projectName}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {checklist.createdByName}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-foreground mt-1 leading-snug">
                            {checklist.title}
                          </h4>

                          {checklist.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                              {checklist.description}
                            </p>
                          )}

                          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                            <span>{pointsCount} change / verification point{pointsCount > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
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
                disabled={submitting || selectedIds.size === 0}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-md ${
                  releaseType === 'UAT' 
                    ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20' 
                    : releaseType === 'Hotfix'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                    : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Creating {parentRelease ? `Follow-up ${releaseType}` : releaseType} Release...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Create {parentRelease ? `Follow-up ${releaseType}` : releaseType} Release ({selectedIds.size})</span>
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
