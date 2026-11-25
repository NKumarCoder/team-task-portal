'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Trash2, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2, 
  Loader2, 
  ShieldAlert, 
  Calendar,
  Layers,
  Clock,
  ShieldCheck,
  CheckSquare,
  Square
} from 'lucide-react';
import { ProductionRelease } from '@/types';
import { dbService } from '@/services/dbService';
import { checkRelease7DayEligibility, formatDate } from '@/utils';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

interface DeleteReleaseConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  releasesToDelete: ProductionRelease[];
  isDeleteAll?: boolean;
  onSuccess: (deletedCount: number) => void;
}

export default function DeleteReleaseConfirmationModal({
  isOpen,
  onClose,
  releasesToDelete,
  isDeleteAll = false,
  onSuccess
}: DeleteReleaseConfirmationModalProps) {
  const { user } = useAuth();
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);
  const [adminOverrideCheckbox, setAdminOverrideCheckbox] = useState(false);
  const [reason, setReason] = useState('');
  const [processingState, setProcessingState] = useState<'idle' | 'deleting' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setConfirmedCheckbox(false);
      setAdminOverrideCheckbox(false);
      setReason('');
      setProcessingState('idle');
    }
  }, [isOpen]);

  if (!isOpen || releasesToDelete.length === 0) return null;

  const count = releasesToDelete.length;
  const isMultiple = count > 1;

  const isSuperAdmin = Boolean(user?.role === 'SuperAdmin' || 
    (user?.email && ['admin@i2space.com', 'rr@i2space.com'].includes(user.email.toLowerCase())));

  // Analyze 7-day eligibility for each target release
  const eligibilityAnalysis = releasesToDelete.map(rel => {
    const analysis = checkRelease7DayEligibility({
      status: rel.status,
      terminalDate: rel.terminalDate,
      createdDate: rel.createdDate
    });
    return {
      release: rel,
      ...analysis
    };
  });

  const allEligible = eligibilityAnalysis.every(it => it.isEligible);
  const ineligibleCount = eligibilityAnalysis.filter(it => !it.isEligible).length;

  const canProceed = confirmedCheckbox && (allEligible || (isSuperAdmin && adminOverrideCheckbox));

  const title = isDeleteAll 
    ? 'Hard Delete All Eligible Terminal Releases?' 
    : isMultiple 
      ? `Hard Delete ${count} Selected Releases?` 
      : `Hard Delete Release: ${releasesToDelete[0].name}?`;

  const userEmail = user?.email || 'admin@apextasks.com';
  const userName = user?.displayName || userEmail.split('@')[0];

  const handleExecuteDelete = async () => {
    if (!canProceed) {
      toast.error('Please confirm the deletion requirements.');
      return;
    }

    setErrorMessage(null);
    setProcessingState('deleting');

    try {
      const releaseIds = releasesToDelete.map(r => r.id!).filter(Boolean);
      const res = await dbService.deleteEligibleReleases({
        releaseIds,
        deletedBy: userEmail,
        deletedByName: userName,
        forceAdminOverride: Boolean(isSuperAdmin && adminOverrideCheckbox),
        reason: reason.trim() || undefined
      });

      setProcessingState('success');
      toast.success(`Successfully deleted ${res.deletedCount} release record(s)!`);
      onSuccess(res.deletedCount);
      onClose();
    } catch (err: any) {
      console.error('Delete execution failed:', err);
      const errMsg = err?.message || 'Failed to hard-delete release records.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
      setProcessingState('idle');
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto"
        onClick={() => {
          if (processingState === 'idle') onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-xl bg-card border border-rose-500/30 rounded-2xl shadow-2xl overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-card-border bg-rose-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {title}
                </h2>
                <p className="text-xs text-rose-400 font-medium mt-0.5">
                  Permanent record cleanup &bull; Zero impact on tasks or projects
                </p>
              </div>
            </div>
            {processingState === 'idle' && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 max-h-[calc(88vh-8rem)] overflow-y-auto custom-scrollbar text-xs">
            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-destructive/15 border border-destructive/30 space-y-1 text-destructive">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Action Aborted – Records Unchanged</span>
                </div>
                <p className="text-[11px] leading-relaxed text-foreground font-medium pl-6">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Seven-Day Retention Notice */}
            <div className="p-3.5 rounded-xl bg-accent/30 border border-card-border/80 space-y-1.5">
              <div className="flex items-center gap-2 text-foreground font-bold">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <span>7-Day Retention Policy</span>
              </div>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                Under system policy, terminal release verification records (Completed, Rejected, or Partially Rejected) become eligible for hard deletion <strong>7 days</strong> after entering their terminal state. Active releases cannot be deleted.
              </p>
            </div>

            {/* List of Releases with Retention Status */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground block">
                Target Release Records ({releasesToDelete.length}):
              </label>
              <div className="divide-y divide-card-border/60 border border-card-border/80 rounded-xl overflow-hidden bg-accent/15 max-h-48 overflow-y-auto custom-scrollbar">
                {eligibilityAnalysis.map(({ release, isEligible, daysRemaining, eligibleDateStr }) => (
                  <div key={release.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          (release.releaseType || 'Production') === 'UAT' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25' :
                          (release.releaseType || 'Production') === 'Hotfix' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' :
                          'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                        }`}>
                          {release.releaseType || 'Production'}
                        </span>
                        <p className="font-bold text-foreground truncate">{release.name}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Date: {release.releaseDate} &bull; Status: <strong className="text-foreground">{release.status}</strong>
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {isEligible ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Eligible (&ge; 7 days)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full" title={`Eligible on ${eligibleDateStr}`}>
                          <Clock className="h-3 w-3" />
                          <span>Ineligible ({daysRemaining}d left)</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ineligible Alert & Admin Override */}
            {!allEligible && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{ineligibleCount} record(s) have not reached the 7-day retention period</span>
                </div>
                <p className="text-[11px] text-foreground leading-relaxed">
                  Before 7 days, normal deletion is restricted to preserve QA history and audit traces.
                </p>

                {isSuperAdmin ? (
                  <div className="pt-2 border-t border-amber-500/20">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none text-foreground">
                      <input
                        type="checkbox"
                        checked={adminOverrideCheckbox}
                        onChange={(e) => setAdminOverrideCheckbox(e.target.checked)}
                        className="mt-0.5 rounded border-amber-500 text-rose-600 focus:ring-rose-500"
                      />
                      <span className="font-bold text-[11px] text-amber-300">
                        Administrator Force Override: I explicitly authorize immediate hard deletion before the 7-day retention period has elapsed.
                      </span>
                    </label>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    Only authorized Administrators can override the 7-day retention rule.
                  </p>
                )}
              </div>
            )}

            {/* Optional Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">
                Cleanup / Deletion Reason (Optional):
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Routine 7-day cleanup of verified terminal release"
                className="w-full px-3.5 py-2 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              />
            </div>

            {/* Hard Delete Confirmation Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 hover:bg-rose-500/10 transition-colors">
                <input
                  type="checkbox"
                  checked={confirmedCheckbox}
                  onChange={(e) => setConfirmedCheckbox(e.target.checked)}
                  className="mt-0.5 rounded border-card-border text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-[11px] text-foreground font-semibold leading-relaxed">
                  I confirm the permanent hard deletion of the selected release records. All original developer tasks, projects, and users remain intact.
                </span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-card-border bg-card/60">
            <button
              type="button"
              onClick={onClose}
              disabled={processingState !== 'idle'}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!canProceed || processingState !== 'idle'}
              onClick={handleExecuteDelete}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-rose-600/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {processingState === 'deleting' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Deleting Records...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Hard Delete {count} Record{count === 1 ? '' : 's'}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
