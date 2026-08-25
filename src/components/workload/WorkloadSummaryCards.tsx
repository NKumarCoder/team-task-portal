'use client';

import React from 'react';
import { Layers, Play, CheckCircle2, Users } from 'lucide-react';

interface WorkloadSummaryCardsProps {
  projectTotalTasks: number;
  projectActiveTasks: number;
  projectCompletedTasks: number;
  totalTeamMembers: number;
  activeTeamMembersCount: number;
  totalTeamAssignments: number;
  projectName: string;
}

export default function WorkloadSummaryCards({
  projectTotalTasks,
  projectActiveTasks,
  projectCompletedTasks,
  totalTeamMembers,
  activeTeamMembersCount,
  totalTeamAssignments,
  projectName,
}: WorkloadSummaryCardsProps) {
  const activeRate = projectTotalTasks > 0 
    ? Math.round((projectActiveTasks / projectTotalTasks) * 100) 
    : 0;
  
  const completionRate = projectTotalTasks > 0 
    ? Math.round((projectCompletedTasks / projectTotalTasks) * 100) 
    : 0;

  const cards = [
    {
      id: 'total-tasks',
      label: 'Total Scope',
      value: projectTotalTasks,
      subtext: projectName === 'all' ? 'All Projects' : `${projectName} Project`,
      badge: `${totalTeamAssignments} assignments`,
      icon: Layers,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 border-blue-500/15',
    },
    {
      id: 'active-tasks',
      label: 'Active Pipeline',
      value: projectActiveTasks,
      subtext: `${activeRate}% of total`,
      badge: activeRate > 0 ? `${activeRate}% active` : '0%',
      icon: Play,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/15',
    },
    {
      id: 'completed-tasks',
      label: 'Completed',
      value: projectCompletedTasks,
      subtext: `${completionRate}% completion`,
      badge: `${completionRate}% done`,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/15',
    },
    {
      id: 'team-members',
      label: 'Active Assignees',
      value: activeTeamMembersCount,
      subtext: `of ${totalTeamMembers} registered`,
      badge: `${activeTeamMembersCount}/${totalTeamMembers} active`,
      icon: Users,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 border-purple-500/15',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="glass-panel p-4 rounded-2xl border border-card-border/80 flex flex-col justify-between transition-all hover:border-primary/25 relative overflow-hidden group shadow-sm select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                {card.label}
              </span>
              <div className={`p-1.5 rounded-lg ${card.bg} ${card.color} shrink-0`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Value */}
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
                {card.value}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground truncate bg-accent/30 px-1.5 py-0.5 rounded-md border border-border/40">
                {card.badge}
              </span>
            </div>

            {/* Subtext */}
            <p className="text-[10px] text-muted-foreground/80 mt-1 font-medium truncate">
              {card.subtext}
            </p>
          </div>
        );
      })}
    </div>
  );
}
