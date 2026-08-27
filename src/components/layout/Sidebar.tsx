'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { 
  LayoutDashboard, 
  CheckSquare, 
  ListTodo,
  FolderKanban, 
  Users, 
  BarChart3, 
  Sparkles,
  Calendar,
  ClipboardList,
  Folder,
  Activity,
  UserCheck
} from 'lucide-react';
import { cn } from '@/utils';

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

export default function Sidebar({ className, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const getNavGroups = (): NavGroup[] => {
    if (!user) return [];
    const isEmployee = user.role === 'Member';

    const groups: NavGroup[] = [
      {
        title: 'Workspace',
        items: [
          { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
          { name: 'Projects', href: '/dashboard/projects', icon: Folder },
        ]
      },
      {
        title: 'My Work',
        items: [
          { name: 'My Tasks', href: '/dashboard/my-tasks', icon: CheckSquare },
          { name: 'To Do', href: '/dashboard/to-do', icon: ListTodo },
          { name: 'Assigned by Me', href: '/dashboard/assigned-by-me', icon: UserCheck },
        ]
      },
      {
        title: 'Workflow',
        items: [
          { name: 'Kanban Board', href: '/dashboard/kanban', icon: FolderKanban },
          { name: 'Calendar View', href: '/dashboard/calendar', icon: Calendar },
          ...(!isEmployee ? [
            { name: 'Team Workload', href: '/dashboard/workload', icon: Activity },
          ] : [])
        ]
      }
    ];

    if (!isEmployee) {
      groups.push({
        title: 'Management',
        items: [
          { name: 'All Tasks', href: '/dashboard/all-tasks', icon: ClipboardList },
          { name: 'Team Members', href: '/dashboard/team', icon: Users },
          { name: 'Reports', href: '/dashboard/reports', icon: BarChart3 },
        ]
      });
    }

    return groups;
  };

  const navGroups = getNavGroups();

  return (
    <aside className={cn(
      "w-64 h-screen glass-panel flex flex-col justify-between border-r border-card-border p-4 select-none",
      className
    )}>
      {/* Top Brand Logo */}
      <div className="flex items-center gap-3 px-3 py-3 mb-2 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base leading-tight tracking-tight">Apex Tasks</span>
          <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Enterprise</span>
        </div>
      </div>

      {/* Navigation Links with Section Groups */}
      <nav className="flex-1 overflow-y-auto space-y-4 px-1 py-2 custom-scrollbar">
        {navGroups.map((group, groupIdx) => (
          <div key={group.title || groupIdx} className="space-y-1">
            {group.title && (
              <div className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 select-none">
                {group.title}
              </div>
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group duration-200 cursor-pointer",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 font-bold" 
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 transition-transform duration-200 group-hover:scale-105 shrink-0",
                      isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Subtle footer indicator without account clutter */}
      <div className="border-t border-card-border/40 pt-3 px-3 shrink-0 flex items-center justify-between text-[11px] text-muted-foreground/70">
        <span className="font-medium">Apex Tasks v2.4</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/40 text-muted-foreground font-semibold">Online</span>
      </div>
    </aside>
  );
}
