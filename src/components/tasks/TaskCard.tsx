'use client';

import React from 'react';
import { Task } from '@/types';
import PriorityBadge from './PriorityBadge';
import StatusBadge from './StatusBadge';
import { Calendar, User, Clock, ChevronRight } from 'lucide-react';
import { formatDate } from '@/utils';
import { motion } from 'framer-motion';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="glass-panel p-5 rounded-2xl flex flex-col justify-between hover:border-primary/30 transition-all cursor-pointer group select-none relative overflow-hidden"
    >
      {/* Visual top indicator colored by priority */}
      <div 
        className={`absolute top-0 left-0 right-0 h-1 opacity-70 group-hover:opacity-100 transition-opacity ${
          task.priority === 'critical' ? 'bg-red-500' :
          task.priority === 'high' ? 'bg-orange-500' :
          task.priority === 'medium' ? 'bg-blue-500' : 'bg-zinc-500'
        }`}
      />

      <div>
        {/* Top meta rows */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[10px] font-bold text-muted-foreground font-mono">{task.taskId}</span>
          <span className="text-[10px] font-bold text-primary truncate max-w-[120px] uppercase tracking-wide bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
            {task.projectName}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-extrabold text-base leading-snug tracking-tight text-foreground line-clamp-1 mb-1.5 group-hover:text-primary transition-colors">
          {task.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-4">
          {task.description}
        </p>

        {/* Badges Row */}
        <div className="flex flex-wrap gap-2 mb-5">
          <PriorityBadge priority={task.priority} showIcon={false} />
          <StatusBadge status={task.status} />
        </div>
      </div>

      {/* Card Footer */}
      <div className="border-t border-border/40 pt-4 flex items-center justify-between text-xs mt-auto">
        {/* Due date */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground/80" />
          <span>Due:</span>
          <span className="font-bold text-foreground">{formatDate(task.expectedCompletionDate)}</span>
        </div>

        {/* Assignee Avatar */}
        <div className="flex items-center gap-1.5">
          <div 
            className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[10px] shadow-inner"
            style={{ backgroundColor: task.assigneeColor }}
            title={task.assigneeName}
          >
            {task.assigneeName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
