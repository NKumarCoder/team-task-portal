'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState
} from '@tanstack/react-table';
import { useAuth } from '@/hooks/useAuth';
import { dbService } from '@/services/dbService';
import { Task, TaskPriority, TaskStatus, Member, Project } from '@/types';
import StatusBadge from '@/components/tasks/StatusBadge';
import PriorityBadge from '@/components/tasks/PriorityBadge';
import TaskCard from '@/components/tasks/TaskCard';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog';
import {
  Search,
  ArrowUpDown,
  Calendar,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  X,
  Clock,
  User,
  Eye,
  Edit,
  Trash2,
  Loader2,
  Download,
  Printer,
  Check,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Send,
  UserCheck,
  Plus,
  Table as TableIcon,
  LayoutGrid,
  Filter,
  AlertOctagon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, getTaskAssignees, getTaskAssigneeIds, getTaskAssigneeNames } from '@/utils';
import toast from 'react-hot-toast';

export default function AssignedByMePage() {
  const { user, hasPermission } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // View presentation mode: Table View (default) or Cards View
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Table Sorting & Global Search
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Extended Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterDueDate, setFilterDueDate] = useState('');

  // Detail Drawer & Modal States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const canCreate = user?.role === 'SuperAdmin' || user?.role === 'Admin' || hasPermission('canCreateTask');
  const isManager = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  // Real-time Firestore Subscriptions for tasks assigned by the current user
  useEffect(() => {
    if (!user || !user.email) {
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log(`[Assigned by Me] Initializing real-time stream for creator: ${user.email}`);

    const unsubscribe = dbService.subscribeTasksAssignedBy(user.email, (fetchedTasks) => {
      console.log(`[Assigned by Me] Received ${fetchedTasks.length} delegated tasks.`);
      setTasks(fetchedTasks);
      setLoading(false);
    });

    // Supporting lookups
    dbService.getMembers().then(setMembers).catch(console.error);
    dbService.getProjects().then(setProjects).catch(console.error);

    return () => unsubscribe();
  }, [user]);

  // Handle Edit & Create Handlers
  const handleEditClick = (task: Task) => {
    setTaskToEdit(task);
    setIsEditOpen(true);
  };

  const handleEditSuccess = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    if (selectedTask?.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }
  };

  const handleTaskCreated = (newTask: Task) => {
    // If created by current user, append immediately to local list
    if (newTask.createdBy?.toLowerCase() === user?.email?.toLowerCase()) {
      setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!isManager) {
      toast.error('Only managers can delete tasks');
      return;
    }

    if (confirm(`Are you sure you want to delete ${task.taskId}?`)) {
      try {
        await dbService.deleteTask(task.id!, user?.email || 'system@company.com', user?.displayName);
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        setIsDetailOpen(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('task-updated'));
        }
        toast.success('Task soft deleted successfully');
      } catch (error) {
        console.error('[Assigned by Me] Error deleting task:', error);
        toast.error('Failed to delete task');
      }
    }
  };

  // Distinct Assignees from the user's assigned tasks
  const distinctAssignees = useMemo(() => {
    const map = new Map<string, { email: string; name: string }>();
    tasks.forEach((t) => {
      getTaskAssignees(t).forEach((a) => {
        if (a.id && !map.has(a.id.toLowerCase())) {
          map.set(a.id.toLowerCase(), { email: a.id.toLowerCase(), name: a.name });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // Distinct Projects from the user's assigned tasks
  const distinctProjects = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.projectName) set.add(t.projectName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  // Dynamic Summary Metrics KPIs
  const summaryMetrics = useMemo(() => {
    const total = tasks.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isCompletedStatus = (s: string) =>
      s === 'completed' || s === 'prod-deployed' || s === 'moved-to-live';
    const isTestingStatus = (s: string) =>
      s === 'uat-testing' || s === 'uat-deployed' || s === 'code-review' || s === 'testing' || s === 'uat';
    const isInProgressStatus = (s: string) =>
      s === 'in-progress' || s === 'supplier-pending' || s === 'development-completed';
    const isBlockedOrRejected = (s: string) =>
      s === 'uat-rejected' || s === 'blocked';

    const inProgress = tasks.filter((t) => isInProgressStatus(t.status)).length;
    const testing = tasks.filter((t) => isTestingStatus(t.status)).length;
    const completed = tasks.filter((t) => isCompletedStatus(t.status)).length;
    const blockedOrRejected = tasks.filter((t) => isBlockedOrRejected(t.status)).length;

    const overdue = tasks.filter((t) => {
      if (isCompletedStatus(t.status) || t.status === 'cancelled') return false;
      if (!t.expectedCompletionDate) return false;
      const due = new Date(t.expectedCompletionDate);
      if (isNaN(due.getTime())) return false;
      due.setHours(0, 0, 0, 0);
      return due.getTime() < today.getTime();
    }).length;

    return {
      total,
      inProgress,
      testing,
      completed,
      overdue,
      blockedOrRejected,
    };
  }, [tasks]);

  // Client-Side Multi-Criteria Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Global text search
      if (globalFilter.trim() !== '') {
        const q = globalFilter.toLowerCase();
        const matchId = (task.taskId || '').toLowerCase().includes(q);
        const matchTitle = (task.title || '').toLowerCase().includes(q);
        const matchDesc = (task.description || '').toLowerCase().includes(q);
        const matchProject = (task.projectName || '').toLowerCase().includes(q);
        const matchModule = (task.module || '').toLowerCase().includes(q);
        const matchRemarks = (task.remarks || '').toLowerCase().includes(q);
        const matchAssignee = getTaskAssignees(task).some(
          (a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
        );

        if (!matchId && !matchTitle && !matchDesc && !matchProject && !matchModule && !matchRemarks && !matchAssignee) {
          return false;
        }
      }

      // 2. Assignee filter
      if (filterAssignee !== 'all') {
        const hasMember = getTaskAssigneeIds(task).includes(filterAssignee.toLowerCase());
        if (!hasMember) return false;
      }

      // 3. Project filter
      if (filterProject !== 'all') {
        if ((task.projectName || '').toLowerCase() !== filterProject.toLowerCase()) {
          return false;
        }
      }

      // 4. Status filter
      if (filterStatus !== 'all') {
        if (task.status !== filterStatus) return false;
      }

      // 5. Priority filter
      if (filterPriority !== 'all') {
        if (task.priority !== filterPriority) return false;
      }

      // 6. Due Date match
      if (filterDueDate) {
        const target = new Date(filterDueDate);
        target.setHours(0, 0, 0, 0);
        const taskDue = new Date(task.expectedCompletionDate);
        taskDue.setHours(0, 0, 0, 0);
        if (taskDue.getTime() !== target.getTime()) return false;
      }

      return true;
    });
  }, [tasks, globalFilter, filterAssignee, filterProject, filterStatus, filterPriority, filterDueDate]);

  // Grouped tasks by priority for the Card View
  const groupedTasks = useMemo(() => {
    const groups: Record<TaskPriority, Task[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    filteredTasks.forEach((task) => {
      if (groups[task.priority]) {
        groups[task.priority].push(task);
      } else {
        groups.low.push(task);
      }
    });
    return groups;
  }, [filteredTasks]);

  // Export to CSV handler
  const handleExportCSV = () => {
    if (filteredTasks.length === 0) {
      toast.error('No tasks available to export.');
      return;
    }

    const headers = ['Task ID', 'Title', 'Project', 'Assigned To', 'Priority', 'Status', 'Due Date', 'Created Date'];
    const rows = filteredTasks.map((t) => [
      t.taskId,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.projectName.replace(/"/g, '""')}"`,
      `"${getTaskAssigneeNames(t).replace(/"/g, '""')}"`,
      t.priority.toUpperCase(),
      t.status.toUpperCase(),
      formatDate(t.expectedCompletionDate),
      formatDate(t.createdDate),
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `assigned_by_me_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV report exported.');
  };

  // Clear all filters
  const clearFilters = () => {
    setGlobalFilter('');
    setFilterAssignee('all');
    setFilterProject('all');
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterDueDate('');
  };

  const hasActiveFilters =
    globalFilter !== '' ||
    filterAssignee !== 'all' ||
    filterProject !== 'all' ||
    filterStatus !== 'all' ||
    filterPriority !== 'all' ||
    filterDueDate !== '';

  // TanStack React Table Column Definitions
  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      {
        accessorKey: 'taskId',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground text-left font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
          >
            ID
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-muted-foreground">{row.original.taskId}</span>
        ),
      },
      {
        accessorKey: 'projectName',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground text-left font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
          >
            Project
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-bold uppercase tracking-wide bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded truncate max-w-[130px] block">
            {row.original.projectName}
          </span>
        ),
      },
      {
        accessorKey: 'title',
        header: () => <span className="font-bold text-xs tracking-wider uppercase">Task Title</span>,
        cell: ({ row }) => (
          <div className="max-w-xs md:max-w-md truncate">
            <p className="font-extrabold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {row.original.title}
            </p>
            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
              {row.original.description || 'No description provided.'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'assignees',
        header: () => (
          <span className="font-bold text-xs tracking-wider uppercase flex items-center gap-1.5 text-primary">
            <UserCheck className="h-3.5 w-3.5" />
            Assigned To
          </span>
        ),
        cell: ({ row }) => {
          const assignees = getTaskAssignees(row.original);
          const names = getTaskAssigneeNames(row.original);
          return (
            <div className="flex items-center gap-2" title={names}>
              <div className="flex items-center shrink-0">
                {assignees.slice(0, 3).map((a, idx) => (
                  <div
                    key={a.id || `assignee-${idx}`}
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[9px] shadow-sm border border-background shrink-0 ${
                      idx > 0 ? '-ml-2' : ''
                    }`}
                    style={{ backgroundColor: a.color || '#6366f1' }}
                  >
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {assignees.length > 3 && (
                  <div className="w-6 h-6 -ml-2 rounded-full flex items-center justify-center font-bold text-[8px] bg-slate-800 text-muted-foreground border border-background shrink-0 shadow-sm">
                    +{assignees.length - 3}
                  </div>
                )}
                {assignees.length === 0 && (
                  <span className="text-xs text-muted-foreground">Unassigned</span>
                )}
              </div>
              <span className="text-xs font-semibold whitespace-nowrap truncate max-w-[140px] text-foreground">
                {names}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'priority',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground text-left font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
          >
            Priority
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => <PriorityBadge priority={row.original.priority} showIcon={false} />,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground text-left font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
          >
            Status
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'expectedCompletionDate',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground text-left font-bold text-xs tracking-wider uppercase cursor-pointer select-none"
          >
            Due Date
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.expectedCompletionDate)}
          </span>
        ),
      },
      {
        accessorKey: 'createdDate',
        header: () => <span className="font-bold text-xs tracking-wider uppercase">Created</span>,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(row.original.createdDate)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="font-bold text-xs tracking-wider uppercase text-right block pr-2">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1 pr-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setSelectedTask(row.original);
                setIsDetailOpen(true);
              }}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleEditClick(row.original)}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Edit Task"
            >
              <Edit className="h-4 w-4" />
            </button>
            {isManager && (
              <button
                onClick={() => handleDeleteTask(row.original)}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                title="Soft Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [isManager]
  );

  // TanStack Table Instance
  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <UserCheck className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Assigned by Me</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor progress, deadlines, and completion of tasks you have delegated to team members.
          </p>
        </div>

        {/* Header Action Button */}
        {canCreate && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all cursor-pointer shadow-lg shadow-primary/20 text-sm shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create Task</span>
          </button>
        )}
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Assigned */}
        <div className="glass-panel p-4 rounded-2xl border border-primary/20 bg-primary/[0.03] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Assigned</span>
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-foreground">{summaryMetrics.total}</span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">Tasks delegated</span>
          </div>
        </div>

        {/* In Progress */}
        <div className="glass-panel p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.03] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">In Progress</span>
            <Clock className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-foreground">{summaryMetrics.inProgress}</span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">Active development</span>
          </div>
        </div>

        {/* Testing & Review */}
        <div className="glass-panel p-4 rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">UAT & Review</span>
            <Sparkles className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-foreground">{summaryMetrics.testing}</span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">Pending validation</span>
          </div>
        </div>

        {/* Completed */}
        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-foreground">{summaryMetrics.completed}</span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">Delivered / Deployed</span>
          </div>
        </div>

        {/* Overdue */}
        <div className="glass-panel p-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Overdue</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-400">{summaryMetrics.overdue}</span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">Past deadline</span>
          </div>
        </div>

        {/* Blocked / Rejected */}
        <div className="glass-panel p-4 rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Rejected / Blocked</span>
            <AlertOctagon className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-400">{summaryMetrics.blockedOrRejected}</span>
            <span className="text-[10px] text-muted-foreground block mt-0.5">Needs attention</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters Toggle, View Switcher & Export */}
      <div className="glass-panel p-4 rounded-2xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search by ID, title, project, assignee..."
              className="w-full bg-accent/40 border border-card-border rounded-xl pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
            />
            {globalFilter && (
              <button
                onClick={() => setGlobalFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                showFilters || hasActiveFilters
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'bg-accent/40 border-card-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
              )}
            </button>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-accent/40 border border-card-border rounded-xl p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 px-2.5 ${
                  viewMode === 'table'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Table View"
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 px-2.5 ${
                  viewMode === 'cards'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Priority Cards View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-accent/40 border border-card-border text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all cursor-pointer"
              title="Export Filtered Tasks to CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Collapsible Secondary Filter Bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pt-2 border-t border-card-border"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                {/* Assignee Filter */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Assignee
                  </label>
                  <select
                    value={filterAssignee}
                    onChange={(e) => setFilterAssignee(e.target.value)}
                    className="w-full bg-accent/50 border border-card-border rounded-xl px-2.5 py-1.5 text-xs text-foreground outline-none cursor-pointer hover:border-primary/40 focus:border-primary transition-colors"
                  >
                    <option value="all">All Assignees ({distinctAssignees.length})</option>
                    {distinctAssignees.map((a) => (
                      <option key={a.email} value={a.email}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Project Filter */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Project
                  </label>
                  <select
                    value={filterProject}
                    onChange={(e) => setFilterProject(e.target.value)}
                    className="w-full bg-accent/50 border border-card-border rounded-xl px-2.5 py-1.5 text-xs text-foreground outline-none cursor-pointer hover:border-primary/40 focus:border-primary transition-colors"
                  >
                    <option value="all">All Projects ({distinctProjects.length})</option>
                    {distinctProjects.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-accent/50 border border-card-border rounded-xl px-2.5 py-1.5 text-xs text-foreground outline-none cursor-pointer hover:border-primary/40 focus:border-primary transition-colors"
                  >
                    <option value="all">All Statuses</option>
                    <option value="assigned">Assigned</option>
                    <option value="in-progress">In Progress</option>
                    <option value="supplier-pending">Supplier Pending</option>
                    <option value="code-review">Code Review</option>
                    <option value="uat-deployed">UAT Deployed</option>
                    <option value="uat-testing">UAT Testing</option>
                    <option value="uat-rejected">UAT Rejected</option>
                    <option value="ready-for-production-deploy">Ready for Prod Deploy</option>
                    <option value="prod-deployed">Prod Deployed</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Priority
                  </label>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="w-full bg-accent/50 border border-card-border rounded-xl px-2.5 py-1.5 text-xs text-foreground outline-none cursor-pointer hover:border-primary/40 focus:border-primary transition-colors"
                  >
                    <option value="all">All Priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                {/* Due Date Filter */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Due Date
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={filterDueDate}
                      onChange={(e) => setFilterDueDate(e.target.value)}
                      className="w-full bg-accent/50 border border-card-border rounded-xl px-2 py-1 text-xs text-foreground outline-none cursor-pointer hover:border-primary/40 focus:border-primary transition-colors"
                    />
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="px-2 py-1 rounded-lg bg-destructive/10 text-destructive text-[11px] font-semibold hover:bg-destructive/20 transition-colors cursor-pointer shrink-0"
                        title="Clear Filters"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">Loading your delegated tasks...</p>
        </div>
      ) : filteredTasks.length > 0 ? (
        viewMode === 'table' ? (
          /* Table Presentation View */
          <div className="glass-panel rounded-2xl border border-card-border overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-card-border bg-accent/20">
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-card-border/60">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => {
                        setSelectedTask(row.original);
                        setIsDetailOpen(true);
                      }}
                      className="hover:bg-accent/30 transition-colors cursor-pointer group"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3.5 text-xs text-foreground">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-card-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
              <div>
                Showing <strong className="text-foreground">{table.getRowModel().rows.length}</strong> of{' '}
                <strong className="text-foreground">{filteredTasks.length}</strong> delegated tasks
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="px-3 py-1.5 rounded-lg border border-card-border bg-accent/30 hover:bg-accent/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors font-semibold"
                >
                  Previous
                </button>
                <span className="font-semibold text-foreground px-1">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="px-3 py-1.5 rounded-lg border border-card-border bg-accent/30 hover:bg-accent/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Cards Grid View grouped by priority */
          <div className="space-y-8 pt-2">
            {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map((priority) => {
              const list = groupedTasks[priority];
              if (list.length === 0) return null;

              const priorityStyles = {
                critical: { dot: 'bg-red-500', ring: 'ring-red-500/10', label: 'Critical Priority' },
                high: { dot: 'bg-orange-500', ring: 'ring-orange-500/10', label: 'High Priority' },
                medium: { dot: 'bg-blue-500', ring: 'ring-blue-500/10', label: 'Medium Priority' },
                low: { dot: 'bg-zinc-400', ring: 'ring-zinc-500/10', label: 'Low Priority' },
              };
              const style = priorityStyles[priority];

              return (
                <div key={priority} className="space-y-4">
                  {/* Section Header */}
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${style.dot} ring-4 ${style.ring}`} />
                    <h3 className="font-extrabold text-sm uppercase tracking-wider text-foreground">
                      {style.label} ({list.length})
                    </h3>
                  </div>

                  {/* Priority Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {list.map((task, tIdx) => (
                      <TaskCard
                        key={task.id || task.taskId || `assigned-task-${tIdx}`}
                        task={task}
                        onClick={() => {
                          setSelectedTask(task);
                          setIsDetailOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Empty State */
        <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-4">
            <UserCheck className="h-7 w-7" />
          </div>
          <h3 className="font-extrabold text-lg">No delegated tasks found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1.5">
            {hasActiveFilters
              ? 'No tasks match your current filter settings. Try adjusting or clearing filters.'
              : 'Tasks you create and assign to team members will appear here for real-time tracking.'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="mt-5 px-4 py-2 bg-accent/60 hover:bg-accent text-foreground font-semibold rounded-xl text-xs transition-all cursor-pointer border border-card-border"
            >
              Clear Filters
            </button>
          ) : canCreate ? (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all text-xs cursor-pointer shadow-lg shadow-primary/20"
            >
              <Plus className="h-4 w-4" />
              <span>Create Your First Task</span>
            </button>
          ) : null}
        </div>
      )}

      {/* Task Details Side Drawer */}
      <TaskDetailDrawer
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        task={selectedTask}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteTask}
      />

      {/* Create / Edit Modal Dialog */}
      <CreateTaskDialog
        isOpen={isCreateOpen || isEditOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setIsEditOpen(false);
          setTaskToEdit(undefined);
        }}
        onSuccess={(task) => {
          if (isEditOpen) {
            handleEditSuccess(task);
          } else {
            handleTaskCreated(task);
          }
        }}
        taskToEdit={taskToEdit}
      />
    </div>
  );
}
