'use client';

import React from 'react';
import { TaskStatus } from '@/types';
import { cn } from '@/utils';

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config: Record<TaskStatus, { color: string; label: string }> = {
    'assigned': {
      color: 'bg-slate-500/10 text-slate-600 border-slate-500/25 dark:text-slate-400',
      label: 'Assigned',
    },
    'in-progress': {
      color: 'bg-blue-500/10 text-blue-600 border-blue-500/25 dark:text-blue-400',
      label: 'In Progress',
    },
    'supplier-pending': {
      color: 'bg-orange-500/10 text-orange-600 border-orange-500/25 dark:text-orange-400',
      label: 'Supplier Pending',
    },
    'development-completed': {
      color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/25 dark:text-indigo-400',
      label: 'Dev Completed',
    },
    'code-review': {
      color: 'bg-purple-500/10 text-purple-600 border-purple-500/25 dark:text-purple-400',
      label: 'Code Review',
    },
    'testing': {
      color: 'bg-violet-500/10 text-violet-600 border-violet-500/25 dark:text-violet-400',
      label: 'Testing',
    },
    'uat': {
      color: 'bg-pink-500/10 text-pink-600 border-pink-500/25 dark:text-pink-400',
      label: 'UAT',
    },
    'ready-for-deployment': {
      color: 'bg-teal-500/10 text-teal-600 border-teal-500/25 dark:text-teal-400',
      label: 'Ready for Deploy',
    },
    'deployed': {
      color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/25 dark:text-cyan-400',
      label: 'Deployed',
    },
    'moved-to-live': {
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-400',
      label: 'Moved to Live',
    },
    'completed': {
      color: 'bg-green-500/10 text-green-600 border-green-500/25 dark:text-green-400',
      label: 'Completed',
    },
    'blocked': {
      color: 'bg-red-500/10 text-red-600 border-red-500/25 dark:text-red-400',
      label: 'Blocked',
    },
    'on-hold': {
      color: 'bg-amber-500/10 text-amber-600 border-amber-500/25 dark:text-amber-400',
      label: 'On Hold',
    },
    'cancelled': {
      color: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/25 dark:text-zinc-400',
      label: 'Cancelled',
    },
  };

  const current = config[status] || { color: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/25', label: status };

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border select-none whitespace-nowrap",
      current.color,
      className
    )}>
      {current.label}
    </span>
  );
}
