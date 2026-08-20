'use client';

import React from 'react';
import { Search, Filter, X, ArrowUpDown, Folder, CheckCircle } from 'lucide-react';
import { ACTIVE_TASK_STATUS_LIST, TASK_STATUS_CONFIG } from '@/constants';

interface WorkloadFiltersProps {
  projectList: string[];
  selectedProject: string;
  onSelectProject: (project: string) => void;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'workload' | 'total' | 'active' | 'completed' | 'name';
  onSortChange: (sort: 'workload' | 'total' | 'active' | 'completed' | 'name') => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  totalMembersCount: number;
  filteredMembersCount: number;
}

export default function WorkloadFilters({
  projectList,
  selectedProject,
  onSelectProject,
  selectedStatus,
  onSelectStatus,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  hasActiveFilters,
  onClearFilters,
  totalMembersCount,
  filteredMembersCount,
}: WorkloadFiltersProps) {
  return (
    <div className="glass-panel p-3.5 rounded-2xl border border-card-border/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 select-none">
      
      {/* Left side: Search & Filter Dropdowns */}
      <div className="flex flex-wrap items-center gap-2.5 flex-1">
        
        {/* Instant Search Bar */}
        <div className="relative min-w-[200px] flex-1 sm:flex-initial sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search member or email..."
            aria-label="Search members by name or email"
            className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-accent/25 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-accent/40 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search query"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Project Selector */}
        <div className="relative min-w-[150px]">
          <select
            value={selectedProject}
            onChange={(e) => onSelectProject(e.target.value)}
            aria-label="Filter by project"
            className="w-full pl-3 pr-7 py-1.5 rounded-xl bg-accent/25 border border-border/40 text-xs font-semibold text-foreground focus:outline-none focus:border-primary/50 cursor-pointer appearance-none truncate"
          >
            <option value="all" className="bg-popover text-popover-foreground">All Projects</option>
            {projectList.map((p) => (
              <option key={p} value={p} className="bg-popover text-popover-foreground">
                {p}
              </option>
            ))}
          </select>
          <Folder className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>

        {/* Status Filter */}
        <div className="relative min-w-[140px]">
          <select
            value={selectedStatus}
            onChange={(e) => onSelectStatus(e.target.value)}
            aria-label="Filter by task status"
            className="w-full pl-3 pr-7 py-1.5 rounded-xl bg-accent/25 border border-border/40 text-xs font-semibold text-foreground focus:outline-none focus:border-primary/50 cursor-pointer appearance-none truncate"
          >
            <option value="all" className="bg-popover text-popover-foreground">All Statuses</option>
            {ACTIVE_TASK_STATUS_LIST.map((st) => (
              <option key={st} value={st} className="bg-popover text-popover-foreground">
                {TASK_STATUS_CONFIG[st]?.label || st}
              </option>
            ))}
          </select>
          <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
        </div>

        {/* Clear Filters Reset */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-xs font-semibold hover:bg-destructive/15 transition-all cursor-pointer"
            title="Reset all active filters"
          >
            <X className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Right side: Sort Controls & Count Pill */}
      <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/30">
        
        {/* Result counter */}
        <span className="text-[11px] font-bold text-muted-foreground">
          Showing <span className="text-foreground">{filteredMembersCount}</span> of {totalMembersCount} members
        </span>

        {/* Sort Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase hidden sm:inline">Sort:</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as any)}
              aria-label="Sort member list"
              className="pl-2.5 pr-6 py-1.5 rounded-xl bg-accent/25 border border-border/40 text-xs font-semibold text-foreground focus:outline-none focus:border-primary/50 cursor-pointer appearance-none"
            >
              <option value="workload" className="bg-popover text-popover-foreground">Workload (Highest)</option>
              <option value="total" className="bg-popover text-popover-foreground">Total Tasks</option>
              <option value="active" className="bg-popover text-popover-foreground">Active Tasks</option>
              <option value="completed" className="bg-popover text-popover-foreground">Completed Tasks</option>
              <option value="name" className="bg-popover text-popover-foreground">Name (A-Z)</option>
            </select>
            <ArrowUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>
        </div>

      </div>

    </div>
  );
}
