'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  Sparkles, 
  User, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  MessageSquare, 
  Send,
  Layers,
  Check,
  X,
  ExternalLink,
  Tag
} from 'lucide-react';
import { ProductionRelease, ReleaseChangeItem, getReleaseItemPoints } from '@/types';
import { dbService } from '@/services/dbService';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/utils';
import toast from 'react-hot-toast';

interface ReleaseVerificationViewProps {
  release: ProductionRelease;
  onUpdate?: () => void;
  onBack?: () => void;
}

export default function ReleaseVerificationView({
  release,
  onUpdate,
  onBack
}: ReleaseVerificationViewProps) {
  const { user } = useAuth();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    new Set(release.items.map(it => it.changeChecklistId))
  );

  // Rejection Dialog State
  const [rejectingItem, setRejectingItem] = useState<ReleaseChangeItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [failedPointIdx, setFailedPointIdx] = useState<number | undefined>(undefined);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Update item verification point status (Pending | Passed | Failed)
  const handleItemStatusToggle = async (
    checklistId: string,
    itemId: string,
    newStatus: 'Pending' | 'Passed' | 'Failed'
  ) => {
    if (!release.id || !user) return;
    try {
      const qaUser = user.email.toLowerCase();
      const qaUserName = user.displayName || user.email.split('@')[0];
      await dbService.updateReleaseItemVerification(
        release.id, 
        checklistId, 
        itemId, 
        newStatus,
        qaUser,
        qaUserName
      );
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error('Failed to update verification status:', err);
      toast.error('Failed to update verification item');
    }
  };

  // Complete an entire change (only if all points are passed)
  const handleCompleteChange = async (item: ReleaseChangeItem) => {
    if (!release.id || !user) return;

    const points = getReleaseItemPoints(item);
    const hasUnpassed = points.some(v => v.status !== 'Passed');
    if (hasUnpassed) {
      toast.error('All verification points must be marked "Passed" before completing this change.');
      return;
    }

    setActionLoadingId(item.changeChecklistId);
    try {
      const qaUser = user.email.toLowerCase();
      const qaUserName = user.displayName || user.email.split('@')[0];
      await dbService.completeReleaseChangeItem(release.id, item.changeChecklistId, qaUser, qaUserName);
      toast.success(`Change "${item.title}" successfully verified and completed!`);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error('Failed to complete change:', err);
      toast.error(err?.message || 'Failed to complete change');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Rejection Modal
  const openRejectModal = (item: ReleaseChangeItem, pointIndex?: number) => {
    setRejectingItem(item);
    setFailedPointIdx(pointIndex);
    setRejectionReason('');
  };

  // Submit Rejection
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!release.id || !rejectingItem || !user) return;

    const cleanReason = rejectionReason.trim();
    if (!cleanReason) {
      toast.error('Please specify what is not working and what needs correction.');
      return;
    }

    const points = getReleaseItemPoints(rejectingItem);
    const failedText = failedPointIdx !== undefined && points[failedPointIdx] 
      ? points[failedPointIdx].text 
      : undefined;

    setActionLoadingId(rejectingItem.changeChecklistId);
    try {
      const qaUser = user.email.toLowerCase();
      const qaUserName = user.displayName || user.email.split('@')[0];
      await dbService.rejectReleaseChangeItem(
        release.id,
        rejectingItem.changeChecklistId,
        cleanReason,
        qaUser,
        qaUserName,
        failedPointIdx,
        failedText
      );

      toast.error(`Change "${rejectingItem.title}" marked as Rejected by QA.`);
      setRejectingItem(null);
      setRejectionReason('');
      setFailedPointIdx(undefined);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error('Failed to reject change:', err);
      toast.error(err?.message || 'Failed to reject change');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: ReleaseChangeItem['status']) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/25">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-500 border border-rose-500/25">
            <XCircle className="h-3 w-3" />
            Rejected by QA
          </span>
        );
      case 'Pending QA':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/25">
            <Clock className="h-3 w-3" />
            Pending QA
          </span>
        );
    }
  };

  const totalItems = release.items.length;
  const completedCount = release.items.filter(it => it.status === 'Completed').length;
  const rejectedCount = release.items.filter(it => it.status === 'Rejected').length;
  const pendingCount = release.items.filter(it => it.status === 'Pending QA').length;

  return (
    <div className="space-y-6">
      {/* Top Banner with Release Summary */}
      <div className="glass-panel p-5 rounded-2xl border border-card-border bg-card/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 mr-2 cursor-pointer"
              >
                &larr; All Releases
              </button>
            )}
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-purple-500/15 text-purple-400 border border-purple-500/25">
              Production Release
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
              release.status === 'Completed' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25' :
              release.status === 'Partially Rejected' ? 'bg-rose-500/15 text-rose-500 border border-rose-500/25' :
              'bg-blue-500/15 text-blue-500 border border-blue-500/25'
            }`}>
              {release.status}
            </span>
          </div>

          <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
            {release.name}
          </h1>

          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Target Date: <strong className="text-foreground">{release.releaseDate}</strong>
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              Created by: <strong className="text-foreground">{release.createdByName}</strong>
            </span>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <div className="px-3 py-1.5 rounded-xl bg-card border border-card-border text-center">
            <p className="text-[10px] text-muted-foreground font-bold uppercase">Total Changes</p>
            <p className="text-sm font-black text-foreground">{totalItems}</p>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-[10px] text-emerald-500 font-bold uppercase">Passed</p>
            <p className="text-sm font-black text-emerald-500">{completedCount}</p>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
            <p className="text-[10px] text-rose-500 font-bold uppercase">Rejected</p>
            <p className="text-sm font-black text-rose-500">{rejectedCount}</p>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-[10px] text-amber-500 font-bold uppercase">Pending</p>
            <p className="text-sm font-black text-amber-500">{pendingCount}</p>
          </div>
        </div>
      </div>

      {/* Included Project Changes List */}
      <div className="space-y-4">
        {release.items.map((item, itemIdx) => {
          const isExpanded = expandedItems.has(item.changeChecklistId);
          const points = getReleaseItemPoints(item);
          const allItemsPassed = points.length > 0 && points.every(v => v.status === 'Passed');
          const isDecided = item.status === 'Completed' || item.status === 'Rejected';
          const isLoading = actionLoadingId === item.changeChecklistId;

          return (
            <div 
              key={item.changeChecklistId}
              className={`glass-panel rounded-2xl border transition-all overflow-hidden ${
                item.status === 'Completed' ? 'border-emerald-500/30 bg-card/40' :
                item.status === 'Rejected' ? 'border-rose-500/30 bg-card/40' :
                'border-card-border bg-card/80 shadow-md'
              }`}
            >
              {/* Change Item Card Header */}
              <div 
                onClick={() => toggleExpand(item.changeChecklistId)}
                className="p-4 sm:p-5 flex items-start justify-between gap-3 cursor-pointer select-none hover:bg-accent/20 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {itemIdx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[11px] font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                        {item.projectName}
                      </span>
                      {getStatusBadge(item.status)}
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.developerName}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-foreground leading-snug">
                      {item.title}
                    </h3>

                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-center">
                  <button
                    type="button"
                    className="p-1 rounded text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Collapsible Content */}
              {isExpanded && (
                <div className="px-4 sm:px-5 pb-5 pt-1 space-y-4 border-t border-card-border/60">
                  {/* Rejection notice if this item was rejected in this release */}
                  {item.status === 'Rejected' && item.rejectionReason && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs space-y-1">
                      <div className="flex items-center gap-2 text-rose-500 font-bold">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>Rejection Reason:</span>
                      </div>
                      <p className="text-foreground pl-6 font-medium leading-relaxed">
                        "{item.rejectionReason}"
                      </p>
                      <p className="text-[10px] text-muted-foreground pl-6 pt-0.5">
                        Recorded by {item.qaUserName} on {item.qaDate ? formatDate(item.qaDate) : 'recently'}.
                      </p>
                    </div>
                  )}

                  {/* Single Common Section: Changes / Verification Points */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        Changes / Verification Points ({points.length} points)
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        {points.filter(v => v.status === 'Passed').length} of {points.length} passed
                      </span>
                    </div>

                    <div className="space-y-2">
                      {points.map((vItem, vIdx) => {
                        const isPassed = vItem.status === 'Passed';
                        const isFailed = vItem.status === 'Failed';
                        const isPending = vItem.status === 'Pending';

                        return (
                          <div 
                            key={vItem.id || vIdx}
                            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                              isPassed ? 'bg-emerald-500/[0.06] border-emerald-500/25' :
                              isFailed ? 'bg-rose-500/[0.06] border-rose-500/25' :
                              'bg-accent/20 border-card-border/60'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                                isPassed ? 'bg-emerald-500/20 text-emerald-500' :
                                isFailed ? 'bg-rose-500/20 text-rose-500' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {vIdx + 1}
                              </span>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {vItem.taskId ? (
                                    <>
                                      <span className="font-mono font-bold text-[11px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                                        {vItem.taskId}
                                      </span>
                                      {vItem.taskModule && (
                                        <span className="text-[10px] font-medium text-muted-foreground bg-accent/40 px-1.5 py-0.5 rounded border border-card-border/60">
                                          {vItem.taskModule}
                                        </span>
                                      )}
                                      {vItem.taskDocId && (
                                        <a
                                          href={`/dashboard/tasks/${vItem.taskDocId}`}
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

                                  {vItem.developerCompleted && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded">
                                      <CheckCircle2 className="h-2.5 w-2.5" />
                                      <span>Developer Verified</span>
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-foreground font-medium leading-relaxed">
                                  {vItem.text}
                                </p>

                                {/* Developer Comment if provided */}
                                {vItem.developerComment && (
                                  <div className="p-2 rounded-lg bg-card/60 border border-card-border/80 text-[11px] text-foreground/90 flex items-start gap-1.5 mt-1">
                                    <MessageSquare className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold text-muted-foreground text-[10px] block uppercase">Developer Comment:</span>
                                      <span>{vItem.developerComment}</span>
                                    </div>
                                  </div>
                                )}

                                {vItem.qaUserName && vItem.status !== 'Pending' && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    QA Verified by {vItem.qaUserName} {vItem.qaDate ? `(${formatDate(vItem.qaDate)})` : ''}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* QA Toggle Actions for this item */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              <button
                                type="button"
                                disabled={isDecided}
                                onClick={() => handleItemStatusToggle(item.changeChecklistId, vItem.id, 'Passed')}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                                  isPassed 
                                    ? 'bg-emerald-500 text-white shadow-xs' 
                                    : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20'
                                }`}
                                title="Mark Passed"
                              >
                                <Check className="h-3 w-3" />
                                <span>Passed</span>
                              </button>

                              <button
                                type="button"
                                disabled={isDecided}
                                onClick={() => {
                                  handleItemStatusToggle(item.changeChecklistId, vItem.id, 'Failed');
                                  openRejectModal(item, vIdx);
                                }}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                                  isFailed 
                                    ? 'bg-rose-500 text-white shadow-xs' 
                                    : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20'
                                }`}
                                title="Mark Failed & Reject"
                              >
                                <X className="h-3 w-3" />
                                <span>Failed</span>
                              </button>

                              {!isPending && !isDecided && (
                                <button
                                  type="button"
                                  onClick={() => handleItemStatusToggle(item.changeChecklistId, vItem.id, 'Pending')}
                                  className="text-[10px] text-muted-foreground hover:text-foreground font-medium px-1 cursor-pointer"
                                  title="Reset to Pending"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 2: Overall Change Actions */}
                  {!isDecided ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-card-border/60">
                      <div className="text-[11px] text-muted-foreground">
                        {allItemsPassed ? (
                          <span className="text-emerald-500 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            All change points passed! Ready to complete.
                          </span>
                        ) : (
                          <span>Mark all points Passed to enable completion, or Reject if any point fails.</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 self-end sm:self-center">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => openRejectModal(item)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold transition-all border border-rose-500/25 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Reject Change</span>
                        </button>

                        <button
                          type="button"
                          disabled={!allItemsPassed || isLoading}
                          onClick={() => handleCompleteChange(item)}
                          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                            allItemsPassed 
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-600/20' 
                              : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                          }`}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Complete Change</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-accent/20 border border-card-border/60 text-xs flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Verification concluded by <strong className="text-foreground">{item.qaUserName}</strong> on {item.qaDate ? formatDate(item.qaDate) : 'recently'}.
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mandatory Rejection Dialog Modal */}
      <AnimatePresence>
        {rejectingItem && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none"
            onClick={() => setRejectingItem(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md bg-card border border-card-border rounded-2xl shadow-2xl p-6 text-left space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-500 shrink-0">
                  <XCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-foreground">Reject Change</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {rejectingItem.title}
                  </p>
                </div>
              </div>

              {failedPointIdx !== undefined && getReleaseItemPoints(rejectingItem)[failedPointIdx] && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                  <p className="text-[10px] font-bold uppercase text-rose-400">Failed Point #{failedPointIdx + 1}:</p>
                  <p className="text-foreground font-medium">"{getReleaseItemPoints(rejectingItem)[failedPointIdx].text}"</p>
                </div>
              )}

              <form onSubmit={handleConfirmReject} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5 text-rose-500" />
                    Mandatory Rejection Reason <span className="text-destructive">*</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Explain what failed and what needs correction by the developer:
                  </p>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    required
                    placeholder="e.g. Trace ID is not being propagated from the Supplier API to the Consolidation API. The Trace ID is missing in the supplier error logs."
                    className="w-full px-3 py-2.5 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-card-border/60">
                  <button
                    type="button"
                    onClick={() => setRejectingItem(null)}
                    disabled={actionLoadingId !== null}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoadingId !== null || !rejectionReason.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-rose-600/20"
                  >
                    {actionLoadingId ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Rejecting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Confirm Rejection</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
