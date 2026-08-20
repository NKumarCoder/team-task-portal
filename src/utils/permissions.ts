/**
 * Role-based permission system
 * Three roles: SuperAdmin, Admin, Member
 */

import { UserRole, Task } from '../types';
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
