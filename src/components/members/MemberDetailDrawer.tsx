'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Mail, 
  Shield, 
  Activity, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Calendar,
  Layers,
  TrendingUp,
  Award,
  AlertCircle
} from 'lucide-react';
import { Member, Task, TaskStatus, TaskPriority, UserRole } from '@/types';
import { formatDate } from '@/utils';
import StatusBadge from '../tasks/StatusBadge';
import PriorityBadge from '../tasks/PriorityBadge';

interface MemberDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  tasks: Task[];
}

export default function MemberDetailDrawer({ isOpen, onClose, member, tasks }: MemberDetailDrawerProps) {
  if (!member) return null;

  // Filter tasks assigned to this member
  const memberTasks = useMemo(() => {
    return tasks.filter(t => t.assigneeId.toLowerCase() === member.email.toLowerCase());
  }, [tasks, member]);

  // Compute Task Categories
  const activeTasks = useMemo(() => {
    return memberTasks.filter(t => t.status !== 'completed' && t.status !== 'moved-to-live' && t.status !== 'cancelled');
  }, [memberTasks]);

  const completedTasks = useMemo(() => {
    return memberTasks.filter(t => t.status === 'completed' || t.status === 'moved-to-live');
  }, [memberTasks]);

  const today = new Date();
  today.setHours(0,0,0,0);

  const overdueTasks = useMemo(() => {
    return activeTasks.filter(t => {
      const d = new Date(t.expectedCompletionDate);
      d.setHours(0,0,0,0);
      return d.getTime() < today.getTime();
    });
  }, [activeTasks]);

  const upcomingTasks = useMemo(() => {
    return activeTasks.filter(t => {
      const d = new Date(t.expectedCompletionDate);
      d.setHours(0,0,0,0);
      return d.getTime() >= today.getTime();
    });
  }, [activeTasks]);

  // Workload Points calculation: Critical (5), High (3), Medium (2), Low (1)
  const workloadData = useMemo(() => {
    const points = activeTasks.reduce((acc, task) => {
      const w = task.priority === 'critical' ? 5 
              : task.priority === 'high' ? 3 
              : task.priority === 'medium' ? 2 
              : 1;
      return acc + w;
    }, 0);

    let status: 'Light' | 'Medium' | 'Busy' | 'Overloaded' = 'Light';
    let badgeColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    let progressColor = 'bg-emerald-500';

    if (points >= 3 && points <= 6) {
      status = 'Medium';
      badgeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      progressColor = 'bg-amber-500';
    } else if (points >= 7 && points <= 10) {
      status = 'Busy';
      badgeColor = 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      progressColor = 'bg-orange-500';
    } else if (points > 10) {
      status = 'Overloaded';
      badgeColor = 'bg-red-500/10 text-red-500 border-red-500/20';
      progressColor = 'bg-red-500';
    }

    const percentage = Math.min(100, Math.round((points / 15) * 100));

    return { points, status, percentage, badgeColor, progressColor };
  }, [activeTasks]);

  // Completion Rate
  const completionPercentage = useMemo(() => {
    if (memberTasks.length === 0) return 0;
    return Math.round((completedTasks.length / memberTasks.length) * 100);
  }, [memberTasks, completedTasks]);

  // Average Completion Time Calculation
  const avgCompletionTimeText = useMemo(() => {
    const times = completedTasks.map(t => {
      const created = new Date(t.createdDate).getTime();
      const completedHistory = t.statusHistory?.find(h => h.status === 'completed' || h.status === 'moved-to-live');
      const completed = completedHistory ? new Date(completedHistory.updatedAt).getTime() : new Date(t.updatedDate).getTime();
      return Math.max(0, completed - created);
    });

    if (times.length === 0) return 'No items completed';
    
    const avgMs = times.reduce((acc, t) => acc + t, 0) / times.length;
    const avgHrs = avgMs / (1000 * 60 * 60);
    if (avgHrs < 24) {
      return `${avgHrs.toFixed(1)} Hours`;
    }
    const avgDays = avgHrs / 24;
    return `${avgDays.toFixed(1)} Days`;
  }, [completedTasks]);

  // Status Distribution
  const statusDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    memberTasks.forEach(t => {
      dist[t.status] = (dist[t.status] || 0) + 1;
    });
    return Object.entries(dist).map(([status, val]) => ({ status, count: val }));
  }, [memberTasks]);

  // Unified status history timeline
  const combinedTimeline = useMemo(() => {
    const events: { taskTitle: string; taskId: string; status: TaskStatus; user: string; time: string; remarks?: string }[] = [];
    memberTasks.forEach(task => {
      if (task.statusHistory) {
        task.statusHistory.forEach(h => {
          events.push({
            taskTitle: task.title,
            taskId: task.taskId,
            status: h.status,
            user: h.updatedByName,
            time: h.updatedAt,
            remarks: h.remarks
          });
        });
      }
    });
    // Sort descending by time
    return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);
  }, [memberTasks]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-40 overflow-hidden select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black"
          />

          {/* Sliding Drawer */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-screen max-w-lg glass-panel bg-card/95 border-l border-card-border p-6 shadow-2xl flex flex-col h-full overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-card-border mb-5">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg shadow-inner"
                    style={{ backgroundColor: member.avatarColor }}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground">{member.name}</h2>
                    <span className="text-xs text-muted-foreground capitalize bg-accent/60 px-1.5 py-0.5 rounded font-medium mt-0.5 inline-block">
                      {member.role}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Scrollable Contents */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                
                {/* Employee Contact Info */}
                <div className="space-y-2.5 text-xs font-semibold text-muted-foreground bg-accent/15 p-4 rounded-2xl border border-card-border">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground/80 shrink-0" />
                    <span>{member.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-muted-foreground/80 shrink-0" />
                    <span>Average Completion: <strong className="text-foreground">{avgCompletionTimeText}</strong></span>
                  </div>
                </div>

                {/* Workload Indicator Section */}
                <div className="glass-panel p-4.5 rounded-2xl border border-card-border space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold uppercase text-muted-foreground tracking-wide">Workload Capacity</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${workloadData.badgeColor}`}>
                      {workloadData.status} ({workloadData.points} pts)
                    </span>
                  </div>

                  {/* Workload and completion dual metrics */}
                  <div className="space-y-3 pt-1">
                    {/* Workload percentage */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-muted-foreground">Workload Index</span>
                        <span className="text-foreground">{workloadData.percentage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-accent/40 rounded-full overflow-hidden">
                        <div className={`h-full ${workloadData.progressColor} rounded-full`} style={{ width: `${workloadData.percentage}%` }} />
                      </div>
                    </div>

                    {/* Completion rate */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-muted-foreground">Task Completion Rate</span>
                        <span className="text-foreground">{completionPercentage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-accent/40 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${completionPercentage}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Distribution Summary */}
                {memberTasks.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      Status Distribution ({memberTasks.length} tasks total)
                    </span>
                    <div className="space-y-2 bg-accent/10 p-4 rounded-2xl border border-card-border">
                      {statusDistribution.map(item => (
                        <div key={item.status} className="flex justify-between items-center text-xs font-semibold">
                          <span className="capitalize text-muted-foreground">{item.status.replace('-', ' ')}</span>
                          <span className="text-foreground bg-accent/60 px-2 py-0.5 rounded">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Tasks Grid Section */}
                <div className="space-y-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-blue-500" />
                    Active Tasks ({activeTasks.length})
                  </span>
                  
                  {activeTasks.length > 0 ? (
                    <div className="space-y-3">
                      {activeTasks.map(task => (
                        <div key={task.id} className="p-3 bg-accent/15 rounded-xl border border-card-border flex flex-col justify-between gap-2.5">
                          <div>
                            <div className="flex justify-between items-center gap-2 mb-1.5">
                              <span className="text-[9px] font-bold text-muted-foreground font-mono">{task.taskId}</span>
                              <span className="text-[9px] font-bold text-primary uppercase bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 truncate max-w-[120px]">
                                {task.projectName}
                              </span>
                            </div>
                            <h4 className="font-extrabold text-xs text-foreground line-clamp-1 leading-snug">{task.title}</h4>
                          </div>

                          <div className="flex justify-between items-center pt-1.5 border-t border-border/30">
                            <StatusBadge status={task.status} className="text-[8px]" />
                            <span className="text-[9px] text-muted-foreground font-medium">
                              Due: {formatDate(task.expectedCompletionDate)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic pl-1">No active items.</p>
                  )}
                </div>

                {/* Completed Tasks Section */}
                <div className="space-y-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    Completed Tasks ({completedTasks.length})
                  </span>

                  {completedTasks.length > 0 ? (
                    <div className="space-y-2.5">
                      {completedTasks.slice(0, 5).map(task => (
                        <div key={task.id} className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex justify-between items-center text-xs">
                          <div className="truncate max-w-[260px]">
                            <span className="font-bold font-mono text-[9px] text-muted-foreground mr-2">{task.taskId}</span>
                            <span className="font-extrabold line-clamp-1 text-foreground inline">{task.title}</span>
                          </div>
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Completed</span>
                        </div>
                      ))}
                      {completedTasks.length > 5 && (
                        <p className="text-[10px] text-muted-foreground text-center italic">Showed last 5 completed items</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic pl-1">No completed items.</p>
                  )}
                </div>

                {/* Overdue Items Section */}
                {overdueTasks.length > 0 && (
                  <div className="space-y-3">
                    <span className="text-[10px] uppercase font-bold text-destructive tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      Overdue Items ({overdueTasks.length})
                    </span>
                    <div className="space-y-2">
                      {overdueTasks.map(task => (
                        <div key={task.id} className="p-2.5 bg-red-500/5 border border-red-500/10 rounded-xl flex justify-between items-center text-xs">
                          <span className="font-mono text-[9px] font-bold text-red-500 mr-2 shrink-0">{task.taskId}</span>
                          <span className="font-extrabold line-clamp-1 text-foreground flex-1">{task.title}</span>
                          <span className="text-[9px] text-red-500 font-bold shrink-0 pl-2">Due {formatDate(task.expectedCompletionDate)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline History */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Task Update History Timeline
                  </span>

                  {combinedTimeline.length > 0 ? (
                    <div className="relative border-l border-border/80 ml-2 pl-4 space-y-4">
                      {combinedTimeline.map((history, idx) => (
                        <div key={idx} className="relative text-xs">
                          <span className="absolute -left-[20px] top-1 w-2 h-2 rounded-full bg-primary border border-background" />
                          <div>
                            <p className="font-semibold text-foreground">
                              {history.user} updated status to <span className="font-bold capitalize">{history.status.replace('-', ' ')}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium leading-relaxed">
                              On <span className="font-semibold text-foreground">{history.taskTitle}</span> ({history.taskId}) • {formatDate(history.time)}
                            </p>
                            {history.remarks && (
                              <p className="text-[9px] text-muted-foreground/80 italic mt-0.5">"{history.remarks}"</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic pl-1">No timeline logs.</p>
                  )}
                </div>

              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
