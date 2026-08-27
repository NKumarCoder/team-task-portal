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
import { Task, TaskStatus, TaskPriority, Comment } from '@/types';
import StatusBadge from '@/components/tasks/StatusBadge';
import PriorityBadge from '@/components/tasks/PriorityBadge';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog';
import {
  Search,
  Trash2,
  Edit,
  ArrowUpDown,
  Calendar,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  X,
  FileText,
  Clock,
  User,
  Eye,
  Loader2,
  Download,
  Printer,
  Check,
  ChevronRight,
  ClipboardList,
  Folder
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, getTaskAssignees, getTaskAssigneeIds, getTaskAssigneeNames } from '@/utils';
import toast from 'react-hot-toast';

export default function AllTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // View presentation mode: 'list' (consolidated All Tasks table) or 'project' (project-wise cards/directory)
  const [viewMode, setViewMode] = useState<'list' | 'project'>('list');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Table Sorting & Global Search Filter
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Extended Advanced Filters States
  const [showFilters, setShowFilters] = useState(false);
  const [filterTaskId, setFilterTaskId] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterModule, setFilterModule] = useState('');
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterDueDate, setFilterDueDate] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterCompleted, setFilterCompleted] = useState(false);
  const [filterTesting, setFilterTesting] = useState(false);
  const [filterDeployment, setFilterDeployment] = useState(false);
  const [filterLive, setFilterLive] = useState(false);
  const [filterCritical, setFilterCritical] = useState(false);
  const [filterBlocked, setFilterBlocked] = useState(false);

  // Local comments cache loader for Global Search support
  const [commentsMap, setCommentsMap] = useState<Map<string, string[]>>(new Map());

  // Detail Drawer & Edit Modal States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isManager = user?.role === 'SuperAdmin';

  const loadCommentsMap = () => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('portal_comments') || '[]';
    try {
      const list: Comment[] = JSON.parse(raw);
      const map = new Map<string, string[]>();
      list.forEach(c => {
        const existing = map.get(c.taskId) || [];
        existing.push(c.content.toLowerCase());
        map.set(c.taskId, existing);
      });
      setCommentsMap(map);
    } catch {}
  };

  async function loadTasks() {
    console.log("[All Tasks] Fetching task directory list...");
    setLoading(true);
    try {
      const fetchedTasks = await dbService.getTasks();
      console.log("[All Tasks] Tasks directory loaded successfully, count:", fetchedTasks.length);
      setTasks(fetchedTasks);
      loadCommentsMap();
    } catch (error) {
      console.error('[All Tasks] Error:', error);
      toast.error('Failed to retrieve task roster.');
    } finally {
      setLoading(false);
    }
  }

  // Real-time task syncing
  useEffect(() => {
    setLoading(true);
    const unsubscribe = dbService.subscribeTasks((fetched) => {
      setTasks(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load data & register updates listener
  useEffect(() => {
    loadTasks();
    if (typeof window !== 'undefined') {
      window.addEventListener('task-updated', loadTasks);
      window.addEventListener('comments-updated', loadCommentsMap);
      return () => {
        window.removeEventListener('task-updated', loadTasks);
        window.removeEventListener('comments-updated', loadCommentsMap);
      };
    }
  }, []);

  // Unified Filter Pipeline: applies global search & column filters across all tasks
  const baseFilteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Global Search in comments map
      const taskComments = commentsMap.get(task.id!) || [];
      const matchesComments = taskComments.some(content => content.includes(globalFilter.toLowerCase()));

      const matchesGlobal =
        task.title.toLowerCase().includes(globalFilter.toLowerCase()) ||
        task.projectName.toLowerCase().includes(globalFilter.toLowerCase()) ||
        task.description.toLowerCase().includes(globalFilter.toLowerCase()) ||
        task.taskId.toLowerCase().includes(globalFilter.toLowerCase()) ||
        getTaskAssignees(task).some(a => a.name.toLowerCase().includes(globalFilter.toLowerCase()) || a.id.toLowerCase().includes(globalFilter.toLowerCase())) ||
        (task.remarks || '').toLowerCase().includes(globalFilter.toLowerCase()) ||
        matchesComments;

      // Advanced column searches
      const matchesTaskId = !filterTaskId || task.taskId.toLowerCase().includes(filterTaskId.toLowerCase());
      const matchesProject = !filterProject || task.projectName.toLowerCase().includes(filterProject.toLowerCase());
      const matchesAssignee = !filterAssignee || getTaskAssignees(task).some(a => a.name.toLowerCase().includes(filterAssignee.toLowerCase()) || a.id.toLowerCase().includes(filterAssignee.toLowerCase()));
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      const matchesModule = !filterModule || task.module.toLowerCase().includes(filterModule.toLowerCase());
      const matchesCreatedBy = !filterCreatedBy || task.createdBy.toLowerCase().includes(filterCreatedBy.toLowerCase());

      // Date Range (createdDate)
      let matchesDateRange = true;
      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        matchesDateRange = matchesDateRange && new Date(task.createdDate) >= start;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        matchesDateRange = matchesDateRange && new Date(task.createdDate) <= end;
      }

      // Due Date match
      let matchesDueDate = true;
      if (filterDueDate) {
        const target = new Date(filterDueDate);
        target.setHours(0, 0, 0, 0);
        const taskDue = new Date(task.expectedCompletionDate);
        taskDue.setHours(0, 0, 0, 0);
        matchesDueDate = taskDue.getTime() === target.getTime();
      }

      // Overdue check
      let matchesOverdue = true;
      if (filterOverdue) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDue = new Date(task.expectedCompletionDate);
        taskDue.setHours(0, 0, 0, 0);
        const isNotDone = task.status !== 'completed' && task.status !== 'moved-to-live' && task.status !== 'prod-deployed';
        const isOverdue = isNotDone && taskDue.getTime() < today.getTime();
        matchesOverdue = isOverdue;
      }

      // Specific Status checks
      const matchesCompleted = !filterCompleted || (task.status === 'completed' || task.status === 'moved-to-live' || task.status === 'prod-deployed');
      const matchesTesting = !filterTesting || (task.status === 'testing' || task.status === 'uat-testing' || task.status === 'uat');
      const matchesDeployment = !filterDeployment || (task.status === 'ready-for-deployment' || task.status === 'deployed' || task.status === 'ready-for-production-deploy' || task.status === 'prod-deployed' || task.status === 'uat-deployed');
      const matchesLive = !filterLive || (task.status === 'moved-to-live' || task.status === 'prod-deployed');
      const matchesCritical = !filterCritical || (task.priority === 'critical');

      // Blocked check
      let matchesBlocked = true;
      if (filterBlocked) {
        const isSelfBlocked = task.status === 'blocked' || task.status === 'uat-rejected';
        let isDepBlocked = false;
        if (task.dependencies && task.dependencies.length > 0) {
          isDepBlocked = task.dependencies.some(depId => {
            const depTask = tasks.find(t => t.taskId === depId);
            return depTask ? (depTask.status !== 'completed' && depTask.status !== 'moved-to-live' && depTask.status !== 'prod-deployed') : false;
          });
        }
        matchesBlocked = isSelfBlocked || isDepBlocked;
      }

      return matchesGlobal && matchesTaskId && matchesProject && matchesAssignee && matchesStatus && matchesPriority &&
             matchesModule && matchesCreatedBy && matchesDateRange && matchesDueDate && matchesOverdue &&
             matchesCompleted && matchesTesting && matchesDeployment && matchesLive && matchesCritical && matchesBlocked;
    });
  }, [
    tasks, globalFilter, filterTaskId, filterProject, filterAssignee, filterStatus, filterPriority,
    filterModule, filterCreatedBy, filterStartDate, filterEndDate, filterDueDate, filterOverdue,
    filterCompleted, filterTesting, filterDeployment, filterLive, filterCritical, filterBlocked, commentsMap
  ]);

  // Tasks dataset for table rendering: full consolidated list in List Mode, or scoped project tasks in Project Drilldown Mode
  const filteredTasks = useMemo(() => {
    if (!selectedProject) return baseFilteredTasks;
    return baseFilteredTasks.filter(task =>
      task.projectName.toLowerCase() === selectedProject.toLowerCase()
    );
  }, [baseFilteredTasks, selectedProject]);

  // Compute Project Summaries directly from baseFilteredTasks so project cards reflect active filters
  const projectsData = useMemo(() => {
    const map = new Map<string, Task[]>();
    baseFilteredTasks.forEach(t => {
      const p = t.projectName || 'Unassigned';
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(t);
    });

    return Array.from(map.entries()).map(([name, projectTasks]) => {
      const total = projectTasks.length;
      const completed = projectTasks.filter(t => t.status === 'completed' || t.status === 'moved-to-live' || t.status === 'prod-deployed').length;
      const testing = projectTasks.filter(t => t.status === 'testing' || t.status === 'uat' || t.status === 'code-review' || t.status === 'uat-testing' || t.status === 'uat-deployed').length;
      const inProgress = projectTasks.filter(t => t.status === 'in-progress' || t.status === 'assigned' || t.status === 'supplier-pending').length;
      const blocked = projectTasks.filter(t => t.status === 'blocked' || t.status === 'uat-rejected').length;
      const critical = projectTasks.filter(t => t.priority === 'critical' && t.status !== 'completed' && t.status !== 'moved-to-live' && t.status !== 'prod-deployed').length;
      
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      // Extract unique assignees
      const assigneeMap = new Map<string, { name: string; color: string }>();
      projectTasks.forEach(t => {
        getTaskAssignees(t).forEach(a => {
          if (a.id && a.name) {
            assigneeMap.set(a.id.toLowerCase(), { name: a.name, color: a.color });
          }
        });
      });
      const assignees = Array.from(assigneeMap.values());

      return {
        name,
        total,
        completed,
        testing,
        inProgress,
        blocked,
        critical,
        progress,
        assignees
      };
    }).sort((a, b) => b.total - a.total);
  }, [baseFilteredTasks]);

  const handleExportCSV = (completedOnly = false) => {
    const list = completedOnly 
      ? filteredTasks.filter(t => t.status === 'completed' || t.status === 'moved-to-live' || t.status === 'prod-deployed')
      : filteredTasks;

    if (list.length === 0) {
      toast.error('No tasks available to export.');
      return;
    }

    const headers = ['Task ID', 'Title', 'Project', 'Assigned To', 'Priority', 'Status', 'Due Date', 'Created By', 'Created Date'];
    const rows = list.map(t => [
      t.taskId,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.projectName.replace(/"/g, '""')}"`,
      `"${getTaskAssigneeNames(t).replace(/"/g, '""')}"`,
      t.priority.toUpperCase(),
      t.status.toUpperCase(),
      formatDate(t.expectedCompletionDate),
      t.createdBy,
      formatDate(t.createdDate)
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${completedOnly ? 'completed_tasks' : 'tasks'}_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV report exported.');
  };

  const handleExportExcel = () => {
    if (filteredTasks.length === 0) {
      toast.error('No tasks available to export.');
      return;
    }

    let excelContent = `
      <xml xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Filtered Tasks</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
        </head>
        <body>
          <table border="1">
            <tr style="background-color: #4F46E5; color: #FFFFFF; font-weight: bold;">
              <td>Task ID</td>
              <td>Title</td>
              <td>Project</td>
              <td>Assigned To</td>
              <td>Priority</td>
              <td>Status</td>
              <td>Due Date</td>
              <td>Created By</td>
              <td>Created Date</td>
            </tr>
    `;

    filteredTasks.forEach(t => {
      excelContent += `
        <tr>
          <td>${t.taskId}</td>
          <td>${t.title}</td>
          <td>${t.projectName}</td>
          <td>${getTaskAssigneeNames(t)}</td>
          <td>${t.priority.toUpperCase()}</td>
          <td>${t.status.toUpperCase()}</td>
          <td>${formatDate(t.expectedCompletionDate)}</td>
          <td>${t.createdBy}</td>
          <td>${formatDate(t.createdDate)}</td>
        </tr>
      `;
    });

    excelContent += `
          </table>
        </body>
      </xml>
    `;

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_export_${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Excel report exported.');
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleDeleteTask = async (task: Task) => {
    if (!isManager) {
      toast.error('Only managers can delete tasks');
      return;
    }

    if (confirm(`Are you sure you want to delete ${task.taskId}?`)) {
      console.log(`[All Tasks] Initiating soft delete for task: ${task.taskId}`);
      try {
        await dbService.deleteTask(task.id!, user?.email || 'nm@i2space.com');
        console.log(`[All Tasks] Task ${task.taskId} deleted successfully.`);
        setTasks(prev => prev.filter(t => t.id !== task.id));
        setIsDetailOpen(false);
        // Dispatch global refresh event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('task-updated'));
        }
        toast.success('Task soft deleted successfully');
      } catch (error) {
        console.error('[All Tasks] Error soft deleting task:', error);
        toast.error('Failed to delete task');
      }
    }
  };

  const handleEditClick = (task: Task) => {
    setTaskToEdit(task);
    setIsEditOpen(true);
  };

  const handleEditSuccess = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));

    // Sync detailed drawer state if it matches the current view
    if (selectedTask?.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }
  };

  // Define Columns
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
        cell: ({ row }) => <span className="font-mono text-xs font-bold text-muted-foreground">{row.original.taskId}</span>
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
        accessorKey: 'title',
        header: () => <span className="font-bold text-xs tracking-wider uppercase">Task Title</span>,
        cell: ({ row }) => (
          <div className="max-w-xs md:max-w-md truncate">
            <p className="font-extrabold text-sm text-foreground line-clamp-1">{row.original.title}</p>
            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{row.original.description}</p>
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
              <span className="text-xs font-semibold whitespace-nowrap truncate max-w-[140px]">
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
        cell: ({ row }) => (
          <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">{formatDate(row.original.expectedCompletionDate)}</span>
        )
      },
      {
        accessorKey: 'createdBy',
        header: () => <span className="font-bold text-xs tracking-wider uppercase">Created By</span>,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate max-w-[100px] block" title={row.original.createdBy}>
            {row.original.createdBy.split('@')[0]}
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
    setFilterTaskId('');
    setFilterProject('');
    setFilterAssignee('');
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterModule('');
    setFilterCreatedBy('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterDueDate('');
    setFilterOverdue(false);
    setFilterCompleted(false);
    setFilterTesting(false);
    setFilterDeployment(false);
    setFilterLive(false);
    setFilterCritical(false);
    setFilterBlocked(false);
  };

  const getProjectColors = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      { from: 'from-blue-500/20', to: 'to-indigo-500/5', border: 'border-blue-500/20', text: 'text-blue-500' },
      { from: 'from-emerald-500/20', to: 'to-teal-500/5', border: 'border-emerald-500/20', text: 'text-emerald-500' },
      { from: 'from-violet-500/20', to: 'to-purple-500/5', border: 'border-violet-500/20', text: 'text-violet-500' },
      { from: 'from-pink-500/20', to: 'to-rose-500/5', border: 'border-pink-500/20', text: 'text-pink-500' },
      { from: 'from-amber-500/20', to: 'to-orange-500/5', border: 'border-amber-500/20', text: 'text-amber-500' }
    ];
    return colors[hash % colors.length];
  };

  return (
    <div className="space-y-6 pb-28">
      {/* --- TOP HEADER & CONTROLS --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight">
              {viewMode === 'list' 
                ? 'All Tasks' 
                : selectedProject 
                  ? `${selectedProject} Tasks` 
                  : 'Scope Directory'}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {viewMode === 'list'
              ? 'Consolidated roster of all tasks across all projects.'
              : selectedProject
                ? `Search, sort, filter, and audit tasks for project ${selectedProject}.`
                : 'Select a project to view and manage its task configurations.'}
          </p>
        </div>

        {/* View Switcher & Quick Stats Summary */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto justify-end">
          {/* Segmented View Switcher */}
          <div className="flex items-center bg-card/60 border border-card-border p-1 rounded-xl backdrop-blur-md shadow-sm select-none">
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setSelectedProject(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>All Tasks</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('project');
                setSelectedProject(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'project'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
              }`}
            >
              <Folder className="h-3.5 w-3.5" />
              <span>Project-wise</span>
            </button>
          </div>

          {/* Quick Stats Summary */}
          <div className="flex items-center gap-3 bg-card/45 border border-card-border px-3.5 py-2 rounded-xl backdrop-blur-md">
            <div className="text-center px-1.5">
              <p className="text-[9px] uppercase font-bold text-muted-foreground">Projects</p>
              <p className="text-lg font-extrabold text-foreground">{projectsData.length}</p>
            </div>
            <div className="h-7 w-px bg-border/40" />
            <div className="text-center px-1.5">
              <p className="text-[9px] uppercase font-bold text-muted-foreground">Tasks</p>
              <p className="text-lg font-extrabold text-primary">{baseFilteredTasks.length}</p>
            </div>
            <div className="h-7 w-px bg-border/40" />
            <div className="text-center px-1.5">
              <p className="text-[9px] uppercase font-bold text-muted-foreground">Done</p>
              <p className="text-lg font-extrabold text-emerald-500">
                {baseFilteredTasks.filter(t => t.status === 'completed' || t.status === 'moved-to-live' || t.status === 'prod-deployed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation when inside Project Drill-down */}
      {viewMode === 'project' && selectedProject && (
        <div className="no-print -mb-2">
          <button
            onClick={() => setSelectedProject(null)}
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit group py-1"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Projects</span>
          </button>
        </div>
      )}

      {/* --- SHARED FILTER & EXPORTER TOOLBAR --- */}
      <div className="flex flex-col gap-4 bg-card/45 border border-card-border p-4 rounded-2xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          {/* Global Search */}
          <div className="relative w-full sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder={viewMode === 'list' ? "Search all tasks, projects, comments..." : "Search project directory..."}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-background/50 border border-border rounded-xl outline-none text-sm focus:border-primary/50 text-foreground"
            />
          </div>

          {/* Exporters & Advanced Filter Toggle */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 shrink-0 no-print">
            {/* Exporter Controls */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-card-border bg-background/50 hover:bg-accent/60 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
                title="Export Filtered Tasks to Excel"
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">Export Excel</span>
              </button>
              <button
                onClick={() => handleExportCSV(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-card-border bg-background/50 hover:bg-accent/60 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
                title="Export Filtered Tasks to CSV"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={() => handleExportCSV(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-card-border bg-background/50 hover:bg-accent/60 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
                title="Export Completed Tasks to CSV"
              >
                <Download className="h-3.5 w-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Completed CSV</span>
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-card-border bg-background/50 hover:bg-accent/60 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
                title="Print or Save PDF"
              >
                <Printer className="h-3.5 w-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Print (PDF)</span>
              </button>
            </div>

            {/* Advanced Filters Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                showFilters || filterStatus !== 'all' || filterPriority !== 'all' || filterProject || filterTaskId || filterAssignee || filterModule || filterCreatedBy || filterStartDate || filterEndDate || filterDueDate || filterOverdue || filterCompleted || filterTesting || filterDeployment || filterLive || filterCritical || filterBlocked
                  ? 'border-primary/40 bg-primary/5 text-primary'
                  : 'border-border hover:bg-accent/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Advanced Filters</span>
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Drawer */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-border/40 pt-4 mt-2 space-y-4"
            >
              {/* Input Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* Task ID Search */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Task ID</label>
                  <input
                    type="text"
                    placeholder="e.g. TASK-000001"
                    value={filterTaskId}
                    onChange={(e) => setFilterTaskId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background/40 text-xs outline-none focus:border-primary/40 text-foreground"
                  />
                </div>

                {/* Project Search */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Project</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Website"
                    value={filterProject}
                    onChange={(e) => setFilterProject(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background/40 text-xs outline-none focus:border-primary/40 text-foreground"
                  />
                </div>

                {/* Assignee Search */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Assignee</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah"
                    value={filterAssignee}
                    onChange={(e) => setFilterAssignee(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background/40 text-xs outline-none focus:border-primary/40 text-foreground"
                  />
                </div>

                {/* Status Select */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-2 py-1.5 border border-border rounded-lg bg-background/40 text-xs outline-none cursor-pointer focus:border-primary/40 text-foreground"
                  >
                    <option value="all">All Statuses</option>
                    <option value="assigned">Assigned</option>
                    <option value="in-progress">In Progress</option>
                    <option value="supplier-pending">Supplier Pending</option>
                    <option value="code-review">Code Review</option>
                    <option value="uat-deployed">UAT Deployed</option>
                    <option value="uat-testing">UAT Testing</option>
                    <option value="uat-rejected">UAT Rejected</option>
                    <option value="ready-for-production-deploy">Ready for Production Deploy</option>
                    <option value="prod-deployed">Prod Deployed</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Priority Select */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Priority</label>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="w-full px-2 py-1.5 border border-border rounded-lg bg-background/40 text-xs outline-none cursor-pointer focus:border-primary/40 text-foreground"
                  >
                    <option value="all">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                {/* Module Search */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Module</label>
                  <input
                    type="text"
                    placeholder="e.g. Auth"
                    value={filterModule}
                    onChange={(e) => setFilterModule(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background/40 text-xs outline-none focus:border-primary/40 text-foreground"
                  />
                </div>

                {/* Created By Search */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Created By</label>
                  <input
                    type="text"
                    placeholder="e.g. admin@co.com"
                    value={filterCreatedBy}
                    onChange={(e) => setFilterCreatedBy(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background/40 text-xs outline-none focus:border-primary/40 text-foreground"
                  />
                </div>

                {/* Due Date Match */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Due Date</label>
                  <input
                    type="date"
                    value={filterDueDate}
                    onChange={(e) => setFilterDueDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-border rounded-lg bg-background/40 text-xs outline-none focus:border-primary/40 text-foreground cursor-pointer"
                  />
                </div>

                {/* Created Start Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Created From</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-border rounded-lg bg-background/40 text-xs outline-none focus:border-primary/40 text-foreground cursor-pointer"
                  />
                </div>

                {/* Created End Date */}
                <div className="space-y-1 col-span-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Created To</label>
                    {(filterTaskId || filterProject || filterAssignee || filterStatus !== 'all' || filterPriority !== 'all' || filterModule || filterCreatedBy || filterStartDate || filterEndDate || filterDueDate || filterOverdue || filterCompleted || filterTesting || filterDeployment || filterLive || filterCritical || filterBlocked) && (
                      <button
                        onClick={clearFilters}
                        className="text-[9px] text-destructive font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <X className="h-2 w-2" /> Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-border rounded-lg bg-background/40 text-xs outline-none focus:border-primary/40 text-foreground cursor-pointer"
                  />
                </div>
              </div>

              {/* Status and Toggle Tags Grid */}
              <div className="border-t border-border/20 pt-3 flex flex-wrap gap-2 items-center">
                <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider mr-2">Toggle Overrides:</span>
                
                {/* Overdue */}
                <button
                  onClick={() => setFilterOverdue(!filterOverdue)}
                  className={`flex items-center gap-1 px-3 py-1.5 border rounded-full text-xs font-semibold cursor-pointer transition-all ${filterOverdue
                    ? 'bg-red-500/10 border-red-500/40 text-red-500 shadow-sm'
                    : 'bg-background/20 border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'}`}
                >
                  {filterOverdue && <Check className="h-3 w-3" />}
                  <span>Overdue</span>
                </button>

                {/* Completed */}
                <button
                  onClick={() => setFilterCompleted(!filterCompleted)}
                  className={`flex items-center gap-1 px-3 py-1.5 border rounded-full text-xs font-semibold cursor-pointer transition-all ${filterCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500 shadow-sm'
                    : 'bg-background/20 border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'}`}
                >
                  {filterCompleted && <Check className="h-3 w-3" />}
                  <span>Completed</span>
                </button>

                {/* Testing */}
                <button
                  onClick={() => setFilterTesting(!filterTesting)}
                  className={`flex items-center gap-1 px-3 py-1.5 border rounded-full text-xs font-semibold cursor-pointer transition-all ${filterTesting
                    ? 'bg-purple-500/10 border-purple-500/40 text-purple-500 shadow-sm'
                    : 'bg-background/20 border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'}`}
                >
                  {filterTesting && <Check className="h-3 w-3" />}
                  <span>Testing</span>
                </button>

                {/* Deployment */}
                <button
                  onClick={() => setFilterDeployment(!filterDeployment)}
                  className={`flex items-center gap-1 px-3 py-1.5 border rounded-full text-xs font-semibold cursor-pointer transition-all ${filterDeployment
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-500 shadow-sm'
                    : 'bg-background/20 border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'}`}
                >
                  {filterDeployment && <Check className="h-3 w-3" />}
                  <span>Deployment</span>
                </button>

                {/* Live */}
                <button
                  onClick={() => setFilterLive(!filterLive)}
                  className={`flex items-center gap-1 px-3 py-1.5 border rounded-full text-xs font-semibold cursor-pointer transition-all ${filterLive
                    ? 'bg-sky-500/10 border-sky-500/40 text-sky-500 shadow-sm'
                    : 'bg-background/20 border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'}`}
                >
                  {filterLive && <Check className="h-3 w-3" />}
                  <span>Live</span>
                </button>

                {/* Critical */}
                <button
                  onClick={() => setFilterCritical(!filterCritical)}
                  className={`flex items-center gap-1 px-3 py-1.5 border rounded-full text-xs font-semibold cursor-pointer transition-all ${filterCritical
                    ? 'bg-orange-500/10 border-orange-500/40 text-orange-500 shadow-sm'
                    : 'bg-background/20 border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'}`}
                >
                  {filterCritical && <Check className="h-3 w-3" />}
                  <span>Critical</span>
                </button>

                {/* Blocked */}
                <button
                  onClick={() => setFilterBlocked(!filterBlocked)}
                  className={`flex items-center gap-1 px-3 py-1.5 border rounded-full text-xs font-semibold cursor-pointer transition-all ${filterBlocked
                    ? 'bg-pink-500/10 border-pink-500/40 text-pink-500 shadow-sm'
                    : 'bg-background/20 border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'}`}
                >
                  {filterBlocked && <Check className="h-3 w-3" />}
                  <span>Blocked</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- PRESENTATION LAYER --- */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : viewMode === 'project' && !selectedProject ? (
        /* --- PROJECT-WISE CARDS GRID VIEW --- */
        projectsData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projectsData.map((project) => {
              const colors = getProjectColors(project.name);
              return (
                <motion.div
                  key={project.name}
                  whileHover={{ y: -4, scale: 1.01 }}
                  onClick={() => setSelectedProject(project.name)}
                  className="glass-panel border border-card-border p-5 rounded-2xl hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between h-[230px]"
                >
                  <div>
                    {/* Project Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.from} ${colors.to} border ${colors.border} flex items-center justify-center font-extrabold ${colors.text} text-xs shadow-inner uppercase`}>
                          {project.name.slice(0, 3)}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base text-foreground transition-colors truncate max-w-[150px]">
                            {project.name}
                          </h3>
                          <span className="text-xs text-muted-foreground font-semibold">
                            {project.total} {project.total === 1 ? 'task' : 'tasks'} total
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>

                    {/* Project Progress */}
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                        <span>Progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-secondary/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Team Members & Stats Section */}
                  <div className="mt-4 pt-3 border-t border-border/20 flex items-center justify-between">
                    {/* Assignee Avatars */}
                    <div className="flex -space-x-2 overflow-hidden py-1">
                      {project.assignees.slice(0, 4).map((assignee, idx) => (
                        <div
                          key={idx}
                          title={assignee.name}
                          className="inline-block h-6 w-6 rounded-full ring-2 ring-background flex items-center justify-center font-bold text-white text-[9px] shadow-sm select-none"
                          style={{ backgroundColor: assignee.color }}
                        >
                          {assignee.name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {project.assignees.length > 4 && (
                        <div className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-card/60 flex items-center justify-center font-bold text-[9px] text-muted-foreground select-none border border-card-border">
                          +{project.assignees.length - 4}
                        </div>
                      )}
                      {project.assignees.length === 0 && (
                        <span className="text-[10px] text-muted-foreground">No assignees</span>
                      )}
                    </div>

                    {/* Stats Breakdown */}
                    <div className="flex gap-3 text-right">
                      {project.critical > 0 && (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase text-red-500">Critical</span>
                          <span className="text-xs font-extrabold text-red-500">{project.critical}</span>
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Active</span>
                        <span className="text-xs font-extrabold text-foreground">{project.total - project.completed}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-emerald-500">Done</span>
                        <span className="text-xs font-extrabold text-emerald-500">{project.completed}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground mb-4" />
            <h3 className="font-extrabold text-lg">No projects match the current filters</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Try adjusting your search queries or filter choices.
            </p>
          </div>
        )
      ) : (
        /* --- CONSOLIDATED ALL TASKS TABLE VIEW (Default) OR DRILLED-DOWN PROJECT TABLE --- */
        filteredTasks.length > 0 ? (
          <div className="space-y-4">
            {/* Sticky Header Glass Table Container with full vertical & horizontal accessibility */}
            <div className="glass-panel rounded-2xl overflow-auto border border-card-border shadow-sm max-h-[calc(100vh-260px)] min-h-[300px]">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-md shadow-sm border-b border-card-border">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="text-left px-5 py-4 text-xs font-bold text-muted-foreground tracking-wider select-none border-b border-card-border">
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

            {/* Pagination controls with clear safe area */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-card/40 border border-card-border rounded-xl backdrop-blur-md select-none">
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

                {/* Interactive Page Number Buttons */}
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
          <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground mb-4" />
            <h3 className="font-extrabold text-lg">No tasks found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Try adjusting your search queries or filter choices.
            </p>
          </div>
        )
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
