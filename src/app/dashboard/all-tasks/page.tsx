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
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate } from '@/utils';
import toast from 'react-hot-toast';

export default function AllTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Real-time task syncing
  useEffect(() => {
    setLoading(true);
    const unsubscribe = dbService.subscribeTasks((fetched) => {
      setTasks(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleExportCSV = (completedOnly = false) => {
    const list = completedOnly 
      ? filteredTasks.filter(t => t.status === 'completed' || t.status === 'moved-to-live')
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
      `"${t.assigneeName.replace(/"/g, '""')}"`,
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
          <td>${t.assigneeName}</td>
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
        accessorKey: 'assigneeName',
        header: () => <span className="font-bold text-xs tracking-wider uppercase">Assigned To</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div
              className="w-6.5 h-6.5 rounded-full flex items-center justify-center font-bold text-white text-[10px] shadow-sm shrink-0"
              style={{ backgroundColor: row.original.assigneeColor }}
            >
              {row.original.assigneeName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-semibold whitespace-nowrap">{row.original.assigneeName}</span>
          </div>
        )
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

  // Apply filters on the raw task list client-side
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Global Search in comments map
      const taskComments = commentsMap.get(task.id!) || [];
      const matchesComments = taskComments.some(content => content.includes(globalFilter.toLowerCase()));

      const matchesGlobal =
        task.title.toLowerCase().includes(globalFilter.toLowerCase()) ||
        task.projectName.toLowerCase().includes(globalFilter.toLowerCase()) ||
        task.description.toLowerCase().includes(globalFilter.toLowerCase()) ||
        task.taskId.toLowerCase().includes(globalFilter.toLowerCase()) ||
        task.assigneeName.toLowerCase().includes(globalFilter.toLowerCase()) ||
        (task.remarks || '').toLowerCase().includes(globalFilter.toLowerCase()) ||
        matchesComments;

      // Advanced column searches
      const matchesTaskId = !filterTaskId || task.taskId.toLowerCase().includes(filterTaskId.toLowerCase());
      const matchesProject = !filterProject || task.projectName.toLowerCase().includes(filterProject.toLowerCase());
      const matchesAssignee = !filterAssignee || task.assigneeName.toLowerCase().includes(filterAssignee.toLowerCase());
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      const matchesModule = !filterModule || task.module.toLowerCase().includes(filterModule.toLowerCase());
      const matchesCreatedBy = !filterCreatedBy || task.createdBy.toLowerCase().includes(filterCreatedBy.toLowerCase());

      // Date Range (createdDate)
      let matchesDateRange = true;
      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0,0,0,0);
        matchesDateRange = matchesDateRange && new Date(task.createdDate) >= start;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23,59,59,999);
        matchesDateRange = matchesDateRange && new Date(task.createdDate) <= end;
      }

      // Due Date match
      let matchesDueDate = true;
      if (filterDueDate) {
        const target = new Date(filterDueDate);
        target.setHours(0,0,0,0);
        const taskDue = new Date(task.expectedCompletionDate);
        taskDue.setHours(0,0,0,0);
        matchesDueDate = taskDue.getTime() === target.getTime();
      }

      // Overdue check
      let matchesOverdue = true;
      if (filterOverdue) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const taskDue = new Date(task.expectedCompletionDate);
        taskDue.setHours(0,0,0,0);
        const isNotDone = task.status !== 'completed' && task.status !== 'moved-to-live';
        const isOverdue = isNotDone && taskDue.getTime() < today.getTime();
        matchesOverdue = isOverdue;
      }

      // Specific Status checks
      const matchesCompleted = !filterCompleted || (task.status === 'completed' || task.status === 'moved-to-live');
      const matchesTesting = !filterTesting || (task.status === 'testing');
      const matchesDeployment = !filterDeployment || (task.status === 'ready-for-deployment' || task.status === 'deployed');
      const matchesLive = !filterLive || (task.status === 'moved-to-live');
      const matchesCritical = !filterCritical || (task.priority === 'critical');

      // Blocked check
      let matchesBlocked = true;
      if (filterBlocked) {
        const isSelfBlocked = task.status === 'blocked';
        let isDepBlocked = false;
        if (task.dependencies && task.dependencies.length > 0) {
          isDepBlocked = task.dependencies.some(depId => {
            const depTask = tasks.find(t => t.taskId === depId);
            return depTask ? (depTask.status !== 'completed' && depTask.status !== 'moved-to-live') : false;
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Scope Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">Search, sort, filter, and audit task configurations.</p>
        </div>

        {/* Exporter Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-card-border bg-background/50 hover:bg-accent/60 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => handleExportCSV(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-card-border bg-background/50 hover:bg-accent/60 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleExportCSV(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-card-border bg-background/50 hover:bg-accent/60 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-emerald-500" />
            <span>Completed CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-card-border bg-background/50 hover:bg-accent/60 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
          >
            <Printer className="h-3.5 w-3.5 text-indigo-500" />
            <span>Print Report (PDF)</span>
          </button>
        </div>
      </div>

      {/* Query Filter and Toggle bar */}
      <div className="flex flex-col gap-4 bg-card/45 border border-card-border p-4 rounded-2xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          {/* Global Search */}
          <div className="relative w-full sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search directory..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-background/50 border border-border rounded-xl outline-none text-sm focus:border-primary/50"
            />
          </div>

          {/* Advanced toggle */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-all cursor-pointer ${showFilters || filterStatus !== 'all' || filterPriority !== 'all' || filterProject || filterTaskId || filterAssignee
                  ? 'border-primary/40 bg-primary/5 text-primary'
                  : 'border-border hover:bg-accent/40 text-muted-foreground hover:text-foreground'
                }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Advanced Filters</span>
            </button>
          </div>
        </div>

        {/* Collapsible advanced column trays */}
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
                    <option value="development-completed">Dev Completed</option>
                    <option value="code-review">Code Review</option>
                    <option value="testing">Testing</option>
                    <option value="uat">UAT</option>
                    <option value="ready-for-deployment">Ready for Deploy</option>
                    <option value="deployed">Deployed</option>
                    <option value="moved-to-live">Moved to Live</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                    <option value="on-hold">On Hold</option>
                    <option value="cancelled">Cancelled</option>
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

      {/* Main Table view */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="space-y-4">
          {/* Sticky Header Glass Table Container */}
          <div className="glass-panel rounded-2xl overflow-hidden overflow-x-auto max-h-[60vh]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-card/90 backdrop-blur-md shadow-sm border-b border-card-border">
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

          {/* Pagination controls */}
          <div className="flex items-center justify-between px-2 py-1 select-none">
            <span className="text-xs text-muted-foreground font-medium">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} ({filteredTasks.length} tasks matching)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 border border-border rounded-lg bg-card/50 hover:bg-accent/40 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1.5 border border-border rounded-lg bg-card/50 hover:bg-accent/40 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ArrowRight className="h-4 w-4" />
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
