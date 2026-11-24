'use client';

import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/utils';

export interface PaginationControlsProps {
  currentPage: number; // 0-indexed pageIndex
  pageCount: number;   // Total number of pages
  totalItems: number;  // Total matching items
  onPageChange: (pageIndex: number) => void;
  canPreviousPage: boolean;
  canNextPage: boolean;
  className?: string;
  itemLabel?: string;
}

/**
 * Returns a windowed array of page indices (0-indexed) with 'ellipsis' placeholders
 * for scalable, readable pagination across large datasets (e.g. 15+ pages).
 */
export function getPaginationWindow(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const pages: (number | 'ellipsis')[] = [];

  if (currentPage <= 3) {
    // Near start: 0, 1, 2, 3, 4, ..., totalPages - 1
    for (let i = 0; i <= 4; i++) pages.push(i);
    pages.push('ellipsis');
    pages.push(totalPages - 1);
  } else if (currentPage >= totalPages - 4) {
    // Near end: 0, ..., totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1
    pages.push(0);
    pages.push('ellipsis');
    for (let i = totalPages - 5; i < totalPages; i++) pages.push(i);
  } else {
    // In middle: 0, ..., currentPage - 1, currentPage, currentPage + 1, ..., totalPages - 1
    pages.push(0);
    pages.push('ellipsis');
    pages.push(currentPage - 1);
    pages.push(currentPage);
    pages.push(currentPage + 1);
    pages.push('ellipsis');
    pages.push(totalPages - 1);
  }

  return pages;
}

export default function PaginationControls({
  currentPage,
  pageCount,
  totalItems,
  onPageChange,
  canPreviousPage,
  canNextPage,
  className,
  itemLabel = 'task'
}: PaginationControlsProps) {
  const safePageCount = Math.max(1, pageCount);
  const pages = getPaginationWindow(currentPage, safePageCount);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 bg-card/40 border border-card-border rounded-xl backdrop-blur-md select-none pr-4 md:pr-24",
        className
      )}
    >
      <span className="text-xs text-muted-foreground font-medium">
        Page {currentPage + 1} of {safePageCount} ({totalItems} {totalItems === 1 ? itemLabel : `${itemLabel}s`} matching)
      </span>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canPreviousPage}
          className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg bg-card/60 hover:bg-accent/50 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-all shadow-sm"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Numbered Page Buttons with Smart Windowing */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-7 h-7 flex items-center justify-center text-xs text-muted-foreground/60 select-none font-bold"
                >
                  ...
                </span>
              );
            }

            const isCurrent = currentPage === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  "w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  isCurrent
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "bg-card/40 hover:bg-accent/40 text-muted-foreground hover:text-foreground border border-border/50"
                )}
                aria-label={`Go to page ${p + 1}`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {p + 1}
              </button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canNextPage}
          className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg bg-card/60 hover:bg-accent/50 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-all shadow-sm"
          title="Next Page"
          aria-label="Next Page"
        >
          <span className="hidden sm:inline">Next</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
