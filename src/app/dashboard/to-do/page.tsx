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
  Loader2,
  Check,
  X,
  Search,
  StickyNote,
  CalendarDays,
  AlertCircle,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDate, getTodoAgeInfo, calculateTodoAgeInDays } from '@/utils';
import toast from 'react-hot-toast';

export default function ToDoPage() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Add State
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newNote, setNewNote] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tabs & Search & Filters
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [ageFilter, setAgeFilter] = useState<'all' | 'recent' | 'warning' | 'critical'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Inline Edit State (Title & Due Date)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDueDate, setEditingDueDate] = useState('');

  // Note Modal State
  const [noteTodo, setNoteTodo] = useState<TodoItem | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // Delete All Modal State
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

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
    });

    return () => unsubscribe();
  }, [user]);

  // Date classifications for Due Date
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

  // Base Lists
  const activeTodos = useMemo(() => {
    return todos.filter((t) => !t.completed);
  }, [todos]);

  const completedTodos = useMemo(() => {
    return todos.filter((t) => t.completed);
  }, [todos]);

  // Age Breakdown Counts for Active Tab
  const ageCounts = useMemo(() => {
    let recent = 0;
    let warning = 0;
    let critical = 0;

    activeTodos.forEach((t) => {
      const age = calculateTodoAgeInDays(t.createdAt);
      if (age <= 2) {
        recent++;
      } else {
        warning++; // 3+ days
        if (age > 10) {
          critical++; // 10+ days (subset of warning)
        }
      }
    });

    return {
      all: activeTodos.length,
      recent,
      warning,
      critical,
    };
  }, [activeTodos]);

  // Filtered & Grouped Active Items
  const groupedActiveTodos = useMemo(() => {
    // 1. Age Filter
    let filtered = activeTodos;
    if (ageFilter === 'recent') {
      filtered = filtered.filter((t) => calculateTodoAgeInDays(t.createdAt) <= 2);
    } else if (ageFilter === 'warning') {
      filtered = filtered.filter((t) => calculateTodoAgeInDays(t.createdAt) > 2);
    } else if (ageFilter === 'critical') {
      filtered = filtered.filter((t) => calculateTodoAgeInDays(t.createdAt) > 10);
    }

    // 2. Search Query
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          (t.note && t.note.toLowerCase().includes(query))
      );
    }

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
  }, [activeTodos, ageFilter, searchQuery]);

  const filteredCompletedTodos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return completedTodos.filter(
      (t) =>
        !query ||
        t.title.toLowerCase().includes(query) ||
        (t.note && t.note.toLowerCase().includes(query))
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
        note: newNote.trim() ? newNote.trim() : undefined,
        dueDate: newDueDate.trim() ? newDueDate.trim() : undefined,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setNewTitle('');
      setNewDueDate('');
      setNewNote('');
      setShowAddNote(false);
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
        completedAt: isNowCompleted ? new Date().toISOString() : undefined,
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

  // Note Modal Actions
  const openNoteModal = (todo: TodoItem) => {
    setNoteTodo(todo);
    setNoteText(todo.note || '');
    setIsNoteModalOpen(true);
  };

  const closeNoteModal = () => {
    setIsNoteModalOpen(false);
    setNoteTodo(null);
    setNoteText('');
  };

  const handleSaveNote = async () => {
    if (!noteTodo?.id) return;
    setSavingNote(true);
    try {
      await dbService.updateTodo(noteTodo.id, {
        note: noteText.trim() ? noteText.trim() : '',
      });
      toast.success(noteText.trim() ? 'Note saved.' : 'Note cleared.');
      closeNoteModal();
    } catch (err) {
      toast.error('Failed to save note.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleRemoveNote = async () => {
    if (!noteTodo?.id) return;
    setSavingNote(true);
    try {
      await dbService.updateTodo(noteTodo.id, {
        note: '',
      });
      toast.success('Note removed.');
      closeNoteModal();
    } catch (err) {
      toast.error('Failed to remove note.');
    } finally {
      setSavingNote(false);
    }
  };

  // Delete All Action
  const handleConfirmDeleteAll = async () => {
    if (!user?.email) return;
    setIsDeletingAll(true);
    const isCompletedTarget = activeTab === 'completed';
    try {
      const count = await dbService.deleteAllTodos(user.email, isCompletedTarget);
      toast.success(`Deleted all ${count} ${activeTab} to-dos.`);
      setIsDeleteAllOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete to-dos.');
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Start Inline Editing (Title/Date)
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
        dueDate: editingDueDate.trim() ? editingDueDate.trim() : undefined,
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
          convertedAt: new Date().toISOString(),
        });
        toast.success(`Converted to formal task ${createdTask.taskId}!`);
      } catch (e) {
        console.error('Failed to update converted todo reference:', e);
      }
    }
    setIsConvertOpen(false);
    setConvertingTodo(null);
  };

  const currentTabCount = activeTab === 'active' ? activeTodos.length : completedTodos.length;

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

      {/* --- TOOLBAR: AGE FILTERS & DELETE ALL --- */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* Left: Filter Pills (Active View) or Count Info (Completed View) */}
        {activeTab === 'active' ? (
          <div className="flex items-center flex-wrap gap-1.5 bg-card/40 p-1 rounded-xl border border-card-border/60">
            <button
              onClick={() => setAgeFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                ageFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All {ageCounts.all > 0 && <span className="opacity-80 text-[11px] font-normal">({ageCounts.all})</span>}
            </button>
            <button
              onClick={() => setAgeFilter('recent')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                ageFilter === 'recent'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Recent {ageCounts.recent > 0 && <span className="opacity-80 text-[11px] font-normal">({ageCounts.recent})</span>}
            </button>
            <button
              onClick={() => setAgeFilter('warning')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                ageFilter === 'warning'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-orange-500 hover:bg-orange-500/10'
              }`}
            >
              <span>3+ Days</span>
              {ageCounts.warning > 0 && <span className="opacity-80 text-[11px] font-normal">({ageCounts.warning})</span>}
            </button>
            <button
              onClick={() => setAgeFilter('critical')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                ageFilter === 'critical'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-rose-500 hover:bg-rose-500/10'
              }`}
            >
              <span>10+ Days</span>
              {ageCounts.critical > 0 && <span className="opacity-80 text-[11px] font-normal">({ageCounts.critical})</span>}
            </button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground font-medium py-1">
            Showing completed to-dos for your reference ({completedTodos.length})
          </div>
        )}

        {/* Right: Search & Delete All Button */}
        <div className="flex items-center gap-2 shrink-0">
          {todos.length > 2 && (
            <div className="relative flex-1 sm:w-48">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-muted-foreground/60">
                <Search className="h-3.5 w-3.5" />
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 bg-card/40 border border-card-border rounded-xl text-xs outline-none focus:border-primary/40 text-foreground"
              />
            </div>
          )}

          {currentTabCount > 0 && (
            <button
              type="button"
              onClick={() => setIsDeleteAllOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/15 text-destructive text-xs font-semibold transition-all cursor-pointer shrink-0"
              title={`Delete all ${activeTab} to-dos`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete All</span>
            </button>
          )}
        </div>
      </div>

      {/* --- QUICK ADD INPUT CARD (ACTIVE VIEW) --- */}
      {activeTab === 'active' && (
        <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-card-border shadow-sm focus-within:border-primary/50 transition-all space-y-2.5">
          <form onSubmit={handleQuickAdd} className="flex flex-col gap-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
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

                {/* Optional Note Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAddNote(!showAddNote)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    showAddNote || newNote.trim()
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-card/50 border-border/80 text-muted-foreground hover:text-foreground'
                  }`}
                  title="Add optional note / remark"
                >
                  <StickyNote className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Note</span>
                </button>

                <button
                  type="submit"
                  disabled={!newTitle.trim() || isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-extrabold rounded-xl hover:bg-primary/95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-sm shadow-primary/20"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Optional Note Textarea Expand */}
            {(showAddNote || newNote.trim()) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-1"
              >
                <div className="relative">
                  <textarea
                    rows={2}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Note (optional) — e.g. Waiting for Rajini to confirm, BA checking with supplier..."
                    className="w-full px-3 py-2 bg-background/50 border border-border/70 rounded-xl text-xs font-medium text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 resize-y min-h-[50px]"
                  />
                  {newNote && (
                    <button
                      type="button"
                      onClick={() => setNewNote('')}
                      className="absolute right-2 top-2 text-muted-foreground hover:text-foreground p-1"
                      title="Clear note"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </form>
        </div>
      )}

      {/* --- MAIN CONTENT & LIST VIEWS --- */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : activeTab === 'active' ? (
        /* ACTIVE TO DOS */
        activeTodos.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-center border border-card-border">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-3 shadow-inner">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="font-extrabold text-lg text-foreground">You&apos;re all caught up!</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Add a To Do when you have something you want to remember.
            </p>
          </div>
        ) : groupedActiveTodos.total === 0 ? (
          <div className="glass-panel p-10 rounded-2xl flex flex-col items-center justify-center text-center border border-card-border">
            <Info className="h-7 w-7 text-muted-foreground mb-2" />
            <h3 className="font-bold text-base text-foreground">No To Dos match this filter</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Try adjusting your filter or search query.
            </p>
            <button
              onClick={() => {
                setAgeFilter('all');
                setSearchQuery('');
              }}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 cursor-pointer"
            >
              Show All Active To Dos
            </button>
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
        completedTodos.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-center border border-card-border">
            <Sparkles className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="font-extrabold text-lg text-foreground">No completed to-dos yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Items you mark as complete will be saved here for your reference.
            </p>
          </div>
        ) : filteredCompletedTodos.length === 0 ? (
          <div className="glass-panel p-10 rounded-2xl flex flex-col items-center justify-center text-center border border-card-border">
            <Info className="h-7 w-7 text-muted-foreground mb-2" />
            <h3 className="font-bold text-base text-foreground">No completed To Dos match your search</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Clear your search query to see all completed items.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredCompletedTodos.map((todo) => renderTodoRow(todo))}
          </div>
        )
      )}

      {/* --- NOTE MODAL DIALOG --- */}
      <AnimatePresence>
        {isNoteModalOpen && noteTodo && (
          <div key="note-modal-wrapper" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="note-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={closeNoteModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              key="note-modal-panel"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-card border border-card-border rounded-2xl p-5 shadow-2xl overflow-hidden flex flex-col space-y-4"
            >
              <div className="flex justify-between items-start pb-2 border-b border-card-border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <StickyNote className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Note / Remark</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1 max-w-[280px]">
                      {noteTodo.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeNoteModal}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Remark / Blocker / Follow-up Note
                </label>
                <textarea
                  rows={4}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Record what happened, why it's pending, or what you are waiting for (e.g. Pending confirmation from Rajini)..."
                  className="w-full px-3.5 py-2.5 bg-background/60 border border-border rounded-xl text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/25 resize-y"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-card-border">
                {noteTodo.note ? (
                  <button
                    type="button"
                    onClick={handleRemoveNote}
                    disabled={savingNote}
                    className="text-xs text-destructive hover:underline font-semibold cursor-pointer"
                  >
                    Remove Note
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeNoteModal}
                    disabled={savingNote}
                    className="px-3.5 py-1.5 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    disabled={savingNote}
                    className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/95 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-primary/20 disabled:opacity-50"
                  >
                    {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    <span>Save Note</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DELETE ALL CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {isDeleteAllOpen && (
          <div key="delete-all-modal-wrapper" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="delete-all-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeletingAll && setIsDeleteAllOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              key="delete-all-modal-panel"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-card border border-card-border rounded-2xl p-5 shadow-2xl overflow-hidden flex flex-col space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Delete all {activeTab} To Dos?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    This will permanently delete all <strong className="text-foreground">{currentTabCount}</strong> {activeTab} To Dos for your account. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => setIsDeleteAllOpen(false)}
                  disabled={isDeletingAll}
                  className="px-3.5 py-1.5 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAll}
                  disabled={isDeletingAll}
                  className="px-4 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs font-bold hover:bg-destructive/90 flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isDeletingAll ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete All</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CONVERT TO TASK MODAL --- */}
      <CreateTaskDialog
        isOpen={isConvertOpen}
        onClose={() => {
          setIsConvertOpen(false);
          setConvertingTodo(null);
        }}
        onSuccess={handleConvertSuccess}
        initialTitle={convertingTodo?.title}
        initialDueDate={convertingTodo?.dueDate}
        initialDescription={convertingTodo?.note}
      />
    </div>
  );

  // Helper row renderer
  function renderTodoRow(todo: TodoItem) {
    const isEditing = editingTodoId === todo.id;
    const dueBadge = formatDueBadge(todo.dueDate);
    const ageInfo = getTodoAgeInfo(todo.createdAt);

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

    // Determine row warning border/accent for active todos
    let rowBorderClass = 'border-card-border hover:border-card-border/80 bg-card/45 hover:bg-card/65';
    if (todo.completed) {
      rowBorderClass = 'border-card-border/40 bg-card/25 opacity-75';
    } else if (ageInfo.severity === 'critical') {
      rowBorderClass = 'border-rose-500/40 bg-rose-500/[0.04] hover:bg-rose-500/[0.08]';
    } else if (ageInfo.severity === 'warning') {
      rowBorderClass = 'border-orange-500/40 bg-orange-500/[0.04] hover:bg-orange-500/[0.08]';
    }

    return (
      <div
        key={todo.id}
        className={`group glass-panel px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${rowBorderClass}`}
      >
        {/* Left: Checkbox + Title + Note + Created Date & Age */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            onClick={() => handleToggleComplete(todo)}
            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 cursor-pointer mt-0.5 ${
              todo.completed
                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 hover:bg-emerald-500/30'
                : 'border border-muted-foreground/40 hover:border-primary text-transparent hover:text-primary/40'
            }`}
            title={todo.completed ? 'Mark as incomplete' : 'Mark as completed'}
          >
            <Check className="h-3 w-3" />
          </button>

          <div className="min-w-0 flex-1">
            {/* Title */}
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

            {/* Note Display (Underneath Title) */}
            {todo.note && (
              <div
                onClick={() => openNoteModal(todo)}
                className={`flex items-start gap-1.5 mt-1 px-2.5 py-1 rounded-lg text-[11px] font-medium leading-relaxed max-w-fit cursor-pointer transition-colors ${
                  todo.completed
                    ? 'bg-card/30 border border-card-border/30 text-muted-foreground'
                    : 'bg-card/60 border border-card-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40'
                }`}
                title="Click to view / edit note"
              >
                <StickyNote className="h-3 w-3 mt-0.5 text-primary/80 shrink-0" />
                <span className="break-words line-clamp-2">{todo.note}</span>
              </div>
            )}

            {/* Metadata: Created Date & Dynamic Age Warning */}
            <div className="flex items-center flex-wrap gap-2 text-[10px] text-muted-foreground/80 mt-1.5">
              <span className="flex items-center gap-1 font-medium">
                <CalendarDays className="h-3 w-3 text-muted-foreground/60" />
                Created {formatDate(todo.createdAt)}
              </span>

              {/* Age Warning Badge for Active To Dos */}
              {!todo.completed && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    ageInfo.severity === 'critical'
                      ? 'bg-rose-500/10 text-rose-500 border border-rose-500/25'
                      : ageInfo.severity === 'warning'
                      ? 'bg-orange-500/10 text-orange-500 border border-orange-500/25'
                      : 'bg-muted/40 text-muted-foreground/90 border border-muted/50'
                  }`}
                >
                  {ageInfo.badgeIcon && <span>{ageInfo.badgeIcon}</span>}
                  <span>{ageInfo.badgeText}</span>
                </span>
              )}

              {/* Traceability if converted */}
              {todo.convertedToTaskId && (
                <span className="text-primary/80 font-mono font-bold">
                  → Converted to {todo.convertedToTaskId}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Date Badge + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {dueBadge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${dueBadge.color}`}>
              {dueBadge.text}
            </span>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {/* Convert to Task (Active only) */}
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

            {/* Note Action (Active & Completed) */}
            <button
              onClick={() => openNoteModal(todo)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                todo.note
                  ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                  : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
              }`}
              title={todo.note ? 'Edit note' : 'Add note'}
            >
              <StickyNote className="h-3.5 w-3.5" />
            </button>

            {/* Edit Title / Due Date (Active only) */}
            {!todo.completed && (
              <button
                onClick={() => startEditing(todo)}
                className="p-1.5 rounded-lg hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Edit title / date"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            )}

            {/* Delete Single To Do */}
            <button
              onClick={() => handleDeleteTodo(todo.id)}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
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
