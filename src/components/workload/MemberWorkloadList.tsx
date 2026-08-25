'use client';

import React from 'react';
import { MemberProjectWorkload } from '@/utils';
import MemberWorkloadRow from './MemberWorkloadRow';
import { Users, SearchX, Briefcase, Plus } from 'lucide-react';
import Link from 'next/link';

interface MemberWorkloadListProps {
  workloads: MemberProjectWorkload[];
  onSelectMember: (workload: MemberProjectWorkload) => void;
  searchQuery: string;
  selectedProject: string;
  selectedStatus: string;
  onClearFilters: () => void;
  projectTotalTasks: number;
}

export default function MemberWorkloadList({
  workloads,
  onSelectMember,
  searchQuery,
  selectedProject,
  selectedStatus,
  onClearFilters,
  projectTotalTasks,
}: MemberWorkloadListProps) {
  // Empty State: Search produced no results
  if (workloads.length === 0 && searchQuery) {
    return (
      <div className="glass-panel p-12 rounded-3xl border border-card-border/60 text-center max-w-md mx-auto my-8 select-none">
        <div className="w-12 h-12 rounded-2xl bg-accent/30 flex items-center justify-center text-muted-foreground mx-auto mb-3">
          <SearchX className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">No matching team members</h3>
        <p className="text-xs text-muted-foreground mt-1 mb-5">
          No team members matched the query &quot;{searchQuery}&quot;.
        </p>
        <button
          onClick={onClearFilters}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/95 transition-all shadow-md shadow-primary/20 cursor-pointer"
        >
          Clear Search Filters
        </button>
      </div>
    );
  }

  // Empty State: Project has zero tasks registered
  if (projectTotalTasks === 0 && selectedProject !== 'all') {
    return (
      <div className="glass-panel p-12 rounded-3xl border border-card-border/60 text-center max-w-md mx-auto my-8 select-none">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-3">
          <Briefcase className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">No Tasks in {selectedProject}</h3>
        <p className="text-xs text-muted-foreground mt-1 mb-5">
          This project container does not have any tasks created yet.
        </p>
        <Link
          href="/dashboard/all-tasks"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/95 transition-all shadow-md shadow-primary/20 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Create First Task</span>
        </Link>
      </div>
    );
  }

  // Empty State: General empty
  if (workloads.length === 0) {
    return (
      <div className="glass-panel p-12 rounded-3xl border border-card-border/60 text-center max-w-md mx-auto my-8 select-none">
        <div className="w-12 h-12 rounded-2xl bg-accent/30 flex items-center justify-center text-muted-foreground mx-auto mb-3">
          <Users className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">No Member Workload Available</h3>
        <p className="text-xs text-muted-foreground mt-1 mb-5">
          No team members match the current filter selection.
        </p>
        <button
          onClick={onClearFilters}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/95 transition-all shadow-md shadow-primary/20 cursor-pointer"
        >
          Reset Filters
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workloads.map((workload) => {
        // Guaranteed unique and non-empty key
        const uniqueKey = workload.member.id || workload.member.email || workload.member.name;
        return (
          <MemberWorkloadRow
            key={uniqueKey}
            workload={workload}
            onSelectMember={onSelectMember}
          />
        );
      })}
    </div>
  );
}
