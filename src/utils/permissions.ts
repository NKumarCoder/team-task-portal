/**
 * Role-based permission system
 * Three roles: SuperAdmin, Admin, Member
 */

import { UserRole, Task, TaskStatus } from '../types';
import { isUserAssignedToTask } from './index';

export interface Permissions {
  // Task permissions
  canCreateTask: boolean;
  canEditAnyTask: boolean;
  canEditOwnTask: boolean;
  canDeleteTask: boolean;
  canAssignTask: boolean;
  canReassignTask: boolean;
  canUpdateTaskStatus: boolean;
  canUpdateOwnTaskStatus: boolean;

  // User/Member permissions
  canAddMember: boolean;
  canEditMember: boolean;
  canRemoveMember: boolean;
  canActivateUser: boolean;
  canDeactivateUser: boolean;
  canChangeUserRole: boolean;
  canViewAllMembers: boolean;

  // Reporting
  canViewReports: boolean;
  canAccessSettings: boolean;

  // General
  canViewAllTasks: boolean;
  canViewAllTeam: boolean;
}

/**
 * Get permissions for a given role
 */
export function getPermissionsForRole(role: UserRole): Permissions {
  switch (role) {
    case 'SuperAdmin':
      return {
        // Tasks
        canCreateTask: true,
        canEditAnyTask: true,
        canEditOwnTask: true,
        canDeleteTask: true,
        canAssignTask: true,
        canReassignTask: true,
        canUpdateTaskStatus: true,
        canUpdateOwnTaskStatus: true,

        // Users
        canAddMember: true,
        canEditMember: true,
        canRemoveMember: true,
        canActivateUser: true,
        canDeactivateUser: true,
        canChangeUserRole: true,
        canViewAllMembers: true,

        // Reports & Settings
        canViewReports: true,
        canAccessSettings: true,

        // General
        canViewAllTasks: true,
        canViewAllTeam: true,
      };

    case 'Admin':
      return {
        // Tasks
        canCreateTask: true,
        canEditAnyTask: true,
        canEditOwnTask: true,
        canDeleteTask: false, // Admin cannot delete
        canAssignTask: true,
        canReassignTask: true,
        canUpdateTaskStatus: true,
        canUpdateOwnTaskStatus: true,

        // Users
        canAddMember: false, // Admin cannot add members
        canEditMember: false,
        canRemoveMember: false,
        canActivateUser: false,
        canDeactivateUser: false,
        canChangeUserRole: false,
        canViewAllMembers: true,

        // Reports & Settings
        canViewReports: true,
        canAccessSettings: false,

        // General
        canViewAllTasks: true,
        canViewAllTeam: true,
      };

    case 'Member':
      return {
        // Tasks
        canCreateTask: false,
        canEditAnyTask: false,
        canEditOwnTask: false,
        canDeleteTask: false,
        canAssignTask: false,
        canReassignTask: false,
        canUpdateTaskStatus: false,
        canUpdateOwnTaskStatus: true, // Can only update status of their own tasks

        // Users
        canAddMember: false,
        canEditMember: false,
        canRemoveMember: false,
        canActivateUser: false,
        canDeactivateUser: false,
        canChangeUserRole: false,
        canViewAllMembers: true,

        // Reports & Settings
        canViewReports: true,
        canAccessSettings: false,

        // General
        canViewAllTasks: true,
        canViewAllTeam: true,
      };

    default:
      // Default to Member if role is unknown
      return getPermissionsForRole('Member');
  }
}

/**
 * Check if user can perform an action
 */
export function hasPermission(role: UserRole, action: keyof Permissions): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions[action];
}

/**
 * Check if a SuperAdmin's first account
 * Used to auto-assign SuperAdmin role to nm@i2space.com
 */
export function isSuperAdminEmail(email: string): boolean {
  return email.toLowerCase() === 'nm@i2space.com';
}

/**
 * Check if a user can add a co-assignee to a task
 * Returns true for:
 * - SuperAdmin
 * - Admin
 * - Task Creator
 * - Any currently assigned member
 */
export function canAddCoAssignee(
  task: Task | null | undefined,
  user: { email?: string | null; role?: UserRole } | null | undefined
): boolean {
  if (!task || !user || !user.email) return false;

  if (user.role === 'SuperAdmin' || user.role === 'Admin') {
    return true;
  }

  const userEmail = user.email.toLowerCase();

  // Task creator
  if (task.createdBy && task.createdBy.toLowerCase() === userEmail) {
    return true;
  }

  // Any currently assigned member / co-assignee
  if (isUserAssignedToTask(task, userEmail)) {
    return true;
  }

  return false;
}

export interface StatusPermissionCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if the given user is the designated QA Owner of the task
 */
export function isTaskQaOwner(
  task: Task | null | undefined,
  userEmail: string | null | undefined
): boolean {
  if (!task || !userEmail) return false;
  const email = userEmail.toLowerCase().trim();
  if (task.qaOwnerId && task.qaOwnerId.toLowerCase().trim() === email) return true;
  if (task.qaOwner?.id && task.qaOwner.id.toLowerCase().trim() === email) return true;
  return false;
}

/**
 * Return list of allowed target statuses for the current user and task
 */
export function getAllowedStatusTransitions(
  task: Task | null | undefined,
  user: { email?: string | null; role?: UserRole } | null | undefined
): TaskStatus[] {
  if (!task || !user || !user.email) return [];

  // SuperAdmin and Admin have unrestricted access across all 10 stages
  if (user.role === 'SuperAdmin' || user.role === 'Admin') {
    return [
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
  }

  const userEmail = user.email.toLowerCase().trim();
  const isAssignee = isUserAssignedToTask(task, userEmail);
  const isQa = isTaskQaOwner(task, userEmail);

  const allowed = new Set<TaskStatus>();

  // Assigned Developers: Development workflow stages
  if (isAssignee) {
    allowed.add('assigned');
    allowed.add('in-progress');
    allowed.add('supplier-pending');
    allowed.add('code-review');
  }

  // QA Owner: Verification and Testing stages
  if (isQa) {
    allowed.add('uat-testing');
    allowed.add('uat-rejected');
    allowed.add('ready-for-production-deploy');
    allowed.add('code-review');
    allowed.add('in-progress');
  }

  return Array.from(allowed);
}

/**
 * Validate whether a status transition is permitted
 */
export function canTransitionToStatus(
  task: Task | null | undefined,
  targetStatus: TaskStatus,
  user: { email?: string | null; role?: UserRole } | null | undefined
): StatusPermissionCheck {
  if (!task) {
    return { allowed: false, reason: 'Task does not exist.' };
  }
  if (!user || !user.email) {
    return { allowed: false, reason: 'You must be authenticated to update task status.' };
  }

  // SuperAdmin and Admin can transition to any status
  if (user.role === 'SuperAdmin' || user.role === 'Admin') {
    return { allowed: true };
  }

  const allowedStatuses = getAllowedStatusTransitions(task, user);
  if (allowedStatuses.includes(targetStatus)) {
    return { allowed: true };
  }

  const userEmail = user.email.toLowerCase().trim();
  const isAssignee = isUserAssignedToTask(task, userEmail);
  const isQa = isTaskQaOwner(task, userEmail);

  if (!isAssignee && !isQa) {
    return {
      allowed: false,
      reason: 'Only assigned developers, QA owner, or administrators can update the status of this task.'
    };
  }

  if (targetStatus === 'uat-deployed' || targetStatus === 'prod-deployed' || targetStatus === 'completed') {
    return {
      allowed: false,
      reason: 'Deploying and completing tasks is restricted to Administrators.'
    };
  }

  if (targetStatus === 'uat-rejected' || targetStatus === 'uat-testing' || targetStatus === 'ready-for-production-deploy') {
    return {
      allowed: false,
      reason: 'UAT status transitions are reserved for the designated QA Owner or Administrators.'
    };
  }

  return {
    allowed: false,
    reason: `You do not have permission to transition this task to "${targetStatus}".`
  };
}
