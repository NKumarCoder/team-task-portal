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
  UserCheck,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { cn } from '@/utils';
import { useNavigationLayout } from './NavigationLayoutContext';

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
  const { isSidebarCollapsed, toggleSidebarCollapsed } = useNavigationLayout();

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
          { name: 'Change Checklist', href: '/dashboard/change-checklists', icon: ListChecks },
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
    <aside
      className={cn(
        "h-screen glass-panel flex flex-col justify-between border-r border-card-border select-none transition-all duration-300 ease-in-out overflow-x-hidden",
        isSidebarCollapsed ? "w-16 p-2" : "w-64 p-3",
        className
      )}
    >
      {/* Top Section: Logo & Collapse / Expand Controls */}
      <div className={cn(
        "shrink-0 mb-1 transition-all duration-300",
        isSidebarCollapsed ? "flex flex-col items-center gap-1 px-1 py-1.5" : "flex items-center justify-between px-2 py-1.5"
      )}>
        <Link
          href="/dashboard"
          onClick={onClose}
          className={cn(
            "flex items-center gap-2.5 group cursor-pointer min-w-0",
            isSidebarCollapsed && "justify-center"
          )}
          title="Apex Tasks Enterprise"
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm shadow-primary/20 shrink-0 group-hover:scale-105 transition-transform duration-150">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm leading-tight tracking-tight text-foreground truncate">Apex Tasks</span>
              <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider truncate">Enterprise</span>
            </div>
          )}
        </Link>

        {/* Sidebar Collapse / Expand Toggle Button */}
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          className={cn(
            "p-1.5 rounded-lg hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
            isSidebarCollapsed ? "mt-1" : "ml-auto"
          )}
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation Links with Section Groups */}
      <nav className={cn(
        "flex-1 overflow-y-auto custom-scrollbar transition-all duration-300",
        isSidebarCollapsed ? "space-y-2 px-0 py-1.5" : "space-y-2.5 px-0.5 py-1"
      )}>
        {navGroups.map((group, groupIdx) => (
          <div key={group.title || groupIdx} className="space-y-0.5">
            {group.title && (
              isSidebarCollapsed ? (
                <div className="h-px bg-card-border/40 my-1 mx-1.5" />
              ) : (
                <div className="px-2.5 pb-0.5 text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground/60 select-none truncate">
                  {group.title}
                </div>
              )
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    title={isSidebarCollapsed ? item.name : undefined}
                    className={cn(
                      "rounded-lg text-xs font-semibold transition-all group duration-150 cursor-pointer relative",
                      isSidebarCollapsed
                        ? "flex items-center justify-center w-full p-2"
                        : "flex items-center gap-2.5 px-3 py-1.5",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 font-bold"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 transition-transform duration-150 group-hover:scale-105 shrink-0",
                      isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )} />

                    {!isSidebarCollapsed && (
                      <span className="truncate">{item.name}</span>
                    )}

                    {/* Hover Floating Tooltip in Collapsed Rail Mode */}
                    {isSidebarCollapsed && (
                      <div className="absolute left-full ml-2.5 px-2.5 py-1 rounded-md bg-popover text-popover-foreground text-xs shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-card-border font-medium">
                        {item.name}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Indicator */}
      <div className={cn(
        "border-t border-card-border/40 shrink-0 text-muted-foreground/70 transition-all duration-300",
        isSidebarCollapsed ? "pt-2 px-1 flex flex-col items-center justify-center text-[9px]" : "pt-2 px-2 flex items-center justify-between text-[10px]"
      )}>
        {!isSidebarCollapsed ? (
          <>
            <span className="font-medium truncate">Apex Tasks v2.4</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/40 text-muted-foreground font-semibold">Online</span>
          </>
        ) : (
          <div
            className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse cursor-help"
            title="Apex Tasks v2.4 (Online)"
          />
        )}
      </div>
    </aside>
  );
}
