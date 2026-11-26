'use client';

import React, { useState, useId, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ListPlus, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Sparkles, 
  Copy, 
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ChangeChecklistItem } from '@/types';

interface BulkAddPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPoints: (points: string[]) => void;
  existingPoints: ChangeChecklistItem[];
}

/**
 * Clean a single line of pasted text:
 * - Strips numbered list markers: "1.", "1)", "(1)", "[1]", "1 -", "1:"
 * - Strips bullet symbols: -, *, •, –, —, ▪, ▫, ◦, +, >
 * - Strips spreadsheet/Excel wrapping quotes
 * - Preserves interior hyphens and punctuation
 */
export function cleanPastedLine(raw: string): string {
  let s = raw.trim();
  if (!s) return '';

  // Remove Excel/CSV cell wrapping quotes if present
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  if (!s) return '';

  // Strip numbering prefixes: "1.", "1)", "(1)", "[1]", "1 -", "1:"
  s = s.replace(/^(?:\(?\d+[\.\)\:\-]\s*|\[\d+\]\s*)/i, '').trim();

  // Strip bullet markers: -, *, •, –, —, ▪, ▫, ◦, +, >
  s = s.replace(/^[-*•–—▪▫◦\+>]\s*/, '').trim();

  // Secondary pass in case of combined prefix like "1. - Text"
  s = s.replace(/^[-*•–—▪▫◦\+>]\s*/, '').trim();

  return s;
}

/**
 * Parse bulk multiline text into valid unique points and detected duplicates
 */
export function parseBulkText(
  rawText: string,
  existingPoints: ChangeChecklistItem[]
): {
  validPoints: string[];
  duplicatesInPasted: string[];
  duplicatesInExisting: string[];
} {
  const lines = rawText.split(/\r?\n/);
  const existingSet = new Set<string>();

  existingPoints.forEach(p => {
    if (p.text) existingSet.add(p.text.trim().toLowerCase());
    if (p.taskTitle) existingSet.add(p.taskTitle.trim().toLowerCase());
  });

  const validPoints: string[] = [];
  const seenInPasted = new Set<string>();
  const seenDuplicatesPasted = new Set<string>();
  const seenDuplicatesExisting = new Set<string>();
  const duplicatesInPasted: string[] = [];
  const duplicatesInExisting: string[] = [];

  for (const rawLine of lines) {
    const cleaned = cleanPastedLine(rawLine);
    if (!cleaned) continue;

    const normalized = cleaned.toLowerCase();

    // Check if already in the existing checklist form
    if (existingSet.has(normalized)) {
      if (!seenDuplicatesExisting.has(normalized)) {
        seenDuplicatesExisting.add(normalized);
        duplicatesInExisting.push(cleaned);
      }
      continue;
    }

    // Check if already in this pasted batch
    if (seenInPasted.has(normalized)) {
      if (!seenDuplicatesPasted.has(normalized)) {
        seenDuplicatesPasted.add(normalized);
        duplicatesInPasted.push(cleaned);
      }
      continue;
    }

    seenInPasted.add(normalized);
    validPoints.push(cleaned);
  }

  return { validPoints, duplicatesInPasted, duplicatesInExisting };
}

export default function BulkAddPointsModal({
  isOpen,
  onClose,
  onAddPoints,
  existingPoints
}: BulkAddPointsModalProps) {
  const [inputText, setInputText] = useState('');
  const [previewPoints, setPreviewPoints] = useState<string[]>([]);
  const [duplicatesPasted, setDuplicatesPasted] = useState<string[]>([]);
  const [duplicatesExisting, setDuplicatesExisting] = useState<string[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);

  // Re-parse when inputText or existingPoints changes
  useEffect(() => {
    if (!isOpen) return;
    const { validPoints, duplicatesInPasted, duplicatesInExisting } = parseBulkText(
      inputText,
      existingPoints
    );
    setPreviewPoints(validPoints);
    setDuplicatesPasted(duplicatesInPasted);
    setDuplicatesExisting(duplicatesInExisting);
  }, [inputText, existingPoints, isOpen]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setInputText('');
      setPreviewPoints([]);
      setDuplicatesPasted([]);
      setDuplicatesExisting([]);
      setShowDuplicates(false);
    }
  }, [isOpen]);

  const handleEditPoint = (index: number, newText: string) => {
    setPreviewPoints(prev => {
      const copy = [...prev];
      copy[index] = newText;
      return copy;
    });
  };

  const handleRemovePoint = (index: number) => {
    setPreviewPoints(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setInputText('');
    setPreviewPoints([]);
    setDuplicatesPasted([]);
    setDuplicatesExisting([]);
  };

  const handleAddAll = () => {
    // Filter out any empty items the user might have cleared in the preview
    const finalPoints = previewPoints.map(p => p.trim()).filter(Boolean);
    if (finalPoints.length === 0) return;
    onAddPoints(finalPoints);
  };

  const totalDuplicates = duplicatesPasted.length + duplicatesExisting.length;

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
                <ListPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Bulk Add Verification Points
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Paste multiple checklist items below. Each non-empty line will be added as a separate verification point.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 max-h-[calc(88vh-8rem)] overflow-y-auto custom-scrollbar">
            {/* Input Textarea Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Paste Checklist Content <span className="text-destructive">*</span>
                </label>
                {inputText && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Paste lines from ChatGPT, Excel, Word or Notepad...\n\nExample:\nBus Booking - Successful Booking\nBus Booking - Failed Booking\nBus Booking - Cancellation\nHotel Booking - Successful Booking\nHotel Booking - Failed Booking\nHotel Booking - Cancellation\nFlight Booking - Successful Booking`}
                rows={7}
                className="w-full px-3.5 py-2.5 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs font-mono leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-y custom-scrollbar"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Numbers (1., 2.), bullets (-, *, •), and Windows/Unix line breaks are automatically handled.</span>
                <span className="font-semibold text-foreground/80">{inputText ? `${inputText.split(/\r?\n/).filter(l => l.trim()).length} line(s) entered` : ''}</span>
              </p>
            </div>

            {/* Duplicate Notice Banner (if any) */}
            {totalDuplicates > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-500 font-semibold">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      {totalDuplicates} duplicate point{totalDuplicates > 1 ? 's' : ''} detected & excluded
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDuplicates(prev => !prev)}
                    className="text-[11px] text-amber-500 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>{showDuplicates ? 'Hide details' : 'View duplicates'}</span>
                    {showDuplicates ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {showDuplicates && (
                  <div className="pt-2 border-t border-amber-500/20 space-y-2 text-[11px]">
                    {duplicatesPasted.length > 0 && (
                      <div>
                        <p className="font-bold text-amber-600 dark:text-amber-400">Repeated in pasted content ({duplicatesPasted.length}):</p>
                        <ul className="list-disc list-inside text-muted-foreground pl-1 space-y-0.5 mt-0.5">
                          {duplicatesPasted.map((dup, i) => (
                            <li key={i} className="truncate">{dup}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {duplicatesExisting.length > 0 && (
                      <div>
                        <p className="font-bold text-amber-600 dark:text-amber-400">Already in current checklist ({duplicatesExisting.length}):</p>
                        <ul className="list-disc list-inside text-muted-foreground pl-1 space-y-0.5 mt-0.5">
                          {duplicatesExisting.map((dup, i) => (
                            <li key={i} className="truncate">{dup}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Live Preview Section */}
            <div className="space-y-2.5 pt-2 border-t border-card-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-foreground">
                    Preview Checklist Points
                  </h3>
                  {previewPoints.length > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                      {previewPoints.length} point{previewPoints.length > 1 ? 's' : ''} detected
                    </span>
                  )}
                </div>
                {previewPoints.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    You can edit or remove points before adding
                  </p>
                )}
              </div>

              {previewPoints.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-card-border bg-accent/10 space-y-1.5">
                  <ListPlus className="h-7 w-7 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-bold text-foreground">
                    {inputText.trim() ? 'No valid new points found' : 'No points to preview'}
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                    {inputText.trim() 
                      ? 'All entered lines were either empty or duplicates of existing points.' 
                      : 'Paste your checklist points into the box above to preview and edit them.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-0.5">
                  {previewPoints.map((pointText, index) => (
                    <div 
                      key={index}
                      className="p-2 rounded-xl bg-card/60 border border-card-border flex items-center gap-2 text-xs group hover:border-primary/30 transition-colors"
                    >
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={pointText}
                        onChange={(e) => handleEditPoint(index, e.target.value)}
                        className="flex-1 bg-transparent px-2 py-1 text-xs text-foreground font-medium focus:outline-none focus:bg-accent/40 rounded transition-colors"
                        placeholder="Verification point text..."
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePoint(index)}
                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer shrink-0"
                        title="Remove point from preview"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-card-border/60 bg-card/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddAll}
              disabled={previewPoints.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-primary/20"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Add All Points ({previewPoints.length})</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
