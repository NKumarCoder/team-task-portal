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

export interface TaskEmailRecipients {
  to: string[];
  cc: string[];
}

export interface TaskEmailRecipientsOptions {
  creatorEmail?: string;
  extraCc?: string[];
  headEmail?: string;
}

/**
 * Resolves the authoritative list of email recipients for task lifecycle events:
 * - TO: All current assignees/co-assignees
 * - CC: Task creator, Head of Management ('rr@i2space.com'), plus any extra CC addresses
 * - Priority: If an email is in TO, it is omitted from CC.
 * - Deduplication: All addresses are deduplicated case-insensitively and returned in clean lowercase.
 */
export function getTaskEmailRecipients(
  task?: Partial<Task> | null,
  options?: TaskEmailRecipientsOptions
): TaskEmailRecipients {
  const headEmail = (options?.headEmail || 'rr@i2space.com').trim().toLowerCase();

  // 1. Resolve TO recipients (all current assignees)
  const rawAssignees = getTaskAssigneeIds(task);
  const toSet = new Set<string>();
  rawAssignees.forEach((email) => {
    const clean = email.trim().toLowerCase();
    if (clean && clean.includes('@')) {
      toSet.add(clean);
    }
  });

  // 2. Resolve CC candidates (Creator + Head + extraCc)
  const ccCandidates: string[] = [];

  const creator = (options?.creatorEmail || task?.createdBy || '').trim().toLowerCase();
  if (creator && creator.includes('@')) {
    ccCandidates.push(creator);
  }

  if (headEmail && headEmail.includes('@')) {
    ccCandidates.push(headEmail);
  }

  if (options?.extraCc && Array.isArray(options.extraCc)) {
    options.extraCc.forEach((email) => {
      const clean = email.trim().toLowerCase();
      if (clean && clean.includes('@')) {
        ccCandidates.push(clean);
      }
    });
  }

  // 3. Filter CC to omit duplicates and any email already in TO
  const ccSet = new Set<string>();
  ccCandidates.forEach((email) => {
    if (!toSet.has(email)) {
      ccSet.add(email);
    }
  });

  return {
    to: Array.from(toSet),
    cc: Array.from(ccSet),
  };
}

import { WORKING_HOURS_PER_DAY } from '@/constants';

/**
 * Parses a date string (YYYY-MM-DD, MM/DD/YYYY, or ISO timestamp) into UTC midnight Date
 * to ensure 100% timezone-independent and DST-immune date comparisons.
 */
export function parseDateOnlyToUTC(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();

  // Match YYYY-MM-DD (e.g., "2026-08-20")
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }

  // Match DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashMatch) {
    const part1 = parseInt(slashMatch[1], 10);
    const part2 = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    
    // If part1 > 12, it's definitely DD/MM/YYYY
    let month = part1 - 1;
    let day = part2;
    if (part1 > 12) {
      day = part1;
      month = part2 - 1;
    }
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Calculates inclusive calendar days between startDate and expectedCompletionDate:
 * - Both dates are required.
 * - Same day (Start = End) -> 1 day
 * - Start = 20/08/2026, End = 21/08/2026 -> 2 days
 * - Start = 20/08/2026, End = 22/08/2026 -> 3 days
 * - If End < Start -> 0 days (invalid range)
 * - Returns integer number of inclusive days.
 */
export function calculateWorkingDays(startDateStr?: string | null, endDateStr?: string | null): number {
  const startUTC = parseDateOnlyToUTC(startDateStr);
  const endUTC = parseDateOnlyToUTC(endDateStr);

  if (!startUTC || !endUTC) return 0;
  if (endUTC.getTime() < startUTC.getTime()) return 0;

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((endUTC.getTime() - startUTC.getTime()) / msPerDay);
  return diffDays + 1; // Inclusive of both start date and end date
}

/**
 * Calculates estimated effort in hours:
 * Estimated Effort = Working Days * WORKING_HOURS_PER_DAY (9)
 * Examples:
 * - 20/08/2026 -> 20/08/2026 = 1 day  * 9 = 9 Hours
 * - 20/08/2026 -> 21/08/2026 = 2 days * 9 = 18 Hours
 * - 20/08/2026 -> 22/08/2026 = 3 days * 9 = 27 Hours
 */
export function calculateEstimatedEffort(
  startDateStr?: string | null,
  endDateStr?: string | null,
  hoursPerDay: number = WORKING_HOURS_PER_DAY
): number {
  const days = calculateWorkingDays(startDateStr, endDateStr);
  return Math.round(days * hoursPerDay);
}

/**
 * Formats a day count into a clean user-facing string:
 * - 1 -> "1 Day"
 * - 2 -> "2 Days"
 * - 0 -> "0 Days"
 */
export function formatEstimatedDays(days: number): string {
  const count = Math.max(0, Math.round(days || 0));
  return `${count} ${count === 1 ? 'Day' : 'Days'}`;
}

/**
 * Resolves the estimated days for a task (derives from dates or from stored estimatedHours / 9).
 */
export function getTaskEstimatedDays(task?: Partial<Task> | null): number {
  if (!task) return 0;
  if (task.startDate && task.expectedCompletionDate) {
    const days = calculateWorkingDays(task.startDate, task.expectedCompletionDate);
    if (days > 0) return days;
  }
  if (typeof task.estimatedHours === 'number' && task.estimatedHours > 0) {
    return Math.max(1, Math.round(task.estimatedHours / WORKING_HOURS_PER_DAY));
  }
  return 0;
}

import type { Member, TaskStatus } from '@/types';
import { ACTIVE_TASK_STATUS_LIST, TASK_STATUS_CONFIG } from '@/constants';

export interface StatusCountItem {
  status: TaskStatus;
  label: string;
  count: number;
  color: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
}

export interface MemberProjectWorkload {
  member: Member;
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  statusCounts: Record<string, number>;
  nonZeroStatusCounts: StatusCountItem[];
  workloadPoints: number;
  workloadPercentage: number;
  statusLabel: 'Normal' | 'Medium' | 'High' | 'Overloaded';
  cardStyle: string;
  badgeStyle: string;
  progressColor: string;
  tasks: Task[];
  urgentTask: Task | null;
  completionRate: number;
}

export interface ProjectWorkloadResult {
  projectTotalTasks: number;
  projectActiveTasks: number;
  projectCompletedTasks: number;
  totalTeamMembers: number;
  activeTeamMembersCount: number;
  totalTeamAssignments: number;
  memberWorkloads: MemberProjectWorkload[];
}

/**
 * Calculates project-aware, multi-assignee-compatible member workloads.
 * - If projectName === 'all', calculates across all projects.
 * - Shared tasks give +1 workload to each assigned member, while counting as 1 task for the project total.
 * - Reuses the exact workload formula from Dashboard (Critical: 5, High: 3, Medium: 2, Low: 1).
 */
export function getProjectMemberWorkload(
  tasks: Task[] = [],
  members: Member[] = [],
  projectName: string = 'all'
): ProjectWorkloadResult {
  // 1. Filter project tasks
  const projectTasks = projectName === 'all'
    ? tasks
    : tasks.filter(t => (t.projectName || '').toLowerCase() === projectName.toLowerCase());

  const projectTotalTasks = projectTasks.length;
  
  const isCompletedStatus = (s: string) => s === 'completed' || s === 'prod-deployed' || s === 'moved-to-live';
  const isCancelledStatus = (s: string) => s === 'cancelled';

  const projectCompletedTasks = projectTasks.filter(t => isCompletedStatus(t.status)).length;
  const projectActiveTasks = projectTasks.filter(t => !isCompletedStatus(t.status) && !isCancelledStatus(t.status)).length;

  // 2. Compute workload for each member
  const memberWorkloads: MemberProjectWorkload[] = members.map(member => {
    const memberTasks = projectTasks.filter(t => isUserAssignedToTask(t, member.email));
    const active = memberTasks.filter(t => !isCompletedStatus(t.status) && !isCancelledStatus(t.status));
    const completed = memberTasks.filter(t => isCompletedStatus(t.status));

    // Sort active tasks by urgency (earliest deadline first)
    const sortedActive = [...active].sort(
      (a, b) => new Date(a.expectedCompletionDate).getTime() - new Date(b.expectedCompletionDate).getTime()
    );
    const urgentTask = sortedActive[0] || null;

    // Status distribution
    const statusCounts: Record<string, number> = {};
    ACTIVE_TASK_STATUS_LIST.forEach(st => {
      statusCounts[st] = 0;
    });

    memberTasks.forEach(t => {
      if (statusCounts[t.status] !== undefined) {
        statusCounts[t.status] += 1;
      } else {
        statusCounts[t.status] = 1;
      }
    });

    const nonZeroStatusCounts: StatusCountItem[] = ACTIVE_TASK_STATUS_LIST
      .map(st => {
        const count = statusCounts[st] || 0;
        const config = TASK_STATUS_CONFIG[st] || {
          label: st,
          color: '#6366f1',
          badgeBg: 'bg-primary/10',
          badgeColor: 'text-primary',
          badgeBorder: 'border-primary/20',
        };
        return {
          status: st,
          label: config.label,
          count,
          color: config.color,
          badgeBg: config.badgeBg,
          badgeColor: config.badgeColor,
          badgeBorder: config.badgeBorder,
        };
      })
      .filter(item => item.count > 0);

    // Workload points (Critical: 5, High: 3, Medium: 2, Low: 1)
    const workloadPoints = active.reduce((acc, t) => {
      const pts = t.priority === 'critical' ? 5 
                : t.priority === 'high' ? 3 
                : t.priority === 'medium' ? 2 
                : 1;
      return acc + pts;
    }, 0);

    let statusLabel: 'Normal' | 'Medium' | 'High' | 'Overloaded' = 'Normal';
    let cardStyle = 'border-emerald-500/15 bg-emerald-500/[0.03] hover:border-emerald-500/35 hover:bg-emerald-500/[0.06] shadow-emerald-500/[0.02]';
    let badgeStyle = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25';
    let progressColor = 'bg-emerald-500';

    if (workloadPoints >= 3 && workloadPoints <= 6) {
      statusLabel = 'Medium';
      cardStyle = 'border-amber-500/15 bg-amber-500/[0.03] hover:border-amber-500/35 hover:bg-amber-500/[0.06] shadow-amber-500/[0.02]';
      badgeStyle = 'bg-amber-500/10 text-amber-500 border-amber-500/25';
      progressColor = 'bg-amber-500';
    } else if (workloadPoints >= 7 && workloadPoints <= 10) {
      statusLabel = 'High';
      cardStyle = 'border-orange-500/15 bg-orange-500/[0.03] hover:border-orange-500/35 hover:bg-orange-500/[0.06] shadow-orange-500/[0.02]';
      badgeStyle = 'bg-orange-500/10 text-orange-500 border-orange-500/25';
      progressColor = 'bg-orange-500';
    } else if (workloadPoints > 10) {
      statusLabel = 'Overloaded';
      cardStyle = 'border-red-500/15 bg-red-500/[0.03] hover:border-red-500/35 hover:bg-red-500/[0.06] shadow-red-500/[0.02]';
      badgeStyle = 'bg-red-500/10 text-red-500 border-red-500/25';
      progressColor = 'bg-red-500';
    }

    const workloadPercentage = Math.min(100, Math.round((workloadPoints / 15) * 100));
    const completionRate = memberTasks.length > 0 ? Math.round((completed.length / memberTasks.length) * 100) : 0;

    return {
      member,
      totalTasks: memberTasks.length,
      activeTasks: active.length,
      completedTasks: completed.length,
      statusCounts,
      nonZeroStatusCounts,
      workloadPoints,
      workloadPercentage,
      statusLabel,
      cardStyle,
      badgeStyle,
      progressColor,
      tasks: memberTasks,
      urgentTask,
      completionRate,
    };
  });

  const activeTeamMembersCount = memberWorkloads.filter(m => m.totalTasks > 0).length;
  const totalTeamAssignments = memberWorkloads.reduce((acc, m) => acc + m.totalTasks, 0);

  return {
    projectTotalTasks,
    projectActiveTasks,
    projectCompletedTasks,
    totalTeamMembers: members.length,
    activeTeamMembersCount,
    totalTeamAssignments,
    memberWorkloads,
  };
}

/**
 * Calculates elapsed age in calendar days from an ISO date string to today.
 * Examples:
 * - Created today -> 0 days
 * - Created yesterday -> 1 day
 * - Created 2 days ago -> 2 days
 * - Created 3 days ago -> 3 days
 */
export function calculateTodoAgeInDays(createdAt: string): number {
  if (!createdAt) return 0;
  const createdDate = new Date(createdAt);
  if (isNaN(createdDate.getTime())) return 0;

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const createdMidnight = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());

  const diffMs = todayMidnight.getTime() - createdMidnight.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export type TodoAgeSeverity = 'normal' | 'warning' | 'critical';

export interface TodoAgeInfo {
  ageInDays: number;
  severity: TodoAgeSeverity;
  badgeText: string;
  badgeIcon: string;
}

/**
 * Evaluates the aging status according to exact boundary rules:
 * - Age <= 2 days -> normal
 * - Age > 2 and Age <= 10 days -> warning (orange)
 * - Age > 10 days -> critical (red)
 */
export function getTodoAgeInfo(createdAt: string): TodoAgeInfo {
  const age = calculateTodoAgeInDays(createdAt);
  let severity: TodoAgeSeverity = 'normal';
  if (age > 10) {
    severity = 'critical';
  } else if (age > 2) {
    severity = 'warning';
  }

  let badgeText = '';
  if (age === 0) {
    badgeText = 'Today';
  } else if (age === 1) {
    badgeText = '1 day old';
  } else {
    badgeText = `${age} days old`;
  }

  const badgeIcon = severity === 'critical' ? '🔴' : severity === 'warning' ? '🟠' : '';

  return {
    ageInDays: age,
    severity,
    badgeText,
    badgeIcon,
  };
}
