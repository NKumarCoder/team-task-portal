import React, { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, Check, Copy } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';
import MultiAssigneeSelect from '@/components/ui/MultiAssigneeSelect';
import { useAuth } from '@/hooks/useAuth';
import { dbService } from '@/services/dbService';
import { Task, TaskPriority, TaskStatus, Member, Project, Attachment, TaskAssignee } from '@/types';
import toast from 'react-hot-toast';
import { TASK_PRIORITIES } from '@/constants';
import { formatDate, getTaskAssignees, getTaskAssigneeIds, getTaskAssigneeNames } from '@/utils';

const taskFormSchema = z.object({
  projectName: z.string().min(1, 'Project Name is required'),
  title: z.string().min(1, 'Task Title is required'),
  description: z.string(),
  assigneeEmails: z.array(z.string().email('Invalid email')).min(1, 'At least one assignee is required'),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  module: z.string().min(1, 'Module is required'),
  startDate: z.string().optional().or(z.literal('')),
  expectedCompletionDate: z.string().optional().or(z.literal('')).refine((val) => {
    if (!val) return true;
    const today = new Date();
    today.setHours(0,0,0,0);
    const selected = new Date(val);
    selected.setHours(0,0,0,0);
    return selected.getTime() >= today.getTime();
  }, { message: "Completion date cannot be in the past." }),
  remarks: z.string().optional().default(''),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface CreateTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (task: Task) => void;
  taskToEdit?: Task; // If provided, runs Edit mode
}

export default function CreateTaskDialog({ isOpen, onClose, onSuccess, taskToEdit }: CreateTaskDialogProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [addingProject, setAddingProject] = useState(false);
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const isEditMode = !!taskToEdit;
  const isMemberAndEditing = isEditMode && user?.role === 'Member';

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema) as any,
    defaultValues: {
      projectName: '',
      title: '',
      description: '',
      assigneeEmails: [],
      priority: 'medium',
      module: '',
      startDate: '',
      expectedCompletionDate: '',
      remarks: '',
    }
  });

  const expectedCompletionDate = watch('expectedCompletionDate');
  const startDate = watch('startDate');

  // Calculates working days between today and expected due date (excluding Sat/Sun)
  const calculateWorkingDays = (startDateStr: string, endDateStr: string): number => {
    try {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      
      if (end.getTime() <= start.getTime()) return 0;
      
      let workingDays = 0;
      const current = new Date(start);
      
      while (current.getTime() < end.getTime()) {
        current.setDate(current.getDate() + 1);
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Sat (6) and Sun (0)
          workingDays++;
        }
      }
      return workingDays;
    } catch {
      return 0;
    }
  };

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return;
    setAddingProject(true);
    try {
      const created = await dbService.addProject({
        name: newProjectName.trim(),
        createdDate: new Date().toISOString(),
        createdBy: user?.email || 'system@company.com'
      });
      setProjects(prev => [...prev, created]);
      setValue('projectName', created.name);
      setNewProjectName('');
      setShowAddProject(false);
      toast.success('Project added successfully!');
    } catch (err: any) {
      toast.error('Failed to add project');
    } finally {
      setAddingProject(false);
    }
  };

  const calculatedHours = useMemo(() => {
    if (!expectedCompletionDate || !startDate) return 0;
    return calculateWorkingDays(startDate, expectedCompletionDate) * 8;
  }, [expectedCompletionDate, startDate]);

  // Load team members & projects
  useEffect(() => {
    async function loadData() {
      try {
        const [fetchedMembers, fetchedProjects] = await Promise.all([
          dbService.getMembers(),
          dbService.getProjects(),
        ]);
        setMembers(fetchedMembers);
        setProjects(fetchedProjects);
      } catch (error) {
        console.error('Failed to load dropdown data:', error);
      } finally {
        setLoadingMembers(false);
        setLoadingProjects(false);
      }
    }
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Handle Edit Prepopulation
  useEffect(() => {
    setCreatedTask(null);
    if (isOpen && taskToEdit) {
      // Format ISO string to YYYY-MM-DD
      const rawDate = taskToEdit.expectedCompletionDate;
      let formattedDate = '';
      if (rawDate) {
        try {
          formattedDate = new Date(rawDate).toISOString().split('T')[0];
        } catch { }
      }

      // Format start date if available
      let formattedStartDate = '';
      if (taskToEdit.startDate) {
        try {
          formattedStartDate = new Date(taskToEdit.startDate).toISOString().split('T')[0];
        } catch { }
      }

      reset({
        projectName: taskToEdit.projectName,
        title: taskToEdit.title,
        description: taskToEdit.description || '',
        assigneeEmails: getTaskAssigneeIds(taskToEdit),
        priority: taskToEdit.priority,
        module: taskToEdit.module,
        startDate: formattedStartDate,
        expectedCompletionDate: formattedDate,
        remarks: taskToEdit.remarks || '',
      });
    } else if (isOpen && !taskToEdit) {
      setSelectedFiles([]);
      reset({
        projectName: '',
        title: '',
        description: '',
        assigneeEmails: [],
        priority: 'medium',
        module: '',
        startDate: '',
        expectedCompletionDate: '',
        remarks: '',
      });
    }
  }, [isOpen, taskToEdit, reset]);

  const onSubmit = async (values: TaskFormValues) => {
    setSaving(true);
    try {
      // Resolve all assignees objects
      const assignees: TaskAssignee[] = values.assigneeEmails.map(email => {
        const matched = members.find(m => m.email.toLowerCase() === email.toLowerCase());
        return {
          id: email.toLowerCase(),
          name: matched ? matched.name : email.split('@')[0],
          color: matched?.avatarColor || '#6366f1'
        };
      });
      const assigneeIds = assignees.map(a => a.id);
      const primaryAssignee = assignees[0] || { id: '', name: 'Unassigned', color: '#6366f1' };

      if (isEditMode && taskToEdit) {
        // Record timeline history if status changed
        const statusChanged = taskToEdit.status !== 'assigned';
        const currentHistory = taskToEdit.statusHistory || [];
        const newHistory = [...currentHistory];

        if (statusChanged) {
          newHistory.push({
            status: 'assigned' as TaskStatus,
            updatedBy: user?.email || 'system@company.com',
            updatedByName: user?.displayName || 'System User',
            updatedAt: new Date().toISOString(),
            remarks: 'Status transitioned to assigned',
          });
        }

        const taskUpdates: Partial<Task> = {
          projectName: values.projectName,
          title: values.title,
          description: values.description,
          assignees,
          assigneeIds,
          // Legacy backward-compatibility fields
          assigneeId: primaryAssignee.id,
          assigneeName: primaryAssignee.name,
          assigneeColor: primaryAssignee.color,
          priority: values.priority,
          status: 'assigned' as TaskStatus,
          module: values.module,
          startDate: values.startDate ? new Date(values.startDate).toISOString() : '',
          expectedCompletionDate: values.expectedCompletionDate ? new Date(values.expectedCompletionDate).toISOString() : '',
          estimatedHours: calculatedHours,
          labels: taskToEdit.labels || [],
          remarks: values.remarks,
          statusHistory: newHistory,
        };

        await dbService.updateTask(taskToEdit.id!, taskUpdates, user?.email, user?.displayName);
        toast.success('Task updated successfully');
        onSuccess({ ...taskToEdit, ...taskUpdates, updatedDate: new Date().toISOString() });
      } else {
        // Create Mode
        const initialHistory = [
          {
            status: 'assigned' as TaskStatus,
            updatedBy: user?.email || 'system@company.com',
            updatedByName: user?.displayName || 'System User',
            updatedAt: new Date().toISOString(),
            remarks: 'Task created and allocated.'
          }
        ];

        const newTask: Omit<Task, 'id' | 'taskId' | 'isDeleted'> = {
          projectName: values.projectName,
          title: values.title,
          description: values.description,
          assignees,
          assigneeIds,
          // Legacy backward-compatibility fields
          assigneeId: primaryAssignee.id,
          assigneeName: primaryAssignee.name,
          assigneeColor: primaryAssignee.color,
          priority: values.priority,
          status: 'assigned' as TaskStatus,
          module: values.module,
          startDate: values.startDate ? new Date(values.startDate).toISOString() : '',
          expectedCompletionDate: values.expectedCompletionDate ? new Date(values.expectedCompletionDate).toISOString() : '',
          estimatedHours: calculatedHours,
          labels: [],
          remarks: values.remarks,
          createdBy: user?.email || 'nm@i2space.com',
          createdByName: user?.displayName || user?.email?.split('@')[0] || 'System User',
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString(),
          statusHistory: initialHistory,
        };

        // Convert selected files to base64 attachments
        const attachmentsData = [];
        for (const file of selectedFiles) {
          try {
            const content = await readAsBase64(file);
            attachmentsData.push({
              name: file.name,
              size: file.size,
              content: content,
              type: file.type
            });
          } catch (err) {
            console.error('Failed to read file:', file.name, err);
          }
        }

        const toastId = toast.loading('Creating task...');
        const created = await dbService.addTask(newTask, user?.email, user?.displayName, attachmentsData);
        toast.success('Task created successfully!', { id: toastId });

        setSelectedFiles([]);
        setSaving(false);
        setCreatedTask(created);
        return;
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (createdTask) {
      onSuccess(createdTask);
      setCreatedTask(null);
    }
    setSelectedFiles([]);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const readAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };



  return (
    <AnimatePresence>
      {isOpen && (
        <div key="create-task-dialog-wrapper" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            key="create-task-dialog-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            key="create-task-dialog-container"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-xl glass-panel bg-card/90 rounded-2xl p-5 shadow-2xl border border-card-border overflow-hidden backdrop-blur-lg flex flex-col max-h-[85vh]"
          >
            {createdTask ? (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-5 flex-1 select-none">
                {/* Success Sparkle Icon */}
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/10">
                  <Sparkles className="h-8 w-8 animate-pulse" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-extrabold tracking-tight text-white">Task Created Successfully!</h3>
                  <p className="text-xs text-muted-foreground">The development task is now saved in the workspace.</p>
                </div>

                {/* monospaced ticket ID card */}
                <div className="w-full max-w-sm glass-panel bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between gap-4">
                  <div className="text-left">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Ticket ID</span>
                    <code className="text-base font-black text-primary font-mono tracking-wide">{createdTask.taskId}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(createdTask.taskId);
                      toast.success('Ticket ID copied to clipboard!');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-xs font-bold text-primary transition-all border border-primary/20 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy ID</span>
                  </button>
                </div>

                {/* Task Details Card */}
                <div className="w-full max-w-sm text-left glass-panel bg-card/40 p-4 rounded-xl border border-card-border/60 text-xs space-y-2.5">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Project</span>
                    <span className="font-semibold text-foreground">{createdTask.projectName}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Title</span>
                    <span className="font-semibold text-foreground">{createdTask.title}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Assigned To</span>
                    <span className="font-semibold text-foreground">{getTaskAssigneeNames(createdTask)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-center w-full max-w-sm pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const shareText = `Ticket: ${createdTask.taskId}\nProject: ${createdTask.projectName}\nTitle: ${createdTask.title}\nAssigned To: ${getTaskAssigneeNames(createdTask)}\nDue Date: ${formatDate(createdTask.expectedCompletionDate)}\nLink: ${window.location.origin}/dashboard`;
                      navigator.clipboard.writeText(shareText);
                      toast.success('Share details copied to clipboard!');
                    }}
                    className="flex-1 py-2 rounded-xl border border-card-border hover:bg-accent/40 text-xs font-bold transition-all cursor-pointer text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copy Share Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSuccess(createdTask);
                      setCreatedTask(null);
                      onClose();
                    }}
                    className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-all text-xs shadow-md shadow-primary/25 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex justify-between items-center pb-3 border-b border-card-border mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <h2 className="text-lg font-bold tracking-tight">
                      {isEditMode ? `Edit Task: ${taskToEdit?.taskId}` : 'Create Development Task'}
                    </h2>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 cursor-pointer"
                  >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5 overflow-y-auto pr-1 flex-1">

              {/* Row 1: Project Name & Module */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Project Name *</label>
                    {user?.role === 'SuperAdmin' && (
                      <button
                        type="button"
                        onClick={() => setShowAddProject(!showAddProject)}
                        className="text-[10px] text-primary hover:underline font-bold focus:outline-none"
                      >
                        {showAddProject ? 'Cancel' : '+ New Project'}
                      </button>
                    )}
                  </div>

                  {showAddProject ? (
                    <div className="flex gap-2 animate-in fade-in zoom-in-95 duration-100">
                      <input
                        type="text"
                        className="flex-1 px-3 py-1 border border-border rounded-lg bg-background/50 text-xs outline-none focus:border-primary"
                        placeholder="Project Name..."
                        value={newProjectName}
                        onChange={e => setNewProjectName(e.target.value)}
                        disabled={addingProject}
                      />
                      <button
                        type="button"
                        onClick={handleAddProject}
                        disabled={addingProject}
                        className="px-3 py-1 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/95 transition-all"
                      >
                        {addingProject ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  ) : (
                    <select
                      disabled={loadingProjects || isMemberAndEditing}
                      className={`w-full px-3 py-1.5 border rounded-lg bg-background/50 text-xs outline-none cursor-pointer focus:border-primary ${errors.projectName ? 'border-destructive' : 'border-border'
                        }`}
                      {...register('projectName')}
                    >
                      <option value="" disabled>Select a project...</option>
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.name}>
                          {proj.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {errors.projectName && <p className="text-[9px] text-destructive font-semibold">{errors.projectName.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Module *</label>
                  <input
                    type="text"
                    disabled={saving || isMemberAndEditing}
                    className={`w-full px-3 py-1.5 border rounded-lg bg-background/50 outline-none text-xs focus:ring-2 focus:ring-primary/25 ${errors.module ? 'border-destructive' : 'border-border focus:border-primary'
                      }`}
                    placeholder="e.g. Auth Flow"
                    {...register('module')}
                  />
                  {errors.module && <p className="text-[9px] text-destructive font-semibold">{errors.module.message}</p>}
                </div>
              </div>

              {/* Row 2: Task Title */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Task Title *</label>
                <input
                  type="text"
                  disabled={saving || isMemberAndEditing}
                  className={`w-full px-3 py-1.5 border rounded-lg bg-background/50 outline-none text-xs focus:ring-2 focus:ring-primary/25 ${errors.title ? 'border-destructive' : 'border-border focus:border-primary'
                    }`}
                  placeholder="Summarize the core assignment..."
                  {...register('title')}
                />
                {errors.title && <p className="text-[9px] text-destructive font-semibold">{errors.title.message}</p>}
              </div>

              {/* Row 3: Assigned To & Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assigned To *</label>
                  <Controller
                    control={control}
                    name="assigneeEmails"
                    render={({ field }) => (
                      <MultiAssigneeSelect
                        members={members}
                        selectedEmails={field.value || []}
                        onChange={field.onChange}
                        hasError={!!errors.assigneeEmails}
                        disabled={loadingMembers || isMemberAndEditing}
                        placeholder="Select team members..."
                      />
                    )}
                  />
                  {errors.assigneeEmails && <p className="text-[9px] text-destructive font-semibold">{errors.assigneeEmails.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Priority *</label>
                  <select
                    disabled={saving || isMemberAndEditing}
                    className="w-full px-3 py-1.5 border border-border rounded-lg bg-background/50 text-xs outline-none cursor-pointer focus:border-primary"
                    {...register('priority')}
                  >
                    {TASK_PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: Start Date & Expected Completion Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Start Date</label>
                  <Controller
                    control={control}
                    name="startDate"
                    render={({ field }) => (
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        hasError={!!errors.startDate}
                        placeholder="mm/dd/yyyy"
                        align="left"
                        disabled={saving || isMemberAndEditing}
                      />
                    )}
                  />
                  {errors.startDate && <p className="text-[9px] text-destructive font-semibold">{errors.startDate.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expected Completion Date</label>
                  <Controller
                    control={control}
                    name="expectedCompletionDate"
                    render={({ field }) => (
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        hasError={!!errors.expectedCompletionDate}
                        placeholder="mm/dd/yyyy"
                        align="right"
                        disabled={saving || isMemberAndEditing}
                      />
                    )}
                  />
                  {errors.expectedCompletionDate && <p className="text-[9px] text-destructive font-semibold">{errors.expectedCompletionDate.message}</p>}
                </div>
              </div>

              {/* Estimated Effort Display */}
              {!errors.expectedCompletionDate && !errors.startDate && (
                <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/15 rounded-lg">
                  <div>
                    <span className="text-[11px] font-semibold text-foreground/90 block">Estimated Effort</span>
                    <span className="text-[10px] text-muted-foreground">Calculated automatically</span>
                  </div>
                  <span className="text-xs font-bold text-primary font-mono bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                    {calculatedHours} Hours
                  </span>
                </div>
              )}

              {/* Row 5: Description (Optional) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                <textarea
                  rows={3}
                  disabled={isMemberAndEditing}
                  className="w-full px-3 py-1.5 border border-border rounded-lg bg-background/50 outline-none text-xs focus:ring-2 focus:ring-primary/25 resize-y font-medium text-foreground min-h-[70px] disabled:opacity-75 disabled:cursor-not-allowed"
                  placeholder="Explain details, expectations, or requirements..."
                  {...register('description')}
                />
              </div>

              {/* Attachments Section (Only for task creation/email) */}
              {!isEditMode && (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Attachments
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Optional · Logs, text files, PDFs, images
                      </span>
                    </div>
                    <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent/60 hover:bg-accent text-[11px] font-semibold text-primary border border-border/80 transition-colors cursor-pointer select-none">
                      <span>+ Add File(s)</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={saving}
                      />
                    </label>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="space-y-1 max-h-[100px] overflow-y-auto bg-slate-950/40 p-2 rounded-lg border border-border mt-1">
                      {selectedFiles.map((file, idx) => {
                        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                        return (
                          <div key={idx} className="flex items-center justify-between px-2 py-1 rounded-md bg-background/60 border border-border/50 text-xs">
                            <span className="truncate flex-1 text-[11px] font-medium pr-2 text-foreground" title={file.name}>
                              📎 {file.name} <span className="text-[10px] text-muted-foreground">({sizeMB} MB)</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSelectedFile(idx)}
                              className="text-destructive hover:text-destructive/80 transition-colors cursor-pointer p-0.5"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Submit panel */}
              <div className="flex gap-2.5 justify-end pt-2.5 border-t border-card-border mt-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-1.5 border border-border hover:bg-accent/40 rounded-lg text-xs font-semibold transition-all cursor-pointer text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-all rounded-lg text-xs shadow-lg shadow-primary/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      {isEditMode ? 'Save Changes' : 'Create Task'}
                    </>
                  )}
                </button>
              </div>

            </form>
            </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
