'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { dbService } from '@/services/dbService';
import { Task, Member, MonthlyReport, TaskStatus, TaskPriority, ActivityLog, Comment } from '@/types';
import { 
  CheckCircle2, 
  Clock, 
  Play, 
  HelpCircle, 
  AlertTriangle, 
  Sparkles,
  Layers,
  Calendar,
  ChevronRight,
  TrendingUp,
  Activity,
  ShieldAlert,
  Loader2,
  Lock,
  Search,
  Filter,
  Users,
  Briefcase,
  UserCheck,
  UserX,
  History,
  X,
  Plus,
  Download,
  Printer,
  MessageSquare,
  Award
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDate } from '@/utils';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { isFirebaseConfigured } from '@/firebase/config';
import StatusBadge from '@/components/tasks/StatusBadge';
import PriorityBadge from '@/components/tasks/PriorityBadge';
import MemberDetailDrawer from '@/components/members/MemberDetailDrawer';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';

export default function DashboardHome() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [timeoutError, setTimeoutError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Active Selected Member for Detail Drawer
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isMemberDrawerOpen, setIsMemberDrawerOpen] = useState(false);

  // Active Tab for Analytics Charts Grid
  const [analyticsTab, setAnalyticsTab] = useState<'overview' | 'distribution' | 'workload'>('overview');

  // Real-time Firestore Subscriptions
  useEffect(() => {
    setIsMounted(true);
    console.log("[Dashboard] Initializing real-time database listeners...");
    setLoading(true);
    setTimeoutError(false);

    // Timeout safety
    const timer = setTimeout(() => {
      console.error("Dashboard loading timeout");
      setTimeoutError(true);
      setLoading(false);
    }, 10000);

    const unsubscribeTasks = dbService.subscribeTasks((fetchedTasks) => {
      console.log("[Dashboard] Real-time tasks update received. Count:", fetchedTasks.length);
      setTasks(fetchedTasks || []);
      clearTimeout(timer);
      setLoading(false);
    });

    const unsubscribeMembers = dbService.subscribeMembers((fetchedMembers) => {
      console.log("[Dashboard] Real-time members update received. Count:", fetchedMembers.length);
      setMembers(fetchedMembers || []);
    });

    const unsubscribeActivities = dbService.subscribeActivities((fetchedActivities) => {
      console.log("[Dashboard] Real-time activities update received. Count:", fetchedActivities.length);
      setActivities(fetchedActivities || []);
    });

    const unsubscribeComments = dbService.subscribeAllComments((fetchedComments) => {
      console.log("[Dashboard] Real-time global comments update received. Count:", fetchedComments.length);
      setComments(fetchedComments || []);
    });

    return () => {
      console.log("[Dashboard] Unsubscribing from real-time updates");
      unsubscribeTasks();
      unsubscribeMembers();
      unsubscribeActivities();
      unsubscribeComments();
      clearTimeout(timer);
    };
  }, [user]);

  // Derived filter selections
  const projectList = useMemo(() => {
    const projects = new Set<string>();
    tasks.forEach(t => {
      if (t.projectName) projects.add(t.projectName);
    });
    return Array.from(projects);
  }, [tasks]);

  // Dynamically Filter Tasks based on filters/search
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Global Search
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchId = task.taskId?.toLowerCase().includes(q);
        const matchTitle = task.title?.toLowerCase().includes(q);
        const matchProject = task.projectName?.toLowerCase().includes(q);
        const matchAssignee = task.assigneeName?.toLowerCase().includes(q);
        if (!matchId && !matchTitle && !matchProject && !matchAssignee) {
          return false;
        }
      }

      // Filters
      if (filterProject !== 'all' && task.projectName.toLowerCase() !== filterProject.toLowerCase()) {
        return false;
      }
      if (filterEmployee !== 'all' && task.assigneeId.toLowerCase() !== filterEmployee.toLowerCase()) {
        return false;
      }
      if (filterPriority !== 'all' && task.priority.toLowerCase() !== filterPriority.toLowerCase()) {
        return false;
      }
      if (filterStatus !== 'all' && task.status.toLowerCase() !== filterStatus.toLowerCase()) {
        return false;
      }

      // Date Ranges
      if (filterStartDate) {
        const start = new Date(filterStartDate);
        const taskDate = new Date(task.expectedCompletionDate);
        if (taskDate < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        const taskDate = new Date(task.expectedCompletionDate);
        if (taskDate > end) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, filterProject, filterEmployee, filterPriority, filterStatus, filterStartDate, filterEndDate]);

  // 1. Metric Counts derived from filtered tasks
  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'completed' || t.status === 'moved-to-live').length;
    const pending = filteredTasks.filter(t => t.status === 'assigned' || t.status === 'on-hold').length;
    const testing = filteredTasks.filter(t => t.status === 'testing' || t.status === 'uat').length;
    const inProgress = filteredTasks.filter(t => t.status === 'in-progress' || t.status === 'development-completed' || t.status === 'code-review').length;
    const blocked = filteredTasks.filter(t => t.status === 'blocked').length;
    const critical = filteredTasks.filter(t => t.priority === 'critical').length;

    const today = new Date();
    today.setHours(0,0,0,0);
    const overdue = filteredTasks.filter(t => {
      if (t.status === 'completed' || t.status === 'moved-to-live' || t.status === 'cancelled') return false;
      const d = new Date(t.expectedCompletionDate);
      d.setHours(0,0,0,0);
      return d.getTime() < today.getTime();
    }).length;

    return { total, completed, pending, testing, inProgress, blocked, critical, overdue };
  }, [filteredTasks]);

  const metricCards = [
    { label: 'Total Tasks', count: metrics.total, icon: Layers, color: 'text-zinc-600 dark:text-zinc-300', bg: 'bg-zinc-500/10 border-zinc-500/10' },
    { label: 'Completed', count: metrics.completed, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/15' },
    { label: 'Pending', count: metrics.pending, icon: HelpCircle, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/15' },
    { label: 'Testing', count: metrics.testing, icon: Clock, color: 'text-violet-500', bg: 'bg-violet-500/10 border-violet-500/15' },
    { label: 'In Progress', count: metrics.inProgress, icon: Play, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/15' },
    { label: 'Blocked', count: metrics.blocked, icon: Lock, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/15' },
    { label: 'Critical', count: metrics.critical, icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/15' },
    { label: 'Overdue', count: metrics.overdue, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/15' },
  ];

  // 2. Project Progress Section (Calculated from all tasks to maintain consistent project index)
  const projectProgress = useMemo(() => {
    const projectsMap: Record<string, { total: number; completed: number; pending: number; testing: number; deployment: number; live: number }> = {};
    
    // Group all tasks by project name
    tasks.forEach(t => {
      if (!t.projectName) return;
      if (!projectsMap[t.projectName]) {
        projectsMap[t.projectName] = { total: 0, completed: 0, pending: 0, testing: 0, deployment: 0, live: 0 };
      }
      const p = projectsMap[t.projectName];
      p.total += 1;

      if (t.status === 'completed') p.completed += 1;
      else if (t.status === 'assigned' || t.status === 'on-hold') p.pending += 1;
      else if (t.status === 'testing' || t.status === 'uat') p.testing += 1;
      else if (t.status === 'ready-for-deployment' || t.status === 'development-completed' || t.status === 'code-review') p.deployment += 1;
      else if (t.status === 'moved-to-live' || t.status === 'deployed') p.live += 1;
    });

    return Object.entries(projectsMap).map(([name, data]) => {
      const actualCompleted = data.completed + data.live;
      const progress = data.total > 0 ? Math.round((actualCompleted / data.total) * 100) : 0;
      return { name, ...data, progress };
    }).sort((a, b) => b.progress - a.progress); // Sort by highest progress percentage first
  }, [tasks]);

  // 3. Today's Tasks (Due Today)
  const todayTasks = useMemo(() => {
    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date();
    end.setHours(23,59,59,999);

    return filteredTasks.filter(t => {
      if (t.status === 'completed' || t.status === 'moved-to-live' || t.status === 'cancelled') return false;
      const dueDate = new Date(t.expectedCompletionDate);
      return dueDate >= start && dueDate <= end;
    });
  }, [filteredTasks]);

  // 4. Overdue Tasks (Oldest First)
  const overdueTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    return filteredTasks
      .filter(t => {
        if (t.status === 'completed' || t.status === 'moved-to-live' || t.status === 'cancelled') return false;
        const dueDate = new Date(t.expectedCompletionDate);
        dueDate.setHours(0,0,0,0);
        return dueDate.getTime() < today.getTime();
      })
      .sort((a, b) => new Date(a.expectedCompletionDate).getTime() - new Date(b.expectedCompletionDate).getTime());
  }, [filteredTasks]);

  // 5. Upcoming Deadlines (Due within next 7 days, excluding today)
  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date();
    target.setDate(target.getDate() + 7);
    target.setHours(23,59,59,999);

    const startOfTomorrow = new Date();
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    startOfTomorrow.setHours(0,0,0,0);

    return filteredTasks
      .filter(t => {
        if (t.status === 'completed' || t.status === 'moved-to-live' || t.status === 'cancelled') return false;
        const dueDate = new Date(t.expectedCompletionDate);
        return dueDate >= startOfTomorrow && dueDate <= target;
      })
      .map(t => {
        const diffTime = new Date(t.expectedCompletionDate).getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let countdownText = `${diffDays} Days Left`;
        if (diffDays === 1) countdownText = "Tomorrow";
        
        return {
          ...t,
          countdownText
        };
      })
      .sort((a, b) => new Date(a.expectedCompletionDate).getTime() - new Date(b.expectedCompletionDate).getTime());
  }, [filteredTasks]);

  // 6. Recent Activity Feed (Derived from real-time activities collection)
  const recentActivities = useMemo(() => {
    return activities.map(act => ({
      id: act.id || `act-${Date.now()}`,
      time: act.timestamp,
      user: act.performedBy || act.userName || 'Team Member',
      action: act.action,
      taskId: act.taskSeqId || 'TASK-ID',
      project: act.taskTitle || 'Project',
    })).slice(0, 8);
  }, [activities]);

  // 6b. Recent Completed Tasks widget data
  const recentCompletedTasks = useMemo(() => {
    return tasks
      .filter(t => t.status === 'completed' || t.status === 'moved-to-live')
      .sort((a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime())
      .slice(0, 5);
  }, [tasks]);

  // 6c. Critical active tasks widget data
  const criticalTasks = useMemo(() => {
    return tasks
      .filter(t => t.priority === 'critical' && t.status !== 'completed' && t.status !== 'moved-to-live' && t.status !== 'cancelled')
      .slice(0, 5);
  }, [tasks]);

  // 6d. Latest comments feed widget data
  const latestComments = useMemo(() => {
    return comments
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [comments]);

  // 7. Employee Capacity & Workloads List
  const teamActivityList = useMemo(() => {
    return members.map(member => {
      // Find tasks assigned to this member
      const memberAllTasks = tasks.filter(t => t.assigneeId.toLowerCase() === member.email.toLowerCase());
      const active = memberAllTasks.filter(t => t.status !== 'completed' && t.status !== 'moved-to-live' && t.status !== 'cancelled');
      const completed = memberAllTasks.filter(t => t.status === 'completed' || t.status === 'moved-to-live');

      // Sort active tasks by urgency (earliest deadline first) to find the current active task
      const sortedActive = [...active].sort((a, b) => new Date(a.expectedCompletionDate).getTime() - new Date(b.expectedCompletionDate).getTime());
      const currentActiveTask = sortedActive[0] || null;

      // Workload points: Critical (5), High (3), Medium (2), Low (1)
      const workloadPoints = active.reduce((acc, t) => {
        const points = t.priority === 'critical' ? 5 
                     : t.priority === 'high' ? 3 
                     : t.priority === 'medium' ? 2 
                     : 1;
        return acc + points;
      }, 0);

      // Workload color categorizations
      let statusLabel: 'Normal' | 'Medium' | 'High' | 'Overloaded' = 'Normal';
      let cardStyle = 'border-emerald-500/10 bg-emerald-500/5 hover:border-emerald-500/35 hover:bg-emerald-500/[0.08] shadow-emerald-500/[0.02]';
      let badgeStyle = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      let progressColor = 'bg-emerald-500';

      if (workloadPoints >= 3 && workloadPoints <= 6) {
        statusLabel = 'Medium';
        cardStyle = 'border-amber-500/10 bg-amber-500/5 hover:border-amber-500/35 hover:bg-amber-500/[0.08] shadow-amber-500/[0.02]';
        badgeStyle = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
        progressColor = 'bg-amber-500';
      } else if (workloadPoints >= 7 && workloadPoints <= 10) {
        statusLabel = 'High';
        cardStyle = 'border-orange-500/10 bg-orange-500/5 hover:border-orange-500/35 hover:bg-orange-500/[0.08] shadow-orange-500/[0.02]';
        badgeStyle = 'bg-orange-500/10 text-orange-500 border-orange-500/20';
        progressColor = 'bg-orange-500';
      } else if (workloadPoints > 10) {
        statusLabel = 'Overloaded';
        cardStyle = 'border-red-500/10 bg-red-500/5 hover:border-red-500/35 hover:bg-red-500/[0.08] shadow-red-500/[0.02]';
        badgeStyle = 'bg-red-500/10 text-red-500 border-red-500/20';
        progressColor = 'bg-red-500';
      }

      const workloadPercentage = Math.min(100, Math.round((workloadPoints / 15) * 100));
      const completionRate = memberAllTasks.length > 0 ? Math.round((completed.length / memberAllTasks.length) * 100) : 0;
      
      const lastUpdatedText = memberAllTasks.length > 0 
        ? new Date(Math.max(...memberAllTasks.map(t => new Date(t.updatedDate).getTime()))).toISOString() 
        : member.createdDate || new Date().toISOString();

      return {
        member,
        currentActiveTask,
        pendingCount: active.length,
        completedCount: completed.length,
        workloadPoints,
        statusLabel,
        cardStyle,
        badgeStyle,
        progressColor,
        workloadPercentage,
        completionRate,
        lastUpdatedText
      };
    });
  }, [members, tasks]);

  // 8. Recharts Datasets compiled from filteredTasks
  const chartsData = useMemo(() => {
    // A. Tasks by Status
    const statusMap: Record<string, number> = {
      'assigned': 0, 'in-progress': 0, 'testing': 0, 'completed': 0, 'blocked': 0
    };
    filteredTasks.forEach(t => {
      let statusKey = t.status;
      if (t.status === 'moved-to-live' || t.status === 'deployed') statusKey = 'completed';
      else if (t.status === 'on-hold') statusKey = 'assigned';
      else if (t.status === 'development-completed' || t.status === 'code-review') statusKey = 'in-progress';
      else if (t.status === 'uat') statusKey = 'testing';
      
      if (statusMap[statusKey] !== undefined) {
        statusMap[statusKey] += 1;
      }
    });
    const statusData = Object.entries(statusMap).map(([name, value]) => ({
      name: name.replace('-', ' ').toUpperCase(),
      Tasks: value
    }));

    // B. Tasks by Priority
    const priorityMap: Record<string, number> = { 'critical': 0, 'high': 0, 'medium': 0, 'low': 0 };
    filteredTasks.forEach(t => {
      if (priorityMap[t.priority] !== undefined) {
        priorityMap[t.priority] += 1;
      }
    });
    const priorityColors = { critical: '#ef4444', high: '#f97316', medium: '#8b5cf6', low: '#3b82f6' };
    const priorityData = Object.entries(priorityMap).map(([name, value]) => ({
      name: name.toUpperCase(),
      value,
      color: priorityColors[name as keyof typeof priorityColors] || '#3b82f6'
    })).filter(item => item.value > 0);

    // C. Tasks by Project
    const projectCountMap: Record<string, number> = {};
    filteredTasks.forEach(t => {
      if (t.projectName) {
        projectCountMap[t.projectName] = (projectCountMap[t.projectName] || 0) + 1;
      }
    });
    const projectData = Object.entries(projectCountMap).map(([name, value]) => ({
      name,
      Tasks: value
    })).slice(0, 6); // Top 6 projects

    // D. Completed vs Pending
    const compData = [
      { name: 'Completed', value: metrics.completed, color: '#10b981' },
      { name: 'Pending', value: metrics.pending + metrics.testing + metrics.inProgress + metrics.blocked, color: '#f59e0b' }
    ].filter(item => item.value > 0);

    // E. Monthly Completion Trend
    // Group completed tasks by month of updatedDate
    const monthlyMap: Record<string, number> = {};
    tasks
      .filter(t => t.status === 'completed' || t.status === 'moved-to-live')
      .forEach(t => {
        const d = new Date(t.updatedDate);
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        monthlyMap[key] = (monthlyMap[key] || 0) + 1;
      });
    const completionTrendData = Object.entries(monthlyMap).map(([month, count]) => ({
      month,
      Completed: count
    })).slice(-6); // Last 6 months

    // F. Employee Workload (Active points compare)
    const employeeWorkloadData = teamActivityList.map(item => ({
      name: item.member.name.split(' ')[0],
      Points: item.workloadPoints
    })).sort((a, b) => b.Points - a.Points);

    return { statusData, priorityData, projectData, compData, completionTrendData, employeeWorkloadData };
  }, [filteredTasks, metrics, teamActivityList, tasks]);

  // Reset Filters trigger
  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterProject('all');
    setFilterEmployee('all');
    setFilterPriority('all');
    setFilterStatus('all');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const hasActiveFilters = useMemo(() => {
    return searchQuery !== '' || 
      filterProject !== 'all' || 
      filterEmployee !== 'all' || 
      filterPriority !== 'all' || 
      filterStatus !== 'all' || 
      filterStartDate !== '' || 
      filterEndDate !== '';
  }, [searchQuery, filterProject, filterEmployee, filterPriority, filterStatus, filterStartDate, filterEndDate]);

  if (timeoutError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center select-none">
        <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive mb-4">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold tracking-tight">Unable to load dashboard.</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-5">
          The database sync listener timed out. Let's try restarting the listeners.
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
          <p className="text-sm text-muted-foreground font-semibold">Synchronizing Live Board with Cloud Firestore...</p>
        </div>
      </div>
    );
  }

  console.log(`[Dashboard] Dashboard Render - Loading: ${loading}, Tasks Count: ${tasks.length}, Members Count: ${members.length}, Current User:`, user);

  return (
    <div className="space-y-8 select-none">
      
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Enterprise Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time status of items, development activity, and workloads.</p>
        </div>

        {/* Exporter Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              if (filteredTasks.length === 0) {
                toast.error('No tasks available to export.');
                return;
              }
              const headers = ['Task ID', 'Project', 'Title', 'Priority', 'Status', 'Assignee', 'Due Date'];
              const rows = filteredTasks.map(t => [
                t.taskId,
                `"${t.projectName.replace(/"/g, '""')}"`,
                `"${t.title.replace(/"/g, '""')}"`,
                t.priority.toUpperCase(),
                t.status.toUpperCase(),
                t.assigneeName,
                formatDate(t.expectedCompletionDate)
              ]);
              const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.setAttribute('href', url);
              link.setAttribute('download', `dashboard_export_${Date.now()}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-card-border bg-background/50 hover:bg-accent/60 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm animate-in fade-in"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-card-border bg-background/50 hover:bg-accent/60 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
          >
            <Printer className="h-3.5 w-3.5 text-primary" />
            <span>Print Overview (PDF)</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 backdrop-blur-md">
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            <span>Live Sync Active</span>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS BAR */}
      <div className="glass-panel p-4 rounded-2xl border border-card-border space-y-4">
        
        {/* Row 1: Search and resets */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground/80" />
            <input
              type="text"
              placeholder="Search Task ID, Title, Project, or Assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background/50 border border-card-border rounded-xl py-2 pl-10 pr-4 text-xs font-medium placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center justify-center gap-1.5 px-4 py-2 border border-card-border rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all cursor-pointer bg-background/30"
            >
              <X className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          )}
        </div>

        {/* Row 2: Select Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          
          {/* Project */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-muted-foreground/80">Project</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full bg-background/60 border border-card-border rounded-lg py-1.5 px-2.5 text-xs font-medium focus:outline-none text-foreground cursor-pointer"
            >
              <option value="all">All Projects</option>
              {projectList.map(proj => (
                <option key={proj} value={proj}>{proj}</option>
              ))}
            </select>
          </div>

          {/* Member */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-muted-foreground/80">Team Member</label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full bg-background/60 border border-card-border rounded-lg py-1.5 px-2.5 text-xs font-medium focus:outline-none text-foreground cursor-pointer"
            >
              <option value="all">All Employees</option>
              {members.map(m => (
                <option key={m.id} value={m.email}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-muted-foreground/80">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full bg-background/60 border border-card-border rounded-lg py-1.5 px-2.5 text-xs font-medium focus:outline-none text-foreground cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-muted-foreground/80">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-background/60 border border-card-border rounded-lg py-1.5 px-2.5 text-xs font-medium focus:outline-none text-foreground cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="assigned">Assigned</option>
              <option value="in-progress">In Progress</option>
              <option value="testing">Testing</option>
              <option value="ready-for-deployment">Ready for Deployment</option>
              <option value="completed">Completed</option>
              <option value="blocked">Blocked</option>
              <option value="moved-to-live">Moved to Live</option>
            </select>
          </div>

          {/* Date range start */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-muted-foreground/80">Start Date</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full bg-background/60 border border-card-border rounded-lg py-1.5 px-2.5 text-xs font-medium focus:outline-none text-foreground cursor-pointer"
            />
          </div>

          {/* Date range end */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-muted-foreground/80">End Date</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full bg-background/60 border border-card-border rounded-lg py-1.5 px-2.5 text-xs font-medium focus:outline-none text-foreground cursor-pointer"
            />
          </div>

        </div>

      </div>

      {/* METRIC CARD STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-panel p-4.5 rounded-2xl border ${card.bg} relative overflow-hidden group hover:scale-[1.01] transition-all duration-300`}
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wide group-hover:text-foreground transition-colors">
                {card.label}
              </span>
              <card.icon className={`h-4.5 w-4.5 ${card.color} shrink-0`} />
            </div>
            <div className="mt-3.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight">{card.count}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ANALYTICS SECTION (CHARTS BOX) */}
      {isMounted && (
        <div className="glass-panel p-5 rounded-3xl border border-card-border space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Live Performance Analytics
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Real-time statistics calculated from current filtered results.</p>
            </div>
            
            {/* Chart toggle tabs */}
            <div className="flex bg-accent/40 rounded-lg p-0.5 text-xs border border-card-border shrink-0 select-none">
              {(['overview', 'distribution', 'workload'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setAnalyticsTab(tab)}
                  className={`px-3 py-1 rounded font-bold capitalize transition-all cursor-pointer ${
                    analyticsTab === tab ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 w-full">
            {analyticsTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                
                {/* Completed vs Pending (Pie) */}
                <div className="h-full flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-extrabold text-muted-foreground text-center">Completed vs Pending Ratio</span>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartsData.compData}
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {chartsData.compData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '10px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Monthly trend line */}
                <div className="h-full flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-extrabold text-muted-foreground text-center">Monthly Completion Trend</span>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartsData.completionTrendData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#71717a' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#71717a' }} />
                        <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '10px' }} />
                        <Line type="monotone" dataKey="Completed" stroke="#10b981" strokeWidth={2.5} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            )}

            {analyticsTab === 'distribution' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                
                {/* Status bar */}
                <div className="h-full flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-extrabold text-muted-foreground text-center">Tasks by Status Distribution</span>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartsData.statusData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#71717a' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#71717a' }} />
                        <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '10px' }} />
                        <Bar dataKey="Tasks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Priority Pie */}
                <div className="h-full flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-extrabold text-muted-foreground text-center">Tasks by Priority Groupings</span>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartsData.priorityData}
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {chartsData.priorityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '10px' }} />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} layout="horizontal" verticalAlign="bottom" align="center" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            )}

            {analyticsTab === 'workload' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                
                {/* Employee active points bar */}
                <div className="h-full flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-extrabold text-muted-foreground text-center">Employee Active Workload Index (Points)</span>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartsData.employeeWorkloadData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#71717a' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#71717a' }} />
                        <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '10px' }} />
                        <Bar dataKey="Points" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Project items count bar */}
                <div className="h-full flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-extrabold text-muted-foreground text-center">Tasks Count by Project</span>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartsData.projectData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#71717a' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#71717a' }} />
                        <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '10px' }} />
                        <Bar dataKey="Tasks" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* TWO COLUMNS OPERATIONAL WIDGETS AND LISTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Project Progress & Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Project Progress Tracker */}
          <div className="glass-panel p-5 rounded-3xl border border-card-border space-y-4">
            <div>
              <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Active Project Delivery
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Real-time status of all corporate project pipelines.</p>
            </div>

            <div className="space-y-4 pt-1">
              {projectProgress.length > 0 ? (
                projectProgress.map((p) => (
                  <div key={p.name} className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-foreground">{p.name}</span>
                      <span className="text-muted-foreground">{p.progress}% Completed</span>
                    </div>

                    {/* Progress Bar wrapper */}
                    <div className="w-full h-2 bg-accent/40 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${p.progress}%` }} />
                    </div>

                    {/* Miniature counts breakdown */}
                    <div className="flex gap-4 text-[9px] font-bold text-muted-foreground">
                      <span>Total: <strong className="text-foreground">{p.total}</strong></span>
                      <span>Pending: <strong className="text-foreground">{p.pending}</strong></span>
                      <span>Testing: <strong className="text-foreground">{p.testing}</strong></span>
                      <span>Deployment: <strong className="text-foreground">{p.deployment}</strong></span>
                      <span>Live: <strong className="text-foreground">{p.live}</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No project pipelines registered.</p>
              )}
            </div>
          </div>

          {/* Double Grid for Activities & Comments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Widget 1: Recent Activity Feed */}
            <div className="glass-panel p-5 rounded-3xl border border-card-border space-y-4">
              <div>
                <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Recent Portal Activity Log
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Audit log of task updates across the team.</p>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {recentActivities.length > 0 ? (
                  recentActivities.map((act) => (
                    <div key={act.id} className="flex gap-2 text-xs font-semibold border-b border-border/20 pb-2.5 last:border-b-0 last:pb-0">
                      <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-[10px]">
                        {act.user.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground leading-snug truncate">
                          <strong className="text-foreground font-bold">{act.user.split('@')[0]}</strong> {act.action}
                        </p>
                        <p className="text-[9px] text-muted-foreground mt-0.5 font-medium truncate">
                          Task: <span className="text-foreground">{act.taskId}</span> • {act.project}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">No activities logged yet.</p>
                )}
              </div>
            </div>

            {/* Widget 2: Latest Comments Feed */}
            <div className="glass-panel p-5 rounded-3xl border border-card-border space-y-4">
              <div>
                <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-violet-500" />
                  Latest Discussion Comments
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Recent team commentary across project boards.</p>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {latestComments.length > 0 ? (
                  latestComments.map((com) => (
                    <div key={com.id} className="flex gap-2 text-xs font-semibold border-b border-border/20 pb-2.5 last:border-b-0 last:pb-0">
                      <div 
                        className="w-6 h-6 rounded flex items-center justify-center font-bold text-white shrink-0 text-[10px]"
                        style={{ backgroundColor: com.userAvatarColor || '#8B5CF6' }}
                      >
                        {com.userName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <strong className="text-foreground font-bold truncate text-[11px]">{com.userName}</strong>
                          <span className="text-[8px] text-muted-foreground">{formatDate(com.timestamp)}</span>
                        </div>
                        <p className="text-muted-foreground text-[10px] leading-snug line-clamp-1 italic">
                          "{com.content.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '$1')}"
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">No comments posted yet.</p>
                )}
              </div>
            </div>

          </div>

          {/* Double Grid for Completed & Critical Tasks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Widget 3: Recent Completed Tasks */}
            <div className="glass-panel p-5 rounded-3xl border border-card-border space-y-4">
              <div>
                <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Recent Completed Tasks
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Pipeline tasks finished recently.</p>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {recentCompletedTasks.length > 0 ? (
                  recentCompletedTasks.map((t) => (
                    <div key={t.id} className="p-2.5 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl flex justify-between items-center text-xs">
                      <div className="truncate max-w-[190px]">
                        <span className="font-bold font-mono text-[9px] text-muted-foreground mr-1.5">{t.taskId}</span>
                        <span className="font-extrabold text-foreground truncate">{t.title}</span>
                      </div>
                      <span className="text-[9px] text-emerald-500 font-bold shrink-0">{t.assigneeName.split(' ')[0]}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">No completed tasks yet.</p>
                )}
              </div>
            </div>

            {/* Widget 4: Critical Active Tasks */}
            <div className="glass-panel p-5 rounded-3xl border border-card-border space-y-4">
              <div>
                <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  Critical Active Tasks
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Active high-priority blockers needing attention.</p>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {criticalTasks.length > 0 ? (
                  criticalTasks.map((t) => (
                    <div key={t.id} className="p-2.5 bg-red-500/[0.03] border border-red-500/10 rounded-xl flex justify-between items-center text-xs">
                      <div className="truncate max-w-[190px]">
                        <span className="font-bold font-mono text-[9px] text-red-500 mr-1.5">{t.taskId}</span>
                        <span className="font-extrabold text-foreground truncate">{t.title}</span>
                      </div>
                      <span className="text-[9px] text-red-500 font-bold shrink-0">{t.assigneeName.split(' ')[0]}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic py-4 text-center">Zero critical active tasks. Excellent!</p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Deadlines & Overdue Widgets */}
        <div className="space-y-6">
          
          {/* Widget 1: Today's Tasks */}
          <div className="glass-panel p-5 rounded-3xl border border-card-border space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                  Due Today
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Checklist due by end-of-day.</p>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/15">
                {todayTasks.length} Tasks
              </span>
            </div>

            <div className="space-y-3">
              {todayTasks.length > 0 ? (
                todayTasks.map(t => (
                  <div key={t.id} className="p-3 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[9px] font-bold text-muted-foreground font-mono">{t.taskId}</span>
                      <PriorityBadge priority={t.priority} className="text-[8px]" />
                    </div>
                    <h4 className="font-extrabold text-xs text-foreground line-clamp-1">{t.title}</h4>
                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground">
                      <span>{t.assigneeName}</span>
                      <span>Hours Left: <strong className="text-foreground">{t.estimatedHours || 0}h</strong></span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">No tasks due today. Great work!</p>
              )}
            </div>
          </div>

          {/* Widget 2: Overdue Tasks (Highlighted in Red) */}
          <div className="glass-panel p-5 rounded-3xl border border-red-500/10 bg-red-500/[0.01] space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-red-500 tracking-tight flex items-center gap-2">
                  <UserX className="h-4 w-4 text-red-500" />
                  Overdue Tasks
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Tasks past their completion date (oldest first).</p>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                {overdueTasks.length} Alerts
              </span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {overdueTasks.length > 0 ? (
                overdueTasks.map(t => (
                  <div key={t.id} className="p-3 bg-red-500/[0.04] border border-red-500/15 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[9px] font-bold text-red-500 font-mono">{t.taskId}</span>
                      <span className="text-[9px] font-bold text-red-500/70">{formatDate(t.expectedCompletionDate)}</span>
                    </div>
                    <h4 className="font-extrabold text-xs text-foreground line-clamp-1">{t.title}</h4>
                    <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground pt-1.5 border-t border-red-500/5">
                      <span>{t.assigneeName}</span>
                      <PriorityBadge priority={t.priority} className="text-[8px]" />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">Zero overdue items. Roster is clean!</p>
              )}
            </div>
          </div>

          {/* Widget 3: Upcoming Deadlines (Next 7 days countdown) */}
          <div className="glass-panel p-5 rounded-3xl border border-card-border space-y-4">
            <div>
              <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Upcoming Deadlines
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Tasks due in the next 7 days.</p>
            </div>

            <div className="space-y-3">
              {upcomingDeadlines.length > 0 ? (
                upcomingDeadlines.slice(0, 5).map(t => (
                  <div key={t.id} className="p-3 bg-accent/15 border border-card-border rounded-xl space-y-1.5 hover:scale-[1.005] transition-all">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[9px] font-bold text-muted-foreground font-mono">{t.taskId}</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {t.countdownText}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-xs text-foreground line-clamp-1">{t.title}</h4>
                    <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground">
                      <span>{t.assigneeName}</span>
                      <span>Due: {formatDate(t.expectedCompletionDate)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">No deadlines in the next 7 days.</p>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* TEAM ACTIVITY ROSTER SECTION */}
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Active Team Capacity Roster
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time workload calculation index. Select a profile to view timelines, details, and completion speeds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {teamActivityList.map((act) => (
            <motion.div
              key={act.member.id}
              onClick={() => {
                setSelectedMember(act.member);
                setIsMemberDrawerOpen(true);
              }}
              whileHover={{ y: -2 }}
              className={`glass-panel p-5 rounded-3xl border ${act.cardStyle} flex flex-col justify-between gap-4 cursor-pointer transition-all duration-300 relative select-none`}
            >
              
              {/* Employee Top Header */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-inner"
                    style={{ backgroundColor: act.member.avatarColor }}
                  >
                    {act.member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs text-foreground leading-tight">{act.member.name}</h3>
                    <span className="text-[9px] text-muted-foreground capitalize font-bold">{act.member.role}</span>
                  </div>
                </div>
                
                {/* Workload Point Category */}
                <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${act.badgeStyle}`}>
                  {act.statusLabel} ({act.workloadPoints} pts)
                </span>
              </div>

              {/* Current Active Task details */}
              <div className="bg-background/40 p-3 rounded-xl border border-card-border/50 space-y-1.5 flex-1 min-h-[92px] flex flex-col justify-center">
                {act.currentActiveTask ? (
                  <>
                    <div className="flex justify-between items-center gap-2 mb-0.5">
                      <span className="text-[8px] font-bold font-mono text-muted-foreground">{act.currentActiveTask.taskId}</span>
                      <span className="text-[8px] font-extrabold text-primary uppercase bg-primary/5 px-1 rounded truncate max-w-[120px]">
                        {act.currentActiveTask.projectName}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-xs text-foreground line-clamp-1 leading-snug">
                      {act.currentActiveTask.title}
                    </h4>
                    <div className="flex justify-between items-center pt-1 border-t border-border/20">
                      <StatusBadge status={act.currentActiveTask.status} className="text-[7.5px]" />
                      <span className="text-[9px] text-muted-foreground font-semibold">
                        Due {formatDate(act.currentActiveTask.expectedCompletionDate)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-[10px] text-muted-foreground/80 italic font-semibold">Available for assignment</p>
                  </div>
                )}
              </div>

              {/* Workload Indicator slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-bold text-muted-foreground">
                  <span>Workload Index</span>
                  <span>{act.workloadPercentage}%</span>
                </div>
                <div className="w-full h-1 bg-accent/40 rounded-full overflow-hidden">
                  <div className={`h-full ${act.progressColor} rounded-full`} style={{ width: `${act.workloadPercentage}%` }} />
                </div>
              </div>

              {/* Card Footer Ratios */}
              <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground border-t border-border/20 pt-3">
                <div className="flex gap-3">
                  <span>Active: <strong className="text-foreground">{act.pendingCount}</strong></span>
                  <span>Done: <strong className="text-foreground">{act.completedCount}</strong></span>
                </div>
                <span>Done Rate: <strong className="text-foreground">{act.completionRate}%</strong></span>
              </div>

            </motion.div>
          ))}
        </div>
      </div>

      {/* MEMBER DETAIL DRAWER */}
      <MemberDetailDrawer
        isOpen={isMemberDrawerOpen}
        onClose={() => {
          setSelectedMember(null);
          setIsMemberDrawerOpen(false);
        }}
        member={selectedMember}
        tasks={tasks}
      />

    </div>
  );
}
