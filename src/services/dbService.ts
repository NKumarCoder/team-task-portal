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
  writeBatch
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
  todosCollection
} from '../firebase/firestore';
import { Task, Member, PortalSettings, MonthlyReport, TaskStatus, TaskStatusHistory, Comment, NotificationItem, ActivityLog, Attachment, Subtask, Project, TaskAssignee, TodoItem } from '../types';
import { formatDate, getTaskAssignees, getTaskAssigneeIds, getTaskAssigneeNames, getTaskEmailRecipients } from '../utils';
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

export interface MailAttachment {
  name: string;
  size: number;
  content: string; // base64 string
  type: string;
}

class DBService {
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
        const member = { ...data, id: docSnap.id } as Member;
        const key = (member.email || member.uid || docSnap.id).toLowerCase().trim();

        if (!membersMap.has(key)) {
          membersMap.set(key, member);
        } else {
          // Consolidate duplicate document representing the same user account
          const existing = membersMap.get(key)!;
          const merged: Member = {
            ...existing,
            ...member,
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
            createdDate: existing.createdDate || member.createdDate,
          };
          membersMap.set(key, merged);
        }
      });
      return Array.from(membersMap.values());
    })();

    try {
      const members = await withTimeout(queryPromise, 3000, []);
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
      return tasks;
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

    const docRef = await addDoc(tasksCollection, taskPayload);
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

  async updateTask(id: string, updates: Partial<Task>, userEmail?: string, userName?: string, statusComment?: string): Promise<void> {
    console.log("[dbService] Updating task:", id);
    const start = performance.now();

    // Fetch original task to do diff checks for activity log and dependency validation
    const allTasks = await this.getTasks();
    const original = allTasks.find(t => t.id === id);
    if (!original) return;

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
      const historyItem: TaskStatusHistory = {
        status: updates.status,
        previousStatus: original.status,
        updatedBy: logUser,
        updatedByName: logUserName,
        updatedAt: new Date().toISOString(),
        comment: statusComment || (typeof updates.remarks === 'string' ? updates.remarks : '') || '',
        remarks: statusComment || (typeof updates.remarks === 'string' ? updates.remarks : '') || '',
      };

      payload.statusHistory = [...(original.statusHistory || []), historyItem];

      if (updates.status === 'uat-rejected') {
        payload.latestRejectionReason = statusComment || (typeof updates.remarks === 'string' ? updates.remarks : '') || '';
      } else {
        payload.latestRejectionReason = ''; // Clear previous rejection reason once moved to development/testing/etc.
      }
    }

    const taskDoc = doc(db, 'tasks', id);
    await updateDoc(taskDoc, payload);
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
    }

    if (updates.expectedCompletionDate && updates.expectedCompletionDate !== original.expectedCompletionDate) {
      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: logUser,
        userName: logUserName,
        action: 'Due Date Changed',
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
    }

    if (updates.description && updates.description !== original.description) {
      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: logUser,
        userName: logUserName,
        action: 'Description Updated',
        oldValue: original.description ? (original.description.slice(0, 50) + (original.description.length > 50 ? '...' : '')) : 'None',
        newValue: updates.description.slice(0, 50) + (updates.description.length > 50 ? '...' : ''),
        timestamp: new Date().toISOString()
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
        oldValue: original.remarks || 'None',
        newValue: updates.remarks,
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
        oldValue: 'Soft Deleted',
        newValue: 'Restored',
        timestamp: new Date().toISOString()
      });
    }
  }

  // --- ADD CO-ASSIGNEE / DELEGATE WORKFLOW ---
  async addCoAssignee(
    taskId: string,
    newMember: { id?: string; email?: string; name: string; avatarColor?: string; color?: string; isActive?: boolean },
    addedBy: string,
    addedByName: string
  ): Promise<Task> {
    const candidateEmail = (newMember.email || newMember.id || '').toLowerCase().trim();
    if (!candidateEmail) {
      throw new Error('Valid member email is required.');
    }

    if (newMember.isActive === false) {
      throw new Error('This member is no longer active.');
    }

    const docRef = doc(db, 'tasks', taskId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Task not found.');
    }

    const task = { id: snap.id, ...snap.data() } as Task;
    const existingAssignees = getTaskAssignees(task);
    const existingIds = getTaskAssigneeIds(task);

    // Duplicate prevention
    if (existingIds.includes(candidateEmail)) {
      throw new Error('This member is already assigned to this task.');
    }

    // Maximum assignee limit check
    if (existingAssignees.length >= MAX_ASSIGNEES) {
      throw new Error(`Maximum assignee limit reached (${MAX_ASSIGNEES} assignees).`);
    }

    const newAssigneeObj: TaskAssignee = {
      id: candidateEmail,
      name: newMember.name || candidateEmail.split('@')[0],
      color: newMember.avatarColor || newMember.color || '#6366f1'
    };

    const updatedAssignees = [...existingAssignees, newAssigneeObj];
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

    const start = performance.now();
    await updateDoc(docRef, updatePayload);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection: tasks, Operation: ADD_CO_ASSIGNEE, Time: ${(end - start).toFixed(2)}ms`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }

    // 1. Audit / Activity Log
    try {
      await this.logActivity({
        taskId,
        taskSeqId: task.taskId,
        taskTitle: task.title,
        user: addedBy,
        userName: addedByName || addedBy.split('@')[0],
        action: 'Co-Assignee Added',
        oldValue: getTaskAssigneeNames(task),
        newValue: `${newAssigneeObj.name} (Now: ${getTaskAssigneeNames({ assignees: updatedAssignees })})`,
        timestamp: new Date().toISOString()
      });
    } catch (actErr) {
      console.error("[dbService] Failed to record co-assignee activity log:", actErr);
    }

    // 2. In-App Notification (Sent ONLY to the new co-assignee, not to the delegator or existing assignees)
    try {
      await this.addNotification({
        userId: candidateEmail,
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

    // 3. Email Notification (Sent to new co-assignee with delegator CC'd)
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
          to: recipients.to.length > 0 ? recipients.to : [candidateEmail],
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
              console.log(`[dbService] Background SMTP co-assignee email sent to ${candidateEmail}`);
            } else {
              console.warn(`[dbService] Background SMTP failed for co-assignee:`, resData.error);
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
    const docRef = await addDoc(commentsCollection, comment);
    const savedComment = { ...comment, id: docRef.id };
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: comments, Operation: ADD, Execution Time: ${(end - start).toFixed(2)}ms`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comments-updated'));
    }

    // Log Activity
    await this.logActivity({
      taskId: comment.taskId,
      taskSeqId: taskSeqId || 'TASK-ID',
      taskTitle: taskTitle || 'Task',
      user: comment.userId,
      userName: comment.userName,
      action: 'Comment Added',
      oldValue: '',
      newValue: comment.content.length > 30 ? comment.content.substring(0, 30) + '...' : comment.content,
      timestamp: new Date().toISOString()
    });

    // Detect @Mentions to send notifications
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    const mentions = new Set<string>();
    while ((match = mentionRegex.exec(comment.content)) !== null) {
      mentions.add(match[2]); // match[2] is the email of the user
    }

    for (const email of Array.from(mentions)) {
      if (email.toLowerCase() !== comment.userId.toLowerCase()) {
        await this.addNotification({
          userId: email,
          title: 'Mentioned in Comment',
          message: `${comment.userName} mentioned you in task ${taskSeqId || 'details'}: "${comment.content.substring(0, 40)}"`,
          taskId: comment.taskId,
          type: 'mention',
          read: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Notify all task assignees if they are not the commenter and not already notified via mention
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
              message: `${comment.userName} commented on task ${task.taskId || 'assigned to you'}: "${comment.content.substring(0, 45)}"`,
              taskId: comment.taskId,
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

    return savedComment;
  }

  async deleteComment(id: string): Promise<void> {
    const commentDoc = doc(db, 'comments', id);
    await deleteDoc(commentDoc);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comments-updated'));
    }
  }

  async updateComment(id: string, content: string): Promise<void> {
    const commentDoc = doc(db, 'comments', id);
    await updateDoc(commentDoc, { content, edited: true });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('comments-updated'));
    }
  }

  // --- NOTIFICATIONS HUB HANDLERS ---
  subscribeNotifications(userId: string, callback: (notifications: NotificationItem[]) => void): () => void {
    try {
      const q = query(notificationsCollection, where('userId', '==', userId));
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

  async addNotification(notification: Omit<NotificationItem, 'id' | 'notificationId'>): Promise<void> {
    const notId = `not-${Date.now()}`;
    const fullNotification: NotificationItem = {
      ...notification,
      id: notId,
      notificationId: notId,
      read: notification.read !== undefined ? notification.read : false,
      isRead: notification.read !== undefined ? notification.read : false,
      timestamp: notification.timestamp || new Date().toISOString(),
      createdDate: notification.createdDate || notification.timestamp || new Date().toISOString()
    };

    const start = performance.now();
    const docRef = await addDoc(notificationsCollection, {
      userId: fullNotification.userId,
      title: fullNotification.title,
      message: fullNotification.message,
      taskId: fullNotification.taskId,
      type: fullNotification.type,
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
    const notDoc = doc(db, 'notifications', id);
    await updateDoc(notDoc, { read: true, isRead: true });
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: notifications, Operation: UPDATE (mark read), Execution Time: ${(end - start).toFixed(2)}ms`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
  }

  async deleteNotification(id: string): Promise<void> {
    const start = performance.now();
    const notDoc = doc(db, 'notifications', id);
    await deleteDoc(notDoc);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: notifications, Operation: DELETE, Execution Time: ${(end - start).toFixed(2)}ms`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    }
  }

  // --- SYSTEM WIDE ACTIVITY LOGGER ---
  async logActivity(activity: Omit<ActivityLog, 'id' | 'activityId'>): Promise<void> {
    const actId = `act-${Date.now()}`;
    const fullActivity: ActivityLog = {
      ...activity,
      id: actId,
      activityId: actId,
      previousValue: activity.previousValue || activity.oldValue || '',
      oldValue: activity.oldValue || activity.previousValue || '',
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
        previousValue: fullActivity.previousValue,
        oldValue: fullActivity.oldValue,
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
    }, 3500);

    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(usersCollection, (snapshot) => {
        const members: Member[] = [];
        snapshot.forEach((docSnap) => {
          members.push({ ...docSnap.data(), id: docSnap.id } as Member);
        });
        clearTimeout(timer);
        localCallback(members);
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
}

export const dbService = new DBService();

