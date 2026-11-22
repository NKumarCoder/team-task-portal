'use client';

import React from 'react';
import { IssueType } from '@/types';
import { ISSUE_TYPE_CONFIG } from '@/constants';
import { cn } from '@/utils';
import { Bug, CheckSquare, Bookmark, Layers, HelpCircle } from 'lucide-react';

interface IssueTypeBadgeProps {
  issueType?: IssueType | string | null;
  className?: string;
  showIcon?: boolean;
}

export default function IssueTypeBadge({
  issueType,
  className,
  showIcon = true
}: IssueTypeBadgeProps) {
  const normalizedType: IssueType = (
    issueType === 'Bug' || issueType === 'Story' || issueType === 'Epic' || issueType === 'Task'
  ) ? issueType : 'Task';

  const conf = ISSUE_TYPE_CONFIG[normalizedType] || ISSUE_TYPE_CONFIG['Task'];

  const renderIcon = () => {
    switch (normalizedType) {
      case 'Bug':
        return <Bug className="h-3 w-3 shrink-0" />;
      case 'Story':
        return <Bookmark className="h-3 w-3 shrink-0" />;
      case 'Epic':
        return <Layers className="h-3 w-3 shrink-0" />;
      case 'Task':
      default:
        return <CheckSquare className="h-3 w-3 shrink-0" />;
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border select-none whitespace-nowrap",
        conf.badgeBg,
        conf.badgeColor,
        conf.badgeBorder,
        className
      )}
      title={`Issue Type: ${conf.label}`}
    >
      {showIcon && renderIcon()}
      <span>{conf.label}</span>
    </span>
  );
}
