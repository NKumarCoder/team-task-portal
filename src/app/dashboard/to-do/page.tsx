'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { dbService } from '@/services/dbService';
import { TodoItem, Task } from '@/types';
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog';
import DatePicker from '@/components/ui/DatePicker';
import {
  ListTodo,
  CheckCircle2,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Edit2,
  ArrowRight,
  Sparkles,
  Clock,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Check,
  X,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate } from '@/utils';
import toast from 'react-hot-toast';

export default function ToDoPage() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Add State
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tabs & Search
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Inline Edit State
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDueDate, setEditingDueDate] = useState('');

  // Convert to Task Dialog State
  const [convertingTodo, setConvertingTodo] = useState<TodoItem | null>(null);
  const [isConvertOpen, setIsConvertOpen] = useState(false);

  // Load & Realtime subscription
  useEffect(() => {
    if (!user || !user.email) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = dbService.subscribeTodos(user.email, (fetched) => {
      setTodos(fetched);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [user]);

  // Date classifications
  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  };

  const isDueToday = (dueDate?: string) => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due.getTime() === today.getTime();
  };

  const isDueTomorrow = (dueDate?: string) => {
    if (!dueDate) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due.getTime() === tomorrow.getTime();
  };

  const formatDueBadge = (dueDate?: string) => {
    if (!dueDate) return null;
    if (isOverdue(dueDate)) {
      return { text: 'Overdue', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
    }
    if (isDueToday(dueDate)) {
      return { text: 'Due Today', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
    }
    if (isDueTomorrow(dueDate)) {
      return { text: 'Tomorrow', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
    }
    return { text: formatDate(dueDate), color: 'bg-slate-500/10 text-muted-foreground border-slate-500/20' };
  };

  // Filtered lists
  const activeTodos = useMemo(() => {
    return todos.filter((t) => !t.completed);
  }, [todos]);

  const completedTodos = useMemo(() => {
    return todos.filter((t) => t.completed);
  }, [todos]);

  // Grouped active items
  const groupedActiveTodos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = activeTodos.filter((t) =>
      !query || t.title.toLowerCase().includes(query)
    );

    const overdue: TodoItem[] = [];
    const today: TodoItem[] = [];
    const upcoming: TodoItem[] = [];
    const noDate: TodoItem[] = [];

    filtered.forEach((t) => {
      if (!t.dueDate) {
        noDate.push(t);
      } else if (isOverdue(t.dueDate)) {
        overdue.push(t);
      } else if (isDueToday(t.dueDate)) {
        today.push(t);
      } else {
        upcoming.push(t);
      }
    });

    // Sort upcoming by closest date
    upcoming.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    return { overdue, today, upcoming, noDate, total: filtered.length };
  }, [activeTodos, searchQuery]);

  const filteredCompletedTodos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return completedTodos.filter((t) =>
      !query || t.title.toLowerCase().includes(query)
    );
  }, [completedTodos, searchQuery]);

  // Quick Add Action
  const handleQuickAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = newTitle.trim();
    if (!title) {
      toast.error('Please enter a to-do title.');
      return;
    }
    if (!user?.email) return;

    setIsSubmitting(true);
    try {
      await dbService.addTodo({
        userId: user.email,
        title,
        dueDate: newDueDate.trim() ? newDueDate.trim() : undefined,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setNewTitle('');
      setNewDueDate('');
      inputRef.current?.focus();
      toast.success('To Do added!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add To Do.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Complete Action
  const handleToggleComplete = async (todo: TodoItem) => {
    if (!todo.id) return;
    const isNowCompleted = !todo.completed;
    try {
      await dbService.updateTodo(todo.id, {
        completed: isNowCompleted,
        completedAt: isNowCompleted ? new Date().toISOString() : undefined
      });
      if (isNowCompleted) {
        toast.success('Completed! Great job.');
      } else {
        toast.success('Reopened to-do.');
      }
    } catch (err) {
      toast.error('Failed to update to-do.');
    }
  };

  // Delete Action
  const handleDeleteTodo = async (id?: string) => {
    if (!id) return;
    try {
      await dbService.deleteTodo(id);
      toast.success('To Do deleted.');
    } catch (err) {
      toast.error('Failed to delete to-do.');
    }
  };

  // Start Inline Editing
  const startEditing = (todo: TodoItem) => {
    if (!todo.id) return;
    setEditingTodoId(todo.id);
    setEditingTitle(todo.title);
    setEditingDueDate(todo.dueDate || '');
  };

  const cancelEditing = () => {
    setEditingTodoId(null);
    setEditingTitle('');
    setEditingDueDate('');
  };

  const saveEditing = async (id?: string) => {
    if (!id) return;
    const title = editingTitle.trim();
    if (!title) {
      toast.error('Title cannot be empty');
      return;
    }
    try {
      await dbService.updateTodo(id, {
        title,
        dueDate: editingDueDate.trim() ? editingDueDate.trim() : undefined
      });
      setEditingTodoId(null);
      toast.success('To Do updated.');
    } catch (err) {
      toast.error('Failed to update to-do.');
    }
  };

  // Convert to Formal Task
  const handleStartConvert = (todo: TodoItem) => {
    setConvertingTodo(todo);
    setIsConvertOpen(true);
  };

  const handleConvertSuccess = async (createdTask: Task) => {
    if (convertingTodo?.id) {
      try {
        await dbService.updateTodo(convertingTodo.id, {
          completed: true,
          completedAt: new Date().toISOString(),
          convertedToTaskId: createdTask.taskId,
          convertedAt: new Date().toISOString()
        });
        toast.success(`Converted to formal task ${createdTask.taskId}!`);
      } catch (e) {
        console.error('Failed to update converted todo reference:', e);
      }
    }
    setIsConvertOpen(false);
    setConvertingTodo(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28">
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-extrabold tracking-tight">To Do</h1>
            <span className="bg-primary/10 text-primary border border-primary/20 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
              {activeTodos.length} {activeTodos.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Quick scratchpad and reminders for things you need to do.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-card/60 p-1 rounded-xl border border-card-border shadow-xs">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Active ({activeTodos.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Completed ({completedTodos.length})
          </button>
        </div>
      </div>

      {/* --- QUICK ADD INPUT CARD --- */}
      <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-card-border shadow-sm focus-within:border-primary/50 transition-all">
        <form onSubmit={handleQuickAdd} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 flex items-center">
            <div className="absolute left-3 text-muted-foreground/60 pointer-events-none">
              <Plus className="h-5 w-5" />
            </div>
            <input
              ref={inputRef}
              type="text"
              placeholder="What do you need to do? (Press Enter to add)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-transparent text-sm font-medium outline-none text-foreground placeholder:text-muted-foreground/60"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Modern Pill DatePicker */}
            <DatePicker
              value={newDueDate}
              onChange={(d) => setNewDueDate(d)}
              variant="pill"
              label="+ Due Date"
              align="right"
            />

            <button
              type="submit"
              disabled={!newTitle.trim() || isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-extrabold rounded-xl hover:bg-primary/95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-sm shadow-primary/20"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span>Add</span>
            </button>
          </div>
        </form>
      </div>

      {/* --- SEARCH FILTER (WHEN ITEMS EXIST) --- */}
      {todos.length > 3 && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground/60">
            <Search className="h-3.5 w-3.5" />
          </div>
          <input
            type="text"
            placeholder="Search to-do reminders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-1.5 bg-card/30 border border-card-border rounded-xl text-xs outline-none focus:border-primary/40 text-foreground"
          />
        </div>
      )}

      {/* --- MAIN CONTENT & LIST VIEWS --- */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : activeTab === 'active' ? (
        /* ACTIVE TO DOS */
        groupedActiveTodos.total === 0 ? (
          <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-center border border-card-border">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-3 shadow-inner">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-lg text-foreground">You&apos;re all caught up!</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Add something above when you have a quick task or reminder you don&apos;t want to forget.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 1. OVERDUE SECTION */}
            {groupedActiveTodos.overdue.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-500 tracking-wider uppercase px-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Overdue ({groupedActiveTodos.overdue.length})</span>
                </div>
                <div className="space-y-1.5">
                  {groupedActiveTodos.overdue.map((todo) => renderTodoRow(todo))}
                </div>
              </div>
            )}

            {/* 2. TODAY SECTION */}
            {groupedActiveTodos.today.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-500 tracking-wider uppercase px-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Today ({groupedActiveTodos.today.length})</span>
                </div>
                <div className="space-y-1.5">
                  {groupedActiveTodos.today.map((todo) => renderTodoRow(todo))}
                </div>
              </div>
            )}

            {/* 3. UPCOMING SECTION */}
            {groupedActiveTodos.upcoming.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-400 tracking-wider uppercase px-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span>Upcoming ({groupedActiveTodos.upcoming.length})</span>
                </div>
                <div className="space-y-1.5">
                  {groupedActiveTodos.upcoming.map((todo) => renderTodoRow(todo))}
                </div>
              </div>
            )}

            {/* 4. NO DUE DATE SECTION */}
            {groupedActiveTodos.noDate.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-muted-foreground tracking-wider uppercase px-1">
                  <ListTodo className="h-3.5 w-3.5" />
                  <span>No Due Date ({groupedActiveTodos.noDate.length})</span>
                </div>
                <div className="space-y-1.5">
                  {groupedActiveTodos.noDate.map((todo) => renderTodoRow(todo))}
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        /* COMPLETED TO DOS */
        filteredCompletedTodos.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-center border border-card-border">
            <Sparkles className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="font-extrabold text-lg text-foreground">No completed to-dos yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Items you mark as complete will be saved here for your reference.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredCompletedTodos.map((todo) => renderTodoRow(todo))}
          </div>
        )
      )}

      {/* Convert to Formal Task Modal Dialog */}
      <CreateTaskDialog
        isOpen={isConvertOpen}
        onClose={() => {
          setIsConvertOpen(false);
          setConvertingTodo(null);
        }}
        onSuccess={handleConvertSuccess}
        initialTitle={convertingTodo?.title}
        initialDueDate={convertingTodo?.dueDate}
      />
    </div>
  );

  // Helper row renderer
  function renderTodoRow(todo: TodoItem) {
    const isEditing = editingTodoId === todo.id;
    const dueBadge = formatDueBadge(todo.dueDate);

    if (isEditing) {
      return (
        <div
          key={todo.id}
          className="glass-panel p-3 rounded-xl border border-primary/40 bg-card/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
        >
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEditing(todo.id);
              if (e.key === 'Escape') cancelEditing();
            }}
            className="flex-1 px-3 py-1 bg-background/60 border border-border rounded-lg text-xs font-medium text-foreground outline-none"
            autoFocus
          />
          <DatePicker
            value={editingDueDate}
            onChange={(d) => setEditingDueDate(d)}
            variant="pill"
            label="+ Due Date"
            align="right"
          />
          <div className="flex items-center gap-1 shrink-0 justify-end">
            <button
              onClick={() => saveEditing(todo.id)}
              className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/95 text-xs font-bold cursor-pointer"
              title="Save"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={cancelEditing}
              className="p-1.5 bg-card border border-border text-muted-foreground hover:text-foreground rounded-lg text-xs font-bold cursor-pointer"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={todo.id}
        className={`group glass-panel px-3.5 py-2.5 rounded-xl border border-card-border hover:border-card-border/80 flex items-center justify-between gap-3 transition-all ${
          todo.completed ? 'bg-card/25 opacity-75' : 'bg-card/45 hover:bg-card/65'
        }`}
      >
        {/* Left: Checkbox + Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => handleToggleComplete(todo)}
            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 cursor-pointer ${
              todo.completed
                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 hover:bg-emerald-500/30'
                : 'border border-muted-foreground/40 hover:border-primary text-transparent hover:text-primary/40'
            }`}
            title={todo.completed ? 'Mark as incomplete' : 'Mark as completed'}
          >
            <Check className="h-3 w-3" />
          </button>

          <div className="min-w-0 flex-1">
            <span
              onClick={() => !todo.completed && startEditing(todo)}
              className={`text-xs font-bold leading-relaxed break-words cursor-pointer ${
                todo.completed
                  ? 'line-through text-muted-foreground'
                  : 'text-foreground hover:text-primary transition-colors'
              }`}
            >
              {todo.title}
            </span>

            {/* Traceability if converted */}
            {todo.convertedToTaskId && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-primary/80 font-mono font-bold">
                  → Converted to {todo.convertedToTaskId}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Date Badge + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {dueBadge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${dueBadge.color}`}>
              {dueBadge.text}
            </span>
          )}

          {/* Action buttons (convert to task, edit, delete) */}
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {!todo.completed && (
              <button
                onClick={() => handleStartConvert(todo)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 text-[10px] font-extrabold transition-all cursor-pointer shadow-2xs"
                title="Convert this To Do into a formal tracked task"
              >
                <ArrowRight className="h-2.5 w-2.5" />
                <span className="hidden sm:inline">Convert to Task</span>
              </button>
            )}

            {!todo.completed && (
              <button
                onClick={() => startEditing(todo)}
                className="p-1 rounded-lg hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Edit title / date"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            )}

            <button
              onClick={() => handleDeleteTodo(todo.id)}
              className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }
}
