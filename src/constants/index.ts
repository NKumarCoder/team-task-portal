import { TaskPriority, TaskStatus, UserRole } from '../types';

export const WORKING_HOURS_PER_DAY = 9;

export const TASK_PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#3b82f6' },
  { value: 'medium', label: 'Medium', color: '#8b5cf6' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'critical', label: 'Critical Priority', color: '#ef4444' },
];

export const ACTIVE_TASK_STATUS_LIST: TaskStatus[] = [
  'assigned',
  'in-progress',
  'supplier-pending',
  'code-review',
  'uat-deployed',
  'uat-testing',
  'uat-rejected',
  'ready-for-production-deploy',
  'prod-deployed',
  'completed'
];

export const TASK_STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  kanbanBg: string;
  kanbanBorder: string;
  kanbanText: string;
}> = {
  'assigned': {
    label: 'Assigned',
    color: '#3b82f6',
    badgeBg: 'bg-blue-500/10',
    badgeColor: 'text-blue-500 dark:text-blue-400',
    badgeBorder: 'border-blue-500/25',
    kanbanBg: 'bg-blue-500/5',
    kanbanBorder: 'border-blue-500/10',
    kanbanText: 'text-blue-400'
  },
  'in-progress': {
    label: 'In Progress',
    color: '#6366f1',
    badgeBg: 'bg-indigo-500/10',
    badgeColor: 'text-indigo-500 dark:text-indigo-400',
    badgeBorder: 'border-indigo-500/25',
    kanbanBg: 'bg-indigo-500/5',
    kanbanBorder: 'border-indigo-500/10',
    kanbanText: 'text-indigo-400'
  },
  'supplier-pending': {
    label: 'Supplier Pending',
    color: '#f59e0b',
    badgeBg: 'bg-amber-500/10',
    badgeColor: 'text-amber-500 dark:text-amber-400',
    badgeBorder: 'border-amber-500/25',
    kanbanBg: 'bg-amber-500/5',
    kanbanBorder: 'border-amber-500/10',
    kanbanText: 'text-amber-400'
  },
  'code-review': {
    label: 'Code Review',
    color: '#a855f7',
    badgeBg: 'bg-purple-500/10',
    badgeColor: 'text-purple-500 dark:text-purple-400',
    badgeBorder: 'border-purple-500/25',
    kanbanBg: 'bg-purple-500/5',
    kanbanBorder: 'border-purple-500/10',
    kanbanText: 'text-purple-400'
  },
  'uat-deployed': {
    label: 'UAT Deployed',
    color: '#06b6d4',
    badgeBg: 'bg-cyan-500/10',
    badgeColor: 'text-cyan-500 dark:text-cyan-400',
    badgeBorder: 'border-cyan-500/25',
    kanbanBg: 'bg-cyan-500/5',
    kanbanBorder: 'border-cyan-500/10',
    kanbanText: 'text-cyan-400'
  },
  'uat-testing': {
    label: 'UAT Testing',
    color: '#0284c7',
    badgeBg: 'bg-sky-500/10',
    badgeColor: 'text-sky-500 dark:text-sky-400',
    badgeBorder: 'border-sky-500/25',
    kanbanBg: 'bg-sky-500/5',
    kanbanBorder: 'border-sky-500/10',
    kanbanText: 'text-sky-400'
  },
  'uat-rejected': {
    label: 'UAT Rejected',
    color: '#ef4444',
    badgeBg: 'bg-rose-500/10',
    badgeColor: 'text-rose-500 dark:text-rose-400',
    badgeBorder: 'border-rose-500/30',
    kanbanBg: 'bg-rose-500/5',
    kanbanBorder: 'border-rose-500/25',
    kanbanText: 'text-rose-400'
  },
  'ready-for-production-deploy': {
    label: 'Ready for Production Deploy',
    color: '#8b5cf6',
    badgeBg: 'bg-violet-500/10',
    badgeColor: 'text-violet-500 dark:text-violet-400',
    badgeBorder: 'border-violet-500/25',
    kanbanBg: 'bg-violet-500/5',
    kanbanBorder: 'border-violet-500/10',
    kanbanText: 'text-violet-400'
  },
  'prod-deployed': {
    label: 'Prod Deployed',
    color: '#14b8a6',
    badgeBg: 'bg-teal-500/10',
    badgeColor: 'text-teal-500 dark:text-teal-400',
    badgeBorder: 'border-teal-500/25',
    kanbanBg: 'bg-teal-500/5',
    kanbanBorder: 'border-teal-500/10',
    kanbanText: 'text-teal-400'
  },
  'completed': {
    label: 'Completed',
    color: '#10b981',
    badgeBg: 'bg-emerald-500/10',
    badgeColor: 'text-emerald-500 dark:text-emerald-400',
    badgeBorder: 'border-emerald-500/25',
    kanbanBg: 'bg-emerald-500/5',
    kanbanBorder: 'border-emerald-500/10',
    kanbanText: 'text-emerald-400'
  },
  // Legacy status fallbacks for historical records
  'development-completed': {
    label: 'Development Completed',
    color: '#10b981',
    badgeBg: 'bg-indigo-500/10',
    badgeColor: 'text-indigo-400',
    badgeBorder: 'border-indigo-500/25',
    kanbanBg: 'bg-indigo-500/5',
    kanbanBorder: 'border-indigo-500/10',
    kanbanText: 'text-indigo-400'
  },
  'testing': {
    label: 'Testing',
    color: '#a855f7',
    badgeBg: 'bg-purple-500/10',
    badgeColor: 'text-purple-400',
    badgeBorder: 'border-purple-500/25',
    kanbanBg: 'bg-purple-500/5',
    kanbanBorder: 'border-purple-500/10',
    kanbanText: 'text-purple-400'
  },
  'uat': {
    label: 'UAT',
    color: '#ec4899',
    badgeBg: 'bg-pink-500/10',
    badgeColor: 'text-pink-400',
    badgeBorder: 'border-pink-500/25',
    kanbanBg: 'bg-pink-500/5',
    kanbanBorder: 'border-pink-500/10',
    kanbanText: 'text-pink-400'
  },
  'ready-for-deployment': {
    label: 'Ready for Deployment',
    color: '#14b8a6',
    badgeBg: 'bg-teal-500/10',
    badgeColor: 'text-teal-400',
    badgeBorder: 'border-teal-500/25',
    kanbanBg: 'bg-teal-500/5',
    kanbanBorder: 'border-teal-500/10',
    kanbanText: 'text-teal-400'
  },
  'deployed': {
    label: 'Deployed',
    color: '#06b6d4',
    badgeBg: 'bg-cyan-500/10',
    badgeColor: 'text-cyan-400',
    badgeBorder: 'border-cyan-500/25',
    kanbanBg: 'bg-cyan-500/5',
    kanbanBorder: 'border-cyan-500/10',
    kanbanText: 'text-cyan-400'
  },
  'moved-to-live': {
    label: 'Moved to Live',
    color: '#84cc16',
    badgeBg: 'bg-emerald-500/10',
    badgeColor: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/25',
    kanbanBg: 'bg-emerald-500/5',
    kanbanBorder: 'border-emerald-500/10',
    kanbanText: 'text-emerald-400'
  },
  'blocked': {
    label: 'Blocked',
    color: '#ef4444',
    badgeBg: 'bg-red-500/10',
    badgeColor: 'text-red-400',
    badgeBorder: 'border-red-500/25',
    kanbanBg: 'bg-red-500/5',
    kanbanBorder: 'border-red-500/10',
    kanbanText: 'text-red-400'
  },
  'on-hold': {
    label: 'On Hold',
    color: '#6b7280',
    badgeBg: 'bg-amber-500/10',
    badgeColor: 'text-amber-400',
    badgeBorder: 'border-amber-500/25',
    kanbanBg: 'bg-amber-500/5',
    kanbanBorder: 'border-amber-500/10',
    kanbanText: 'text-amber-400'
  },
  'cancelled': {
    label: 'Cancelled',
    color: '#9ca3af',
    badgeBg: 'bg-zinc-500/10',
    badgeColor: 'text-zinc-400',
    badgeBorder: 'border-zinc-500/25',
    kanbanBg: 'bg-zinc-500/5',
    kanbanBorder: 'border-zinc-500/10',
    kanbanText: 'text-zinc-400'
  }
};

export const TASK_STATUSES: { value: TaskStatus; label: string; color: string }[] = ACTIVE_TASK_STATUS_LIST.map(status => ({
  value: status,
  label: TASK_STATUS_CONFIG[status]?.label || status,
  color: TASK_STATUS_CONFIG[status]?.color || '#6366f1'
}));

// New role system - only SuperAdmin, Admin, Member
export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'SuperAdmin', label: 'Super Admin' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Member', label: 'Member' },
];

export const MAX_ASSIGNEES = 10;

export const FIREBASE_COLLECTIONS = {
  USERS: 'users',
  TASKS: 'tasks',
  SETTINGS: 'settings',
  MONTHLY_REPORTS: 'monthlyReports',
  COMMENTS: 'taskComments',
  NOTIFICATIONS: 'notifications',
  ACTIVITIES: 'taskActivities',
} as const;
