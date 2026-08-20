'use client';

import React from 'react';
import { TaskStatus } from '@/types';
import { TASK_STATUS_CONFIG } from '@/constants';
import { cn } from '@/utils';

interface StatusBadgeProps {
  status: TaskStatus | string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const conf = TASK_STATUS_CONFIG[status] || {
    label: typeof status === 'string' ? status.replace(/-/g, ' ') : 'Unknown',
    badgeBg: 'bg-zinc-500/10',
    badgeColor: 'text-zinc-400',
    badgeBorder: 'border-zinc-500/25',
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border select-none whitespace-nowrap",
        conf.badgeBg,
        conf.badgeColor,
        conf.badgeBorder,
        className
      )}
    >
      {conf.label}
    </span>
  );
}
