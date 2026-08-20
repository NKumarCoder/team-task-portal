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
  collection
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
  projectsCollection
} from '../firebase/firestore';
import { Task, Member, PortalSettings, MonthlyReport, TaskStatus, Comment, NotificationItem, ActivityLog, Attachment, Subtask, Project } from '../types';
import { formatDate } from '../utils';

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
      const members: Member[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        members.push({ id: docSnap.id, ...data } as Member);
      });
      return members;
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
    
    const docRef = await addDoc(usersCollection, member);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Member added in users collection (Execution Time: ${(end - start).toFixed(2)}ms)`);
    return { id: docRef.id, ...member };
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
        tasks.push({ id: docSnap.id, ...docSnap.data() } as Task);
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

    // Notify assignee
    if (task.assigneeId) {
      await this.addNotification({
        userId: task.assigneeId,
        title: 'New Task Assigned',
        message: `${userName || 'A Team Lead'} assigned task ${savedTask.taskId}: "${task.title}" to you.`,
        taskId: savedTask.id || '',
        type: 'assignment',
        read: false,
        timestamp: new Date().toISOString()
      });
    }

    // Trigger Email Notification in the background (sent to assignee, CC to assigner/creator)
    try {
      const assigneeEmail = task.assigneeId.toLowerCase();
      const assignerEmail = (userEmail || task.createdBy).toLowerCase();
      
      const mailPayload: any = {
        to: assigneeEmail,
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

      // CC to the creator/assigner if they are not the same person as the assignee
      if (assignerEmail && assignerEmail !== assigneeEmail) {
        mailPayload.cc = assignerEmail;
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

  async updateTask(id: string, updates: Partial<Task>, userEmail?: string, userName?: string): Promise<void> {
    console.log("[dbService] Updating task:", id);
    const start = performance.now();

    // Fetch original task to do diff checks for activity log and dependency validation
    const allTasks = await this.getTasks();
    const original = allTasks.find(t => t.id === id);
    if (!original) return;

    // Check Dependency Block when marking completed
    if (updates.status === 'completed' || updates.status === 'moved-to-live' || updates.status === 'deployed') {
      const blockedBy = await this.checkDependencyBlocked(original);
      if (blockedBy) {
        throw new Error(`Cannot complete task. Blocked by incomplete prerequisite task ${blockedBy}.`);
      }
    }

    const payload = {
      ...updates,
      updatedDate: new Date().toISOString()
    };
    delete (payload as any).taskId;

    const taskDoc = doc(db, 'tasks', id);
    await updateDoc(taskDoc, payload);
    const end = performance.now();
    console.log(`[dbService] [Firestore] Collection Name: tasks, Operation: UPDATE, Execution Time: ${(end - start).toFixed(2)}ms`);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('task-updated'));
    }

    // DIFF CHECKS FOR ACTIVITY LOGS
    const logUser = userEmail || 'system@company.com';
    const logUserName = userName || 'System';

    if (updates.status && updates.status !== original.status) {
      let actionLabel = 'Status Changed';
      if (updates.status === 'completed') actionLabel = 'Task Completed';
      else if (updates.status === 'moved-to-live') actionLabel = 'Moved to Live';
      else if (updates.status === 'deployed') actionLabel = 'Deployment Completed';
      else if (updates.status === 'testing') actionLabel = 'Testing Started';
      else if (updates.status === 'code-review') actionLabel = 'Code Review Started';

      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: logUser,
        userName: logUserName,
        action: actionLabel,
        oldValue: original.status.replace('-', ' '),
        newValue: updates.status.replace('-', ' '),
        timestamp: new Date().toISOString()
      });

      // Notification on status changes
      if (original.assigneeId && original.assigneeId.toLowerCase() !== logUser.toLowerCase()) {
        await this.addNotification({
          userId: original.assigneeId,
          title: 'Status Changed',
          message: `${logUserName} changed status of task ${original.taskId} to "${updates.status.replace('-', ' ')}".`,
          taskId: id,
          type: 'status-change',
          read: false,
          timestamp: new Date().toISOString()
        });
      }

      // Trigger Email Notification in the background on status change (sent to assignee, CC to updater/creator)
      try {
        const assigneeEmail = (original.assigneeId || '').toLowerCase();
        const updaterOrCreatorEmail = (userEmail || original.createdBy || '').toLowerCase();

        if (assigneeEmail) {
          const updaterName = userName || (userEmail ? userEmail.split('@')[0] : 'Team Member');
          const assigneeDisplayName = original.assigneeName || original.assigneeId || 'Team Member';
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
              case 'completed':
              case 'moved-to-live':
              case 'deployed':
              case 'development-completed':
                return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
              case 'in-progress':
              case 'testing':
              case 'code-review':
                return { bg: isNew ? '#e0e7ff' : '#f1f5f9', color: isNew ? '#4338ca' : '#475569', border: isNew ? '#c7d2fe' : '#cbd5e1' };
              case 'supplier-pending':
              case 'uat':
                return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
              case 'blocked':
              case 'cancelled':
                return { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
              case 'on-hold':
              case 'assigned':
              default:
                return { bg: isNew ? '#eff6ff' : '#f1f5f9', color: isNew ? '#1d4ed8' : '#475569', border: isNew ? '#bfdbfe' : '#cbd5e1' };
            }
          };

          const prevStatusFormatted = formatStatusLabel(original.status);
          const newStatusFormatted = formatStatusLabel(updates.status);
          const prevBadge = getStatusBadgeStyle(original.status, false);
          const newBadge = getStatusBadgeStyle(updates.status, true);

          const descriptionHtml = original.description && original.description.trim() ? `
            <tr>
              <td style="padding: 0 24px 14px 24px;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">Description</div>
                <div style="background-color: #f8fafc; border-left: 3px solid #6366f1; padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 13px; color: #334155; line-height: 1.5; white-space: pre-wrap;">${original.description.trim()}</div>
              </td>
            </tr>
          ` : '';

          const currentRemarks = (updates.remarks !== undefined ? updates.remarks : (original.remarks || '')).trim();
          const hasRemarks = currentRemarks && currentRemarks.toLowerCase() !== 'no remarks' && currentRemarks.toLowerCase() !== 'none';
          const remarksHtml = hasRemarks ? `
            <tr>
              <td style="padding: 0 24px 16px 24px;">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">Remarks</div>
                <div style="background-color: #fffbeb; border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 13px; color: #92400e; line-height: 1.5; white-space: pre-wrap;">${currentRemarks}</div>
              </td>
            </tr>
          ` : '';

          const mailPayload: any = {
            to: assigneeEmail,
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
                          <td style="height: 4px; background-color: #4f46e5;"></td>
                        </tr>

                        <!-- Top Brand Header -->
                        <tr>
                          <td style="padding: 16px 24px 12px 24px; border-bottom: 1px solid #f1f5f9;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                              <tr>
                                <td align="left">
                                  <span style="font-size: 14px; font-weight: 700; color: #0f172a; letter-spacing: -0.2px;">Team Task Portal</span>
                                </td>
                                <td align="right">
                                  <span style="display: inline-block; font-size: 10px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.8px; background-color: #eef2ff; padding: 4px 10px; border-radius: 20px; border: 1px solid #e0e7ff;">Task Update</span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Main Title & Task Identifier -->
                        <tr>
                          <td style="padding: 18px 24px 12px 24px;">
                            <h1 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.3;">Task Status Updated</h1>
                            <div style="font-size: 13px; color: #475569; font-weight: 500; line-height: 1.4;">
                              <span style="font-family: monospace; font-weight: 700; color: #4f46e5;">${original.taskId}</span> · ${original.title}
                            </div>
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

                        <!-- Task Details (Compact 2-Column Grid) -->
                        <tr>
                          <td style="padding: 0 24px 14px 24px;">
                            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">Task Details</div>
                            
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; font-size: 12px;">
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
                                <td style="padding: 6px 10px 6px 0; border-bottom: 1px solid #f1f5f9; width: 50%; vertical-align: top;">
                                  <span style="display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Assignee</span>
                                  <span style="font-weight: 600; color: #0f172a; font-size: 13px;">${assigneeDisplayName}</span>
                                </td>
                                <td style="padding: 6px 0 6px 10px; border-bottom: 1px solid #f1f5f9; width: 50%; vertical-align: top;">
                                  <span style="display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Due Date</span>
                                  <span style="font-weight: 500; color: #0f172a; font-size: 13px;">${dueDateFormatted}</span>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 10px 6px 0; width: 50%; vertical-align: top;">
                                  <span style="display: block; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Created By</span>
                                  <span style="font-weight: 500; color: #0f172a; font-size: 13px;">${createdByNameFormatted}</span>
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

                        <!-- Remarks (if provided) -->
                        ${remarksHtml}

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

          // CC to the updater/creator if different from assignee
          if (updaterOrCreatorEmail && updaterOrCreatorEmail !== assigneeEmail) {
            mailPayload.cc = updaterOrCreatorEmail;
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

    if (updates.assigneeId && updates.assigneeId.toLowerCase() !== original.assigneeId.toLowerCase()) {
      await this.logActivity({
        taskId: id,
        taskSeqId: original.taskId,
        taskTitle: original.title,
        user: logUser,
        userName: logUserName,
        action: 'Assigned User Changed',
        oldValue: original.assigneeName || 'None',
        newValue: updates.assigneeName || 'None',
        timestamp: new Date().toISOString()
      });

      // Notify reassigned assignee
      await this.addNotification({
        userId: updates.assigneeId,
        title: 'Task Reassigned',
        message: `${logUserName} reassigned task ${original.taskId} to you.`,
        taskId: id,
        type: 'reassignment',
        read: false,
        timestamp: new Date().toISOString()
      });
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

      if (original.assigneeId && original.assigneeId.toLowerCase() !== logUser.toLowerCase()) {
        await this.addNotification({
          userId: original.assigneeId,
          title: 'Priority Changed',
          message: `${logUserName} updated priority of task ${original.taskId} to "${updates.priority.toUpperCase()}".`,
          taskId: id,
          type: 'priority-change',
          read: false,
          timestamp: new Date().toISOString()
        });
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

      if (original.assigneeId && original.assigneeId.toLowerCase() !== logUser.toLowerCase()) {
        await this.addNotification({
          userId: original.assigneeId,
          title: 'Due Date Updated',
          message: `${logUserName} updated due date of task ${original.taskId} to ${formatDate(updates.expectedCompletionDate)}.`,
          taskId: id,
          type: 'due-date',
          read: false,
          timestamp: new Date().toISOString()
        });
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
          list.push({ id: docSnap.id, ...docSnap.data() } as Comment);
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
          list.push({ id: docSnap.id, ...docSnap.data() } as Comment);
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
    const savedComment = { id: docRef.id, ...comment };
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

    // Notify task assignee if it's someone else and they weren't already notified via mention
    try {
      const tasks = await this.getTasks();
      const task = tasks.find(t => t.id === comment.taskId);
      if (task && task.assigneeId && task.assigneeId.toLowerCase() !== comment.userId.toLowerCase() && !mentions.has(task.assigneeId)) {
        await this.addNotification({
          userId: task.assigneeId,
          title: 'Comment Added',
          message: `${comment.userName} commented on task ${task.taskId || 'assigned to you'}: "${comment.content.substring(0, 45)}"`,
          taskId: comment.taskId,
          type: 'comment-added',
          read: false,
          timestamp: new Date().toISOString()
        });
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
          list.push({ id: docSnap.id, ...docSnap.data() } as NotificationItem);
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
          list.push({ id: docSnap.id, ...docSnap.data() } as ActivityLog);
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
        reports.push({ id: docSnap.id, ...docSnap.data() } as MonthlyReport);
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
          tasks.push({ id: docSnap.id, ...docSnap.data() } as Task);
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
          members.push({ id: docSnap.id, ...docSnap.data() } as Member);
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
        projects.push({ id: docSnap.id, ...docSnap.data() } as Project);
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
          projects.push({ id: docSnap.id, ...docSnap.data() } as Project);
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
}

export const dbService = new DBService();
