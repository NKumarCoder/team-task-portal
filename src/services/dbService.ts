import { 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where,
  setDoc,
  getDoc,
  runTransaction,
  onSnapshot,
  deleteDoc,
  orderBy,
  limit,
  collection,
  deleteField,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { 
  usersCollection, 
  tasksCollection, 
  settingsCollection, 
  monthlyReportsCollection,
  commentsCollection,
  notificationsCollection,
  activitiesCollection,
  projectsCollection,
  todosCollection,
  projectChangeChecklistsCollection,
  productionReleasesCollection,
  releaseDeletionLogsCollection
} from '../firebase/firestore';
import { Task, Member, PortalSettings, MonthlyReport, TaskStatus, TaskStatusHistory, Comment, NotificationItem, ActivityLog, Attachment, Subtask, Project, TaskAssignee, TodoItem, RejectionRecord, UserRole, TaskWatcher, NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES, User, ProjectChangeChecklist, ChangeChecklistStatus, ProductionRelease, ReleaseType, ReleaseLifecycleStatus, ReleaseChangeItem, VerificationChecklistItem, ChangeRejectionRecord, ChangeChecklistItem, ReleaseDeletionLog, getChecklistPoints, getChecklistItems, getReleaseItemPoints } from '../types';
import { formatDate, getTaskAssignees, getTaskAssigneeIds, getTaskAssigneeNames, getTaskEmailRecipients, sanitizeFirestorePayload } from '../utils';
import { canTransitionToStatus, isSuperAdminEmail } from '../utils/permissions';
import { MAX_ASSIGNEES } from '../constants';

// Helper to prevent Firestore from hanging forever when offline or unconfigured
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`[Firestore] Request exceeded timeout of ${timeoutMs}ms. Returning empty fallback.`);
      resolve(fallbackValue);
    }, timeoutMs);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        console.error("[Firestore] Request failed during execution:", err);
        resolve(fallbackValue);
      });
  });
}

/**
 * Recursively removes all undefined properties from an object so Firestore addDoc/updateDoc/setDoc never fails
 */
export function removeUndefinedDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  // If it's a Firestore FieldValue (deleteField(), serverTimestamp(), etc.) or Date, don't mutate
  if (typeof obj === 'object') {
    if (obj instanceof Date) return obj;
    const constructorName = (obj as any)?.constructor?.name;
    if (
      constructorName === 'FieldValue' ||
      constructorName === 'DeleteFieldValue' ||
      (obj as any)?._methodName !== undefined ||
      typeof (obj as any)?.isEqual === 'function'
    ) {
      return obj;
    }
  }
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedDeep(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedDeep(value);
      }
    }
    return cleaned;
  }
  return obj;
}

export interface MailAttachment {
  name: string;
  size: number;
  content: string; // base64 string
  type: string;
}

class DBService {
  private prefCache = new Map<string, { prefs: NotificationPreferences; timestamp: number }>();

  constructor() {
    // No localStorage initialization - Firebase only
  }

  // --- MEMBERS ---
  async getMembers(): Promise<Member[]> {
    console.log("[dbService] Fetching members from users collection...");
    const start = performance.now();
    
    const queryPromise = (async () => {
      const querySnapshot = await getDocs(usersCollection);
      const membersMap = new Map<string, Member>();

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const rawEmail = (data.email || '').toLowerCase().trim();
        const rawName = (data.name || data.displayName || data.fullName || (rawEmail ? rawEmail.split('@')[0] : '') || 'Team Member').trim();
        const member: Member = {
          ...data,
          id: docSnap.id,
          uid: data.uid || docSnap.id,
          name: rawName,
          email: rawEmail,
          role: data.role || 'Member',
          avatarColor: data.avatarColor || '#3b82f6',
          isActive: data.isActive !== false,
          createdDate: data.createdDate || data.createdAt || new Date().toISOString(),
        };

        const key = rawEmail || data.uid || docSnap.id;

        if (!membersMap.has(key)) {
          membersMap.set(key, member);
        } else {
          // Consolidate duplicate document representing the same user account
          const existing = membersMap.get(key)!;
          const merged: Member = {
            ...existing,
            ...member,
            name: member.name || existing.name,
            email: member.email || existing.email,
            uid: member.uid || existing.uid,
            // Prefer the Auth UID docId if available
            id: (member.uid && docSnap.id === member.uid) ? docSnap.id : existing.id,
            // Preserve highest privilege role if discrepancies exist
            role: (existing.role === 'SuperAdmin' || member.role === 'SuperAdmin')
              ? 'SuperAdmin'
              : (existing.role === 'Admin' || member.role === 'Admin')
              ? 'Admin'
              : member.role || existing.role || 'Member',
            avatarColor: member.avatarColor || existing.avatarColor,
            isActive: existing.isActive !== false && member.isActive !== false,
            createdDate: existing.createdDate || member.createdDate,
          };
          membersMap.set(key, merged);
        }
      });
      const list = Array.from(membersMap.values());
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
      return list;
    })();

    try {
      const members = await withTimeout(queryPromise, 15000, []);
      const end = performance.now();
      console.log(`[dbService] [Firestore] Collection Name: users, Returned Count: ${members.length}, Execution Time: ${(end - start).toFixed(2)}ms`);
      return members;
    } catch (e: any) {
      const end = performance.now();
      console.error(`[dbService] [Firestore] Error reading collection users:`, e);
      return [];
    }
  }

  async addMember(member: Omit<Member, 'id'>): Promise<Member> {
    console.log("[dbService] Adding team member:", member.email);
    const start = performance.now();
    
    const cleanEmail = member.email.toLowerCase().trim();
    // Use UID if available or clean email key to avoid duplicate random doc IDs
    const docId = member.uid || cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const docRef = doc(usersCollection, docId);
    
    await setDoc(docRef, {
      ...member,
      email: cleanEmail,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    const end = performance.now();
    console.log(`[dbService] [Firestore] Member added in users collection (Execution Time: ${(end - start).toFixed(2)}ms)`);
    return { id: docId, ...member, email: cleanEmail };
  }

  async updateMemberProfile(email: string, updates: Partial<Member>): Promise<void> {
    console.log("[dbService] Updating member profile in DB for email:", email);
    
    let targetDoc = null;
    const q = query(usersCollection, where('email', '==', email));
    const snap = await withTimeout(getDocs(q), 3000, { empty: true, docs: [] } as any);
    if (snap && !snap.empty) {
      targetDoc = snap.docs[0];
    } else {
      const q2 = query(usersCollection, where('email', '==', email.toLowerCase()));
      const snap2 = await withTimeout(getDocs(q2), 3000, { empty: true, docs: [] } as any);
      if (snap2 && !snap2.empty) {
        targetDoc = snap2.docs[0];
      } else {
        const allSnap = await withTimeout(getDocs(usersCollection), 3000, { empty: true, docs: [] } as any);
        if (allSnap && allSnap.docs) {
          targetDoc = allSnap.docs.find((d: any) => d.data().email?.toLowerCase() === email.toLowerCase()) || null;
        }
      }
    }

    if (targetDoc) {
      const userDoc = doc(db, 'users', targetDoc.id);
      await updateDoc(userDoc, updates);
      console.log("[dbService] Profile document updated in Firestore.");
    } else {
      console.warn("[dbService] Member profile not found to update for email:", email);
    }
  }

  // --- ATOMIC AUTO-INCREMENT ID GENERATOR ---
  private async getNextTaskId(): Promise<string> {
    console.log("[dbService] Generating next task ID sequence...");
    const start = performance.now();
    
    const counterDocRef = doc(db, 'settings', 'task_counter');
    const nextId = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterDocRef);
      if (!counterDoc.exists()) {
        transaction.set(counterDocRef, { lastId: 1 });
        return 1;
      } else {
        const newId = counterDoc.data().lastId + 1;
        transaction.update(counterDocRef, { lastId: newId });
        return newId;
      }
    });
    const end = performance.now();
    console.log(`[dbService] [Firestore] Transaction success. Generated ID index: ${nextId} (Execution Time: ${(end - start).toFixed(2)}ms)`);
    return `TASK-${nextId.toString().padStart(6, '0')}`;
  }

  // --- TASKS ---
  async getTasks(): Promise<Task[]> {
    console.log("[dbService] Fetching tasks from tasks collection...");
    const start = performance.now();
    
    const queryPromise = (async () => {
      const q = query(tasksCollection, where('isDeleted', '==', false));
      const querySnapshot = await getDocs(q);
      const tasks: Task[] = [];
      querySnapshot.forEach((docSnap) => {
        tasks.push({ ...docSnap.data(), id: docSnap.id } as Task);
      });
      return tasks.sort((a, b) => new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime());
    })();

    try {
      const tasks = await withTimeout(queryPromise, 3000, []);
      const end = performance.now();
      console.log(`[dbService] [Firestore] Collection Name: tasks, Returned Count: ${tasks.length}, Execution Time: ${(end - start).toFixed(2)}ms`);
      return tasks;
    } catch (e: any) {
      const end = performance.now();
      console.error(`[dbService] [Firestore] Error reading collection tasks:`, e);
      return [];
    }
  }

  async getTaskById(id: string): Promise<Task | null> {
    console.log("[dbService] Fetching task by ID:", id);
    try {
      // 1. Direct document lookup by doc ID
      const docRef = doc(db, 'tasks', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (!data.isDeleted) {
          return { id: snap.id, ...data } as Task;
        }
      }

      // 2. Lookup by sequence taskId (e.g. TASK-000001)
      const q = query(tasksCollection, where('taskId', '==', id), where('isDeleted', '==', false));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const d = qSnap.docs[0];
        return { id: d.id, ...d.data() } as Task;
      }
      return null;
    } catch (err) {
      console.error("[dbService] Error getting task by ID:", err);
      return null;
    }
  }

  async addTask(
    task: Omit<Task, 'id' | 'taskId' | 'isDeleted'>,
    userEmail?: string,
    userName?: string,
    attachments?: MailAttachment[]
  ): Promise<Task> {
    console.log("[dbService] Adding task:", task.title);
    const start = performance.now();
    const nextTaskId = await this.getNextTaskId();
    const taskPayload: Omit<Task, 'id'> = {
      ...task,
      taskId: nextTaskId,
      isDeleted: false,
    };

    const cleanedPayload = removeUndefinedDeep(taskPayload);
    const docRef = await addDoc(tasksCollection, cleanedPayload);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Task added in tasks collection (Execution Time: ${(end - start).toFixed(2)}ms)`);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }

    const savedTask = { id: docRef.id, ...taskPayload };

    // Log Activity
    await this.logActivity({
      taskId: savedTask.id || '',
      taskSeqId: savedTask.taskId,
      taskTitle: savedTask.title,
      user: userEmail || task.createdBy,
      userName: userName || 'Team Member',
      action: 'Task Created',
      fieldName: 'Task',
      oldValue: '',
      newValue: `Created under ${task.projectName}`,
      timestamp: new Date().toISOString()
    });

    // Notify all assignees
    const assigneeEmails = getTaskAssigneeIds(task);
    const assigneesFormattedNames = getTaskAssigneeNames(task);

    for (const email of assigneeEmails) {
      await this.addNotification({
        userId: email,
        title: 'New Task Assigned',
        message: `${userName || 'A Team Lead'} assigned task ${savedTask.taskId}: "${task.title}" to you.`,
        taskId: savedTask.id || '',
        type: 'assignment',
        read: false,
        timestamp: new Date().toISOString()
      });
    }

    // Trigger Email Notification in the background (sent to all assignees, CC to creator and Head)
    try {
      const assignerEmail = (userEmail || task.createdBy || '').toLowerCase();
      const recipients = getTaskEmailRecipients(savedTask, {
        creatorEmail: assignerEmail,
      });
      
      if (recipients.to.length > 0) {
        const mailPayload: any = {
          to: recipients.to,
          subject: `[Task Allocated] Task ${savedTask.taskId}: ${task.title}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #4f46e5; margin-top: 0;">Task Assigned</h2>
              <p>Hello,</p>
              <p>A new task has been assigned to you in the Team Task Portal.</p>
              <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #6b7280; width: 140px;">Task ID:</td>
                  <td style="padding: 6px 0; font-family: monospace; font-weight: bold; color: #111827;">${savedTask.taskId}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #6b7280;">Project:</td>
                  <td style="padding: 6px 0; color: #111827;">${task.projectName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #6b7280;">Module:</td>
                  <td style="padding: 6px 0; color: #111827;">${task.module}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #6b7280;">Priority:</td>
                  <td style="padding: 6px 0; color: #111827; text-transform: capitalize;">${task.priority}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #6b7280;">Assigned To:</td>
                  <td style="padding: 6px 0; color: #111827; font-weight: 600;">${assigneesFormattedNames}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #6b7280;">Due Date:</td>
                  <td style="padding: 6px 0; color: #111827;">${task.expectedCompletionDate ? formatDate(task.expectedCompletionDate) : 'No due date'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #6b7280;">Description:</td>
                  <td style="padding: 6px 0; color: #111827; white-space: pre-wrap;">${task.description || 'No description'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #6b7280;">Remarks:</td>
                  <td style="padding: 6px 0; color: #111827; white-space: pre-wrap;">${task.remarks || 'No remarks'}</td>
                </tr>
              </table>
              <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="font-size: 12px; color: #9ca3af;">This is an automated message. Please do not reply directly to this email.</p>
            </div>
          `
        };

        if (recipients.cc.length > 0) {
          mailPayload.cc = recipients.cc;
        }

        // Add attachments if provided
        if (attachments && attachments.length > 0) {
          mailPayload.attachments = attachments.map((att) => ({
            filename: att.name,
            content: att.content,
            encoding: 'base64',
          }));
        }

        // Call the Next.js SMTP API Route asynchronously (background task)
        fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mailPayload),
        })
          .then((response) => response.json())
          .then((resData) => {
            if (resData.success) {
              console.log(`[dbService] Background SMTP email sent successfully for task ${savedTask.taskId}`);
            } else {
              console.warn(`[dbService] Background SMTP API failed:`, resData.error);
            }
          })
          .catch((fetchError) => {
            console.error("[dbService] Background SMTP API network/fetch error:", fetchError);
          });
      }
    } catch (mailError) {
      console.error("[dbService] Failed to queue task allocation email:", mailError);
    }

    return savedTask;
  }

  // Check if a status update is blocked by uncompleted dependencies
  async checkDependencyBlocked(task: Task): Promise<string | null> {
    if (!task.dependencies || task.dependencies.length === 0) return null;
    const allTasks = await this.getTasks();
    for (const depSeqId of task.dependencies) {
      const depTask = allTasks.find(t => t.taskId === depSeqId);
      if (depTask) {
        const isNotDone = depTask.status !== 'completed' && depTask.status !== 'moved-to-live' && depTask.status !== 'deployed';
        if (isNotDone) {
          return depSeqId;
        }
      }
    }
    return null;
  }

  async updateTask(
    id: string,
    updates: Partial<Task>,
    userEmail?: string,
    userName?: string,
    statusComment?: string,
    userRole?: UserRole
  ): Promise<void> {
    console.log("[dbService] Updating task:", id);
    const start = performance.now();

    // Fetch original task to do diff checks for activity log and dependency validation
    const allTasks = await this.getTasks();
    const original = allTasks.find(t => t.id === id);
    if (!original) return;

    // Check Role-Based Status Transition Permissions
    if (updates.status && updates.status !== original.status) {
      let effectiveRole: UserRole = userRole || (userEmail && isSuperAdminEmail(userEmail) ? 'SuperAdmin' : 'Member');
      if (!userRole && userEmail) {
        const members = await this.getMembers();
        const foundMem = members.find(m => m.email.toLowerCase() === userEmail.toLowerCase());
        if (foundMem?.role) effectiveRole = foundMem.role;
      }
      const permCheck = canTransitionToStatus(original, updates.status, { email: userEmail, role: effectiveRole });
      if (!permCheck.allowed) {
        throw new Error(permCheck.reason || 'You are not authorized to perform this status transition.');
      }
    }

    // Check Mandatory UAT Rejection Reason
    if (updates.status === 'uat-rejected') {
      const effectiveReason = (statusComment || (typeof updates.remarks === 'string' ? updates.remarks : '') || '').trim();
      if (!effectiveReason) {
        throw new Error('A rejection reason is strictly required when rejecting a task during UAT.');
      }
    }

    // Check Dependency Block when marking completed / live / deployed
    if (updates.status === 'completed' || updates.status === 'prod-deployed' || updates.status === 'moved-to-live' || updates.status === 'deployed') {
      const blockedBy = await this.checkDependencyBlocked(original);
      if (blockedBy) {
        throw new Error(`Cannot complete task. Blocked by incomplete prerequisite task ${blockedBy}.`);
      }
    }

    const logUser = userEmail || 'system@company.com';
    const logUserName = userName || 'System';

    // Status History & Rejection Tracking
    const payload: any = {
      ...updates,
      updatedDate: new Date().toISOString()
    };
    delete payload.taskId;

    if (updates.status && updates.status !== original.status) {
      const effectiveComment = (statusComment || (typeof updates.remarks === 'string' ? updates.remarks : '') || '').trim();
      const historyItem: TaskStatusHistory = {
        status: updates.status,
        previousStatus: original.status,
        updatedBy: logUser,
        updatedByName: logUserName,
        updatedAt: new Date().toISOString(),
        comment: effectiveComment,
        remarks: effectiveComment,
      };

      payload.statusHistory = [...(original.statusHistory || []), historyItem];

      if (updates.status === 'uat-rejected') {
        const rejectionRecord: RejectionRecord = {
          id: `rej-${Date.now()}`,
          reason: effectiveComment,
          rejectedBy: logUser,
          rejectedByName: logUserName,
          rejectedAt: new Date().toISOString(),
          previousStatus: original.status
        };
        payload.rejectionHistory = [...(original.rejectionHistory || []), rejectionRecord];
        payload.latestRejectionReason = effectiveComment;
      }
    }

    const taskDoc = doc(db, 'tasks', id);
    const cleanedPayload = removeUndefinedDeep(payload);
    await updateDoc(taskDoc, cleanedPayload);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: tasks, Operation: UPDATE, Execution Time: ${(end - start).toFixed(2)}ms`);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }

    // DIFF CHECKS FOR ACTIVITY LOGS
    if (updates.status && updates.status !== original.status) {
      let actionLabel = 'Status Changed';
      if (updates.status === 'uat-rejected') actionLabel = 'UAT Rejected';
      else if (updates.status === 'completed') actionLabel = 'Task Completed';
      else if (updates.status === 'prod-deployed') actionLabel = 'Production Deployed';
      else if (updates.status === 'ready-for-production-deploy') actionLabel = 'Ready for Production Deploy';
      else if (updates.status === 'uat-testing') actionLabel = 'UAT Testing Started';
      else if (updates.status === 'uat-deployed') actionLabel = 'UAT Deployed';
      else if (updates.status === 'code-review') actionLabel = 'Code Review Started';
      else if (updates.status === 'supplier-pending') actionLabel = 'Supplier Pending';
      else if (updates.status === 'in-progress') actionLabel = 'In Progress Started';
      else if (updates.status === 'assigned') actionLabel = 'Task Assigned';

      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: logUser,
        userName: logUserName,
        action: actionLabel,
        fieldName: 'Status',
        oldValue: original.status.replace(/-/g, ' '),
        newValue: updates.status.replace(/-/g, ' '),
        timestamp: new Date().toISOString()
      });

      // Notification on status changes to all assignees (except updater)
      const currentAssigneeIds = (updates.assignees !== undefined || updates.assigneeIds !== undefined || updates.assigneeId !== undefined)
        ? getTaskAssigneeIds(updates)
        : getTaskAssigneeIds(original);
      const currentAssigneeNames = (updates.assignees !== undefined || updates.assigneeIds !== undefined || updates.assigneeId !== undefined)
        ? getTaskAssigneeNames(updates)
        : getTaskAssigneeNames(original);

      const statusDisplay = updates.status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const notifTitle = updates.status === 'uat-rejected' ? 'Task UAT Rejected' : 'Status Changed';
      const notifMsg = updates.status === 'uat-rejected'
        ? `${logUserName} rejected task ${original.taskId} during UAT.${statusComment ? ` Reason: "${statusComment}"` : ''}`
        : `${logUserName} changed status of task ${original.taskId} to "${statusDisplay}".${statusComment ? ` Note: "${statusComment}"` : ''}`;

      for (const email of currentAssigneeIds) {
        if (email.toLowerCase() !== logUser.toLowerCase()) {
          await this.addNotification({
            userId: email,
            title: notifTitle,
            message: notifMsg,
            taskId: id,
            type: updates.status === 'uat-rejected' ? 'uat-rejected' : 'status-change',
            read: false,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Notify task watchers about status change (excluding updater and assignees)
      await this.notifyTaskWatchers(original, {
        title: notifTitle,
        message: notifMsg,
        type: updates.status === 'uat-rejected' ? 'uat-rejected' : 'status-change',
        senderEmail: logUser,
        senderName: logUserName,
        excludeEmails: [logUser, ...currentAssigneeIds]
      });

      // Trigger Email Notification in the background on status change (sent to all assignees, CC to updater/creator)
      try {
        const updaterOrCreatorEmail = (userEmail || original.createdBy || '').toLowerCase();

        if (currentAssigneeIds.length > 0) {
          const updaterName = userName || (userEmail ? userEmail.split('@')[0] : 'Team Member');
          const assigneeDisplayName = currentAssigneeNames || 'Team Member';
          const createdByNameFormatted = original.createdByName || (original.createdBy ? original.createdBy.split('@')[0] : 'System');
          const createdDateFormatted = original.createdDate ? formatDate(original.createdDate) : '—';
          const dueDateFormatted = original.expectedCompletionDate ? formatDate(original.expectedCompletionDate) : '—';

          const now = new Date();
          const updatedAtFormatted = new Intl.DateTimeFormat('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }).format(now);

          const formatStatusLabel = (status: string): string => {
            return status.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          };

          const getStatusBadgeStyle = (status: string, isNew: boolean = false): { bg: string; color: string; border: string } => {
            switch (status.toLowerCase()) {
              case 'uat-rejected':
                return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
              case 'completed':
              case 'moved-to-live':
              case 'development-completed':
                return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
              case 'prod-deployed':
              case 'deployed':
                return { bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4' };
              case 'ready-for-production-deploy':
              case 'ready-for-deployment':
                return { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
              case 'uat-testing':
              case 'testing':
                return { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' };
              case 'uat-deployed':
              case 'uat':
                return { bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' };
              case 'code-review':
                return { bg: isNew ? '#faf5ff' : '#f1f5f9', color: isNew ? '#7e22ce' : '#475569', border: isNew ? '#e9d5ff' : '#cbd5e1' };
              case 'supplier-pending':
                return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
              case 'in-progress':
                return { bg: isNew ? '#eef2ff' : '#f1f5f9', color: isNew ? '#4338ca' : '#475569', border: isNew ? '#c7d2fe' : '#cbd5e1' };
              case 'assigned':
              default:
                return { bg: isNew ? '#eff6ff' : '#f1f5f9', color: isNew ? '#1d4ed8' : '#475569', border: isNew ? '#bfdbfe' : '#cbd5e1' };
            }
          };

          const prevStatusFormatted = formatStatusLabel(original.status);
          const newStatusFormatted = formatStatusLabel(updates.status);
          const prevBadge = getStatusBadgeStyle(original.status, false);
          const newBadge = getStatusBadgeStyle(updates.status, true);

          // Status Comment / Rejection Reason Block
          const effectiveComment = (statusComment || updates.remarks || '').trim();
          const hasComment = effectiveComment && effectiveComment.toLowerCase() !== 'no remarks' && effectiveComment.toLowerCase() !== 'none';
          const isRejectionStatus = updates.status === 'uat-rejected';

          const statusCommentHtml = hasComment ? `
            <tr>
              <td style="padding: 0 24px 16px 24px;">
                <div style="font-size: 10px; font-weight: 700; color: ${isRejectionStatus ? '#b91c1c' : '#64748b'}; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">
                  ${isRejectionStatus ? 'Reason for Rejection' : 'Update Note / Remarks'}
                </div>
                <div style="background-color: ${isRejectionStatus ? '#fef2f2' : '#f8fafc'}; border-left: 3px solid ${isRejectionStatus ? '#ef4444' : '#4f46e5'}; padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 13px; color: ${isRejectionStatus ? '#991b1b' : '#334155'}; line-height: 1.5; white-space: pre-wrap;">${effectiveComment}</div>
              </td>
            </tr>
          ` : '';

          const descriptionHtml = original.description && original.description.trim() ? `
            <tr>
              <td style="padding: 0 24px 14px 24px;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">Description</div>
                <div style="background-color: #f8fafc; border-left: 3px solid #6366f1; padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 13px; color: #334155; line-height: 1.5; white-space: pre-wrap;">${original.description.trim()}</div>
              </td>
            </tr>
          ` : '';
          const recipients = getTaskEmailRecipients(original, {
            creatorEmail: original.createdBy,
            extraCc: userEmail ? [userEmail] : [],
          });

          const mailPayload: any = {
            to: recipients.to,
            subject: `[Task Allocated] Task ${original.taskId}: ${original.title}`,
            html: `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Task Status Updated</title>
              </head>
              <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 24px 12px;">
                  <tr>
                    <td align="center">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        
                        <!-- Top Accent Bar -->
                        <tr>
                          <td style="height: 4px; background-color: ${isRejectionStatus ? '#ef4444' : '#4f46e5'};"></td>
                        </tr>

                        <!-- Top Brand Header -->
                        <tr>
                          <td style="padding: 16px 24px 12px 24px; border-bottom: 1px solid #f1f5f9;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                              <tr>
                                <td align="left">
                                  <div style="font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">
                                    Team Task Portal
                                  </div>
                                </td>
                                <td align="right">
                                  <span style="display: inline-block; font-family: monospace; font-size: 12px; font-weight: 700; color: #4338ca; background-color: #eef2ff; border: 1px solid #c7d2fe; padding: 3px 8px; border-radius: 6px;">
                                    ${original.taskId}
                                  </span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Task Title & Heading -->
                        <tr>
                          <td style="padding: 20px 24px 16px 24px;">
                            <div style="font-size: 11px; font-weight: 700; color: ${isRejectionStatus ? '#dc2626' : '#4f46e5'}; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px;">
                              ${isRejectionStatus ? '⚠ Task UAT Rejected' : 'Task Status Updated'}
                            </div>
                            <h1 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.35;">
                              ${original.title}
                            </h1>
                            <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.4;">
                              ${isRejectionStatus 
                                ? `This task was rejected during UAT and requires development attention.` 
                                : `The status of this task has been updated to <strong>${newStatusFormatted}</strong>.`}
                            </p>
                          </td>
                        </tr>

                        <!-- Status Transition Card -->
                        <tr>
                          <td style="padding: 0 24px 16px 24px;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px;">
                              <tr>
                                <td style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; padding-bottom: 10px;">Status Transition</td>
                              </tr>
                              <tr>
                                <td>
                                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                      <td style="background-color: ${prevBadge.bg}; color: ${prevBadge.color}; border: 1px solid ${prevBadge.border}; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 20px; text-transform: capitalize;">
                                        ${prevStatusFormatted}
                                      </td>
                                      <td style="padding: 0 10px; font-size: 15px; color: #94a3b8; font-weight: bold;">
                                        →
                                      </td>
                                      <td style="background-color: ${newBadge.bg}; color: ${newBadge.color}; border: 1px solid ${newBadge.border}; font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 20px; text-transform: capitalize;">
                                        ${newStatusFormatted}
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding-top: 12px; margin-top: 12px; border-top: 1px solid #e2e8f0;">
                                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                      <td style="font-size: 12px; color: #64748b;" width="50%">
                                        Updated by: <strong style="color: #0f172a; font-weight: 600;">${updaterName}</strong>
                                      </td>
                                      <td style="font-size: 12px; color: #64748b; text-align: right;" width="50%">
                                        Updated on: <strong style="color: #0f172a; font-weight: 600;">${updatedAtFormatted}</strong>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Reason / Comment Section (if entered) -->
                        ${statusCommentHtml}

                        <!-- Task Details (Compact 2-Column Grid) -->
                        <tr>
                          <td style="padding: 0 24px 16px 24px;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
                              <tr>
                                <td style="padding: 6px 10px 6px 0; border-bottom: 1px solid #f1f5f9; width: 50%; vertical-align: top;">
                                  <span style="display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Task ID</span>
                                  <span style="font-family: monospace; font-weight: 700; color: #0f172a; font-size: 13px;">${original.taskId}</span>
                                </td>
                                <td style="padding: 6px 0 6px 10px; border-bottom: 1px solid #f1f5f9; width: 50%; vertical-align: top;">
                                  <span style="display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Project</span>
                                  <span style="font-weight: 600; color: #0f172a; font-size: 13px;">${original.projectName}</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 10px 6px 0; border-bottom: 1px solid #f1f5f9; width: 50%; vertical-align: top;">
                                  <span style="display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Module</span>
                                  <span style="font-weight: 500; color: #0f172a; font-size: 13px;">${original.module || '—'}</span>
                                </td>
                                <td style="padding: 6px 0 6px 10px; border-bottom: 1px solid #f1f5f9; width: 50%; vertical-align: top;">
                                  <span style="display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Priority</span>
                                  <span style="font-weight: 600; color: #0f172a; font-size: 13px; text-transform: capitalize;">${original.priority}</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 10px 6px 0; width: 50%; vertical-align: top;">
                                  <span style="display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Due Date</span>
                                  <span style="font-weight: 500; color: #0f172a; font-size: 13px;">${dueDateFormatted}</span>
                                </td>
                                <td style="padding: 6px 0 6px 10px; width: 50%; vertical-align: top;">
                                  <span style="display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Created On</span>
                                  <span style="font-weight: 500; color: #0f172a; font-size: 13px;">${createdDateFormatted}</span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Description (if provided) -->
                        ${descriptionHtml}

                        <!-- Footer -->
                        <tr>
                          <td style="padding: 14px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                            <p style="margin: 0 0 3px 0; font-size: 12px; font-weight: 600; color: #475569;">Team Task Portal</p>
                            <p style="margin: 0; font-size: 11px; color: #94a3b8;">This is an automated task notification. Please do not reply directly to this email.</p>
                          </td>
                        </tr>

                      </table>
                    </td>
                  </tr>
                </table>
              </body>
              </html>
            `
          };

          if (recipients.cc.length > 0) {
            mailPayload.cc = recipients.cc;
          }

          // Call Next.js SMTP API Route asynchronously (fire-and-forget background task)
          fetch('/api/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mailPayload),
          })
            .then((response) => response.json())
            .then((resData) => {
              if (resData.success) {
                console.log(`[dbService] Background SMTP status update email sent successfully for task ${original.taskId}`);
              } else {
                console.warn(`[dbService] Background SMTP API failed for status update:`, resData.error);
              }
            })
            .catch((fetchError) => {
              console.error("[dbService] Background SMTP API network/fetch error on status update:", fetchError);
            });
        }
      } catch (mailError) {
        console.error("[dbService] Failed to queue task status update email:", mailError);
      }
    }

    // Title updates
    if (updates.title && updates.title !== original.title) {
      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: updates.title,
        user: logUser,
        userName: logUserName,
        action: 'Task Title Changed',
        fieldName: 'Title',
        oldValue: original.title,
        newValue: updates.title,
        timestamp: new Date().toISOString()
      });
    }

    // Reassignment / Assignee list updates
    const isAssigneesUpdated = updates.assignees !== undefined || updates.assigneeIds !== undefined || updates.assigneeId !== undefined;
    if (isAssigneesUpdated) {
      const oldIds = getTaskAssigneeIds(original);
      const newIds = getTaskAssigneeIds(updates);
      const addedIds = newIds.filter(e => !oldIds.includes(e));
      const removedIds = oldIds.filter(e => !newIds.includes(e));

      if (addedIds.length > 0 || removedIds.length > 0) {
        let actionLabel = 'Assigned Users Updated';
        if (addedIds.length > 0 && removedIds.length === 0) actionLabel = 'Assigned User Added';
        else if (removedIds.length > 0 && addedIds.length === 0) actionLabel = 'Assigned User Removed';

        await this.logActivity({
          taskId: id,
          taskSeqId: original.taskId,
          taskTitle: original.title,
          user: logUser,
          userName: logUserName,
          action: actionLabel,
          fieldName: 'Assignees',
          oldValue: getTaskAssigneeNames(original),
          newValue: getTaskAssigneeNames(updates),
          timestamp: new Date().toISOString()
        });

        // Notify newly added assignees
        for (const addedEmail of addedIds) {
          await this.addNotification({
            userId: addedEmail,
            title: 'Task Assigned',
            message: `${logUserName} assigned task ${original.taskId}: "${original.title}" to you.`,
            taskId: id,
            type: 'reassignment',
            read: false,
            timestamp: new Date().toISOString()
          });
        }

        // Notify watchers about assignee updates
        await this.notifyTaskWatchers(original, {
          title: 'Task Assignees Updated',
          message: `${logUserName} updated assignees on task ${original.taskId}: "${original.title}".`,
          type: 'task-update',
          senderEmail: logUser,
          senderName: logUserName,
          excludeEmails: [logUser, ...addedIds, ...oldIds, ...newIds]
        });
      }
    }

    if (updates.priority && updates.priority !== original.priority) {
      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: logUser,
        userName: logUserName,
        action: 'Priority Changed',
        fieldName: 'Priority',
        oldValue: original.priority,
        newValue: updates.priority,
        timestamp: new Date().toISOString()
      });

      const targetAssigneeIds = getTaskAssigneeIds(updates.assignees ? updates : original);
      for (const email of targetAssigneeIds) {
        if (email.toLowerCase() !== logUser.toLowerCase()) {
          await this.addNotification({
            userId: email,
            title: 'Priority Changed',
            message: `${logUserName} updated priority of task ${original.taskId} to "${updates.priority.toUpperCase()}".`,
            taskId: id,
            type: 'priority-change',
            read: false,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Notify watchers about priority change
      await this.notifyTaskWatchers(original, {
        title: 'Priority Changed',
        message: `${logUserName} updated priority of task ${original.taskId} to "${updates.priority.toUpperCase()}".`,
        type: 'priority-change',
        senderEmail: logUser,
        senderName: logUserName,
        excludeEmails: [logUser, ...targetAssigneeIds]
      });
    }

    if (updates.expectedCompletionDate && updates.expectedCompletionDate !== original.expectedCompletionDate) {
      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: logUser,
        userName: logUserName,
        action: 'Due Date Changed',
        fieldName: 'Due Date',
        oldValue: formatDate(original.expectedCompletionDate),
        newValue: formatDate(updates.expectedCompletionDate),
        timestamp: new Date().toISOString()
      });

      const targetAssigneeIds = getTaskAssigneeIds(updates.assignees ? updates : original);
      for (const email of targetAssigneeIds) {
        if (email.toLowerCase() !== logUser.toLowerCase()) {
          await this.addNotification({
            userId: email,
            title: 'Due Date Updated',
            message: `${logUserName} updated due date of task ${original.taskId} to ${formatDate(updates.expectedCompletionDate)}.`,
            taskId: id,
            type: 'due-date',
            read: false,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Notify watchers about due date update
      await this.notifyTaskWatchers(original, {
        title: 'Due Date Updated',
        message: `${logUserName} updated due date of task ${original.taskId} to ${formatDate(updates.expectedCompletionDate)}.`,
        type: 'due-date',
        senderEmail: logUser,
        senderName: logUserName,
        excludeEmails: [logUser, ...targetAssigneeIds]
      });
    }

    if (updates.description && updates.description !== original.description) {
      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: logUser,
        userName: logUserName,
        action: 'Description Updated',
        fieldName: 'Description',
        oldValue: original.description ? (original.description.slice(0, 50) + (original.description.length > 50 ? '...' : '')) : 'None',
        newValue: updates.description.slice(0, 50) + (updates.description.length > 50 ? '...' : ''),
        timestamp: new Date().toISOString()
      });

      // Notify watchers about description update
      await this.notifyTaskWatchers(original, {
        title: 'Task Description Updated',
        message: `${logUserName} updated the description of task ${original.taskId}: "${original.title}".`,
        type: 'task-update',
        senderEmail: logUser,
        senderName: logUserName,
        excludeEmails: [logUser, ...getTaskAssigneeIds(original)]
      });
    }

    if (updates.remarks && updates.remarks !== original.remarks) {
      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: logUser,
        userName: logUserName,
        action: 'Remarks Updated',
        fieldName: 'Remarks',
        oldValue: original.remarks || 'None',
        newValue: updates.remarks,
        timestamp: new Date().toISOString()
      });
    }

    if (updates.issueType && updates.issueType !== (original.issueType || 'Task')) {
      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: logUser,
        userName: logUserName,
        action: 'Issue Type Changed',
        fieldName: 'Issue Type',
        oldValue: original.issueType || 'Task',
        newValue: updates.issueType,
        timestamp: new Date().toISOString()
      });
    }

    if (updates.qaOwner !== undefined) {
      const oldQaName = original.qaOwner?.name || original.qaOwnerName || 'Unassigned';
      const newQaName = updates.qaOwner?.name || updates.qaOwnerName || 'Unassigned';
      if (oldQaName !== newQaName) {
        await this.logActivity({
          taskId: id,
          taskSeqId: original.taskId,
          taskTitle: original.title,
          user: logUser,
          userName: logUserName,
          action: 'QA Owner Changed',
          fieldName: 'QA Owner',
          oldValue: oldQaName,
          newValue: newQaName,
          timestamp: new Date().toISOString()
        });

        // Notify watchers about QA Owner update
        await this.notifyTaskWatchers(original, {
          title: 'QA Owner Changed',
          message: `${logUserName} updated QA Owner of task ${original.taskId} to "${newQaName}".`,
          type: 'task-update',
          senderEmail: logUser,
          senderName: logUserName,
          excludeEmails: [logUser, ...getTaskAssigneeIds(original), updates.qaOwner?.id || '']
        });
      }
    }

    if (updates.parentTaskId !== undefined && (updates.parentTaskId || '') !== (original.parentTaskId || '')) {
      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: logUser,
        userName: logUserName,
        action: 'Parent Task Changed',
        fieldName: 'Parent Task',
        oldValue: original.parentTaskTitle || original.parentTaskId || 'None',
        newValue: updates.parentTaskTitle || updates.parentTaskId || 'None',
        timestamp: new Date().toISOString()
      });
    }
  }

  // --- SOFT DELETE ---
  async deleteTask(id: string, deletedBy: string, userName?: string): Promise<void> {
    console.log("[dbService] Soft deleting task:", id, "by", deletedBy);
    const start = performance.now();
    const softDeletePayload = {
      isDeleted: true,
      deletedDate: new Date().toISOString(),
      deletedBy: deletedBy
    };

    // Fetch original task to do activity logging
    const allTasks = await this.getTasks();
    const original = allTasks.find(t => t.id === id);

    const taskDoc = doc(db, 'tasks', id);
    await updateDoc(taskDoc, softDeletePayload);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: tasks, Operation: UPDATE (soft-delete), Execution Time: ${(end - start).toFixed(2)}ms`);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }

    if (original) {
      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: deletedBy,
        userName: userName || deletedBy.split('@')[0],
        action: 'Task Deleted (Soft Delete)',
        fieldName: 'Task',
        oldValue: 'Active',
        newValue: 'Soft Deleted',
        timestamp: new Date().toISOString()
      });
    }
  }

  async restoreTask(id: string, restoredBy: string, userName?: string): Promise<void> {
    console.log("[dbService] Restoring soft-deleted task:", id, "by", restoredBy);
    const start = performance.now();
    const restorePayload = {
      isDeleted: false,
      deletedDate: null,
      deletedBy: null
    };

    // Fetch original task
    const docRef = doc(db, 'tasks', id);
    const snap = await getDoc(docRef);
    let original: Task | undefined;
    if (snap.exists()) {
      original = { id: snap.id, ...snap.data() } as Task;
    }

    const taskDoc = doc(db, 'tasks', id);
    await updateDoc(taskDoc, restorePayload);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: tasks, Operation: UPDATE (restore), Execution Time: ${(end - start).toFixed(2)}ms`);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }

    if (original) {
      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: restoredBy,
        userName: userName || restoredBy.split('@')[0],
        action: 'Task Restored',
        fieldName: 'Task',
        oldValue: 'Soft Deleted',
        newValue: 'Restored',
        timestamp: new Date().toISOString()
      });
    }
  }

  // --- ADD CO-ASSIGNEE / DELEGATE WORKFLOW ---
  async addCoAssignees(
    taskId: string,
    newMembers: Array<{ id?: string; email?: string; name: string; avatarColor?: string; color?: string; isActive?: boolean }>,
    addedBy: string,
    addedByName: string
  ): Promise<Task> {
    const docRef = doc(db, 'tasks', taskId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Task not found.');
    }

    const task = { id: snap.id, ...snap.data() } as Task;
    const existingAssignees = getTaskAssignees(task);
    const existingIds = getTaskAssigneeIds(task);

    // Validate candidates
    const validNewAssignees: TaskAssignee[] = [];
    const validCandidateEmails: string[] = [];

    for (const mem of newMembers) {
      const email = (mem.email || mem.id || '').toLowerCase().trim();
      if (!email) continue;
      if (mem.isActive === false) continue;
      if (existingIds.includes(email) || validCandidateEmails.includes(email)) continue;

      const newAssigneeObj: TaskAssignee = {
        id: email,
        name: mem.name || email.split('@')[0],
        color: mem.avatarColor || mem.color || '#6366f1'
      };
      validNewAssignees.push(newAssigneeObj);
      validCandidateEmails.push(email);
    }

    if (validNewAssignees.length === 0) {
      return task;
    }

    // Maximum assignee limit check
    if (existingAssignees.length + validNewAssignees.length > MAX_ASSIGNEES) {
      throw new Error(`Maximum assignee limit reached (${MAX_ASSIGNEES} assignees). Cannot add ${validNewAssignees.length} more.`);
    }

    const updatedAssignees = [...existingAssignees, ...validNewAssignees];
    const updatedAssigneeIds = updatedAssignees.map(a => a.id.toLowerCase());

    const updatePayload: any = {
      assignees: updatedAssignees,
      assigneeIds: updatedAssigneeIds,
      updatedDate: new Date().toISOString(),
      updatedBy: addedBy
    };

    // Ensure legacy fallback fields are set if missing
    if (!task.assigneeId && updatedAssignees.length > 0) {
      updatePayload.assigneeId = updatedAssignees[0].id;
      updatePayload.assigneeName = updatedAssignees[0].name;
      updatePayload.assigneeColor = updatedAssignees[0].color;
    }

    const cleanedPayload = removeUndefinedDeep(updatePayload);
    const start = performance.now();
    await updateDoc(docRef, cleanedPayload);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection: tasks, Operation: ADD_CO_ASSIGNEES (${validNewAssignees.length}), Time: ${(end - start).toFixed(2)}ms`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }

    const addedNamesStr = validNewAssignees.map(a => a.name).join(', ');

    // 1. Audit / Activity Log
    try {
      await this.logActivity({
        taskId,
        taskSeqId: task.taskId,
        taskTitle: task.title,
        user: addedBy,
        userName: addedByName || addedBy.split('@')[0],
        action: validNewAssignees.length > 1 ? 'Co-Assignees Added' : 'Co-Assignee Added',
        fieldName: 'Assignees',
        oldValue: getTaskAssigneeNames(task),
        newValue: `${addedNamesStr} (Now: ${getTaskAssigneeNames({ assignees: updatedAssignees })})`,
        timestamp: new Date().toISOString()
      });
    } catch (actErr) {
      console.error("[dbService] Failed to record co-assignee activity log:", actErr);
    }

    // 2. In-App Notification (Sent to each newly assigned member)
    for (const newAssignee of validNewAssignees) {
      try {
        await this.addNotification({
          userId: newAssignee.id,
          title: 'Added as Co-Assignee',
          message: `${addedByName} added you as a co-assignee to task ${task.taskId || ''}: "${task.title}".`,
          taskId,
          type: 'co-assignee-added',
          read: false,
          timestamp: new Date().toISOString()
        });
      } catch (notifErr) {
        console.error("[dbService] Failed to send co-assignee notification:", notifErr);
      }
    }

    // 3. Email Notification (Sent to new co-assignees with delegator CC'd)
    try {
      if (typeof window !== 'undefined') {
        const mailSubject = `[Task Allocated] Task ${task.taskId || taskId}: ${task.title}`;
        const allAssigneeNames = getTaskAssigneeNames({ assignees: updatedAssignees });
        const recipients = getTaskEmailRecipients(
          { ...task, assignees: updatedAssignees },
          {
            creatorEmail: task.createdBy,
            extraCc: addedBy ? [addedBy] : [],
          }
        );

        const mailPayload: any = {
          to: recipients.to.length > 0 ? recipients.to : validCandidateEmails,
          subject: mailSubject,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>${mailSubject}</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; line-height: 1.5;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
                      
                      <!-- Header -->
                      <tr>
                        <td style="padding: 24px 28px; background-color: #0f172a; border-bottom: 3px solid #6366f1;">
                          <table width="100%" border="0" cellspacing="0" cellpadding="0">
                            <tr>
                              <td>
                                <span style="font-size: 11px; font-weight: 700; color: #818cf8; text-transform: uppercase; letter-spacing: 1px;">Co-Assignment Notification</span>
                                <h1 style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #ffffff;">Added as Co-Assignee</h1>
                              </td>
                              <td align="right">
                                <span style="font-family: monospace; font-size: 12px; font-weight: 700; color: #94a3b8; background-color: #1e293b; padding: 4px 10px; border-radius: 6px;">${task.taskId || 'TASK'}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Body -->
                      <tr>
                        <td style="padding: 28px;">
                          <!-- Delegator Announcement Banner -->
                          <div style="background-color: #eef2ff; border-left: 4px solid #6366f1; padding: 14px 16px; border-radius: 6px; margin-bottom: 24px;">
                            <p style="margin: 0; font-size: 14px; font-weight: 600; color: #3730a3;">
                              <strong>${addedByName}</strong> has added you as a co-assignee to collaborate on this task.
                            </p>
                          </div>

                          <!-- Task Title & Project -->
                          <h2 style="margin: 0 0 8px 0; font-size: 17px; font-weight: 700; color: #0f172a;">${task.title}</h2>
                          ${task.description ? `<p style="margin: 0 0 20px 0; font-size: 13px; color: #64748b; line-height: 1.6;">${task.description}</p>` : '<div style="margin-bottom: 20px;"></div>'}

                          <!-- 2-Column Task Metadata -->
                          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9;">
                            <tr>
                              <td width="50%" style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
                                <span style="display: block; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Project</span>
                                <span style="font-size: 13px; font-weight: 600; color: #0f172a;">${task.projectName}</span>
                              </td>
                              <td width="50%" style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
                                <span style="display: block; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Module</span>
                                <span style="font-size: 13px; font-weight: 600; color: #0f172a;">${task.module}</span>
                              </td>
                            </tr>
                            <tr>
                              <td width="50%" style="padding: 12px 16px;">
                                <span style="display: block; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Priority</span>
                                <span style="font-size: 12px; font-weight: 700; color: ${task.priority === 'critical' ? '#dc2626' : task.priority === 'high' ? '#ea580c' : '#2563eb'}; text-transform: uppercase;">${task.priority}</span>
                              </td>
                              <td width="50%" style="padding: 12px 16px;">
                                <span style="display: block; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Due Date</span>
                                <span style="font-size: 13px; font-weight: 600; color: #0f172a;">${formatDate(task.expectedCompletionDate)}</span>
                              </td>
                            </tr>
                          </table>

                          <!-- Assignees Roster -->
                          <div style="padding: 12px 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9; margin-bottom: 24px;">
                            <span style="display: block; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Assigned Team Members</span>
                            <span style="font-size: 13px; font-weight: 600; color: #0f172a;">${allAssigneeNames}</span>
                          </div>

                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="padding: 16px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                          <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #475569;">Team Task Portal</p>
                          <p style="margin: 0; font-size: 11px; color: #94a3b8;">This is an automated co-assignment notification.</p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `
        };

        if (recipients.cc.length > 0) {
          mailPayload.cc = recipients.cc;
        }

        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mailPayload),
        })
          .then(res => res.json())
          .then(resData => {
            if (resData.success) {
              console.log(`[dbService] Background SMTP co-assignee email sent to ${validCandidateEmails.join(', ')}`);
            } else {
              console.warn(`[dbService] Background SMTP failed for co-assignees:`, resData.error);
            }
          })
          .catch(err => {
            console.error("[dbService] Failed to send co-assignee email:", err);
          });
      }
    } catch (mailErr) {
      console.error("[dbService] Failed to dispatch co-assignee email:", mailErr);
    }

    return { ...task, ...updatePayload };
  }

  async addCoAssignee(
    taskId: string,
    newMember: { id?: string; email?: string; name: string; avatarColor?: string; color?: string; isActive?: boolean },
    addedBy: string,
    addedByName: string
  ): Promise<Task> {
    return this.addCoAssignees(taskId, [newMember], addedBy, addedByName);
  }

  // --- SUBTASKS CHECKLIST HANDLERS ---
  async toggleSubtask(taskId: string, subtaskId: string, status: 'pending' | 'completed', userEmail: string, userName: string): Promise<void> {
    const tasks = await this.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const subtasks = (task.subtasks || []).map(sub => {
      if (sub.id === subtaskId) {
        return {
          ...sub,
          status,
          completedDate: status === 'completed' ? new Date().toISOString() : undefined
        };
      }
      return sub;
    });

    const total = subtasks.length;
    const completedCount = subtasks.filter(s => s.status === 'completed').length;
    const oldCompletedCount = (task.subtasks || []).filter(s => s.status === 'completed').length;
    const oldPercent = total > 0 ? Math.round((oldCompletedCount / total) * 100) : 0;
    const newPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    await this.updateTask(taskId, { subtasks }, userEmail, userName);

    await this.logActivity({
      taskId,
      taskSeqId: task.taskId,
      taskTitle: task.title,
      user: userEmail,
      userName,
      action: 'Checklist Updated',
      fieldName: 'Checklist',
      oldValue: `Checklist progress was ${oldPercent}%`,
      newValue: `Checklist progress is ${newPercent}%`,
      timestamp: new Date().toISOString()
    });
  }

  // --- STORAGE FILE ATTACHMENTS UPLOAD ---
  async uploadAttachment(taskId: string, file: File, uploaderEmail: string, uploaderName: string): Promise<Attachment> {
    const attachmentId = `att-${Date.now()}`;
    const start = performance.now();

    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const { storage } = await import('../firebase/config');

    // Path: tasks/{taskId}/{attachmentId}_{name}
    const storageRef = ref(storage, `tasks/${taskId}/${attachmentId}_${file.name}`);
    
    // Timeout helper
    const withStorageTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Firebase Storage operation timed out')), timeoutMs)
        )
      ]);
    };

    const snap = await withStorageTimeout(uploadBytes(storageRef, file), 8500);
    const downloadUrl = await withStorageTimeout(getDownloadURL(snap.ref), 4000);

    const attachment: Attachment = {
      id: attachmentId,
      name: file.name,
      size: file.size,
      uploadedBy: uploaderEmail,
      uploadedByName: uploaderName,
      uploadedDate: new Date().toISOString(),
      url: downloadUrl,
      isMock: false
    };

    // Update task document
    const end = performance.now();
    console.log(`[dbService] [Storage] Storage Bucket: team-task-portal-54206.firebasestorage.app, Operation: UPLOAD, Execution Time: ${(end - start).toFixed(2)}ms`);
    const tasks = await this.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const attachments = [...(task.attachments || []), attachment];
      await this.updateTask(taskId, { attachments }, uploaderEmail, uploaderName);
    }

    // Log activity
    await this.logActivity({
      taskId,
      taskSeqId: task?.taskId || '',
      taskTitle: task?.title || '',
      user: uploaderEmail,
      userName: uploaderName,
      action: 'Attachment Uploaded',
      oldValue: '',
      newValue: file.name,
      timestamp: new Date().toISOString()
    });

    return attachment;
  }

  // --- DISCUSSIONS (COMMENTS) HANDLERS ---
  subscribeComments(taskId: string, callback: (comments: Comment[]) => void): () => void {
    try {
      const q = query(commentsCollection, where('taskId', '==', taskId));
      return onSnapshot(q, (snapshot) => {
        const list: Comment[] = [];
        snapshot.forEach(docSnap => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Comment);
        });
        callback(list.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
      }, (err) => {
        console.error("Comments subscription failed:", err);
        callback([]);
      });
    } catch (err) {
      console.error("Failed to register comments listener:", err);
      callback([]);
      return () => {};
    }
  }

  subscribeAllComments(callback: (comments: Comment[]) => void): () => void {
    try {
      return onSnapshot(commentsCollection, (snapshot) => {
        const list: Comment[] = [];
        snapshot.forEach(docSnap => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Comment);
        });
        callback(list.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50));
      }, (err) => {
        console.error("All comments subscription failed:", err);
        callback([]);
      });
    } catch (err) {
      console.error("Failed to listen to all comments:", err);
      callback([]);
      return () => {};
    }
  }

  async addComment(comment: Omit<Comment, 'id'>, taskSeqId?: string, taskTitle?: string): Promise<Comment> {
    const start = performance.now();
    const isReply = Boolean(comment.parentId);

    const cleanedComment = removeUndefinedDeep({
      ...comment,
      replyCount: 0,
      timestamp: comment.timestamp || new Date().toISOString()
    });

    const docRef = await addDoc(commentsCollection, cleanedComment);
    const savedComment: Comment = { ...comment, id: docRef.id, replyCount: 0 };
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: taskComments, Operation: ADD, Execution Time: ${(end - start).toFixed(2)}ms`);

    // If it's a reply, increment parent comment's replyCount
    if (comment.parentId) {
      try {
        const parentDocRef = doc(commentsCollection, comment.parentId);
        await updateDoc(parentDocRef, {
          replyCount: increment(1)
        });
      } catch (err) {
        console.error("Failed to increment parent comment reply count:", err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comments-updated'));
    }

    // Snippet for activity and notification
    const snippet = comment.content.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1');
    const displaySnippet = snippet.length > 40 ? snippet.substring(0, 40) + '...' : snippet;

    // Log Comment Activity
    await this.logActivity({
      taskId: comment.taskId,
      taskSeqId: taskSeqId || 'TASK-ID',
      taskTitle: taskTitle || 'Task',
      user: comment.userId,
      userName: comment.userName,
      action: isReply ? 'Reply Added' : 'Comment Added',
      fieldName: 'Comments',
      oldValue: '',
      newValue: displaySnippet,
      timestamp: new Date().toISOString()
    });

    // --- FEATURE 3: AUTOMATIC CO-ASSIGNEE ASSIGNMENT ---
    const autoAssignedMembers: Member[] = [];
    const autoAssignedEmails = new Set<string>();

    try {
      const taskDocRef = doc(db, 'tasks', comment.taskId);
      const taskSnap = await getDoc(taskDocRef);
      if (taskSnap.exists()) {
        const taskData = { id: taskSnap.id, ...taskSnap.data() } as Task;
        const existingAssignees = getTaskAssignees(taskData);
        const existingAssigneeIds = getTaskAssigneeIds(taskData); // lowercase emails
        const authorEmail = (comment.userId || '').toLowerCase().trim();

        // Extract mentions from comment.mentions or regex
        const mentionedIdentifiers = new Set<string>();
        if (comment.mentions && comment.mentions.length > 0) {
          for (const m of comment.mentions) {
            if (m.userId) mentionedIdentifiers.add(m.userId.toLowerCase().trim());
            if (m.userEmail) mentionedIdentifiers.add(m.userEmail.toLowerCase().trim());
          }
        }
        const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
        let match;
        while ((match = mentionRegex.exec(comment.content)) !== null) {
          mentionedIdentifiers.add(match[2].toLowerCase().trim());
        }

        const allMembers = await this.getMembers();
        const candidateMembers: Member[] = [];

        for (const rawId of Array.from(mentionedIdentifiers)) {
          if (rawId === authorEmail) continue; // Do not auto-assign the comment author
          if (existingAssigneeIds.includes(rawId)) continue; // Already assigned

          const memberObj = allMembers.find(m =>
            (m.email && m.email.toLowerCase() === rawId) ||
            m.uid === rawId ||
            m.id === rawId
          );

          if (memberObj && memberObj.isActive !== false) {
            const memEmail = (memberObj.email || '').toLowerCase().trim();
            if (memEmail && !existingAssigneeIds.includes(memEmail) && !candidateMembers.some(c => (c.email || '').toLowerCase() === memEmail)) {
              candidateMembers.push(memberObj);
            }
          }
        }

        // Capacity check against MAX_ASSIGNEES
        const availableSlots = Math.max(0, MAX_ASSIGNEES - existingAssignees.length);
        const membersToAdd = candidateMembers.slice(0, availableSlots);

        if (membersToAdd.length > 0) {
          const newAssigneeObjs: TaskAssignee[] = membersToAdd.map(m => {
            const memEmail = (m.email || m.id || '').toLowerCase().trim();
            const memName = m.name || (m.email ? m.email.split('@')[0] : 'Team Member');
            return {
              id: memEmail,
              name: memName,
              color: m.avatarColor || '#6366f1'
            };
          });

          const updatedAssignees = [...existingAssignees, ...newAssigneeObjs];
          const updatedAssigneeIds = updatedAssignees.map(a => a.id.toLowerCase());

          const updatePayload: any = {
            assignees: updatedAssignees,
            assigneeIds: updatedAssigneeIds,
            updatedDate: new Date().toISOString(),
            updatedBy: comment.userId
          };

          if (!taskData.assigneeId && updatedAssignees.length > 0) {
            updatePayload.assigneeId = updatedAssignees[0].id;
            updatePayload.assigneeName = updatedAssignees[0].name;
            updatePayload.assigneeColor = updatedAssignees[0].color;
          }

          await updateDoc(taskDocRef, removeUndefinedDeep(updatePayload));
          autoAssignedMembers.push(...membersToAdd);

          for (const m of membersToAdd) {
            autoAssignedEmails.add((m.email || '').toLowerCase().trim());
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('task-updated'));
          }

          // D. Activity Timeline Entry
          const addedNames = membersToAdd.map(m => m.name).join(' and ');
          await this.logActivity({
            taskId: comment.taskId,
            taskSeqId: taskSeqId || taskData.taskId,
            taskTitle: taskTitle || taskData.title,
            user: comment.userId,
            userName: comment.userName,
            action: 'Co-Assignee Added via Mention',
            fieldName: 'Assignees',
            oldValue: getTaskAssigneeNames(taskData),
            newValue: `${comment.userName} mentioned ${addedNames} in a comment and added ${membersToAdd.length > 1 ? 'them' : addedNames} as a co-assignee.`,
            timestamp: new Date().toISOString()
          });

          // E. Assignment Notification for newly added co-assignees
          for (const newMem of membersToAdd) {
            const targetId = (newMem.email || newMem.id || '').toLowerCase();
            if (!targetId) continue;
            await this.addNotification({
              userId: targetId,
              title: 'Added as Co-Assignee via Mention',
              message: `${comment.userName} mentioned you in a comment and added you as a co-assignee on task ${taskData.taskId || taskSeqId || 'details'}: "${displaySnippet}"`,
              taskId: comment.taskId,
              commentId: savedComment.id,
              senderEmail: comment.userId,
              senderName: comment.userName,
              type: 'co-assignee-added',
              read: false,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    } catch (autoErr) {
      console.error("[dbService] Failed to auto-assign mentioned members as co-assignees:", autoErr);
    }

    // Detect @Mentions to send notifications for users NOT newly auto-assigned
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    const mentions = new Set<string>();
    while ((match = mentionRegex.exec(comment.content)) !== null) {
      mentions.add(match[2].toLowerCase().trim());
    }

    for (const email of Array.from(mentions)) {
      if (email !== comment.userId.toLowerCase() && !autoAssignedEmails.has(email)) {
        await this.addNotification({
          userId: email,
          title: isReply ? 'Mentioned in Reply' : 'Mentioned in Comment',
          message: `${comment.userName} mentioned you in task ${taskSeqId || 'details'}: "${displaySnippet}"`,
          taskId: comment.taskId,
          commentId: savedComment.id,
          senderEmail: comment.userId,
          senderName: comment.userName,
          type: 'mention',
          read: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    // If reply: also notify parent comment author if not commenter and not already notified
    if (isReply && comment.parentId) {
      try {
        const parentSnap = await getDoc(doc(commentsCollection, comment.parentId));
        if (parentSnap.exists()) {
          const parentData = parentSnap.data() as Comment;
          const parentAuthor = parentData.userId;
          if (parentAuthor && parentAuthor.toLowerCase() !== comment.userId.toLowerCase() && !mentions.has(parentAuthor)) {
            await this.addNotification({
              userId: parentAuthor,
              title: 'New Reply to your Comment',
              message: `${comment.userName} replied to your comment on task ${taskSeqId || 'details'}: "${displaySnippet}"`,
              taskId: comment.taskId,
              commentId: savedComment.id,
              senderEmail: comment.userId,
              senderName: comment.userName,
              type: 'reply-added',
              read: false,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (err) {
        console.error("Failed to notify parent comment author:", err);
      }
    } else {
      // If root comment: notify task assignees if not commenter and not already notified
      try {
        const tasks = await this.getTasks();
        const task = tasks.find(t => t.id === comment.taskId);
        if (task) {
          const assigneeEmails = getTaskAssigneeIds(task);
          for (const assigneeEmail of assigneeEmails) {
            if (assigneeEmail.toLowerCase() !== comment.userId.toLowerCase() && !mentions.has(assigneeEmail)) {
              await this.addNotification({
                userId: assigneeEmail,
                title: 'Comment Added',
                message: `${comment.userName} commented on task ${task.taskId || 'assigned to you'}: "${displaySnippet}"`,
                taskId: comment.taskId,
                commentId: savedComment.id,
                senderEmail: comment.userId,
                senderName: comment.userName,
                type: 'comment-added',
                read: false,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      } catch (err) {
        console.error("[dbService] Failed to send assignee comment notification:", err);
      }
    }

    // Notify task watchers about new comment / reply (excluding commenter, mentions, parentAuthor, assignees)
    try {
      const tasks = await this.getTasks();
      const taskObj = tasks.find(t => t.id === comment.taskId);
      if (taskObj && taskObj.watchers && taskObj.watchers.length > 0) {
        const excludeCommentEmails = [comment.userId, ...Array.from(mentions), ...getTaskAssigneeIds(taskObj)];
        if (isReply && comment.parentId) {
          const parentSnap = await getDoc(doc(commentsCollection, comment.parentId));
          if (parentSnap.exists()) {
            const parentData = parentSnap.data() as Comment;
            if (parentData.userId) excludeCommentEmails.push(parentData.userId);
          }
        }
        await this.notifyTaskWatchers(taskObj, {
          title: isReply ? 'New Reply on Watched Task' : 'New Comment on Watched Task',
          message: `${comment.userName} ${isReply ? 'replied on' : 'commented on'} watched task ${taskSeqId || taskObj.taskId}: "${displaySnippet}"`,
          type: isReply ? 'reply-added' : 'comment-added',
          commentId: savedComment.id,
          senderEmail: comment.userId,
          senderName: comment.userName,
          excludeEmails: excludeCommentEmails
        });
      }
    } catch (watchErr) {
      console.error("[dbService] Failed to notify watchers of comment:", watchErr);
    }

    savedComment.autoAssignedMembers = autoAssignedMembers;
    return savedComment;
  }

  async deleteComment(
    comment: Comment,
    userEmail: string,
    userName: string,
    taskSeqId?: string,
    taskTitle?: string
  ): Promise<void> {
    if (!comment.id) return;
    const isReply = Boolean(comment.parentId);

    if (!isReply && (comment.replyCount || 0) > 0) {
      // Soft-delete parent comment to ensure threaded replies are never orphaned
      await updateDoc(doc(commentsCollection, comment.id), {
        isDeleted: true,
        content: '[Comment deleted]'
      });
    } else {
      await deleteDoc(doc(commentsCollection, comment.id));
      if (isReply && comment.parentId) {
        try {
          await updateDoc(doc(commentsCollection, comment.parentId), {
            replyCount: increment(-1)
          });
        } catch (err) {
          console.error("Failed to decrement parent comment reply count:", err);
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comments-updated'));
    }

    // Log Activity
    const snippet = comment.content.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1');
    const displaySnippet = snippet.length > 35 ? snippet.substring(0, 35) + '...' : snippet;

    await this.logActivity({
      taskId: comment.taskId,
      taskSeqId: taskSeqId || 'TASK-ID',
      taskTitle: taskTitle || 'Task',
      user: userEmail,
      userName: userName,
      action: isReply ? 'Reply Deleted' : 'Comment Deleted',
      fieldName: 'Comments',
      oldValue: displaySnippet,
      newValue: '',
      timestamp: new Date().toISOString()
    });
  }

  async updateComment(
    id: string,
    content: string,
    userEmail: string,
    userName: string,
    taskId: string,
    isReply: boolean = false,
    taskSeqId?: string,
    taskTitle?: string
  ): Promise<void> {
    const commentDoc = doc(commentsCollection, id);
    await updateDoc(commentDoc, {
      content,
      edited: true,
      editedAt: new Date().toISOString()
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comments-updated'));
    }

    const snippet = content.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1');
    const displaySnippet = snippet.length > 35 ? snippet.substring(0, 35) + '...' : snippet;

    await this.logActivity({
      taskId,
      taskSeqId: taskSeqId || 'TASK-ID',
      taskTitle: taskTitle || 'Task',
      user: userEmail,
      userName: userName,
      action: isReply ? 'Reply Edited' : 'Comment Edited',
      fieldName: 'Comments',
      oldValue: '',
      newValue: displaySnippet,
      timestamp: new Date().toISOString()
    });
  }

  // --- NOTIFICATIONS HUB HANDLERS ---
  subscribeNotifications(userId: string, callback: (notifications: NotificationItem[]) => void): () => void {
    const cleanId = (userId || '').toLowerCase().trim();
    if (!cleanId) {
      callback([]);
      return () => {};
    }

    try {
      const q = query(notificationsCollection, where('userId', '==', cleanId));
      return onSnapshot(q, (snapshot) => {
        const list: NotificationItem[] = [];
        snapshot.forEach(docSnap => {
          list.push({ ...docSnap.data(), id: docSnap.id } as NotificationItem);
        });
        callback(list.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }, (err) => {
        console.error("Notifications subscription failed:", err);
        callback([]);
      });
    } catch (err) {
      console.error("Failed to register notifications listener:", err);
      callback([]);
      return () => {};
    }
  }

  // --- NOTIFICATION PREFERENCES (Batch 4) ---
  async getUserNotificationPreferences(userEmailOrUid: string): Promise<NotificationPreferences> {
    const cacheKey = (userEmailOrUid || '').toLowerCase().trim();
    if (!cacheKey) return { ...DEFAULT_NOTIFICATION_PREFERENCES };

    const cached = this.prefCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.prefs;
    }

    try {
      const q = query(usersCollection, where('email', '==', cacheKey));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data() as User;
        const prefs: NotificationPreferences = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...(data.notificationPreferences || {})
        };
        this.prefCache.set(cacheKey, { prefs, timestamp: Date.now() });
        return prefs;
      }

      // Fallback by doc UID
      const docRef = doc(usersCollection, userEmailOrUid);
      const userSnap = await getDoc(docRef);
      if (userSnap.exists()) {
        const data = userSnap.data() as User;
        const prefs: NotificationPreferences = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...(data.notificationPreferences || {})
        };
        this.prefCache.set(cacheKey, { prefs, timestamp: Date.now() });
        return prefs;
      }
    } catch (err) {
      console.error('[dbService] Failed to load notification preferences:', err);
    }

    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  async saveUserNotificationPreferences(userEmailOrUid: string, preferences: NotificationPreferences): Promise<void> {
    const cacheKey = (userEmailOrUid || '').toLowerCase().trim();
    this.prefCache.set(cacheKey, { prefs: preferences, timestamp: Date.now() });

    try {
      const q = query(usersCollection, where('email', '==', cacheKey));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(usersCollection, snap.docs[0].id), {
          notificationPreferences: preferences,
          updatedAt: new Date().toISOString()
        });
      } else {
        await setDoc(doc(usersCollection, userEmailOrUid), {
          notificationPreferences: preferences,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (err) {
      console.error('[dbService] Failed to save notification preferences:', err);
      throw err;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notification-preferences-updated', { detail: preferences }));
    }
  }

  // --- TASK WATCHERS (Batch 4) ---
  async watchTask(taskId: string, user: { email: string; name?: string; avatarColor?: string; uid?: string }): Promise<void> {
    const userEmail = (user.email || '').toLowerCase().trim();
    if (!userEmail) throw new Error('Valid user email is required to watch a task.');

    const taskDoc = doc(db, 'tasks', taskId);
    const snap = await getDoc(taskDoc);
    if (!snap.exists()) throw new Error('Task not found.');

    const task = { id: snap.id, ...snap.data() } as Task;
    const existingWatchers = task.watchers || [];
    const existingIds = (task.watcherIds || existingWatchers.map(w => (w.email || w.id || '').toLowerCase()));

    // Prevent duplicate watcher entries
    if (existingIds.includes(userEmail)) {
      return;
    }

    const newWatcher: TaskWatcher = {
      id: userEmail,
      email: userEmail,
      name: user.name || userEmail.split('@')[0],
      avatarColor: user.avatarColor || '#3b82f6',
      watchedAt: new Date().toISOString()
    };

    const updatedWatchers = [...existingWatchers, newWatcher];
    const updatedWatcherIds = [...new Set([...existingIds, userEmail])];

    await updateDoc(taskDoc, {
      watchers: updatedWatchers,
      watcherIds: updatedWatcherIds,
      updatedDate: new Date().toISOString()
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }

    await this.logActivity({
      taskId,
      taskSeqId: task.taskId,
      taskTitle: task.title,
      user: userEmail,
      userName: user.name || userEmail.split('@')[0],
      action: 'Started Watching Task',
      fieldName: 'Watchers',
      oldValue: '',
      newValue: `${user.name || userEmail} started watching`,
      timestamp: new Date().toISOString()
    });
  }

  async unwatchTask(taskId: string, userEmail: string, userName?: string): Promise<void> {
    const email = (userEmail || '').toLowerCase().trim();
    if (!email) return;

    const taskDoc = doc(db, 'tasks', taskId);
    const snap = await getDoc(taskDoc);
    if (!snap.exists()) return;

    const task = { id: snap.id, ...snap.data() } as Task;
    const existingWatchers = task.watchers || [];
    const existingIds = (task.watcherIds || existingWatchers.map(w => (w.email || w.id || '').toLowerCase()));

    if (!existingIds.includes(email)) {
      return;
    }

    const updatedWatchers = existingWatchers.filter(w => (w.email || w.id || '').toLowerCase() !== email);
    const updatedWatcherIds = existingIds.filter(id => id.toLowerCase() !== email);

    await updateDoc(taskDoc, {
      watchers: updatedWatchers,
      watcherIds: updatedWatcherIds,
      updatedDate: new Date().toISOString()
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }

    await this.logActivity({
      taskId,
      taskSeqId: task.taskId,
      taskTitle: task.title,
      user: email,
      userName: userName || email.split('@')[0],
      action: 'Stopped Watching Task',
      fieldName: 'Watchers',
      oldValue: `${userName || email} was watching`,
      newValue: 'Stopped watching',
      timestamp: new Date().toISOString()
    });
  }

  async notifyTaskWatchers(
    task: Task,
    event: {
      title: string;
      message: string;
      type: string;
      senderEmail?: string;
      senderName?: string;
      commentId?: string;
      excludeEmails: string[];
    }
  ): Promise<void> {
    const watcherEmails = (task.watchers || []).map(w => (w.email || w.id || '').toLowerCase().trim());
    if (watcherEmails.length === 0) return;

    const normalizedExcludes = new Set(event.excludeEmails.map(e => (e || '').toLowerCase().trim()));

    for (const watcherEmail of watcherEmails) {
      if (!watcherEmail || normalizedExcludes.has(watcherEmail)) {
        continue; // Exclude actor and already notified users (prevents duplicates)
      }

      await this.addNotification({
        userId: watcherEmail,
        title: event.title,
        message: event.message,
        taskId: task.id || '',
        commentId: event.commentId,
        senderEmail: event.senderEmail,
        senderName: event.senderName,
        type: event.type,
        isWatcherNotification: true,
        read: false,
        timestamp: new Date().toISOString()
      });
    }
  }

  async addNotification(notification: Omit<NotificationItem, 'id' | 'notificationId'>): Promise<void> {
    const cleanUserId = (notification.userId || '').toLowerCase().trim();
    if (!cleanUserId) return;

    // Check User Notification Preferences before creating notification
    let category: keyof NotificationPreferences | 'system' = 'system';
    if (notification.isWatcherNotification) {
      category = 'watcherUpdates';
    } else {
      switch (notification.type) {
        case 'assignment':
        case 'reassignment':
        case 'co-assignee-added':
          category = 'assignments';
          break;
        case 'status-change':
          category = 'statusChanges';
          break;
        case 'uat-rejected':
          category = 'uatRejections';
          break;
        case 'priority-change':
        case 'due-date':
        case 'task-update':
          category = 'taskUpdates';
          break;
        case 'comment-added':
          category = 'comments';
          break;
        case 'reply-added':
          category = 'replies';
          break;
        case 'mention':
          category = 'mentions';
          break;
        case 'watcher-update':
        case 'watcher':
          category = 'watcherUpdates';
          break;
        default:
          category = 'system';
      }
    }

    if (category !== 'system') {
      const userPrefs = await this.getUserNotificationPreferences(cleanUserId);
      if (userPrefs && userPrefs[category] === false) {
        console.log(`[dbService] Notification for ${cleanUserId} skipped due to preference '${category}: false'`);
        return;
      }
    }

    const notId = `not-${Date.now()}`;
    const fullNotification: NotificationItem = {
      ...notification,
      id: notId,
      notificationId: notId,
      userId: cleanUserId,
      read: notification.read !== undefined ? notification.read : false,
      isRead: notification.read !== undefined ? notification.read : false,
      isWatcherNotification: notification.isWatcherNotification || false,
      timestamp: notification.timestamp || new Date().toISOString(),
      createdDate: notification.createdDate || notification.timestamp || new Date().toISOString()
    };

    const start = performance.now();
    const docRef = await addDoc(notificationsCollection, {
      userId: fullNotification.userId,
      title: fullNotification.title,
      message: fullNotification.message,
      taskId: fullNotification.taskId,
      commentId: fullNotification.commentId || null,
      senderEmail: fullNotification.senderEmail || null,
      senderName: fullNotification.senderName || null,
      type: fullNotification.type,
      isWatcherNotification: fullNotification.isWatcherNotification || false,
      read: fullNotification.read,
      isRead: fullNotification.isRead,
      timestamp: fullNotification.timestamp,
      createdDate: fullNotification.createdDate
    });
    fullNotification.id = docRef.id;
    fullNotification.notificationId = docRef.id;
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: notifications, Operation: ADD, Execution Time: ${(end - start).toFixed(2)}ms`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
  }

  async markNotificationRead(id: string): Promise<void> {
    const start = performance.now();
    const notDoc = doc(notificationsCollection, id);
    await updateDoc(notDoc, { read: true, isRead: true });
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: notifications, Operation: UPDATE (mark read), Execution Time: ${(end - start).toFixed(2)}ms`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
  }

  async deleteNotification(id: string): Promise<void> {
    const start = performance.now();
    const notDoc = doc(notificationsCollection, id);
    await deleteDoc(notDoc);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: notifications, Operation: DELETE, Execution Time: ${(end - start).toFixed(2)}ms`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
  }

  async deleteAllNotifications(userEmail: string): Promise<{ deletedCount: number }> {
    const cleanEmail = (userEmail || '').toLowerCase().trim();
    if (!cleanEmail) {
      throw new Error("User email is required to delete notifications.");
    }

    const start = performance.now();
    const q = query(notificationsCollection, where('userId', '==', cleanEmail));
    const snap = await getDocs(q);

    if (snap.empty) {
      return { deletedCount: 0 };
    }

    // Process in batches of 450 (well within Firestore 500 operations per batch limit)
    const BATCH_SIZE = 450;
    const docs = snap.docs;
    let deletedCount = 0;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
      deletedCount += chunk.length;
    }

    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: notifications, Operation: DELETE_ALL (${deletedCount} items), Execution Time: ${(end - start).toFixed(2)}ms`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }

    return { deletedCount };
  }

  // --- SYSTEM WIDE ACTIVITY LOGGER ---
  async logActivity(activity: Omit<ActivityLog, 'id' | 'activityId'>): Promise<void> {
    const actId = `act-${Date.now()}`;
    const fullActivity: ActivityLog = {
      ...activity,
      id: actId,
      activityId: actId,
      fieldName: activity.fieldName || '',
      previousValue: activity.previousValue || activity.oldValue || '',
      oldValue: activity.oldValue || activity.previousValue || '',
      newValue: activity.newValue || '',
      performedBy: activity.performedBy || activity.userName || 'Team Member',
      userName: activity.userName || activity.performedBy || 'Team Member',
      performedByEmail: activity.performedByEmail || activity.user || '',
      user: activity.user || activity.performedByEmail || '',
    };

    try {
      const start = performance.now();
      const docRef = await addDoc(activitiesCollection, {
        taskId: fullActivity.taskId,
        taskSeqId: fullActivity.taskSeqId || '',
        taskTitle: fullActivity.taskTitle,
        action: fullActivity.action,
        fieldName: fullActivity.fieldName || '',
        previousValue: fullActivity.previousValue,
        oldValue: fullActivity.oldValue,
        newValue: fullActivity.newValue || '',
        performedBy: fullActivity.performedBy,
        userName: fullActivity.userName,
        performedByEmail: fullActivity.performedByEmail,
        user: fullActivity.user,
        timestamp: fullActivity.timestamp
      });
      fullActivity.id = docRef.id;
      fullActivity.activityId = docRef.id;
      const end = performance.now();
      console.log(`[dbService] [Firestore] Collection Name: activities, Operation: ADD, Execution Time: ${(end - start).toFixed(2)}ms`);
    } catch (err) {
      console.error("[dbService] [Firestore] Failed to write activity logs:", err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('activity-updated'));
    }
  }

  subscribeActivities(callback: (activities: ActivityLog[]) => void): () => void {
    try {
      return onSnapshot(activitiesCollection, (snapshot) => {
        const list: ActivityLog[] = [];
        snapshot.forEach(docSnap => {
          list.push({ ...docSnap.data(), id: docSnap.id } as ActivityLog);
        });
        callback(list.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50));
      }, (err) => {
        console.error("Activities subscription failed:", err);
        callback([]);
      });
    } catch (err) {
      console.error("Failed to listen to activities:", err);
      callback([]);
      return () => {};
    }
  }

  // --- SETTINGS ---
  async getSettings(): Promise<PortalSettings> {
    console.log("[dbService] Fetching settings...");
    const start = performance.now();
    
    const settingsDoc = doc(db, 'settings', 'global_settings');
    const snap = await getDoc(settingsDoc);
    if (snap.exists()) {
      const end = performance.now();
      console.log(`[dbService] [Firestore] Collection Name: settings, Returned Count: 1, Execution Time: ${(end - start).toFixed(2)}ms`);
      return snap.data() as PortalSettings;
    } else {
      // Return empty object if not configured
      const end = performance.now();
      console.log(`[dbService] [Firestore] Settings not found, returning empty object (Execution Time: ${(end - start).toFixed(2)}ms`);
      return {} as PortalSettings;
    }
  }

  async saveSettings(settings: PortalSettings): Promise<void> {
    console.log("[dbService] Saving global portal settings...");
    const start = performance.now();
    
    const settingsDoc = doc(db, 'settings', 'global_settings');
    await setDoc(settingsDoc, settings);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: settings, Operation: UPDATE, Execution Time: ${(end - start).toFixed(2)}ms`);
  }

  // --- REPORTS ---
  async getReports(): Promise<MonthlyReport[]> {
    console.log("[dbService] Fetching reports from monthlyReports collection...");
    const start = performance.now();
    
    const queryPromise = (async () => {
      const querySnapshot = await getDocs(monthlyReportsCollection);
      const reports: MonthlyReport[] = [];
      querySnapshot.forEach((docSnap) => {
        reports.push({ ...docSnap.data(), id: docSnap.id } as MonthlyReport);
      });
      return reports;
    })();

    try {
      const reports = await withTimeout(queryPromise, 3000, []);
      const end = performance.now();
      console.log(`[dbService] [Firestore] Collection Name: monthlyReports, Returned Count: ${reports.length}, Execution Time: ${(end - start).toFixed(2)}ms`);
      return reports;
    } catch (e: any) {
      const end = performance.now();
      console.error(`[dbService] [Firestore] Error reading collection monthlyReports:`, e);
      return [];
    }
  }

  // --- REAL-TIME LISTENERS ---
  subscribeTasks(callback: (tasks: Task[]) => void): () => void {
    console.log("[dbService] Subscribing to tasks collection real-time...");
    let hasFired = false;
    const localCallback = (data: Task[]) => {
      hasFired = true;
      callback(data);
    };
    const timer = setTimeout(() => {
      if (!hasFired) {
        console.warn("[dbService] Tasks subscription first snapshot timed out. Returning empty array.");
        localCallback([]);
      }
    }, 3500);

    let unsubscribe = () => {};
    try {
      const q = query(tasksCollection, where('isDeleted', '==', false));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const tasks: Task[] = [];
        snapshot.forEach((docSnap) => {
          tasks.push({ ...docSnap.data(), id: docSnap.id } as Task);
        });
        tasks.sort((a, b) => new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime());
        clearTimeout(timer);
        localCallback(tasks);
      }, (error: any) => {
        console.error("[dbService] [Realtime] Tasks subscription error:", error);
        clearTimeout(timer);
        localCallback([]);
      });
    } catch (e) {
      console.error("[dbService] [Realtime] Tasks subscription setup failed:", e);
      clearTimeout(timer);
      localCallback([]);
    }

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }

  subscribeTasksAssignedBy(userEmail: string, callback: (tasks: Task[]) => void): () => void {
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    if (!cleanEmail) {
      callback([]);
      return () => {};
    }
    console.log(`[dbService] Subscribing to tasks assigned by: ${cleanEmail} real-time...`);
    let hasFired = false;
    const localCallback = (data: Task[]) => {
      hasFired = true;
      callback(data);
    };
    const timer = setTimeout(() => {
      if (!hasFired) {
        console.warn(`[dbService] Tasks assigned-by (${cleanEmail}) first snapshot timed out. Returning empty array.`);
        localCallback([]);
      }
    }, 3500);

    let unsubscribe = () => {};
    try {
      const q = query(tasksCollection, where('isDeleted', '==', false));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const tasks: Task[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Task;
          if ((data.createdBy || '').toLowerCase() === cleanEmail) {
            tasks.push({ ...data, id: docSnap.id } as Task);
          }
        });
        tasks.sort((a, b) => new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime());
        clearTimeout(timer);
        localCallback(tasks);
      }, (error: any) => {
        console.error(`[dbService] [Realtime] Tasks assigned-by subscription error for ${cleanEmail}:`, error);
        clearTimeout(timer);
        localCallback([]);
      });
    } catch (e) {
      console.error(`[dbService] [Realtime] Tasks assigned-by subscription setup failed for ${cleanEmail}:`, e);
      clearTimeout(timer);
      localCallback([]);
    }

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }

  subscribeMembers(callback: (members: Member[]) => void): () => void {
    console.log("[dbService] Subscribing to users (members) collection real-time...");
    let hasFired = false;
    const localCallback = (data: Member[]) => {
      hasFired = true;
      callback(data);
    };
    const timer = setTimeout(() => {
      if (!hasFired) {
        console.warn("[dbService] Members subscription first snapshot timed out. Returning empty array.");
        localCallback([]);
      }
    }, 15000);

    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(usersCollection, (snapshot) => {
        const membersMap = new Map<string, Member>();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const rawEmail = (data.email || '').toLowerCase().trim();
          const rawName = (data.name || data.displayName || data.fullName || (rawEmail ? rawEmail.split('@')[0] : '') || 'Team Member').trim();
          const member: Member = {
            ...data,
            id: docSnap.id,
            uid: data.uid || docSnap.id,
            name: rawName,
            email: rawEmail,
            role: data.role || 'Member',
            avatarColor: data.avatarColor || '#3b82f6',
            isActive: data.isActive !== false,
            createdDate: data.createdDate || data.createdAt || new Date().toISOString(),
          };

          const key = rawEmail || data.uid || docSnap.id;

          if (!membersMap.has(key)) {
            membersMap.set(key, member);
          } else {
            const existing = membersMap.get(key)!;
            const merged: Member = {
              ...existing,
              ...member,
              name: member.name || existing.name,
              email: member.email || existing.email,
              uid: member.uid || existing.uid,
              id: (member.uid && docSnap.id === member.uid) ? docSnap.id : existing.id,
              role: (existing.role === 'SuperAdmin' || member.role === 'SuperAdmin')
                ? 'SuperAdmin'
                : (existing.role === 'Admin' || member.role === 'Admin')
                ? 'Admin'
                : member.role || existing.role || 'Member',
              avatarColor: member.avatarColor || existing.avatarColor,
              isActive: existing.isActive !== false && member.isActive !== false,
              createdDate: existing.createdDate || member.createdDate,
            };
            membersMap.set(key, merged);
          }
        });
        const list = Array.from(membersMap.values());
        list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
        clearTimeout(timer);
        localCallback(list);
      }, (error: any) => {
        console.error("[dbService] [Realtime] Members subscription error:", error);
        clearTimeout(timer);
        localCallback([]);
      });
    } catch (e) {
      console.error("[dbService] [Realtime] Members subscription setup failed:", e);
      clearTimeout(timer);
      localCallback([]);
    }

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }

  async deleteMember(email: string): Promise<void> {
    console.log("[dbService] Deleting member from DB for email:", email);
    let targetDoc = null;
    const q = query(usersCollection, where('email', '==', email));
    const snap = await withTimeout(getDocs(q), 3000, { empty: true, docs: [] } as any);
    if (snap && !snap.empty) {
      targetDoc = snap.docs[0];
    } else {
      const q2 = query(usersCollection, where('email', '==', email.toLowerCase()));
      const snap2 = await withTimeout(getDocs(q2), 3000, { empty: true, docs: [] } as any);
      if (snap2 && !snap2.empty) {
        targetDoc = snap2.docs[0];
      } else {
        const allSnap = await withTimeout(getDocs(usersCollection), 3000, { empty: true, docs: [] } as any);
        if (allSnap && allSnap.docs) {
          targetDoc = allSnap.docs.find((d: any) => d.data().email?.toLowerCase() === email.toLowerCase()) || null;
        }
      }
    }

    if (targetDoc) {
      const userDoc = doc(db, 'users', targetDoc.id);
      await deleteDoc(userDoc);
      console.log(`[dbService] Member with email ${email} deleted from users collection.`);
    } else {
      console.warn("[dbService] Member not found to delete for email:", email);
    }
  }

  // --- PROJECTS ---
  async getProjects(): Promise<Project[]> {
    console.log("[dbService] Fetching projects from projects collection...");
    const start = performance.now();
    const queryPromise = (async () => {
      const querySnapshot = await getDocs(projectsCollection);
      const projects: Project[] = [];
      querySnapshot.forEach((docSnap) => {
        projects.push({ ...docSnap.data(), id: docSnap.id } as Project);
      });
      return projects;
    })();
    try {
      const projects = await withTimeout(queryPromise, 3000, []);
      const end = performance.now();
      console.log(`[dbService] [Firestore] Collection: projects, Count: ${projects.length}, Time: ${(end - start).toFixed(2)}ms`);
      return projects;
    } catch (e) {
      console.error("[dbService] Error getting projects:", e);
      return [];
    }
  }

  async addProject(project: Omit<Project, 'id'>): Promise<Project> {
    console.log("[dbService] Adding new project:", project.name);
    const start = performance.now();
    const docRef = await addDoc(projectsCollection, project);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Project added (Time: ${(end - start).toFixed(2)}ms)`);
    return { id: docRef.id, ...project };
  }

  async deleteProject(projectId: string): Promise<void> {
    console.log("[dbService] Deleting project with ID:", projectId);
    const docRef = doc(db, 'projects', projectId);
    await deleteDoc(docRef);
  }

  subscribeProjects(localCallback: (projects: Project[]) => void) {
    if (!isFirebaseConfigured()) {
      localCallback([]);
      return () => {};
    }
    const timer = setTimeout(() => {
      console.warn("[dbService] [Realtime] Projects subscription timeout.");
      localCallback([]);
    }, 4000);
    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(projectsCollection, (snapshot) => {
        const projects: Project[] = [];
        snapshot.forEach((docSnap) => {
          projects.push({ ...docSnap.data(), id: docSnap.id } as Project);
        });
        clearTimeout(timer);
        localCallback(projects);
      }, (error) => {
        console.error("[dbService] Projects subscription error:", error);
        clearTimeout(timer);
        localCallback([]);
      });
    } catch (e) {
      console.error("[dbService] Projects subscription setup failed:", e);
      clearTimeout(timer);
      localCallback([]);
    }
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }

  // --- TODOS (LIGHTWEIGHT PERSONAL WORKPAD) ---
  async getTodos(userEmail: string): Promise<TodoItem[]> {
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    if (!cleanEmail) return [];
    const start = performance.now();
    const queryPromise = (async () => {
      const q = query(todosCollection, where('userId', '==', cleanEmail));
      const querySnapshot = await getDocs(q);
      const todos: TodoItem[] = [];
      querySnapshot.forEach((docSnap) => {
        todos.push({ ...docSnap.data(), id: docSnap.id } as TodoItem);
      });
      return todos;
    })();
    try {
      const todos = await withTimeout(queryPromise, 3000, []);
      const end = performance.now();
      console.log(`[dbService] [Firestore] Collection: todos, Count: ${todos.length}, Time: ${(end - start).toFixed(2)}ms`);
      return todos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error("[dbService] Error getting todos:", e);
      return [];
    }
  }

  async addTodo(todo: Omit<TodoItem, 'id'>): Promise<TodoItem> {
    const start = performance.now();
    const cleanTodo: Record<string, any> = {
      userId: todo.userId.toLowerCase().trim(),
      title: todo.title.trim(),
      completed: Boolean(todo.completed),
      createdAt: todo.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (todo.note && typeof todo.note === 'string' && todo.note.trim()) {
      cleanTodo.note = todo.note.trim();
    }
    if (todo.dueDate && typeof todo.dueDate === 'string' && todo.dueDate.trim()) {
      cleanTodo.dueDate = todo.dueDate.trim();
    }
    if (todo.completedAt && typeof todo.completedAt === 'string') {
      cleanTodo.completedAt = todo.completedAt;
    }
    if (todo.convertedToTaskId && typeof todo.convertedToTaskId === 'string') {
      cleanTodo.convertedToTaskId = todo.convertedToTaskId;
    }
    if (todo.convertedAt && typeof todo.convertedAt === 'string') {
      cleanTodo.convertedAt = todo.convertedAt;
    }
    const docRef = await addDoc(todosCollection, cleanTodo);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Todo added (Time: ${(end - start).toFixed(2)}ms)`);
    return { id: docRef.id, ...cleanTodo } as TodoItem;
  }

  async updateTodo(id: string, updates: Partial<TodoItem>): Promise<void> {
    const start = performance.now();
    const docRef = doc(db, 'todos', id);
    const cleanUpdates: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };
    if (updates.title !== undefined) cleanUpdates.title = updates.title.trim();
    if (updates.note !== undefined) {
      if (updates.note && typeof updates.note === 'string' && updates.note.trim()) {
        cleanUpdates.note = updates.note.trim();
      } else {
        cleanUpdates.note = deleteField();
      }
    }
    if (updates.completed !== undefined) cleanUpdates.completed = Boolean(updates.completed);
    if (updates.completedAt !== undefined) {
      if (updates.completedAt) cleanUpdates.completedAt = updates.completedAt;
      else cleanUpdates.completedAt = deleteField();
    }
    if (updates.dueDate !== undefined) {
      if (updates.dueDate && updates.dueDate.trim()) cleanUpdates.dueDate = updates.dueDate.trim();
      else cleanUpdates.dueDate = deleteField();
    }
    if (updates.convertedToTaskId !== undefined) {
      if (updates.convertedToTaskId) cleanUpdates.convertedToTaskId = updates.convertedToTaskId;
    }
    if (updates.convertedAt !== undefined) {
      if (updates.convertedAt) cleanUpdates.convertedAt = updates.convertedAt;
    }
    await updateDoc(docRef, cleanUpdates);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Todo updated (Time: ${(end - start).toFixed(2)}ms)`);
  }

  async deleteTodo(id: string): Promise<void> {
    const start = performance.now();
    const docRef = doc(db, 'todos', id);
    await deleteDoc(docRef);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Todo deleted (Time: ${(end - start).toFixed(2)}ms)`);
  }

  async deleteAllTodos(userEmail: string, completed: boolean): Promise<number> {
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    if (!cleanEmail) return 0;
    const start = performance.now();
    
    // Scoped specifically to current user's todos and matching completed state
    const q = query(
      todosCollection,
      where('userId', '==', cleanEmail),
      where('completed', '==', completed)
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    // Use batches in chunks of 450 to stay safely under Firestore's 500-op limit
    const docs = snap.docs;
    const chunkSize = 450;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + chunkSize);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    const end = performance.now();
    console.log(`[dbService] [Firestore] Batch deleted ${docs.length} ${completed ? 'completed' : 'active'} todos for ${cleanEmail} (Time: ${(end - start).toFixed(2)}ms)`);
    return docs.length;
  }

  subscribeTodos(userEmail: string, callback: (todos: TodoItem[]) => void): () => void {
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    if (!cleanEmail || !isFirebaseConfigured()) {
      callback([]);
      return () => {};
    }
    const timer = setTimeout(() => {
      console.warn("[dbService] [Realtime] Todos subscription timeout.");
      callback([]);
    }, 4000);
    let unsubscribe = () => {};
    try {
      const q = query(todosCollection, where('userId', '==', cleanEmail));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const list: TodoItem[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as TodoItem);
        });
        clearTimeout(timer);
        callback(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }, (error) => {
        console.error("[dbService] Todos subscription error:", error);
        clearTimeout(timer);
        callback([]);
      });
    } catch (e) {
      console.error("[dbService] Todos subscription setup failed:", e);
      clearTimeout(timer);
      callback([]);
    }
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }

  // ==========================================
  // PROJECT CHANGE CHECKLIST & QA VERIFICATION
  // ==========================================

  async getProjectChangeChecklists(): Promise<ProjectChangeChecklist[]> {
    try {
      const q = query(projectChangeChecklistsCollection);
      const queryPromise = getDocs(q).then((snapshot) => {
        const list: ProjectChangeChecklist[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as ProjectChangeChecklist);
        });
        return list.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
      });
      return await withTimeout(queryPromise, 3500, []);
    } catch (err) {
      console.error("[dbService] Error getting project change checklists:", err);
      return [];
    }
  }

  async getProjectChangeChecklist(id: string): Promise<ProjectChangeChecklist | null> {
    try {
      const docRef = doc(db, 'projectChangeChecklists', id);
      const snapPromise = getDoc(docRef).then((snap) => {
        if (!snap.exists()) return null;
        return { ...snap.data(), id: snap.id } as ProjectChangeChecklist;
      });
      return await withTimeout(snapPromise, 3500, null as any);
    } catch (err) {
      console.error(`[dbService] Error getting checklist with id ${id}:`, err);
      return null;
    }
  }

  subscribeProjectChangeChecklist(id: string, callback: (checklist: ProjectChangeChecklist | null) => void) {
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      callback(null);
    }, 4000);

    try {
      const docRef = doc(db, 'projectChangeChecklists', id);
      unsubscribe = onSnapshot(docRef, (docSnap) => {
        clearTimeout(timer);
        if (!docSnap.exists()) {
          callback(null);
        } else {
          callback({ ...docSnap.data(), id: docSnap.id } as ProjectChangeChecklist);
        }
      }, (error) => {
        console.error(`[dbService] Checklist subscription error for ${id}:`, error);
        clearTimeout(timer);
        callback(null);
      });
    } catch (err) {
      console.error(`[dbService] Subscription setup failed for checklist ${id}:`, err);
      clearTimeout(timer);
      callback(null);
    }

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }

  subscribeProjectChangeChecklists(callback: (checklists: ProjectChangeChecklist[]) => void) {
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      callback([]);
    }, 4000);

    try {
      unsubscribe = onSnapshot(projectChangeChecklistsCollection, (snapshot) => {
        clearTimeout(timer);
        const list: ProjectChangeChecklist[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as ProjectChangeChecklist);
        });
        callback(list.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()));
      }, (error) => {
        console.error("[dbService] Project change checklists subscription error:", error);
        clearTimeout(timer);
        callback([]);
      });
    } catch (err) {
      console.error("[dbService] Subscription setup failed for checklists:", err);
      clearTimeout(timer);
      callback([]);
    }

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }

  async createProjectChangeChecklist(
    data: Omit<ProjectChangeChecklist, 'id' | 'status' | 'createdDate' | 'updatedDate'>
  ): Promise<string> {
    const now = new Date().toISOString();
    const rawItems: ChangeChecklistItem[] = data.items && Array.isArray(data.items)
      ? data.items
      : (data.points || []).map((p, idx) => ({
          id: `item-${idx + 1}`,
          text: p,
          type: 'manual',
          status: 'Pending'
        }));

    // Build clean items ensuring no undefined keys are present
    const cleanItems: ChangeChecklistItem[] = rawItems
      .filter(it => it && typeof it.text === 'string' && it.text.trim())
      .map(it => {
        const item: Record<string, any> = {
          id: it.id,
          text: it.text.trim(),
          type: it.type || 'manual',
          status: it.status || 'Pending'
        };
        if (it.taskId) item.taskId = it.taskId;
        if (it.taskDocId) item.taskDocId = it.taskDocId;
        if (it.taskTitle) item.taskTitle = it.taskTitle;
        if (it.taskStatus) item.taskStatus = it.taskStatus;
        if (it.taskModule) item.taskModule = it.taskModule;
        if (it.taskPriority) item.taskPriority = it.taskPriority;
        if (it.status === 'Completed') {
          if (it.completedBy) item.completedBy = it.completedBy;
          if (it.completedByName) item.completedByName = it.completedByName;
          if (it.completedDate) item.completedDate = it.completedDate;
        }
        if (typeof it.comment === 'string' && it.comment.trim()) {
          item.comment = it.comment.trim();
        }
        return item as ChangeChecklistItem;
      });

    const cleanPoints = cleanItems.map(it => it.text);

    const verificationItems: VerificationChecklistItem[] = cleanItems.map((it, idx) => {
      const vItem: Record<string, any> = {
        id: `p-${idx + 1}`,
        text: it.text,
        status: 'Pending',
        type: it.type,
        developerCompleted: it.status === 'Completed'
      };
      if (it.taskId) vItem.taskId = it.taskId;
      if (it.taskDocId) vItem.taskDocId = it.taskDocId;
      if (it.taskTitle) vItem.taskTitle = it.taskTitle;
      if (it.taskStatus) vItem.taskStatus = it.taskStatus;
      if (it.taskModule) vItem.taskModule = it.taskModule;
      if (it.status === 'Completed') {
        if (it.completedBy) vItem.developerCompletedBy = it.completedBy;
        if (it.completedByName) vItem.developerCompletedByName = it.completedByName;
        if (it.completedDate) vItem.developerCompletedDate = it.completedDate;
      }
      if (typeof it.comment === 'string' && it.comment.trim()) {
        vItem.developerComment = it.comment.trim();
      }
      return vItem as VerificationChecklistItem;
    });

    const payload: Omit<ProjectChangeChecklist, 'id'> = {
      projectId: data.projectId,
      projectName: data.projectName,
      title: data.title.trim(),
      description: data.description ? data.description.trim() : '',
      items: cleanItems,
      points: cleanPoints,
      changes: cleanPoints,
      verificationItems,
      status: 'Available for Release',
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      createdDate: now,
      updatedDate: now,
      currentReleaseId: null,
      currentReleaseName: null,
      rejectionHistory: []
    };

    const safePayload = sanitizeFirestorePayload(payload);

    // Development diagnostics
    if (process.env.NODE_ENV !== 'production') {
      const findUndefined = (obj: any, path = ''): string[] => {
        let issues: string[] = [];
        if (!obj || typeof obj !== 'object') return issues;
        for (const [k, v] of Object.entries(obj)) {
          const fullPath = path ? `${path}.${k}` : k;
          if (v === undefined) issues.push(fullPath);
          else if (v && typeof v === 'object') issues = issues.concat(findUndefined(v, fullPath));
        }
        return issues;
      };
      const undefinedFields = findUndefined(safePayload);
      if (undefinedFields.length > 0) {
        console.error('[dbService.createProjectChangeChecklist] Undefined fields detected:', undefinedFields);
      }
    }

    const docRef = await addDoc(projectChangeChecklistsCollection, safePayload);
    return docRef.id;
  }

  async updateProjectChangeChecklist(
    id: string,
    updates: Partial<ProjectChangeChecklist>
  ): Promise<void> {
    const docRef = doc(db, 'projectChangeChecklists', id);
    const payload: any = {
      ...updates,
      updatedDate: new Date().toISOString()
    };
    if (updates.items && Array.isArray(updates.items)) {
      const cleanItems = updates.items
        .filter(it => it && typeof it.text === 'string' && it.text.trim())
        .map(it => {
          const item: Record<string, any> = {
            id: it.id,
            text: it.text.trim(),
            type: it.type || 'manual',
            status: it.status || 'Pending'
          };
          if (it.taskId) item.taskId = it.taskId;
          if (it.taskDocId) item.taskDocId = it.taskDocId;
          if (it.taskTitle) item.taskTitle = it.taskTitle;
          if (it.taskStatus) item.taskStatus = it.taskStatus;
          if (it.taskModule) item.taskModule = it.taskModule;
          if (it.taskPriority) item.taskPriority = it.taskPriority;
          if (it.status === 'Completed') {
            if (it.completedBy) item.completedBy = it.completedBy;
            if (it.completedByName) item.completedByName = it.completedByName;
            if (it.completedDate) item.completedDate = it.completedDate;
          }
          if (typeof it.comment === 'string' && it.comment.trim()) {
            item.comment = it.comment.trim();
          }
          return item;
        });

      payload.items = cleanItems;
      const cleanPoints = cleanItems.map(it => it.text);
      payload.points = cleanPoints;
      payload.changes = cleanPoints;
      payload.verificationItems = cleanItems.map((it, idx) => {
        const vItem: Record<string, any> = {
          id: `p-${idx + 1}`,
          text: it.text,
          status: 'Pending',
          type: it.type,
          developerCompleted: it.status === 'Completed'
        };
        if (it.taskId) vItem.taskId = it.taskId;
        if (it.taskDocId) vItem.taskDocId = it.taskDocId;
        if (it.taskTitle) vItem.taskTitle = it.taskTitle;
        if (it.taskStatus) vItem.taskStatus = it.taskStatus;
        if (it.taskModule) vItem.taskModule = it.taskModule;
        if (it.status === 'Completed') {
          if (it.completedBy) vItem.developerCompletedBy = it.completedBy;
          if (it.completedByName) vItem.developerCompletedByName = it.completedByName;
          if (it.completedDate) vItem.developerCompletedDate = it.completedDate;
        }
        if (typeof it.comment === 'string' && it.comment.trim()) {
          vItem.developerComment = it.comment.trim();
        }
        return vItem;
      });
    } else if (updates.points && Array.isArray(updates.points)) {
      const cleanPoints = updates.points.map(p => p.trim()).filter(Boolean);
      payload.points = cleanPoints;
      payload.changes = cleanPoints;
      payload.verificationItems = cleanPoints.map((p, idx) => ({ id: `p-${idx + 1}`, text: p, status: 'Pending' }));
    }
    await updateDoc(docRef, sanitizeFirestorePayload(payload));
  }

  async deleteProjectChangeChecklist(id: string, userEmail?: string, userRole?: string): Promise<void> {
    const docRef = doc(db, 'projectChangeChecklists', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error("Change checklist not found.");
    }

    const data = snap.data() as ProjectChangeChecklist;

    // Strict role & creator check if credentials provided
    if (userEmail && userRole) {
      const isPrivileged = userRole === 'SuperAdmin' || userRole === 'Admin';
      const isCreator = data.createdBy && data.createdBy.toLowerCase() === userEmail.toLowerCase();
      if (!isPrivileged && !isCreator) {
        throw new Error("Access denied: You do not have permission to delete this checklist.");
      }
    }

    // Strict safeguard: allow deletion ONLY if unreleased and never included in a release
    const hasReleaseHistory = (data.rejectionHistory && data.rejectionHistory.length > 0) || Boolean(data.currentReleaseId);
    if (data.status === 'Included in Release' || data.status === 'Completed' || hasReleaseHistory) {
      throw new Error("Cannot delete: This change checklist is included in a production release or has release history. Deletion is only allowed for unreleased entries.");
    }

    await deleteDoc(docRef);
  }

  async toggleChecklistItemStatus(
    checklistId: string,
    itemId: string,
    userEmail: string,
    userName: string
  ): Promise<ChangeChecklistItem[]> {
    const docRef = doc(db, 'projectChangeChecklists', checklistId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Change checklist not found.");

    const data = snap.data() as ProjectChangeChecklist;
    const currentItems = getChecklistItems(data);
    const now = new Date().toISOString();

    const updatedItems = currentItems.map(it => {
      if (it.id === itemId) {
        const nextStatus: 'Pending' | 'Completed' = it.status === 'Completed' ? 'Pending' : 'Completed';
        return {
          ...it,
          status: nextStatus,
          completedBy: nextStatus === 'Completed' ? userEmail : undefined,
          completedByName: nextStatus === 'Completed' ? userName : undefined,
          completedDate: nextStatus === 'Completed' ? now : undefined
        };
      }
      return it;
    });

    await updateDoc(docRef, {
      items: updatedItems,
      updatedDate: now
    });

    return updatedItems;
  }

  async updateChecklistItemComment(
    checklistId: string,
    itemId: string,
    comment: string
  ): Promise<ChangeChecklistItem[]> {
    const docRef = doc(db, 'projectChangeChecklists', checklistId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Change checklist not found.");

    const data = snap.data() as ProjectChangeChecklist;
    const currentItems = getChecklistItems(data);
    const now = new Date().toISOString();

    const updatedItems = currentItems.map(it => {
      if (it.id === itemId) {
        return {
          ...it,
          comment: comment.trim()
        };
      }
      return it;
    });

    await updateDoc(docRef, {
      items: updatedItems,
      updatedDate: now
    });

    return updatedItems;
  }

  async addChangePoint(checklistId: string, pointText: string): Promise<string[]> {
    const cleanText = pointText.trim();
    if (!cleanText) throw new Error("Point text cannot be empty.");

    const docRef = doc(db, 'projectChangeChecklists', checklistId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Change checklist not found.");

    const data = snap.data() as ProjectChangeChecklist;
    const currentItems = getChecklistItems(data);
    const newItem: ChangeChecklistItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: cleanText,
      type: 'manual',
      status: 'Pending'
    };
    const updatedItems = [...currentItems, newItem];
    const updatedPoints = updatedItems.map(it => it.text);

    await updateDoc(docRef, {
      items: updatedItems,
      points: updatedPoints,
      changes: updatedPoints,
      verificationItems: updatedItems.map((it, idx) => ({
        id: `p-${idx + 1}`,
        text: it.text,
        status: 'Pending',
        type: it.type,
        taskId: it.taskId,
        taskDocId: it.taskDocId,
        taskTitle: it.taskTitle,
        taskStatus: it.taskStatus,
        taskModule: it.taskModule,
        developerCompleted: it.status === 'Completed',
        developerCompletedBy: it.completedBy,
        developerCompletedByName: it.completedByName,
        developerCompletedDate: it.completedDate,
        developerComment: it.comment
      })),
      updatedDate: new Date().toISOString()
    });

    return updatedPoints;
  }

  async updateChangePoint(checklistId: string, pointIndex: number, newText: string): Promise<string[]> {
    const cleanText = newText.trim();
    if (!cleanText) throw new Error("Point text cannot be empty.");

    const docRef = doc(db, 'projectChangeChecklists', checklistId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Change checklist not found.");

    const data = snap.data() as ProjectChangeChecklist;
    const currentItems = getChecklistItems(data);
    if (pointIndex < 0 || pointIndex >= currentItems.length) {
      throw new Error("Invalid point index.");
    }

    const updatedItems = [...currentItems];
    updatedItems[pointIndex] = {
      ...updatedItems[pointIndex],
      text: cleanText
    };
    const updatedPoints = updatedItems.map(it => it.text);

    await updateDoc(docRef, {
      items: updatedItems,
      points: updatedPoints,
      changes: updatedPoints,
      verificationItems: updatedItems.map((it, idx) => ({
        id: `p-${idx + 1}`,
        text: it.text,
        status: 'Pending',
        type: it.type,
        taskId: it.taskId,
        taskDocId: it.taskDocId,
        taskTitle: it.taskTitle,
        taskStatus: it.taskStatus,
        taskModule: it.taskModule,
        developerCompleted: it.status === 'Completed',
        developerCompletedBy: it.completedBy,
        developerCompletedByName: it.completedByName,
        developerCompletedDate: it.completedDate,
        developerComment: it.comment
      })),
      updatedDate: new Date().toISOString()
    });

    return updatedPoints;
  }

  async deleteChangePoint(checklistId: string, pointIndex: number): Promise<string[]> {
    const docRef = doc(db, 'projectChangeChecklists', checklistId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Change checklist not found.");

    const data = snap.data() as ProjectChangeChecklist;
    const currentItems = getChecklistItems(data);
    if (currentItems.length <= 1) {
      throw new Error("A change checklist must have at least one point.");
    }
    if (pointIndex < 0 || pointIndex >= currentItems.length) {
      throw new Error("Invalid point index.");
    }

    const updatedItems = currentItems.filter((_, idx) => idx !== pointIndex);
    const updatedPoints = updatedItems.map(it => it.text);

    await updateDoc(docRef, {
      items: updatedItems,
      points: updatedPoints,
      changes: updatedPoints,
      verificationItems: updatedItems.map((it, idx) => ({
        id: `p-${idx + 1}`,
        text: it.text,
        status: 'Pending',
        type: it.type,
        taskId: it.taskId,
        taskDocId: it.taskDocId,
        taskTitle: it.taskTitle,
        taskStatus: it.taskStatus,
        taskModule: it.taskModule,
        developerCompleted: it.status === 'Completed',
        developerCompletedBy: it.completedBy,
        developerCompletedByName: it.completedByName,
        developerCompletedDate: it.completedDate,
        developerComment: it.comment
      })),
      updatedDate: new Date().toISOString()
    });

    return updatedPoints;
  }

  async reopenRejectedChangeChecklist(
    id: string,
    updates: {
      title?: string;
      description?: string;
      items?: ChangeChecklistItem[];
      points?: string[];
      changes?: string[];
      verificationItems?: VerificationChecklistItem[];
    }
  ): Promise<void> {
    const docRef = doc(db, 'projectChangeChecklists', id);
    const items: ChangeChecklistItem[] = updates.items || (updates.points || []).map((p, idx) => ({
      id: `item-${idx + 1}`,
      text: p,
      type: 'manual',
      status: 'Pending'
    }));
    const cleanPoints = items.map(it => it.text.trim()).filter(Boolean);
    await updateDoc(docRef, {
      ...updates,
      items,
      points: cleanPoints,
      changes: cleanPoints,
      verificationItems: items.map((it, idx) => ({
        id: `p-${idx + 1}`,
        text: it.text,
        status: 'Pending',
        type: it.type,
        taskId: it.taskId,
        taskDocId: it.taskDocId,
        taskTitle: it.taskTitle,
        taskStatus: it.taskStatus,
        taskModule: it.taskModule,
        developerCompleted: it.status === 'Completed',
        developerCompletedBy: it.completedBy,
        developerCompletedByName: it.completedByName,
        developerCompletedDate: it.completedDate,
        developerComment: it.comment
      })),
      status: 'Available for Release',
      currentReleaseId: null,
      currentReleaseName: null,
      updatedDate: new Date().toISOString()
    });
  }

  async getProductionReleases(): Promise<ProductionRelease[]> {
    try {
      const q = query(productionReleasesCollection);
      const queryPromise = getDocs(q).then((snapshot) => {
        const list: ProductionRelease[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as ProductionRelease);
        });
        return list.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
      });
      return await withTimeout(queryPromise, 3500, []);
    } catch (err) {
      console.error("[dbService] Error getting production releases:", err);
      return [];
    }
  }

  subscribeProductionReleases(callback: (releases: ProductionRelease[]) => void) {
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      callback([]);
    }, 4000);

    try {
      unsubscribe = onSnapshot(productionReleasesCollection, (snapshot) => {
        clearTimeout(timer);
        const list: ProductionRelease[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as ProductionRelease);
        });
        callback(list.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()));
      }, (error) => {
        console.error("[dbService] Production releases subscription error:", error);
        clearTimeout(timer);
        callback([]);
      });
    } catch (err) {
      console.error("[dbService] Subscription setup failed for production releases:", err);
      clearTimeout(timer);
      callback([]);
    }

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }

  async createRelease(data: {
    name: string;
    releaseDate: string;
    releaseType: ReleaseType;
    changeChecklistIds: string[];
    createdBy: string;
    createdByName: string;
    parentReleaseId?: string | null;
    isFollowUp?: boolean;
    pointSelectionMap?: Record<string, string[]>; // checklistId -> array of point IDs
  }): Promise<string> {
    const cleanName = (data.name || '').trim();
    if (!cleanName) {
      throw new Error("Release Name is mandatory.");
    }

    const cleanReleaseDate = (data.releaseDate || '').trim();
    if (!cleanReleaseDate) {
      throw new Error("Release Date is mandatory.");
    }

    const releaseType: ReleaseType = data.releaseType || 'Production';

    if (!data.changeChecklistIds || data.changeChecklistIds.length === 0) {
      throw new Error("Please select at least one available project change.");
    }

    // Deduplicate change checklist IDs
    const uniqueIds = Array.from(new Set(data.changeChecklistIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      throw new Error("Please select at least one valid project change.");
    }

    // 1. Fetch authoritative change checklists to validate eligibility
    const allChecklists = await this.getProjectChangeChecklists();
    const checklistMap = new Map(allChecklists.filter(c => !!c.id).map(c => [c.id!, c]));

    const selected: ProjectChangeChecklist[] = [];
    for (const id of uniqueIds) {
      const change = checklistMap.get(id);
      if (!change) {
        throw new Error(`The selected change checklist with ID "${id}" no longer exists in the database.`);
      }

      // Check eligibility according to release type
      if (releaseType === 'UAT') {
        const uatEligible = 
          change.status === 'Available for UAT' || 
          change.status === 'Available for Release' ||
          change.status === 'Failed in UAT – Developer Action Required' ||
          change.status === 'Rejected by QA';
        if (!uatEligible && !data.isFollowUp) {
          throw new Error(`The change "${change.title}" is not available for UAT (Current status: "${change.status}").`);
        }
      } else if (releaseType === 'Production') {
        const prodEligible = 
          change.status === 'UAT Approved' || 
          change.status === 'Available for Production' ||
          change.status === 'Available for Release' ||
          change.status === 'Failed in Production – Developer Action Required';
        if (!prodEligible && !data.isFollowUp) {
          throw new Error(`The change "${change.title}" cannot be included in a Production Release because it has not been approved in UAT (Current status: "${change.status}").`);
        }
      } else if (releaseType === 'Hotfix') {
        const hotfixEligible = 
          change.status === 'Available for Hotfix' || 
          change.status === 'Failed in Hotfix – Developer Action Required' ||
          change.status === 'Available for Release' ||
          change.isHotfix === true;
        if (!hotfixEligible && !data.isFollowUp) {
          throw new Error(`The change "${change.title}" is not available for Hotfix release (Current status: "${change.status}").`);
        }
      }

      if (change.currentReleaseId && !data.isFollowUp) {
        throw new Error(`The change "${change.title}" is already assigned to active release "${change.currentReleaseName || change.currentReleaseId}".`);
      }
      selected.push(change);
    }

    const now = new Date().toISOString();

    // 2. Build release items. If follow-up release, filter to include ONLY failed/retest points!
    const items: ReleaseChangeItem[] = selected.map(c => {
      const checklistItems = getChecklistItems(c);
      
      // Determine which points to include
      let pointsToInclude = checklistItems;
      if (data.isFollowUp || data.parentReleaseId) {
        if (data.pointSelectionMap && data.pointSelectionMap[c.id!]) {
          const allowedIds = new Set(data.pointSelectionMap[c.id!]);
          pointsToInclude = checklistItems.filter(p => allowedIds.has(p.id));
        } else {
          // By default for follow-up, only include points that failed or need developer action / retest
          pointsToInclude = checklistItems.filter(p => {
            if (releaseType === 'UAT') return p.uatStatus === 'Failed' || p.needsDeveloperAction || p.developerRetestReady;
            if (releaseType === 'Production') return p.prodStatus === 'Failed' || p.needsDeveloperAction || p.developerRetestReady;
            if (releaseType === 'Hotfix') return p.hotfixStatus === 'Failed' || p.needsDeveloperAction || p.developerRetestReady;
            return p.status !== 'Completed';
          });
        }
        // Fallback if none explicitly matched: include any points not marked Passed
        if (pointsToInclude.length === 0) {
          pointsToInclude = checklistItems.filter(p => {
            const statusToCheck = releaseType === 'UAT' ? p.uatStatus : releaseType === 'Production' ? p.prodStatus : p.hotfixStatus;
            return statusToCheck !== 'Passed';
          });
        }
      }

      const verificationList: VerificationChecklistItem[] = pointsToInclude.map((item, idx) => {
        const vItem: VerificationChecklistItem = {
          id: item.id || `p-${idx + 1}`,
          text: item.text,
          status: 'Pending',
          type: item.type,
          developerCompleted: item.status === 'Completed'
        };

        if (item.taskId) vItem.taskId = item.taskId;
        if (item.taskDocId) vItem.taskDocId = item.taskDocId;
        if (item.taskTitle) vItem.taskTitle = item.taskTitle;
        if (item.taskStatus) vItem.taskStatus = item.taskStatus;
        if (item.taskModule) vItem.taskModule = item.taskModule;
        if (item.taskPriority) vItem.taskPriority = item.taskPriority;
        if (item.completedBy) vItem.developerCompletedBy = item.completedBy;
        if (item.completedByName) vItem.developerCompletedByName = item.completedByName;
        if (item.completedDate) vItem.developerCompletedDate = item.completedDate;
        if (item.comment) vItem.developerComment = item.comment;
        if (item.developerRetestComment) vItem.developerRetestComment = item.developerRetestComment;
        if (item.developerRetestReady) vItem.developerRetestReady = item.developerRetestReady;

        return vItem;
      });

      const commonPoints = verificationList.map(v => v.text);

      const releaseItem: ReleaseChangeItem = {
        changeChecklistId: c.id!,
        title: c.title,
        description: c.description || '',
        projectId: c.projectId || '',
        projectName: c.projectName || '',
        developerEmail: c.createdBy || '',
        developerName: c.createdByName || '',
        points: verificationList,
        changes: commonPoints,
        verificationItems: verificationList,
        status: 'Pending QA'
      };

      return releaseItem;
    });

    const releasePayload: Omit<ProductionRelease, 'id'> = {
      name: cleanName,
      releaseDate: cleanReleaseDate,
      releaseType,
      status: 'In QA',
      changeChecklistIds: uniqueIds,
      items,
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      createdDate: now,
      ...(data.parentReleaseId ? { parentReleaseId: data.parentReleaseId } : {}),
      ...(data.isFollowUp ? { isFollowUp: true } : {})
    };

    const sanitizedPayload = sanitizeFirestorePayload(releasePayload);

    // 3. Batch write for release creation & change checklist updates
    const batch = writeBatch(db);
    const releaseDocRef = doc(productionReleasesCollection);
    batch.set(releaseDocRef, sanitizedPayload);

    // If follow-up, link to parent release
    if (data.parentReleaseId) {
      const parentRef = doc(db, 'productionReleases', data.parentReleaseId);
      const parentSnap = await getDoc(parentRef);
      if (parentSnap.exists()) {
        const parentData = parentSnap.data() as ProductionRelease;
        const currentFollowUps = parentData.followUpReleaseIds || [];
        batch.update(parentRef, sanitizeFirestorePayload({
          followUpReleaseIds: Array.from(new Set([...currentFollowUps, releaseDocRef.id]))
        }));
      }
    }

    const targetChecklistStatus = 
      releaseType === 'UAT' ? 'Included in UAT' :
      releaseType === 'Hotfix' ? 'Included in Hotfix' :
      'Included in Production';

    for (const c of selected) {
      const checklistDoc = doc(db, 'projectChangeChecklists', c.id!);
      batch.update(checklistDoc, sanitizeFirestorePayload({
        status: targetChecklistStatus,
        currentReleaseId: releaseDocRef.id,
        currentReleaseName: cleanName,
        currentReleaseType: releaseType,
        updatedDate: now
      }));
    }

    await batch.commit();

    return releaseDocRef.id;
  }

  async createProductionRelease(data: {
    name: string;
    releaseDate: string;
    changeChecklistIds: string[];
    createdBy: string;
    createdByName: string;
  }): Promise<string> {
    return this.createRelease({
      ...data,
      releaseType: 'Production'
    });
  }

  async updateReleaseItemVerification(
    releaseId: string,
    checklistId: string,
    itemId: string,
    status: 'Pending' | 'Passed' | 'Failed',
    qaUser?: string,
    qaUserName?: string,
    qaComment?: string
  ): Promise<void> {
    const releaseRef = doc(db, 'productionReleases', releaseId);
    const releaseSnap = await getDoc(releaseRef);
    if (!releaseSnap.exists()) throw new Error("Release not found");

    const releaseData = releaseSnap.data() as ProductionRelease;
    const items = [...releaseData.items];
    const targetItemIndex = items.findIndex(it => it.changeChecklistId === checklistId);

    if (targetItemIndex === -1) throw new Error("Change item not found in release");

    const targetItem = { ...items[targetItemIndex] };
    const now = new Date().toISOString();
    const currentPoints = getReleaseItemPoints(targetItem);

    const updatedPoints = currentPoints.map(v => {
      if (v.id !== itemId) return v;
      const updated: VerificationChecklistItem = {
        ...v,
        status,
        qaUser: qaUser || v.qaUser,
        qaUserName: qaUserName || v.qaUserName,
        qaComment: qaComment !== undefined ? qaComment : v.qaComment
      };
      if (status !== 'Pending') {
        updated.qaDate = now;
      } else {
        delete updated.qaDate;
      }
      return updated;
    });

    targetItem.points = updatedPoints;
    targetItem.verificationItems = updatedPoints;

    items[targetItemIndex] = targetItem;
    await updateDoc(releaseRef, sanitizeFirestorePayload({ items }));
  }

  async completeReleaseChangeItem(
    releaseId: string,
    checklistId: string,
    qaUser: string,
    qaUserName: string
  ): Promise<void> {
    const releaseRef = doc(db, 'productionReleases', releaseId);
    const releaseSnap = await getDoc(releaseRef);
    if (!releaseSnap.exists()) throw new Error("Release not found");

    const releaseData = releaseSnap.data() as ProductionRelease;
    const releaseType = releaseData.releaseType || 'Production';
    const items = [...releaseData.items];
    const targetItemIndex = items.findIndex(it => it.changeChecklistId === checklistId);

    if (targetItemIndex === -1) throw new Error("Change item not found in release");

    const targetItem = { ...items[targetItemIndex] };
    const currentPoints = getReleaseItemPoints(targetItem);
    const hasUnpassed = currentPoints.some(v => v.status !== 'Passed');
    if (hasUnpassed) {
      throw new Error("All verification points in this release must be marked 'Passed' before completing.");
    }

    const now = new Date().toISOString();
    targetItem.status = 'Completed';
    targetItem.qaUser = qaUser;
    targetItem.qaUserName = qaUserName;
    targetItem.qaDate = now;

    items[targetItemIndex] = targetItem;

    // Check if entire release is completed
    const allCompleted = items.every(it => it.status === 'Completed');
    const hasRejected = items.some(it => it.status === 'Rejected');
    const newReleaseStatus: ReleaseLifecycleStatus = allCompleted
      ? 'Completed'
      : hasRejected && items.every(it => it.status !== 'Pending QA')
      ? 'Partially Rejected'
      : releaseData.status;

    const releaseUpdatePayload: any = { items, status: newReleaseStatus };
    if (newReleaseStatus === 'Completed') {
      releaseUpdatePayload.terminalDate = now;
    }

    await updateDoc(releaseRef, sanitizeFirestorePayload(releaseUpdatePayload));

    // Update the underlying change checklist
    const checklistRef = doc(db, 'projectChangeChecklists', checklistId);
    const checklistSnap = await getDoc(checklistRef);
    if (checklistSnap.exists()) {
      const checklistData = checklistSnap.data() as ProjectChangeChecklist;
      const currentItems = getChecklistItems(checklistData);

      // Map passed status onto the checklist items
      const passedPointIds = new Set(currentPoints.map(p => p.id));
      const updatedChecklistItems = currentItems.map(item => {
        if (passedPointIds.has(item.id)) {
          const matchingPassed = currentPoints.find(p => p.id === item.id);
          return {
            ...item,
            ...(releaseType === 'UAT' ? { uatStatus: 'Passed' as const, uatQaUser: qaUser, uatQaUserName: qaUserName, uatQaDate: now, uatQaComment: matchingPassed?.qaComment } : {}),
            ...(releaseType === 'Production' ? { prodStatus: 'Passed' as const, prodQaUser: qaUser, prodQaUserName: qaUserName, prodQaDate: now, prodQaComment: matchingPassed?.qaComment } : {}),
            ...(releaseType === 'Hotfix' ? { hotfixStatus: 'Passed' as const, hotfixQaUser: qaUser, hotfixQaUserName: qaUserName, hotfixQaDate: now, hotfixQaComment: matchingPassed?.qaComment } : {}),
            needsDeveloperAction: false,
            developerRetestReady: false
          };
        }
        return item;
      });

      // Check if ALL points across the checklist are now Passed
      let allPointsPassedInPhase = false;
      if (releaseType === 'UAT') {
        allPointsPassedInPhase = updatedChecklistItems.every(it => it.uatStatus === 'Passed');
      } else if (releaseType === 'Production') {
        allPointsPassedInPhase = updatedChecklistItems.every(it => it.prodStatus === 'Passed');
      } else if (releaseType === 'Hotfix') {
        allPointsPassedInPhase = updatedChecklistItems.every(it => it.hotfixStatus === 'Passed');
      }

      let newChecklistStatus: ChangeChecklistStatus = checklistData.status;
      if (allPointsPassedInPhase) {
        if (releaseType === 'UAT') {
          newChecklistStatus = 'UAT Approved';
        } else if (releaseType === 'Production') {
          newChecklistStatus = 'Completed';
        } else if (releaseType === 'Hotfix') {
          newChecklistStatus = 'Hotfix Completed';
        }
      }

      await updateDoc(checklistRef, sanitizeFirestorePayload({
        items: updatedChecklistItems,
        status: newChecklistStatus,
        ...(allPointsPassedInPhase && releaseType === 'UAT' ? { uatApprovedDate: now } : {}),
        currentReleaseId: null,
        currentReleaseName: null,
        updatedDate: now
      }));
    }
  }

  async rejectReleaseChangeItem(
    releaseId: string,
    checklistId: string,
    reason: string,
    qaUser: string,
    qaUserName: string,
    failedPointIndex?: number,
    failedPointText?: string,
    failedPointId?: string
  ): Promise<void> {
    if (!reason || !reason.trim()) {
      throw new Error("A rejection reason is mandatory.");
    }

    const releaseRef = doc(db, 'productionReleases', releaseId);
    const releaseSnap = await getDoc(releaseRef);
    if (!releaseSnap.exists()) throw new Error("Release not found");

    const releaseData = releaseSnap.data() as ProductionRelease;
    const releaseType = releaseData.releaseType || 'Production';
    const items = [...releaseData.items];
    const targetItemIndex = items.findIndex(it => it.changeChecklistId === checklistId);

    if (targetItemIndex === -1) throw new Error("Change item not found in release");

    const targetItem = { ...items[targetItemIndex] };
    const now = new Date().toISOString();

    // Mark the failed point in the release item
    const currentPoints = getReleaseItemPoints(targetItem);
    const updatedPoints = currentPoints.map((p, idx) => {
      const isFailed = (failedPointId && p.id === failedPointId) || 
                       (failedPointIndex !== undefined && idx === failedPointIndex) ||
                       (failedPointText && p.text === failedPointText);
      if (isFailed) {
        return {
          ...p,
          status: 'Failed' as const,
          qaUser,
          qaUserName,
          qaDate: now,
          qaComment: reason.trim()
        };
      }
      return p;
    });

    targetItem.points = updatedPoints;
    targetItem.verificationItems = updatedPoints;
    targetItem.status = 'Rejected';
    targetItem.rejectionReason = reason.trim();
    targetItem.qaUser = qaUser;
    targetItem.qaUserName = qaUserName;
    targetItem.qaDate = now;

    items[targetItemIndex] = targetItem;

    // Update release status to Partially Rejected
    const allDecided = items.every(it => it.status !== 'Pending QA');
    const newReleaseStatus = allDecided ? 'Partially Rejected' : 'In QA';

    await updateDoc(releaseRef, sanitizeFirestorePayload({ 
      items, 
      status: newReleaseStatus,
      terminalDate: allDecided ? now : (releaseData.terminalDate || null)
    }));

    // Update underlying change checklist: PRESERVE PASSED POINTS, return ONLY failed point!
    const checklistRef = doc(db, 'projectChangeChecklists', checklistId);
    const checklistSnap = await getDoc(checklistRef);
    if (checklistSnap.exists()) {
      const checklistData = checklistSnap.data() as ProjectChangeChecklist;
      const existingHistory = checklistData.rejectionHistory || [];
      const currentItems = getChecklistItems(checklistData);

      // Identify the failed point ID
      const targetFailedPointId = failedPointId || 
        (failedPointIndex !== undefined && currentPoints[failedPointIndex] ? currentPoints[failedPointIndex].id : undefined) ||
        (failedPointText ? currentPoints.find(p => p.text === failedPointText)?.id : undefined);

      const updatedChecklistItems = currentItems.map(item => {
        const isThisFailed = (targetFailedPointId && item.id === targetFailedPointId) ||
                             (failedPointText && item.text === failedPointText);
        if (isThisFailed) {
          return {
            ...item,
            ...(releaseType === 'UAT' ? { uatStatus: 'Failed' as const, uatQaComment: reason.trim(), uatQaUser: qaUser, uatQaUserName: qaUserName, uatQaDate: now } : {}),
            ...(releaseType === 'Production' ? { prodStatus: 'Failed' as const, prodQaComment: reason.trim(), prodQaUser: qaUser, prodQaUserName: qaUserName, prodQaDate: now } : {}),
            ...(releaseType === 'Hotfix' ? { hotfixStatus: 'Failed' as const, hotfixQaComment: reason.trim(), hotfixQaUser: qaUser, hotfixQaUserName: qaUserName, hotfixQaDate: now } : {}),
            needsDeveloperAction: true,
            developerRetestReady: false
          };
        }
        return item;
      });

      const rejectionRecord: ChangeRejectionRecord = {
        releaseId,
        releaseName: releaseData.name,
        releaseType,
        rejectedBy: qaUser,
        rejectedByName: qaUserName,
        rejectedDate: now,
        reason: reason.trim(),
        ...(failedPointIndex !== undefined ? { failedPointIndex } : {}),
        ...(failedPointText ? { failedPointText } : {}),
        ...(targetFailedPointId ? { failedPointId: targetFailedPointId } : {})
      };

      const newChecklistStatus: ChangeChecklistStatus = 
        releaseType === 'UAT' ? 'Failed in UAT – Developer Action Required' :
        releaseType === 'Production' ? 'Failed in Production – Developer Action Required' :
        'Failed in Hotfix – Developer Action Required';

      await updateDoc(checklistRef, sanitizeFirestorePayload({
        items: updatedChecklistItems,
        status: newChecklistStatus,
        rejectionHistory: [...existingHistory, rejectionRecord],
        currentReleaseId: null, // Release lock so follow-up release can be created
        currentReleaseName: null,
        updatedDate: now
      }));
    }
  }

  async markPointReadyForRetest(data: {
    checklistId: string;
    pointId: string;
    comment: string;
    developerEmail: string;
    developerName: string;
  }): Promise<void> {
    const checklistRef = doc(db, 'projectChangeChecklists', data.checklistId);
    const snap = await getDoc(checklistRef);
    if (!snap.exists()) throw new Error("Checklist not found");

    const checklistData = snap.data() as ProjectChangeChecklist;
    const items = getChecklistItems(checklistData);
    const now = new Date().toISOString();

    const updatedItems = items.map(it => {
      if (it.id === data.pointId) {
        return {
          ...it,
          needsDeveloperAction: false,
          developerRetestReady: true,
          developerRetestComment: data.comment.trim(),
          completedBy: data.developerEmail,
          completedByName: data.developerName,
          completedDate: now
        };
      }
      return it;
    });

    await updateDoc(checklistRef, sanitizeFirestorePayload({
      items: updatedItems,
      updatedDate: now
    }));
  }

  async deleteEligibleReleases(data: {
    releaseIds: string[];
    deletedBy: string;
    deletedByName: string;
    forceAdminOverride?: boolean;
    reason?: string;
  }): Promise<{ deletedCount: number; operationId: string }> {
    if (!data.releaseIds || data.releaseIds.length === 0) {
      throw new Error("No releases selected for deletion.");
    }

    const operationId = `del-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const nowTime = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // 1. Fetch all releases to verify terminal state, 7-day rule, and dependencies
    const allReleases = await this.getProductionReleases();
    const allReleaseMap = new Map(allReleases.map(r => [r.id!, r]));

    const validDocsToDelete: string[] = [];
    const releaseNames: string[] = [];
    const targetIdsSet = new Set(data.releaseIds);

    for (const relId of data.releaseIds) {
      const relData = allReleaseMap.get(relId);
      if (!relData) continue;

      // Terminal check: Must be Completed, Partially Rejected, or Rejected
      const isTerminal = 
        relData.status === 'Completed' || 
        relData.status === 'Partially Rejected' || 
        relData.status === 'Rejected';

      if (!isTerminal) {
        throw new Error(
          `Release "${relData.name}" cannot be deleted because it is still active (Status: "${relData.status}"). Only terminal records can be purged.`
        );
      }

      // Dependency check: If this release has an active follow-up release not included in deletion, block
      if (relData.followUpReleaseIds && relData.followUpReleaseIds.length > 0) {
        for (const childId of relData.followUpReleaseIds) {
          const childRel = allReleaseMap.get(childId);
          if (childRel && !targetIdsSet.has(childId)) {
            const childIsActive = childRel.status === 'In QA' || childRel.status === 'Pending QA';
            if (childIsActive) {
              throw new Error(
                `Release "${relData.name}" cannot be deleted because active follow-up release "${childRel.name}" depends on it. Complete or delete the follow-up release first.`
              );
            }
          }
        }
      }

      // 7-day retention rule
      const terminalTime = relData.terminalDate 
        ? new Date(relData.terminalDate).getTime() 
        : new Date(relData.createdDate).getTime();

      const isEligible = (nowTime - terminalTime) >= sevenDaysMs;

      if (!isEligible && !data.forceAdminOverride) {
        const daysRemaining = Math.max(1, Math.ceil((sevenDaysMs - (nowTime - terminalTime)) / (24 * 60 * 60 * 1000)));
        throw new Error(
          `Release "${relData.name}" is not yet eligible for deletion under the 7-day retention rule (${daysRemaining} day(s) remaining).`
        );
      }

      validDocsToDelete.push(relId);
      releaseNames.push(relData.name);
    }

    if (validDocsToDelete.length === 0) {
      throw new Error("None of the selected releases are eligible for deletion.");
    }

    // 2. Perform atomic batch deletion (NO EMAIL SENT)
    const batch = writeBatch(db);
    for (const relId of validDocsToDelete) {
      const docRef = doc(db, 'productionReleases', relId);
      batch.delete(docRef);
    }

    // 3. Record minimal audit entry
    const logDocRef = doc(releaseDeletionLogsCollection);
    const auditPayload: ReleaseDeletionLog = {
      operationId,
      deletedRecordIds: validDocsToDelete,
      releaseNames,
      deletedBy: data.deletedBy.toLowerCase(),
      deletedByName: data.deletedByName,
      deletionDate: now,
      recordCount: validDocsToDelete.length,
      reason: data.reason ? data.reason.trim() : undefined
    };

    batch.set(logDocRef, sanitizeFirestorePayload(auditPayload));

    await batch.commit();

    return {
      deletedCount: validDocsToDelete.length,
      operationId
    };
  }

  async deleteCompletedProductionReleases(data: {
    releaseIds: string[];
    deletedBy: string;
    deletedByName: string;
    emailRecipients: string[];
    emailSubject: string;
    emailMessageId?: string;
    reason?: string;
  }): Promise<{ deletedCount: number; operationId: string }> {
    if (!data.releaseIds || data.releaseIds.length === 0) {
      throw new Error("No releases selected for deletion.");
    }

    const operationId = `del-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    // 1. Fetch each release to verify eligibility (MUST be status === 'Completed')
    const releaseNames: string[] = [];
    const validDocsToDelete: string[] = [];

    for (const relId of data.releaseIds) {
      const docRef = doc(db, 'productionReleases', relId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        continue;
      }
      const relData = snap.data() as ProductionRelease;
      if (relData.status !== 'Completed') {
        throw new Error(
          `Release "${relData.name}" cannot be deleted because its status is "${relData.status}". Only "Completed" release verification records can be purged.`
        );
      }
      releaseNames.push(relData.name);
      validDocsToDelete.push(relId);
    }

    if (validDocsToDelete.length === 0) {
      throw new Error("None of the selected releases exist or are eligible for deletion.");
    }

    // 2. Perform atomic batch deletion of the completed release documents
    const batch = writeBatch(db);
    for (const relId of validDocsToDelete) {
      const docRef = doc(db, 'productionReleases', relId);
      batch.delete(docRef);
    }

    // 3. Record audit history in releaseDeletionLogs
    const logDocRef = doc(releaseDeletionLogsCollection);
    const auditPayload: ReleaseDeletionLog = {
      operationId,
      deletedRecordIds: validDocsToDelete,
      releaseNames,
      deletedBy: data.deletedBy.toLowerCase(),
      deletedByName: data.deletedByName,
      deletionDate: now,
      recordCount: validDocsToDelete.length,
      emailRecipients: data.emailRecipients,
      emailSubject: data.emailSubject,
      emailMessageId: data.emailMessageId,
      reason: data.reason ? data.reason.trim() : undefined
    };

    batch.set(logDocRef, sanitizeFirestorePayload(auditPayload));

    await batch.commit();

    return {
      deletedCount: validDocsToDelete.length,
      operationId
    };
  }
}

export const dbService = new DBService();

