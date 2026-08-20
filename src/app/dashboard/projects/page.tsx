'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { dbService } from '@/services/dbService';
import { Project, Task, TaskStatus } from '@/types';
import { 
  Plus, 
  Folder, 
  Trash2, 
  X, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  AlertOctagon, 
  ChevronDown, 
  ChevronUp,
  User,
  Calendar,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { formatDate, getTaskAssignees, getTaskAssigneeNames } from '@/utils';

export default function ProjectsPage() {
  const { user, hasPermission } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribeProjects = dbService.subscribeProjects((fetched) => {
      setProjects(fetched);
      setLoading(false);
    });
    const unsubscribeTasks = dbService.subscribeTasks((fetched) => {
      setTasks(fetched);
    });
    return () => {
      unsubscribeProjects();
      unsubscribeTasks();
    };
  }, []);

  const canManage = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setActionLoading(true);
    try {
      await dbService.addProject({
        name: newProjectName.trim(),
        createdDate: new Date().toISOString(),
        createdBy: user?.email || 'system@company.com'
      });
      setNewProjectName('');
      setIsModalOpen(false);
      toast.success('Project added successfully!');
    } catch (err: any) {
      toast.error('Failed to add project');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteProject = async (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete project "${proj.name}"? Active tasks will remain but will no longer be linked to this project.`)) {
      return;
    }
    setActionLoading(true);
    try {
      await dbService.deleteProject(proj.id!);
      toast.success('Project deleted successfully!');
    } catch (err: any) {
      toast.error('Failed to delete project');
    } finally {
      setActionLoading(false);
    }
  };

  const getProjectStats = (projectName: string) => {
    const projectTasks = tasks.filter(t => t.projectName.toLowerCase() === projectName.toLowerCase());
    const total = projectTasks.length;
    const completed = projectTasks.filter(t => ['completed', 'prod-deployed', 'deployed', 'moved-to-live'].includes(t.status)).length;
    const inProgress = projectTasks.filter(t => ['in-progress', 'supplier-pending', 'code-review', 'uat-deployed', 'uat-testing', 'ready-for-production-deploy', 'development-completed', 'testing', 'uat'].includes(t.status)).length;
    const blocked = projectTasks.filter(t => ['blocked', 'uat-rejected'].includes(t.status)).length;
    const pending = total - completed - inProgress - blocked;
    
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Unique Assignees
    const assigneesMap = new Map<string, { name: string; color: string }>();
    projectTasks.forEach(t => {
      getTaskAssignees(t).forEach(a => {
        if (a.id && a.name) {
          assigneesMap.set(a.id.toLowerCase(), { name: a.name, color: a.color });
        }
      });
    });
    const assignees = Array.from(assigneesMap.values());
    
    return {
      total,
      completed,
      inProgress,
      blocked,
      pending,
      progress,
      assignees,
      tasksList: projectTasks
    };
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400 bg-red-400/10 border-red-500/20';
      case 'high': return 'text-amber-400 bg-amber-400/10 border-amber-500/20';
      case 'medium': return 'text-indigo-400 bg-indigo-400/10 border-indigo-500/20';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Projects Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor module-level progress, status breakdowns, and allocated engineers.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-all cursor-pointer shadow-lg shadow-primary/20"
          >
            <Plus className="h-5 w-5" />
            <span>Add Project</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Clock className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center border border-card-border/50 max-w-md mx-auto mt-12">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
            <Briefcase className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">No Projects Configured</h3>
          <p className="text-xs text-muted-foreground mb-6">Create a project container to organize development tasks and track progress.</p>
          {canManage && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/95 transition-all shadow-lg shadow-primary/25 cursor-pointer"
            >
              Add Your First Project
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((proj) => {
            const stats = getProjectStats(proj.name);
            const isExpanded = expandedProjectId === proj.id;
            
            return (
              <motion.div
                key={proj.id}
                layout="position"
                className={`glass-panel rounded-2xl border transition-all overflow-hidden ${
                  isExpanded ? 'border-primary/40 shadow-xl' : 'border-card-border hover:border-primary/20'
                }`}
              >
                {/* Project Brief Info Card */}
                <div 
                  onClick={() => setExpandedProjectId(isExpanded ? null : proj.id!)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Folder className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base leading-tight tracking-tight text-foreground truncate">{proj.name}</h3>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                        Created {formatDate(proj.createdDate)}
                      </p>
                    </div>
                  </div>

                  {/* Task Progress Bar */}
                  <div className="flex-1 max-w-xs space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-muted-foreground">Completion Progress</span>
                      <span className="text-foreground">{stats.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-accent/30 rounded-full overflow-hidden border border-card-border/30">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500 ease-out shadow-inner"
                        style={{ width: `${stats.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Task Stat Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{stats.completed} Done</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 text-xs font-bold">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>{stats.inProgress} Working</span>
                    </div>
                    {stats.blocked > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold">
                        <AlertOctagon className="h-3.5 w-3.5 shrink-0 animate-pulse" />
                        <span>{stats.blocked} Blocked</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground font-semibold px-2">
                      {stats.total} Tasks Total
                    </div>
                  </div>

                  {/* Team Members stack & Arrow */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                    <div className="flex -space-x-2.5 overflow-hidden">
                      {stats.assignees.slice(0, 4).map((assignee, idx) => (
                        <div
                          key={idx}
                          className="w-7 h-7 rounded-full border-2 border-background flex items-center justify-center font-extrabold text-white text-[10px] shadow-sm select-none"
                          style={{ backgroundColor: assignee.color }}
                          title={assignee.name}
                        >
                          {assignee.name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {stats.assignees.length > 4 && (
                        <div className="w-7 h-7 rounded-full border-2 border-background bg-slate-800 flex items-center justify-center font-bold text-gray-400 text-[10px] shadow-sm">
                          +{stats.assignees.length - 4}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      {canManage && (
                        <button
                          onClick={(e) => handleDeleteProject(proj, e)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          title="Delete Project"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <div className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details - Task List Table */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-card-border overflow-hidden bg-card/10"
                    >
                      <div className="p-5 overflow-x-auto">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Tasks in this Project</h4>
                        {stats.tasksList.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic py-2">No tasks created under this project container yet.</p>
                        ) : (
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-card-border/50 text-muted-foreground font-semibold">
                                <th className="pb-2.5 w-24">ID</th>
                                <th className="pb-2.5">Task Title</th>
                                <th className="pb-2.5 w-32">Module</th>
                                <th className="pb-2.5 w-28">Assignee</th>
                                <th className="pb-2.5 w-24 text-center">Priority</th>
                                <th className="pb-2.5 w-24 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stats.tasksList.map((task) => (
                                <tr key={task.id} className="border-b border-card-border/20 last:border-0 hover:bg-accent/10 transition-colors">
                                  <td className="py-3 font-semibold text-primary">{task.taskId}</td>
                                  <td className="py-3 font-semibold text-foreground">{task.title}</td>
                                  <td className="py-3 text-muted-foreground">{task.module}</td>
                                  <td className="py-3">
                                    <div className="flex items-center gap-1.5" title={getTaskAssigneeNames(task)}>
                                      <div className="flex items-center shrink-0">
                                        {getTaskAssignees(task).slice(0, 3).map((a, idx) => (
                                          <div 
                                            key={a.id || `assignee-${idx}`}
                                            className={`w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-white text-[8px] border border-card shrink-0 ${
                                              idx > 0 ? '-ml-2' : ''
                                            }`}
                                            style={{ backgroundColor: a.color || '#6366f1' }}
                                          >
                                            {a.name.charAt(0).toUpperCase()}
                                          </div>
                                        ))}
                                      </div>
                                      <span className="font-medium text-gray-300 truncate max-w-[90px]">{getTaskAssigneeNames(task)}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                                      {task.priority}
                                    </span>
                                  </td>
                                  <td className="py-3 text-center">
                                    <span className="capitalize text-gray-400 font-semibold">{task.status.replace('-', ' ')}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Project Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Modal backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm glass-panel bg-card/90 rounded-2xl p-6 shadow-2xl border border-card-border overflow-hidden backdrop-blur-lg"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4.5 right-4.5 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 cursor-pointer"
                disabled={actionLoading}
              >
                <X className="h-4.5 w-4.5" />
              </button>
              
              <h2 className="text-xl font-bold tracking-tight mb-5">Create New Project</h2>

              <form onSubmit={handleAddProject} className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Project Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background/50 outline-none text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary"
                    placeholder="e.g. Acme Website Redesign"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    disabled={actionLoading}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={actionLoading}
                    className="px-4 py-2 border border-border hover:bg-accent/40 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/95 transition-all rounded-xl text-sm shadow-md shadow-primary/20 cursor-pointer flex items-center gap-1.5"
                  >
                    {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create Project
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
