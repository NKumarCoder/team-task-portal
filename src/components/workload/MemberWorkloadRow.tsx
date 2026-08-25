'use client';

import React from 'react';
import { MemberProjectWorkload } from '@/utils';
import { ArrowRight, ChevronRight, Clock, AlertTriangle, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

interface MemberWorkloadRowProps {
  workload: MemberProjectWorkload;
  onSelectMember: (workload: MemberProjectWorkload) => void;
}

export default function MemberWorkloadRow({
  workload,
  onSelectMember,
}: MemberWorkloadRowProps) {
  const {
    member,
    totalTasks,
    activeTasks,
    completedTasks,
    nonZeroStatusCounts,
    workloadPoints,
    workloadPercentage,
    statusLabel,
    cardStyle,
    badgeStyle,
    progressColor,
    urgentTask,
    completionRate,
  } = workload;

  // React Key safety: guaranteed non-empty identifier
  const memberKey = member.id || member.email || member.name;

  return (
    <div
      onClick={() => onSelectMember(workload)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectMember(workload);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View workload details for ${member.name}: ${totalTasks} assigned tasks, ${activeTasks} active, ${statusLabel} workload`}
      className={`glass-panel p-4 sm:p-5 rounded-2xl border ${cardStyle} transition-all duration-200 cursor-pointer flex flex-col gap-3.5 group select-none relative focus:outline-none focus:ring-2 focus:ring-primary/40`}
    >
      {/* Top Header: Identity & High-level Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Member Profile */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0 border border-white/10"
            style={{ backgroundColor: member.avatarColor || '#6366f1' }}
          >
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-foreground tracking-tight truncate group-hover:text-primary transition-colors">
                {member.name}
              </h3>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/40 text-muted-foreground border border-border/40 uppercase">
                {member.role === 'SuperAdmin' ? 'Super Admin' : member.role}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium truncate">
              {member.email}
            </p>
          </div>
        </div>

        {/* Workload Indicator Badge & Task Metrics */}
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
          
          {/* Workload State Badge */}
          <div className={`px-2.5 py-1 rounded-full border ${badgeStyle} flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider`}>
            {statusLabel === 'Overloaded' && <ShieldAlert className="h-3 w-3 animate-pulse" />}
            {statusLabel === 'High' && <AlertTriangle className="h-3 w-3" />}
            <span>{statusLabel}</span>
            <span className="opacity-60">•</span>
            <span>{workloadPoints} pts</span>
          </div>

          {/* Numerical Counter */}
          <div className="text-right flex items-baseline gap-1.5 sm:gap-2">
            <div>
              <span className="text-lg sm:text-xl font-black font-mono text-foreground">
                {totalTasks}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground ml-1">
                {totalTasks === 1 ? 'Task' : 'Tasks'}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground">
              ({activeTasks} active • {completedTasks} done)
            </span>
          </div>

        </div>

      </div>

      {/* Middle: Workload Capacity Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
          <span>Capacity Index</span>
          <span>{workloadPercentage}%</span>
        </div>
        <div className="w-full h-1.5 bg-accent/30 rounded-full overflow-hidden border border-card-border/30">
          <div
            className={`h-full ${progressColor} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${Math.max(3, workloadPercentage)}%` }}
          />
        </div>
      </div>

      {/* Bottom: Status Breakdown Chips & Action Link */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/20">
        
        {/* Status Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {nonZeroStatusCounts.length > 0 ? (
            nonZeroStatusCounts.map((st) => (
              <span
                key={`${memberKey}-${st.status}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold ${st.badgeBg} ${st.badgeColor} ${st.badgeBorder}`}
              >
                <span>{st.label}</span>
                <strong className="font-extrabold font-mono">{st.count}</strong>
              </span>
            ))
          ) : (
            <span className="text-[10px] text-muted-foreground italic font-medium">
              No tasks currently assigned in this scope
            </span>
          )}
        </div>

        {/* View Tasks Action */}
        <div className="flex items-center gap-1 text-[11px] font-bold text-primary group-hover:translate-x-0.5 transition-transform shrink-0 ml-auto">
          <span>View {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>

      </div>

    </div>
  );
}
