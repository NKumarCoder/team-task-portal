'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Trash2, 
  Mail, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert, 
  FileText,
  Calendar,
  Layers,
  RefreshCw,
  KeyRound
} from 'lucide-react';
import { ProductionRelease } from '@/types';
import { dbService } from '@/services/dbService';
import { sendReleaseArchiveEmail, checkSmtpStatus, SendArchiveEmailResult } from '@/services/emailArchiveService';
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
  const [reason, setReason] = useState('');
  const [extraEmail, setExtraEmail] = useState('');
  const [processingState, setProcessingState] = useState<'idle' | 'archiving' | 'deleting' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cachedArchiveResult, setCachedArchiveResult] = useState<SendArchiveEmailResult | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean; connected?: boolean; missing?: string[]; error?: string } | null>(null);
  const [checkingSmtp, setCheckingSmtp] = useState(false);

  // Check SMTP configuration when dialog opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setConfirmedCheckbox(false);
      setCachedArchiveResult(null);
      checkConfig();
    }
  }, [isOpen]);

  const checkConfig = async () => {
    setCheckingSmtp(true);
    try {
      const status = await checkSmtpStatus();
      setSmtpStatus(status);
    } catch {
      setSmtpStatus({ configured: false, error: 'Could not connect to verification endpoint.' });
    } finally {
      setCheckingSmtp(false);
    }
  };

  if (!isOpen || releasesToDelete.length === 0) return null;

  const count = releasesToDelete.length;
  const isMultiple = count > 1;

  const title = isDeleteAll 
    ? 'Delete All Completed Release Verifications?' 
    : isMultiple 
      ? `Delete ${count} Completed Release Verifications?` 
      : `Delete Completed Release: ${releasesToDelete[0].name}?`;

  const deleteMode = isDeleteAll ? 'all' : isMultiple ? 'bulk' : 'individual';

  const userEmail = user?.email || 'admin@apextasks.com';
  const userName = user?.displayName || userEmail.split('@')[0];

  const handleExecuteDelete = async () => {
    if (!confirmedCheckbox) {
      toast.error('Please confirm the archive and deletion checkbox');
      return;
    }

    setErrorMessage(null);

    try {
      // 1. Mandatory Step: Generate & send email archive (or reuse already-sent archive on retry)
      let archiveResult = cachedArchiveResult;
      if (!archiveResult) {
        setProcessingState('archiving');
        const additionalRecipients = extraEmail.trim()
          ? extraEmail.split(/[,;]/).map(e => e.trim()).filter(Boolean)
          : [];

        archiveResult = await sendReleaseArchiveEmail({
          releases: releasesToDelete,
          deleteMode,
          deletedBy: userEmail,
          deletedByName: userName,
          reason: reason.trim() || undefined,
          additionalRecipients
        });
        setCachedArchiveResult(archiveResult);
      }

      // 2. Mandatory Step: Delete records from database only after email confirmation
      setProcessingState('deleting');

      const releaseIds = releasesToDelete.map(r => r.id!).filter(Boolean);
      const deleteResult = await dbService.deleteCompletedProductionReleases({
        releaseIds,
        deletedBy: userEmail,
        deletedByName: userName,
        emailRecipients: archiveResult.recipients,
        emailSubject: archiveResult.subject,
        emailMessageId: archiveResult.messageId,
        reason: reason.trim() || undefined
      });

      setProcessingState('success');
      toast.success(`Successfully archived and deleted ${deleteResult.deletedCount} completed release(s)!`);
      onSuccess(deleteResult.deletedCount);
      onClose();
    } catch (err: any) {
      console.error('Delete execution failed:', err);
      const errMsg = err?.message || 'An unexpected error occurred during email archival or deletion.';
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
                  Permanent cleanup with mandatory email archive
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

            {/* SMTP Missing Configuration Alert */}
            {smtpStatus && !smtpStatus.configured && !cachedArchiveResult && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-amber-400">
                <div className="flex items-center justify-between gap-2 font-bold">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>SMTP Email Delivery Incomplete</span>
                  </div>
                  <button
                    type="button"
                    onClick={checkConfig}
                    disabled={checkingSmtp}
                    className="flex items-center gap-1 text-[10px] text-amber-300 hover:text-white px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`h-3 w-3 ${checkingSmtp ? 'animate-spin' : ''}`} />
                    <span>Check Again</span>
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-foreground/90 font-medium">
                  {smtpStatus.error || 'Server email delivery is not configured.'}
                </p>
                {smtpStatus.missing && smtpStatus.missing.length > 0 && (
                  <div className="text-[10px] bg-background/50 p-2 rounded-lg border border-amber-500/20 space-y-1">
                    <span className="font-semibold text-amber-300">Required variables in .env.local:</span>
                    <ul className="list-disc list-inside space-y-0.5 font-mono text-[10px] text-foreground">
                      {smtpStatus.missing.map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground italic">
                  Safety policy: Release records cannot be deleted until archive transmission is operational.
                </p>
              </div>
            )}

            {/* Reusable archive confirmation on retry */}
            {cachedArchiveResult && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-emerald-400 text-xs">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Email archive verified (Message ID: {cachedArchiveResult.messageId}). Ready to retry deletion.</span>
                </div>
              </div>
            )}

            {/* Email Guarantee Notice */}
            <div className="p-3.5 rounded-xl bg-accent/30 border border-card-border/80 space-y-2">
              <div className="flex items-center gap-2 text-foreground font-bold">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <span>Automatic Historical Email Archive Guarantee</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Before any record is removed, Apex Tasks will transmit a complete HTML email archive detailing the release metadata, linked developer change points, developer notes, and QA verification results. <strong>If email transmission fails, zero records will be deleted.</strong>
              </p>
              <div className="pt-1 text-[11px] text-foreground font-semibold flex items-center gap-2">
                <span>Archive Recipient:</span>
                <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                  {userEmail}
                </span>
              </div>
            </div>

            {/* Releases To Be Deleted Summary */}
            <div className="space-y-1.5">
              <label className="font-bold text-foreground flex items-center justify-between">
                <span>Eligible Completed Release(s) to Delete ({count}):</span>
                <span className="text-[11px] text-emerald-500 font-semibold">100% Completed</span>
              </label>
              <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-accent/20 border border-card-border custom-scrollbar">
                {releasesToDelete.map((rel) => (
                  <div key={rel.id} className="p-2 rounded-lg bg-card/60 border border-card-border/60 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{rel.name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>Date: {rel.releaseDate}</span>
                        <span>&bull;</span>
                        <span>{rel.items?.length || 0} project change(s)</span>
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                      Completed
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Recipient Field */}
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <span>Additional Notification Recipient(s)</span>
                <span className="text-[10px] font-normal text-muted-foreground/60">(Optional, comma separated)</span>
              </label>
              <input
                type="text"
                value={extraEmail}
                onChange={(e) => setExtraEmail(e.target.value)}
                placeholder="e.g. qa-lead@company.com, manager@company.com"
                disabled={processingState !== 'idle'}
                className="w-full px-3 py-2 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              />
            </div>

            {/* Deletion Reason (Optional) */}
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <span>Reason for Deletion</span>
                <span className="text-[10px] font-normal text-muted-foreground/60">(Optional)</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. End-of-cycle cleanup of verified production releases"
                disabled={processingState !== 'idle'}
                className="w-full px-3 py-2 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              />
            </div>

            {/* Confirmation Checkbox */}
            <div className="p-3 rounded-xl bg-rose-500/[0.08] border border-rose-500/20">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmedCheckbox}
                  onChange={(e) => setConfirmedCheckbox(e.target.checked)}
                  disabled={processingState !== 'idle'}
                  className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="text-foreground font-semibold leading-relaxed">
                  I confirm that I want to archive and permanently delete {count === 1 ? 'this completed release record' : `these ${count} completed release records`}. Underlying tasks and projects remain untouched.
                </span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-card-border bg-card/70">
            <div className="text-xs text-muted-foreground">
              {processingState === 'archiving' && (
                <span className="flex items-center gap-1.5 text-primary font-bold">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  1/2 Sending email archive...
                </span>
              )}
              {processingState === 'deleting' && (
                <span className="flex items-center gap-1.5 text-rose-500 font-bold">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  2/2 Purging database records...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={processingState !== 'idle'}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={!confirmedCheckbox || processingState !== 'idle' || (smtpStatus !== null && !smtpStatus.configured && !cachedArchiveResult)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-rose-600/20"
              >
                {processingState !== 'idle' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : cachedArchiveResult ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Retry Purging Records ({count})</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Archive & Delete ({count})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
