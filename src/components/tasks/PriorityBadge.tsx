'use client';

import React from 'react';
import { TaskPriority } from '@/types';
import { cn } from '@/utils';
import { ShieldAlert, AlertTriangle, ArrowDown, HelpCircle } from 'lucide-react';

interface PriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
  showIcon?: boolean;
}

export default function PriorityBadge({ priority, className, showIcon = true }: PriorityBadgeProps) {
  const config = {
    critical: {
      color: 'bg-red-500/10 text-red-500 border-red-500/20 dark:bg-red-500/15',
      icon: ShieldAlert,
      label: 'Critical',
    },
    high: {
      color: 'bg-orange-500/10 text-orange-500 border-orange-500/20 dark:bg-orange-500/15',
      icon: AlertTriangle,
      label: 'High',
    },
    medium: {
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/20 dark:bg-blue-500/15',
      icon: HelpCircle,
      label: 'Medium',
    },
    low: {
      color: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/25 dark:bg-zinc-500/15',
      icon: ArrowDown,
      label: 'Low',
    },
  };

  const current = config[priority] || config.low;
  const Icon = current.icon;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border select-none",
      current.color,
      className
    )}>
      {showIcon && <Icon className="h-3 w-3" />}
      <span>{current.label}</span>
    </span>
  );
}
