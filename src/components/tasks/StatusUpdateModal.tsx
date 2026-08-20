'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle2, ArrowRight, Loader2, MessageSquare } from 'lucide-react';
import { Task, TaskStatus } from '@/types';
import { TASK_STATUS_CONFIG } from '@/constants';
import StatusBadge from './StatusBadge';

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  targetStatus: TaskStatus | null;
  onConfirm: (targetStatus: TaskStatus, comment: string) => Promise<void>;
}

export default function StatusUpdateModal({
  isOpen,
  onClose,
  task,
  targetStatus,
  onConfirm,
}: StatusUpdateModalProps) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRejection = targetStatus === 'uat-rejected';
  const MAX_CHAR_COUNT = 1000;

  useEffect(() => {
    if (isOpen) {
      setComment('');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen, targetStatus]);

  if (!isOpen || !task || !targetStatus) return null;

  const prevStatus = task.status;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const trimmed = comment.trim();
    if (isRejection && !trimmed) {
      setError('Please provide a reason for UAT rejection.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onConfirm(targetStatus, trimmed);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update task status.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div key="status-update-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          key="status-update-modal-panel"
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-5 py-4 border-b ${
            isRejection ? 'bg-rose-950/30 border-rose-900/40' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                isRejection ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-primary/20 text-primary border border-primary/30'
              }`}>
                {isRejection ? <AlertCircle className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">
                  {isRejection ? 'UAT Rejected' : 'Update Task Status'}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                  {task.taskId} · {task.projectName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Task Info & Status Transition Preview */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-white line-clamp-1">{task.title}</p>
              
              <div className="flex items-center gap-2 pt-1">
                <StatusBadge status={prevStatus} />
                <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                <StatusBadge status={targetStatus} />
              </div>
            </div>

            {/* Comment / Reason Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  {isRejection ? (
                    <span>Reason for Rejection <span className="text-rose-400">*</span></span>
                  ) : (
                    <span>Update Notes / Remarks <span className="text-slate-500 text-[10px] font-normal lowercase">(optional)</span></span>
                  )}
                </label>
                <span className={`text-[10px] ${comment.length > MAX_CHAR_COUNT ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                  {comment.length}/{MAX_CHAR_COUNT}
                </span>
              </div>

              <textarea
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (error) setError('');
                }}
                maxLength={MAX_CHAR_COUNT}
                rows={4}
                placeholder={
                  isRejection
                    ? 'Explain why the UAT deployment was rejected (e.g. API returning 500 errors, layout mismatch, broken flow)...'
                    : 'Add any remarks or context for this status update...'
                }
                autoFocus
                className={`w-full px-3.5 py-2.5 bg-slate-950/80 border rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none transition-all resize-none ${
                  error
                    ? 'border-rose-500/70 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                    : 'border-slate-700/80 focus:border-primary focus:ring-1 focus:ring-primary/25'
                }`}
              />

              {error && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium pt-0.5">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{error}</span>
                </p>
              )}
            </div>

            {/* Notice */}
            <p className="text-[10px] text-slate-500 leading-relaxed">
              {isRejection ? (
                <span>This rejection reason will be saved in the task timeline and emailed to all assigned team members.</span>
              ) : (
                <span>All assignees will receive a real-time notification and email update.</span>
              )}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || (isRejection && !comment.trim())}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                  isRejection
                    ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    {isRejection ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>{isRejection ? 'Reject Task' : 'Update Status'}</span>
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
