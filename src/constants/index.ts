import { TaskPriority, TaskStatus, UserRole } from '../types';

export const TASK_PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#3b82f6' },
  { value: 'medium', label: 'Medium', color: '#8b5cf6' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'critical', label: 'Critical Priority', color: '#ef4444' },
];

export const TASK_STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'assigned', label: 'Assigned', color: '#3b82f6' },
  { value: 'in-progress', label: 'In Progress', color: '#6366f1' },
  { value: 'supplier-pending', label: 'Supplier Pending', color: '#f59e0b' },
  { value: 'development-completed', label: 'Development Completed', color: '#10b981' },
  { value: 'code-review', label: 'Code Review', color: '#f59e0b' },
  { value: 'testing', label: 'Testing', color: '#a855f7' },
  { value: 'uat', label: 'UAT', color: '#ec4899' },
  { value: 'ready-for-deployment', label: 'Ready for Deployment', color: '#14b8a6' },
  { value: 'deployed', label: 'Deployed', color: '#06b6d4' },
  { value: 'moved-to-live', label: 'Moved to Live', color: '#84cc16' },
  { value: 'completed', label: 'Completed', color: '#10b981' },
  { value: 'blocked', label: 'Blocked', color: '#ef4444' },
  { value: 'on-hold', label: 'On Hold', color: '#6b7280' },
  { value: 'cancelled', label: 'Cancelled', color: '#9ca3af' },
];

// New role system - only SuperAdmin, Admin, Member
export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'SuperAdmin', label: 'Super Admin' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Member', label: 'Member' },
];

export const FIREBASE_COLLECTIONS = {
  USERS: 'users',
  TASKS: 'tasks',
  SETTINGS: 'settings',
  MONTHLY_REPORTS: 'monthlyReports',
  COMMENTS: 'taskComments',
  NOTIFICATIONS: 'notifications',
  ACTIVITIES: 'taskActivities',
} as const;
