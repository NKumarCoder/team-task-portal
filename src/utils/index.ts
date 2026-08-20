export { cn } from './cn';

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'No due date';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return 'Invalid Date';
  }
}

import type { Task, TaskAssignee } from '@/types';

/**
 * Safely extracts all assignees from a task, normalizing between
 * new multi-assignee structure and legacy single-assignee fields.
 * Guarantees every assignee has a non-empty, valid, unique ID.
 */
export function getTaskAssignees(task?: Partial<Task> | null): TaskAssignee[] {
  if (!task) return [];

  if (Array.isArray(task.assignees) && task.assignees.length > 0) {
    const seen = new Set<string>();
    const result: TaskAssignee[] = [];

    task.assignees.forEach((a, idx) => {
      if (!a) return;
      const rawId = (a.id || a.name || `assignee-${idx}`).toLowerCase().trim();
      if (!rawId) return;
      if (!seen.has(rawId)) {
        seen.add(rawId);
        result.push({
          id: rawId,
          name: a.name || a.id || 'Team Member',
          color: a.color || '#6366f1',
        });
      }
    });

    if (result.length > 0) return result;
  }

  // Fallback to legacy single assignee fields if present
  if (task.assigneeId && task.assigneeId.trim()) {
    const cleanId = task.assigneeId.toLowerCase().trim();
    return [
      {
        id: cleanId,
        name: task.assigneeName || cleanId.split('@')[0],
        color: task.assigneeColor || '#6366f1',
      },
    ];
  }

  return [];
}

/**
 * Returns an array of lowercase email strings for all assignees on a task.
 */
export function getTaskAssigneeIds(task?: Partial<Task> | null): string[] {
  return getTaskAssignees(task).map((a) => a.id.toLowerCase());
}

/**
 * Returns a formatted, comma-separated string of all assignee names on a task.
 */
export function getTaskAssigneeNames(task?: Partial<Task> | null): string {
  const assignees = getTaskAssignees(task);
  if (assignees.length === 0) return 'Unassigned';
  return assignees.map((a) => a.name).join(', ');
}

/**
 * Checks if a specific user email is assigned to a task.
 */
export function isUserAssignedToTask(task?: Partial<Task> | null, userEmail?: string | null): boolean {
  if (!userEmail) return false;
  return getTaskAssigneeIds(task).includes(userEmail.toLowerCase());
}

export function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}
