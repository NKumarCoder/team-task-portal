'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { dbService } from '@/services/dbService';
import { Task, Member, Project } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { getProjectMemberWorkload, MemberProjectWorkload } from '@/utils';
import WorkloadSummaryCards from '@/components/workload/WorkloadSummaryCards';
import WorkloadFilters from '@/components/workload/WorkloadFilters';
import MemberWorkloadList from '@/components/workload/MemberWorkloadList';
import MemberDetailDrawer from '@/components/members/MemberDetailDrawer';
import { Activity, Loader2, Sparkles, AlertTriangle } from 'lucide-react';

export default function TeamWorkloadPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeoutError, setTimeoutError] = useState(false);

  // Filters and Sorting state
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'workload' | 'total' | 'active' | 'completed' | 'name'>('workload');

  // Member Detail Drawer State
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isMemberDrawerOpen, setIsMemberDrawerOpen] = useState(false);

  // Real-time Firestore Subscriptions
  useEffect(() => {
    setLoading(true);
    setTimeoutError(false);

    const timer = setTimeout(() => {
      setTimeoutError(true);
      setLoading(false);
    }, 10000);

    const unsubscribeTasks = dbService.subscribeTasks((fetchedTasks) => {
      setTasks(fetchedTasks || []);
      clearTimeout(timer);
      setLoading(false);
    });

    const unsubscribeMembers = dbService.subscribeMembers((fetchedMembers) => {
      setMembers(fetchedMembers || []);
    });

    const unsubscribeProjects = dbService.subscribeProjects((fetchedProjects) => {
      setProjects(fetchedProjects || []);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeMembers();
      unsubscribeProjects();
      clearTimeout(timer);
    };
  }, []);

  // Distinct Project Names List
  const projectList = useMemo(() => {
    const list = new Set<string>();
    projects.forEach((p) => {
      if (p.name) list.add(p.name);
    });
    tasks.forEach((t) => {
      if (t.projectName) list.add(t.projectName);
    });
    return Array.from(list).sort((a, b) => a.localeCompare(b));
  }, [projects, tasks]);

  // Centralized Workload Computation for the selected project
  const workloadResult = useMemo(() => {
    return getProjectMemberWorkload(tasks, members, selectedProject);
  }, [tasks, members, selectedProject]);

  // Filter & Sort Members based on search query, status, and sort criteria
  const filteredAndSortedMembers = useMemo(() => {
    let result = [...workloadResult.memberWorkloads];

    // Status filter
    if (selectedStatus !== 'all') {
      result = result.filter((m) => (m.statusCounts[selectedStatus] || 0) > 0);
    }

    // Search query filter (Name or Email)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.member.name.toLowerCase().includes(q) ||
          m.member.email.toLowerCase().includes(q)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'workload') {
        if (b.workloadPoints !== a.workloadPoints) {
          return b.workloadPoints - a.workloadPoints;
        }
        return b.totalTasks - a.totalTasks;
      }
      if (sortBy === 'total') {
        return b.totalTasks - a.totalTasks;
      }
      if (sortBy === 'active') {
        return b.activeTasks - a.activeTasks;
      }
      if (sortBy === 'completed') {
        return b.completedTasks - a.completedTasks;
      }
      if (sortBy === 'name') {
        return a.member.name.localeCompare(b.member.name);
      }
      return 0;
    });

    return result;
  }, [workloadResult.memberWorkloads, selectedStatus, searchQuery, sortBy]);

  // Tasks for the selected member in the selected project (for the drawer)
  const drawerTasks = useMemo(() => {
    if (selectedProject === 'all') {
      return tasks;
    }
    return tasks.filter(
      (t) => (t.projectName || '').toLowerCase() === selectedProject.toLowerCase()
    );
  }, [tasks, selectedProject]);

  const hasActiveFilters =
    selectedProject !== 'all' ||
    selectedStatus !== 'all' ||
    searchQuery.trim() !== '' ||
    sortBy !== 'workload';

  const handleClearFilters = () => {
    setSelectedProject('all');
    setSelectedStatus('all');
    setSearchQuery('');
    setSortBy('workload');
  };

  const handleSelectMember = (workloadItem: MemberProjectWorkload) => {
    setSelectedMember(workloadItem.member);
    setIsMemberDrawerOpen(true);
  };

  if (timeoutError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center select-none">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mb-4">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold tracking-tight">Unable to load workload data</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-5">
          The database listener timed out. Let&apos;s try re-establishing the live connection.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition-all text-xs cursor-pointer shadow-md shadow-primary/20"
        >
          Re-establish Connection
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-semibold">
            Synchronizing Team Workload & Allocation metrics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none max-w-7xl mx-auto pb-12">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Team Workload & Task Allocation
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Understand team capacity, task distribution, and pipeline delivery for any project container.
          </p>
        </div>
      </div>

      {/* Summary KPI Tiles */}
      <WorkloadSummaryCards
        projectTotalTasks={workloadResult.projectTotalTasks}
        projectActiveTasks={workloadResult.projectActiveTasks}
        projectCompletedTasks={workloadResult.projectCompletedTasks}
        totalTeamMembers={workloadResult.totalTeamMembers}
        activeTeamMembersCount={workloadResult.activeTeamMembersCount}
        totalTeamAssignments={workloadResult.totalTeamAssignments}
        projectName={selectedProject}
      />

      {/* Filter & Sort Controls */}
      <WorkloadFilters
        projectList={projectList}
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        onSortChange={setSortBy}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        totalMembersCount={workloadResult.totalTeamMembers}
        filteredMembersCount={filteredAndSortedMembers.length}
      />

      {/* Member Workload Roster */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span>
              {selectedProject === 'all'
                ? 'All Projects — Team Allocation Roster'
                : `${selectedProject} — Member Task Allocation`}
            </span>
          </h2>
          <span className="text-[11px] font-semibold text-muted-foreground">
            Click any member to inspect allocated tasks
          </span>
        </div>

        <MemberWorkloadList
          workloads={filteredAndSortedMembers}
          onSelectMember={handleSelectMember}
          searchQuery={searchQuery}
          selectedProject={selectedProject}
          selectedStatus={selectedStatus}
          onClearFilters={handleClearFilters}
          projectTotalTasks={workloadResult.projectTotalTasks}
        />
      </div>

      {/* Reused Member Detail Drawer (filtered by selected project) */}
      <MemberDetailDrawer
        isOpen={isMemberDrawerOpen}
        onClose={() => {
          setSelectedMember(null);
          setIsMemberDrawerOpen(false);
        }}
        member={selectedMember}
        tasks={drawerTasks}
      />

    </div>
  );
}
