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
import { Task, TaskPriority, TaskStatus } from '@/types';
import StatusBadge from '@/components/tasks/StatusBadge';
import PriorityBadge from '@/components/tasks/PriorityBadge';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog';
import {
  ClipboardList,
  Loader2,
  CalendarCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  ArrowUpDown,
  ArrowLeft,
  ArrowRight,
  Eye,
  Edit,
  Trash2,
  Sparkles,
  PlayCircle,
  X,
  UserCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { formatDate, getTaskAssignees, getTaskAssigneeNames, isUserAssignedToTask } from '@/utils';
import { TASK_STATUSES, TASK_PRIORITIES } from '@/constants';

type ActiveTab = 'pending' | 'in-progress' | 'today' | 'overdue' | 'completed' | 'all';

// Helper to determine if a status is considered completed across active & legacy workflow
const isCompletedStatus = (status: TaskStatus | string): boolean => {
  return [
    'completed',
    'moved-to-live',
    'prod-deployed',
    'deployed',
    'development-completed'
  ].includes((status || '').toLowerCase());
};

export default function MyTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab Filtering State (Default to 'pending' so active work is prominently displayed)
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending');

  // Search and Secondary Dropdown Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Table Sorting (Default to Created Date DESC)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdDate', desc: true }
  ]);

  // Detail Drawer & Edit Modal States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isManager = user?.role === 'SuperAdmin';

  // Real-time synchronization for tasks relevant to current user
  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const userEmail = user.email.toLowerCase();

    const unsubscribe = dbService.subscribeTasks((allTasks) => {
      const myTasks = allTasks.filter(t =>
        isUserAssignedToTask(t, userEmail) ||
        (t.status === 'uat' && (t.createdBy || '').toLowerCase() === userEmail)
      );
      setTasks(myTasks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.email]);

  const handleEditClick = (task: Task) => {
    setTaskToEdit(task);
    setIsEditOpen(true);
  };

  const handleEditSuccess = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));

    if (selectedTask?.id === updatedTask.id) {
      setSelectedTask(updatedTask);
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
        await dbService.deleteTask(task.id!, user?.email || 'nm@i2space.com');
        setTasks(prev => prev.filter(t => t.id !== task.id));
        setIsDetailOpen(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('task-updated'));
        }
        toast.success('Task soft deleted');
      } catch (error) {
        console.error('[My Tasks] Error deleting task:', error);
        toast.error('Failed to delete task');
      }
    }
  };

  // Helper date calculators
  const dateHelpers = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    return { todayTime: today.getTime(), todayStr };
  }, []);

  // Compute live count breakdown for all tabs
  const tabCounts = useMemo(() => {
    const { todayTime, todayStr } = dateHelpers;

    let pendingCount = 0;
    let inProgressCount = 0;
    let todayCount = 0;
    let overdueCount = 0;
    let completedCount = 0;

    tasks.forEach(task => {
      const isCompleted = isCompletedStatus(task.status);
      const isCancelled = task.status === 'cancelled';

      if (!isCompleted && !isCancelled) {
        pendingCount++;

        if (task.status === 'in-progress') {
          inProgressCount++;
        }

        if (task.expectedCompletionDate) {
          const d = new Date(task.expectedCompletionDate);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dayNum = String(d.getDate()).padStart(2, '0');
            const taskDueStr = `${y}-${m}-${dayNum}`;

            if (taskDueStr === todayStr) {
              todayCount++;
            }

            d.setHours(0, 0, 0, 0);
            if (d.getTime() < todayTime) {
              overdueCount++;
            }
          }
        }
      } else if (isCompleted) {
        completedCount++;
      }
    });

    return {
      pending: pendingCount,
      inProgress: inProgressCount,
      today: todayCount,
      overdue: overdueCount,
      completed: completedCount,
      all: tasks.length
    };
  }, [tasks, dateHelpers]);

  // Tab configuration
  const tabItems: { id: ActiveTab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'pending', label: 'Pending / Active', icon: Clock, count: tabCounts.pending },
    { id: 'in-progress', label: 'In Progress', icon: PlayCircle, count: tabCounts.inProgress },
    { id: 'today', label: "Today's Tasks", icon: CalendarCheck, count: tabCounts.today },
    { id: 'overdue', label: 'Overdue', icon: AlertTriangle, count: tabCounts.overdue },
    { id: 'completed', label: 'Completed', icon: CheckCircle, count: tabCounts.completed },
    { id: 'all', label: 'All Tasks', icon: ClipboardList, count: tabCounts.all },
  ];

  // Tab and secondary filter pipeline
  const filteredTasks = useMemo(() => {
    const { todayTime, todayStr } = dateHelpers;
    const cleanSearch = searchQuery.trim().toLowerCase();

    return tasks.filter(task => {
      const isCompleted = isCompletedStatus(task.status);
      const isCancelled = task.status === 'cancelled';

      // 1. Tab-level filter
      let matchesTab = false;
      switch (activeTab) {
        case 'pending':
          matchesTab = !isCompleted && !isCancelled;
          break;
        case 'in-progress':
          matchesTab = task.status === 'in-progress';
          break;
        case 'today': {
          if (!task.expectedCompletionDate || isCompleted || isCancelled) {
            matchesTab = false;
          } else {
            const d = new Date(task.expectedCompletionDate);
            if (isNaN(d.getTime())) {
              matchesTab = false;
            } else {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const dayNum = String(d.getDate()).padStart(2, '0');
              matchesTab = `${y}-${m}-${dayNum}` === todayStr;
            }
          }
          break;
        }
        case 'overdue': {
          if (!task.expectedCompletionDate || isCompleted || isCancelled) {
            matchesTab = false;
          } else {
            const d = new Date(task.expectedCompletionDate);
            if (isNaN(d.getTime())) {
              matchesTab = false;
            } else {
              d.setHours(0, 0, 0, 0);
              matchesTab = d.getTime() < todayTime;
            }
          }
          break;
        }
        case 'completed':
          matchesTab = isCompleted;
          break;
        case 'all':
        default:
          matchesTab = true;
          break;
      }

      if (!matchesTab) return false;

      // 2. Priority secondary filter
      if (filterPriority !== 'all' && task.priority !== filterPriority) {
        return false;
      }

      // 3. Status secondary filter
      if (filterStatus !== 'all' && task.status !== filterStatus) {
        return false;
      }

      // 4. Search query filter (title, taskId, project, module, description)
      if (cleanSearch) {
        const matchesSearch =
          task.title.toLowerCase().includes(cleanSearch) ||
          task.taskId.toLowerCase().includes(cleanSearch) ||
          task.projectName.toLowerCase().includes(cleanSearch) ||
          (task.module || '').toLowerCase().includes(cleanSearch) ||
          (task.description || '').toLowerCase().includes(cleanSearch);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [tasks, activeTab, filterPriority, filterStatus, searchQuery, dateHelpers]);

  // Define Columns with exact visual language matching All Tasks table
  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      {
        accessorKey: 'taskId',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground text-left font-bold text-xs tracking-wider uppercase cursor-pointer"
          >
            ID
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-muted-foreground">
            {row.original.taskId}
          </span>
        )
      },
      {
        accessorKey: 'projectName',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground text-left font-bold text-xs tracking-wider uppercase cursor-pointer"
          >
            Project
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-bold uppercase tracking-wide bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded truncate max-w-[120px] block">
            {row.original.projectName}
          </span>
        )
      },
      {
        accessorKey: 'module',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground text-left font-bold text-xs tracking-wider uppercase cursor-pointer"
          >
            Module
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap truncate max-w-[120px] block">
            {row.original.module?.trim() ? row.original.module : '—'}
          </span>
        )
      },
      {
        accessorKey: 'title',
        header: () => (
          <div className="w-[360px] min-w-[360px] max-w-[360px]">
            <span className="font-bold text-xs tracking-wider uppercase">Task Title</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="w-[360px] min-w-[360px] max-w-[360px] overflow-hidden" title={row.original.title}>
            <p className="font-extrabold text-sm text-foreground truncate block">
              {row.original.title}
            </p>
            {row.original.description ? (
              <p className="text-[11px] text-muted-foreground truncate block mt-0.5" title={row.original.description}>
                {row.original.description}
              </p>
            ) : null}
          </div>
        )
      },
      {
        accessorKey: 'assignees',
        header: () => <span className="font-bold text-xs tracking-wider uppercase">Assigned To</span>,
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
              <span className="text-xs font-semibold whitespace-nowrap truncate max-w-[130px]">
                {names}
              </span>
            </div>
          );
        }
      },
      {
        accessorKey: 'priority',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground text-left font-bold text-xs tracking-wider uppercase cursor-pointer"
          >
            Priority
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => <PriorityBadge priority={row.original.priority} showIcon={false} />
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground text-left font-bold text-xs tracking-wider uppercase cursor-pointer"
          >
            Status
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => <StatusBadge status={row.original.status} />
      },
      {
        accessorKey: 'expectedCompletionDate',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground text-left font-bold text-xs tracking-wider uppercase cursor-pointer"
          >
            Due Date
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => {
          const task = row.original;
          const isDone = isCompletedStatus(task.status);
          let isOverdue = false;

          if (!isDone && task.expectedCompletionDate) {
            const d = new Date(task.expectedCompletionDate);
            if (!isNaN(d.getTime())) {
              d.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              isOverdue = d.getTime() < today.getTime();
            }
          }

          return (
            <span
              className={`text-xs font-semibold whitespace-nowrap ${
                isOverdue ? 'text-red-500 font-bold' : 'text-muted-foreground'
              }`}
            >
              {formatDate(task.expectedCompletionDate)}
              {isOverdue && <span className="ml-1 text-[10px] text-red-500">· Overdue</span>}
            </span>
          );
        }
      },
      {
        accessorKey: 'createdDate',
        sortingFn: (rowA, rowB) => {
          const timeA = new Date(rowA.original.createdDate || 0).getTime();
          const timeB = new Date(rowB.original.createdDate || 0).getTime();
          return timeA - timeB;
        },
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 hover:text-foreground text-left font-bold text-xs tracking-wider uppercase cursor-pointer"
          >
            Created Date
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">
            {row.original.createdDate ? formatDate(row.original.createdDate) : '—'}
          </span>
        )
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
        )
      }
    ],
    [isManager]
  );

  // Table Configuration
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
      }
    }
  });

  const clearFilters = () => {
    setSearchQuery('');
    setFilterPriority('all');
    setFilterStatus('all');
  };

  const hasActiveFilters = searchQuery !== '' || filterPriority !== 'all' || filterStatus !== 'all';

  return (
    <div className="space-y-6 pb-24">
      {/* Header & User Context Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight">My Tasks</h1>
            {user?.email && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <UserCheck className="h-3.5 w-3.5" />
                <span>{user.displayName || user.email}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Review assignments specifically allocated to your profile.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3 bg-card/45 border border-card-border px-3.5 py-2 rounded-xl backdrop-blur-md">
          <div className="text-center px-1.5">
            <p className="text-[9px] uppercase font-bold text-muted-foreground">Pending</p>
            <p className="text-lg font-extrabold text-primary">{tabCounts.pending}</p>
          </div>
          <div className="h-7 w-px bg-border/40" />
          <div className="text-center px-1.5">
            <p className="text-[9px] uppercase font-bold text-muted-foreground">In Progress</p>
            <p className="text-lg font-extrabold text-indigo-500">{tabCounts.inProgress}</p>
          </div>
          <div className="h-7 w-px bg-border/40" />
          <div className="text-center px-1.5">
            <p className="text-[9px] uppercase font-bold text-muted-foreground">Overdue</p>
            <p className="text-lg font-extrabold text-red-500">{tabCounts.overdue}</p>
          </div>
          <div className="h-7 w-px bg-border/40" />
          <div className="text-center px-1.5">
            <p className="text-[9px] uppercase font-bold text-muted-foreground">Done</p>
            <p className="text-lg font-extrabold text-emerald-500">{tabCounts.completed}</p>
          </div>
        </div>
      </div>

      {/* Tabs list with Live Count Badges */}
      <div className="flex border-b border-border/40 gap-2 sm:gap-4 overflow-x-auto pb-px select-none scrollbar-none">
        {tabItems.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3.5 px-1 text-xs sm:text-sm font-semibold relative transition-colors cursor-pointer shrink-0 ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
              {isActive && (
                <motion.div
                  layoutId="activeMyTasksTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Toolbar: Search & Secondary Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/45 border border-card-border p-3 rounded-xl backdrop-blur-md">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search tasks, project, module..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-background/50 border border-border rounded-lg outline-none text-xs focus:border-primary/50 text-foreground"
          />
        </div>

        {/* Priority & Status Dropdown Filters */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-2.5 py-1.5 bg-background/50 border border-border rounded-lg text-xs outline-none text-muted-foreground hover:text-foreground cursor-pointer focus:border-primary/50"
          >
            <option value="all">All Priorities</option>
            {TASK_PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-background/50 border border-border rounded-lg text-xs outline-none text-muted-foreground hover:text-foreground cursor-pointer focus:border-primary/50"
          >
            <option value="all">All Statuses</option>
            {TASK_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              title="Reset Search and Filters"
            >
              <X className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Presentation: Table View or Empty States */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="space-y-4">
          {/* Row/Table Container with responsive horizontal scroll */}
          <div className="glass-panel rounded-2xl overflow-x-auto border border-card-border shadow-sm">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-md shadow-sm border-b border-card-border">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className="text-left px-5 py-4 text-xs font-bold text-muted-foreground tracking-wider select-none border-b border-card-border"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border/30">
                {table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      setSelectedTask(row.original);
                      setIsDetailOpen(true);
                    }}
                    className="hover:bg-accent/15 transition-colors cursor-pointer"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-5 py-3.5 align-middle text-sm text-foreground">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 bg-card/40 border border-card-border rounded-xl backdrop-blur-md select-none pr-4 md:pr-24">
            <span className="text-xs text-muted-foreground font-medium">
              Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())} ({filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} matching)
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg bg-card/60 hover:bg-accent/50 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-all shadow-sm"
                title="Previous Page"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              {/* Numbered Page Buttons */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.max(1, table.getPageCount()) }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => table.setPageIndex(idx)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      table.getState().pagination.pageIndex === idx
                        ? 'bg-primary text-white shadow-md shadow-primary/25'
                        : 'bg-card/40 hover:bg-accent/40 text-muted-foreground hover:text-foreground border border-border/50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg bg-card/60 hover:bg-accent/50 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none transition-all shadow-sm"
                title="Next Page"
              >
                <span className="hidden sm:inline">Next</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center text-center">
          <CalendarCheck className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="font-extrabold text-lg">
            {activeTab === 'pending'
              ? 'All caught up!'
              : activeTab === 'in-progress'
              ? 'No tasks currently in progress'
              : activeTab === 'today'
              ? 'No tasks due today'
              : activeTab === 'overdue'
              ? 'No overdue tasks'
              : activeTab === 'completed'
              ? 'No completed tasks yet'
              : 'No tasks found'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1.5">
            {hasActiveFilters
              ? 'No tasks match your current search or filter criteria. Try resetting the filters.'
              : activeTab === 'pending'
              ? 'You have no pending assignments on your plate.'
              : 'Switch tabs or clear filters to view other assigned tasks.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-xs font-bold text-primary transition-all border border-primary/20 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
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

      {/* Create/Edit Modal Dialog */}
      <CreateTaskDialog
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setTaskToEdit(undefined);
        }}
        onSuccess={handleEditSuccess}
        taskToEdit={taskToEdit}
      />
    </div>
  );
}
