'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { dbService } from '@/services/dbService';
import { Task, Member, TaskStatus, TaskPriority } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { 
  FolderKanban, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Calendar, 
  AlertCircle, 
  Loader2, 
  Layers,
  ArrowRight,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDate } from '@/utils';
import PriorityBadge from '@/components/tasks/PriorityBadge';
import StatusBadge from '@/components/tasks/StatusBadge';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog';
import toast from 'react-hot-toast';

const COLUMNS: { id: TaskStatus; label: string; bg: string; border: string; text: string }[] = [
  { id: 'assigned', label: 'Assigned', bg: 'bg-zinc-500/5', border: 'border-zinc-500/10', text: 'text-zinc-400' },
  { id: 'in-progress', label: 'In Progress', bg: 'bg-blue-500/5', border: 'border-blue-500/10', text: 'text-blue-400' },
  { id: 'development-completed', label: 'Dev Done', bg: 'bg-indigo-500/5', border: 'border-indigo-500/10', text: 'text-indigo-400' },
  { id: 'code-review', label: 'Code Review', bg: 'bg-orange-500/5', border: 'border-orange-500/10', text: 'text-orange-400' },
  { id: 'testing', label: 'Testing', bg: 'bg-purple-500/5', border: 'border-purple-500/10', text: 'text-purple-400' },
  { id: 'uat', label: 'UAT', bg: 'bg-violet-500/5', border: 'border-violet-500/10', text: 'text-violet-400' },
  { id: 'ready-for-deployment', label: 'Ready for Deploy', bg: 'bg-teal-500/5', border: 'border-teal-500/10', text: 'text-teal-400' },
  { id: 'deployed', label: 'Deployed', bg: 'bg-cyan-500/5', border: 'border-cyan-500/10', text: 'text-cyan-400' },
  { id: 'moved-to-live', label: 'Moved to Live', bg: 'bg-emerald-500/5', border: 'border-emerald-500/10', text: 'text-emerald-400' },
  { id: 'completed', label: 'Completed', bg: 'bg-green-500/5', border: 'border-green-500/10', text: 'text-green-400' }
];

export default function KanbanPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');

  // Detail Drawer States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [maxScrollPosition, setMaxScrollPosition] = useState(0);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const isEmployee = user?.role === 'Member';

  // Listen to tasks & members in real-time
  useEffect(() => {
    setLoading(true);
    const unsubscribeTasks = dbService.subscribeTasks((fetchedTasks) => {
      setTasks(fetchedTasks);
      setLoading(false);
    });

    const unsubscribeMembers = dbService.subscribeMembers((fetchedMembers) => {
      setMembers(fetchedMembers);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeMembers();
    };
  }, []);

  // Handle scroll position tracking
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    setScrollPosition(container.scrollLeft);
    
    // Calculate max scroll position
    const maxScroll = container.scrollWidth - container.clientWidth;
    setMaxScrollPosition(maxScroll);
  };

  const projectList = useMemo(() => {
    const list = new Set<string>();
    tasks.forEach(t => {
      if (t.projectName) list.add(t.projectName);
    });
    return Array.from(list);
  }, [tasks]);

  // Derived Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Access Control: Employee can ONLY view their own assigned tasks
      if (isEmployee && task.assigneeId.toLowerCase() !== user?.email.toLowerCase()) {
        return false;
      }

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchId = task.taskId?.toLowerCase().includes(q);
        const matchTitle = task.title?.toLowerCase().includes(q);
        const matchDesc = task.description?.toLowerCase().includes(q);
        const matchUser = task.assigneeName?.toLowerCase().includes(q);
        const matchProject = task.projectName?.toLowerCase().includes(q);
        if (!matchId && !matchTitle && !matchDesc && !matchUser && !matchProject) {
          return false;
        }
      }

      if (selectedProject !== 'all' && task.projectName.toLowerCase() !== selectedProject.toLowerCase()) {
        return false;
      }
      if (selectedEmployee !== 'all' && task.assigneeId.toLowerCase() !== selectedEmployee.toLowerCase()) {
        return false;
      }
      if (selectedPriority !== 'all' && task.priority.toLowerCase() !== selectedPriority.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, selectedProject, selectedEmployee, selectedPriority, isEmployee, user]);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    // Find the task in local state
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.status === status) return;

    // Check Employee rule: employee can only update status of their OWN assigned tasks
    if (isEmployee && task.assigneeId.toLowerCase() !== user?.email.toLowerCase()) {
      toast.error('Permission Denied: Employees can only move tasks assigned to themselves.');
      return;
    }

    try {
      await dbService.updateTask(taskId, { status }, user?.email || '', user?.displayName || '');
      toast.success(`Task status updated to ${status.replace('-', ' ')}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  // Exporter: client-side CSV downloader
  const handleExportCSV = () => {
    if (filteredTasks.length === 0) {
      toast.error('No tasks available to export.');
      return;
    }

    const headers = ['Task ID', 'Project', 'Title', 'Priority', 'Status', 'Assignee', 'Due Date', 'Created By'];
    const rows = filteredTasks.map(t => [
      t.taskId,
      `"${t.projectName.replace(/"/g, '""')}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      t.priority.toUpperCase(),
      t.status.toUpperCase(),
      t.assigneeName,
      formatDate(t.expectedCompletionDate),
      t.createdBy
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kanban_tasks_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none h-[calc(100vh-120px)] flex flex-col min-w-0 overflow-hidden">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <FolderKanban className="h-7 w-7 text-primary animate-pulse" />
            Workspace Kanban
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Drag and drop cards between status pools to update progression.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 border border-card-border bg-background/50 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all cursor-pointer shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-card-border grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/80" />
          <input
            type="text"
            placeholder="Search Board tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background/60 border border-card-border rounded-xl py-2 pl-9 pr-4 text-xs font-medium placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>

        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="bg-background/60 border border-card-border rounded-xl py-2 px-3.5 text-xs font-medium text-foreground cursor-pointer focus:outline-none"
        >
          <option value="all">All Projects</option>
          {projectList.map(proj => (
            <option key={proj} value={proj}>{proj}</option>
          ))}
        </select>

        {!isEmployee && (
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="bg-background/60 border border-card-border rounded-xl py-2 px-3.5 text-xs font-medium text-foreground cursor-pointer focus:outline-none"
          >
            <option value="all">All Assignees</option>
            {members.map(m => (
              <option key={m.id} value={m.email}>{m.name}</option>
            ))}
          </select>
        )}

        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="bg-background/60 border border-card-border rounded-xl py-2 px-3.5 text-xs font-medium text-foreground cursor-pointer focus:outline-none"
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Kanban Scrollable Column Board */}
      <div className="flex-1 relative border border-card-border rounded-2xl bg-background/30 overflow-hidden min-w-0">
        {/* Scroll Container - Only this scrolls, not the page */}
        <div 
          ref={scrollContainerRef}
          className="w-full h-full overflow-x-auto overflow-y-hidden"
          onScroll={handleScroll}
        >
          {/* Inner flex container - expands to fit content */}
          <div className="inline-flex gap-4 p-4 h-full">
            {COLUMNS.map(col => {
              const colTasks = filteredTasks.filter(t => t.status === col.id);
              
              return (
                <div
                  key={col.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`w-80 shrink-0 rounded-2xl border ${col.border} ${col.bg} p-3.5 flex flex-col h-full overflow-hidden`}
                >
                  {/* Column Header */}
                  <div className="flex justify-between items-center pb-2.5 mb-3.5 border-b border-card-border/60 shrink-0">
                    <span className="text-xs font-extrabold tracking-wide uppercase text-foreground">
                      {col.label}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded bg-accent/60 ${col.text}`}>
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Cards Container */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
                    {colTasks.length > 0 ? (
                      colTasks.map(task => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id!)}
                          onClick={() => {
                            setSelectedTask(task);
                            setIsDetailOpen(true);
                          }}
                          className="glass-panel p-3.5 rounded-xl border border-card-border hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing hover:scale-[1.01] duration-200 relative group space-y-3 bg-card/65 select-none"
                        >
                          {/* Top Row: Task Seq ID & Project */}
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[9px] font-bold font-mono text-muted-foreground">{task.taskId}</span>
                            <span className="text-[9px] font-extrabold text-primary bg-primary/5 px-1.5 py-0.5 rounded max-w-[120px] truncate uppercase border border-primary/10">
                              {task.projectName}
                            </span>
                          </div>

                          {/* Title */}
                          <h4 className="font-extrabold text-xs text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                            {task.title}
                          </h4>

                          {/* Info Footer */}
                          <div className="flex justify-between items-center pt-2.5 border-t border-border/20">
                            {/* Assignee Avatar */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div 
                                className="w-5.5 h-5.5 rounded-full flex items-center justify-center font-bold text-white text-[8px] shrink-0 shadow-inner"
                                style={{ backgroundColor: task.assigneeColor || '#3b82f6' }}
                              >
                                {task.assigneeName.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[9px] text-muted-foreground font-semibold truncate">
                                {task.assigneeName.split(' ')[0]}
                              </span>
                            </div>
                            
                            {/* Priority Badge */}
                            <PriorityBadge priority={task.priority} className="text-[8px] py-0.5" />
                          </div>

                          {/* Due Date alert if critical/high */}
                          <div className="flex items-center gap-1 text-[8.5px] font-bold text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>Due: {formatDate(task.expectedCompletionDate)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-28 rounded-xl border border-dashed border-card-border/40 flex items-center justify-center p-4">
                        <p className="text-[10px] text-muted-foreground/60 italic text-center">Empty pool. Drop items here.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Left Scroll Arrow - Show only when not at start */}
        {scrollPosition > 10 && (
          <button
            onClick={() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' });
              }
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-xl z-50 transition-all duration-200 hover:scale-110 active:scale-95"
            title="Scroll Left"
            aria-label="Scroll Kanban board left"
          >
            <ArrowRight className="h-5 w-5 rotate-180" />
          </button>
        )}

        {/* Right Scroll Arrow - Show only when not at end */}
        {scrollPosition < maxScrollPosition - 10 && (
          <button
            onClick={() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' });
              }
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-xl z-50 transition-all duration-200 hover:scale-110 active:scale-95"
            title="Scroll Right"
            aria-label="Scroll Kanban board right"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Task Details Drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          isOpen={isDetailOpen}
          onClose={() => {
            setSelectedTask(null);
            setIsDetailOpen(false);
          }}
          task={selectedTask}
        />
      )}

      {/* Task Creation Dialog */}
      <CreateTaskDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {}}
      />

      {/* Floating Create Task Button - Fixed to viewport */}
      <button
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-6 right-6 flex items-center justify-center p-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg hover:shadow-xl z-50 transition-all duration-200 hover:scale-110 active:scale-95 group"
        title="Create New Task"
        aria-label="Create new task"
      >
        <Plus className="h-6 w-6" />
      </button>

    </div>
  );
}
