'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { dbService } from '@/services/dbService';
import { Task, TaskPriority } from '@/types';
import TaskCard from '@/components/tasks/TaskCard';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog';
import {
  ClipboardList,
  Loader2,
  CalendarCheck,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { isUserAssignedToTask } from '@/utils';

type ActiveTab = 'all' | 'today' | 'overdue' | 'completed';

export default function MyTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');

  // Detail Drawer & Edit Modal States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  const [isEditOpen, setIsEditOpen] = useState(false);

  async function loadTasks() {
    console.log("[My Tasks] Loading tasks initiated...");
    if (user) {
      console.log("[My Tasks] Active user email session:", user.email);
      try {
        const allTasks = await dbService.getTasks();
        const myTasks = allTasks.filter(t => 
          isUserAssignedToTask(t, user.email) ||
          (t.status === 'uat' && t.createdBy.toLowerCase() === user.email.toLowerCase())
        );
        console.log("[My Tasks] Workspace tasks fetched count:", myTasks.length);
        setTasks(myTasks);
      } catch (error) {
        console.error('[My Tasks] Error:', error);
        toast.error('Failed to retrieve your task checklist');
      } finally {
        setLoading(false);
      }
    } else {
      console.log("[My Tasks] No active user session resolved yet, hiding loader");
      setLoading(false);
    }
  }

  // Load and register events
  useEffect(() => {
    loadTasks();
    if (typeof window !== 'undefined') {
      window.addEventListener('task-updated', loadTasks);
      return () => window.removeEventListener('task-updated', loadTasks);
    }
  }, [user]);

  const handleEditClick = (task: Task) => {
    setTaskToEdit(task);
    setIsEditOpen(true);
  };

  const handleEditSuccess = (updatedTask: Task) => {
    // Re-fetch or locally update list
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));

    // Sync drawer
    if (selectedTask?.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      await dbService.deleteTask(task.id!, user?.email || 'nm@i2space.com');
      setTasks(prev => prev.filter(t => t.id !== task.id));
      setIsDetailOpen(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('task-updated'));
      }
      toast.success('Task soft deleted');
    } catch (e) {
      toast.error('Failed to delete task');
    }
  };

  // Filter tasks based on selected tab
  const filteredTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    return tasks.filter(task => {
      switch (activeTab) {
        case 'today': {
          if (!task.expectedCompletionDate) return false;
          const d = new Date(task.expectedCompletionDate);
          if (isNaN(d.getTime())) return false;
          const taskDate = d.toISOString().split('T')[0];
          return taskDate === todayStr && task.status !== 'completed' && task.status !== 'moved-to-live';
        }
        case 'overdue': {
          if (task.status === 'completed' || task.status === 'moved-to-live' || task.status === 'cancelled') return false;
          if (!task.expectedCompletionDate) return false;
          const taskDueDate = new Date(task.expectedCompletionDate);
          if (isNaN(taskDueDate.getTime())) return false;
          taskDueDate.setHours(0, 0, 0, 0);
          return taskDueDate.getTime() < todayDate.getTime();
        }
        case 'completed':
          return task.status === 'completed' || task.status === 'moved-to-live';
        case 'all':
        default:
          return true;
      }
    });
  }, [tasks, activeTab]);

  // Group filtered tasks by priority
  const groupedTasks = useMemo(() => {
    const groups: Record<TaskPriority, Task[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    filteredTasks.forEach(task => {
      if (groups[task.priority]) {
        groups[task.priority].push(task);
      } else {
        groups.low.push(task);
      }
    });

    return groups;
  }, [filteredTasks]);

  const hasTasks = filteredTasks.length > 0;

  const tabItems = [
    { id: 'all', label: 'All Tasks', icon: ClipboardList },
    { id: 'today', label: "Today's Tasks", icon: CalendarCheck },
    { id: 'overdue', label: 'Overdue', icon: AlertTriangle },
    { id: 'completed', label: 'Completed', icon: CheckCircle },
  ];

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">My Workspace</h1>
        <p className="text-sm text-muted-foreground mt-1">Review assignments specifically allocated to your profile.</p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-border/40 gap-4 overflow-x-auto pb-px">
        {tabItems.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`flex items-center gap-2 pb-3.5 text-sm font-semibold relative transition-colors cursor-pointer shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Grouped lists */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : hasTasks ? (
        <div className="space-y-8 pt-2">
          {/* Loop over priorities */}
          {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map(priority => {
            const list = groupedTasks[priority];
            if (list.length === 0) return null;

            const priorityStyles = {
              critical: { border: 'border-red-500/20 bg-red-500/5', dot: 'bg-red-500', label: 'Critical Priority' },
              high: { border: 'border-orange-500/20 bg-orange-500/5', dot: 'bg-orange-500', label: 'High Priority' },
              medium: { border: 'border-blue-500/20 bg-blue-500/5', dot: 'bg-blue-500', label: 'Medium Priority' },
              low: { border: 'border-zinc-500/20 bg-zinc-500/5', dot: 'bg-zinc-400', label: 'Low Priority' },
            };
            const currentStyle = priorityStyles[priority];

            return (
              <div key={priority} className="space-y-4">
                {/* Section Header */}
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${currentStyle.dot} ring-4 ${priority === 'critical' ? 'ring-red-500/10' : priority === 'high' ? 'ring-orange-500/10' : priority === 'medium' ? 'ring-blue-500/10' : 'ring-zinc-500/10'}`} />
                  <h3 className="font-extrabold text-sm uppercase tracking-wider text-foreground">
                    {currentStyle.label} ({list.length})
                  </h3>
                </div>

                {/* Priority specific Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {list.map((task, tIdx) => (
                    <TaskCard
                      key={task.id || task.taskId || `task-${tIdx}`}
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
      ) : (
        /* Empty State */
        <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center text-center">
          <CalendarCheck className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="font-extrabold text-lg">Clean sweep!</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1.5">
            No tasks found in this view. Looks like all your duties are fully clear.
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
