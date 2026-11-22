// New simplified role system - only 3 roles
export type UserRole = 'SuperAdmin' | 'Admin' | 'Member';

export interface NotificationPreferences {
  assignments: boolean; // 1. Task Assignments / Reassignments
  statusChanges: boolean; // 2. Task Status Changes
  taskUpdates: boolean; // 3. Task Updates (Priority, Due Date, Details)
  comments: boolean; // 4. Comments
  replies: boolean; // 5. Comment Replies
  mentions: boolean; // 6. @Mentions
  uatRejections: boolean; // 7. UAT Rejections
  watcherUpdates: boolean; // 8. Watcher Notifications
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  assignments: true,
  statusChanges: true,
  taskUpdates: true,
  comments: true,
  replies: true,
  mentions: true,
  uatRejections: true,
  watcherUpdates: true,
};

// User document in Firestore (replaces Member)
export interface User {
  uid: string; // Firebase Auth UID
  name: string;
  email: string;
  role: UserRole; // SuperAdmin, Admin, or Member
  isActive: boolean;
  avatarColor: string; // e.g. '#3b82f6'
  notificationPreferences?: NotificationPreferences; // User's custom preferences
  createdAt: string; // ISO String - when user was first created
  createdBy: string; // Email of who created this user
  updatedAt: string; // ISO String - last update timestamp
}

export interface Member {
  id?: string;
  uid?: string;
  name: string;
  email: string;
  role: UserRole;
  avatarColor: string; // e.g. '#3b82f6'
  password?: string;
  isActive?: boolean;
  createdDate: string; // ISO String
}

export type TaskStatus = 
  // 10 Active Workflow Statuses
  | 'assigned' 
  | 'in-progress' 
  | 'supplier-pending'
  | 'code-review' 
  | 'uat-deployed' 
  | 'uat-testing' 
  | 'uat-rejected' 
  | 'ready-for-production-deploy' 
  | 'prod-deployed' 
  | 'completed' 
  // Legacy / Historical Backward Compatibility
  | 'development-completed'
  | 'testing' 
  | 'uat' 
  | 'ready-for-deployment' 
  | 'deployed' 
  | 'moved-to-live' 
  | 'blocked' 
  | 'on-hold' 
  | 'cancelled';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface RejectionRecord {
  id: string; // Unique ID e.g. rej-1725...
  reason: string;
  rejectedBy: string; // Email
  rejectedByName: string; // Display name
  rejectedAt: string; // ISO date string
  previousStatus?: TaskStatus | string;
}

export interface TaskStatusHistory {
  status: TaskStatus;
  previousStatus?: TaskStatus | string;
  updatedBy: string; // User email
  updatedByName: string; // User display name
  updatedAt: string; // ISO Date String
  comment?: string; // Status update comment / rejection reason
  remarks?: string;
}

export interface Subtask {
  id: string;
  title: string;
  status: 'pending' | 'completed';
  assignedUser?: string; // Email
  completedDate?: string; // ISO String
}

export type IssueType = 'Bug' | 'Task' | 'Story' | 'Epic';

export interface TaskAssignee {
  id: string; // Email
  name: string; // Display Name
  color: string; // Avatar Color (e.g. '#6366f1')
}

export interface TaskWatcher {
  id: string; // Email or UID
  name: string; // Display Name
  email: string; // Email
  avatarColor?: string;
  watchedAt: string; // ISO date string
}

export interface Task {
  id?: string;
  taskId: string; // Auto-generated e.g. TASK-000001
  projectName: string;
  title: string;
  description: string;
  issueType?: IssueType; // Bug, Task, Story, Epic (defaults to Task)
  parentTaskId?: string; // Parent Task ID or Sequence ID (e.g. TASK-000001)
  parentTaskTitle?: string; // Optional cached title of parent task
  qaOwner?: TaskAssignee; // Dedicated QA Owner
  qaOwnerId?: string; // QA Owner email for fast lookups
  qaOwnerName?: string; // QA Owner display name
  assignees?: TaskAssignee[]; // Multi-assignees list (Authoritative)
  assigneeIds?: string[]; // Multi-assignees email list for fast membership checks
  assigneeId?: string; // Legacy fallback single email
  assigneeName?: string; // Legacy fallback single display name
  assigneeColor?: string; // Legacy fallback avatar color
  priority: TaskPriority;
  status: TaskStatus;
  module: string;
  startDate: string; // ISO Date String (When task starts)
  expectedCompletionDate: string; // ISO Date String (Due Date)
  estimatedHours: number;
  labels: string[]; // Multiple tags
  remarks: string;
  latestRejectionReason?: string; // Latest UAT rejection reason if applicable
  rejectionHistory?: RejectionRecord[]; // Comprehensive history across multiple rejections
  watchers?: TaskWatcher[]; // List of task followers/watchers (Batch 4)
  watcherIds?: string[]; // Watcher emails list for fast membership checks (Batch 4)
  attachments?: Attachment[]; // File attachments
  subtasks?: Subtask[]; // Checklist items
  dependencies?: string[]; // Array of prerequisite Task IDs (e.g. ['TASK-000001'])
  createdBy: string; // Email
  createdByName?: string; // Display Name
  createdDate: string; // ISO Date String
  updatedDate: string; // ISO Date String
  isDeleted?: boolean; // Soft Delete indicator
  deletedDate?: string; // ISO Date String
  deletedBy?: string; // Email
  statusHistory?: TaskStatusHistory[]; // Array of status updates for Timeline
}

export interface Attachment {
  id: string;
  name: string;
  size: number; // in bytes
  uploadedBy: string; // email
  uploadedByName: string; // name
  uploadedDate: string; // ISO string
  url: string; // download url or object url
  isMock?: boolean;
}

export interface MentionData {
  userId: string; // member email or UID
  userName: string; // member display name
}

export interface Comment {
  id?: string;
  taskId: string;
  userId: string; // email or UID
  userName: string;
  userAvatarColor?: string;
  content: string;
  mentions?: MentionData[];
  parentId?: string | null; // null/undefined for top-level comments, parent comment ID for replies
  replyCount?: number; // count of replies for parent comment
  isDeleted?: boolean; // soft-delete indicator so threaded replies remain accessible
  timestamp: string; // ISO String
  edited?: boolean;
  editedAt?: string;
}

export interface ActivityLog {
  id?: string;
  activityId?: string; // Align with request
  taskId: string; // Task document ID
  taskSeqId?: string; // e.g. TASK-000001
  taskTitle: string;
  user: string; // email (backward compatibility)
  userName: string; // backward compatibility
  action: string; // e.g. 'Task Created'
  fieldName?: string; // Field-level audit: e.g. 'Status', 'Priority', 'Assignees', 'QA Owner', 'Due Date', 'Title', 'Description', 'Remarks', 'Issue Type', 'Parent Task', 'Subtask'
  oldValue: string; // backward compatibility
  newValue: string; // backward compatibility
  previousValue?: string; // Align with request
  performedBy?: string; // Align with request
  performedByEmail?: string; // Align with request
  timestamp: string; // ISO string
}

export interface NotificationItem {
  id?: string;
  notificationId?: string; // Align with request
  userId: string; // recipient email or UID
  title: string;
  message: string;
  taskId: string; // related task ID
  commentId?: string; // related comment ID for deep linking
  senderEmail?: string;
  senderName?: string;
  type: 'assignment' | 'mention' | 'status-change' | 'due-date' | 'completed' | 'comment-added' | 'reply-added' | string;
  read: boolean; // backward compatibility
  isRead?: boolean; // Align with request
  isWatcherNotification?: boolean; // Indicates if notification was sent due to watching task (Batch 4)
  timestamp: string; // backward compatibility (ISO string)
  createdDate?: string; // Align with request
}

export interface PortalSettings {
  id?: string;
  companyName: string;
  allowMemberSignUp: boolean;
  defaultTaskRole: UserRole;
  notificationsEnabled: boolean;
}

export interface MonthlyReport {
  id?: string;
  month: string; // e.g. "July 2026"
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  testingTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  efficiencyRate: number; // percentage
  generatedAt: string; // ISO Date String
}

export interface UserSession {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarColor: string;
  notificationPreferences?: NotificationPreferences;
}

export interface Project {
  id?: string;
  name: string;
  createdDate: string;
  createdBy: string;
}

export interface TodoItem {
  id?: string;
  userId: string; // Email of owner (current authenticated user)
  title: string;
  note?: string; // Optional lightweight note / remarks
  completed: boolean;
  completedAt?: string; // ISO string
  dueDate?: string; // ISO date string e.g. "2026-08-28"
  createdAt: string; // ISO Date String
  updatedAt: string; // ISO Date String
  convertedToTaskId?: string; // Formal Task ID e.g. "TASK-000012"
  convertedAt?: string; // ISO Date String
}
