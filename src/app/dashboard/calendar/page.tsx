'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '@/services/dbService';
import { Task, Member } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Loader2, 
  AlertTriangle 
} from 'lucide-react';
import { formatDate, isUserAssignedToTask } from '@/utils';
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer';
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CalendarPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar Date Navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Drawer & Edit Modal States
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isEmployee = user?.role === 'Member';

  // Read tasks in real-time
  useEffect(() => {
    setLoading(true);
    const unsubscribe = dbService.subscribeTasks((fetchedTasks) => {
      setTasks(fetchedTasks);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filter tasks based on RBAC rule (Employee can only see their own assigned tasks)
  const visibleTasks = useMemo(() => {
    return tasks.filter(task => {
      if (isEmployee && !isUserAssignedToTask(task, user?.email)) {
        return false;
      }
      return true;
    });
  }, [tasks, isEmployee, user]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calculate calendar days grid
  const calendarCells = useMemo(() => {
    const cells: { date: Date | null; isCurrentMonth: boolean; key: string }[] = [];
    
    // First day weekday index of the current month
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Total days in the current month
    const totalDays = new Date(year, month + 1, 0).getDate();
    // Total days in the previous month
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    // 1. Fill leading empty cells from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthTotalDays - i);
      cells.push({
        date: prevDate,
        isCurrentMonth: false,
        key: `prev-${prevMonthTotalDays - i}`
      });
    }

    // 2. Fill days of the current month
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(year, month, i);
      cells.push({
        date,
        isCurrentMonth: true,
        key: `curr-${i}`
      });
    }

    // 3. Fill trailing cells from the next month to complete standard 42 cell grid
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i);
      cells.push({
        date: nextDate,
        isCurrentMonth: false,
        key: `next-${i}`
      });
    }

    return cells;
  }, [year, month]);

  // Group tasks by date
  const getTasksForDate = (date: Date) => {
    const targetStr = date.toDateString();
    return visibleTasks.filter(task => {
      const taskDate = new Date(task.expectedCompletionDate);
      return taskDate.toDateString() === targetStr;
    });
  };

  // Helper to color tasks based on priority
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-l-3 border-red-500 bg-red-500/10 text-red-400';
      case 'high':
        return 'border-l-3 border-orange-500 bg-orange-500/10 text-orange-400';
      case 'medium':
        return 'border-l-3 border-purple-500 bg-purple-500/10 text-purple-400';
      default:
        return 'border-l-3 border-blue-500 bg-blue-500/10 text-blue-400';
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none flex flex-col h-[calc(100vh-120px)] overflow-hidden">
      
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-7 w-7 text-primary" />
            Milestone Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Chronological scheduling overview of team items and deadlines.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month controls */}
          <div className="flex bg-accent/40 rounded-xl p-0.5 border border-card-border items-center">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold px-3 shrink-0 text-foreground w-36 text-center">
              {MONTHS[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleToday}
            className="px-3.5 py-2 border border-card-border bg-background/50 hover:bg-accent/60 text-xs font-bold text-muted-foreground hover:text-foreground rounded-xl transition-all cursor-pointer"
          >
            Today
          </button>

          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95 transition-all rounded-xl cursor-pointer shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Week Days Labels */}
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] uppercase font-bold text-muted-foreground/80 shrink-0 select-none">
        {WEEKDAYS.map(day => (
          <div key={day} className="py-2.5 bg-accent/15 rounded-xl border border-card-border/50">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid cells */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-1.5 min-h-0">
        {calendarCells.map((cell) => {
          const date = cell.date;
          const isToday = date ? date.toDateString() === new Date().toDateString() : false;
          const dayTasks = date ? getTasksForDate(date) : [];

          return (
            <div
              key={cell.key}
              className={`rounded-2xl border p-2 flex flex-col justify-between overflow-hidden transition-all bg-card/45 relative select-none ${
                cell.isCurrentMonth 
                  ? 'border-card-border hover:border-card-border/90' 
                  : 'border-card-border/30 opacity-40'
              } ${isToday ? 'border-primary ring-1 ring-primary/30' : ''}`}
            >
              {/* Day Number */}
              <div className="flex justify-between items-center shrink-0">
                <span className={`text-[10px] font-black font-mono w-5 h-5 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}>
                  {date ? date.getDate() : ''}
                </span>
                
                {dayTasks.length > 0 && (
                  <span className="text-[8px] font-extrabold px-1 py-0.25 rounded bg-accent text-foreground font-mono">
                    {dayTasks.length} tasks
                  </span>
                )}
              </div>

              {/* Tasks List inside Cell */}
              <div className="flex-1 overflow-y-auto space-y-1.5 mt-2.5">
                {date && dayTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => {
                      setSelectedTask(task);
                      setIsDetailOpen(true);
                    }}
                    className={`p-1.5 text-[8.5px] font-bold rounded-lg truncate cursor-pointer select-none leading-none border transition-all ${getPriorityStyle(task.priority)} hover:scale-[1.01]`}
                    title={`${task.taskId}: ${task.title}`}
                  >
                    <span className="font-mono text-[7px] text-muted-foreground mr-1.5">{task.taskId}</span>
                    {task.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Details drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          isOpen={isDetailOpen}
          onClose={() => {
            setSelectedTask(null);
            setIsDetailOpen(false);
          }}
          task={selectedTask}
          onEditClick={(task) => {
            setTaskToEdit(task);
            setIsDetailOpen(false);
            setIsEditOpen(true);
          }}
        />
      )}

      {/* Creation modal */}
      <CreateTaskDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {}}
      />

      {/* Edit modal */}
      <CreateTaskDialog
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setTaskToEdit(undefined);
        }}
        taskToEdit={taskToEdit}
        onSuccess={() => {
          setIsEditOpen(false);
          setTaskToEdit(undefined);
        }}
      />

    </div>
  );
}
