'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  ChevronDown,
  LayoutDashboard,
  CheckSquare,
  ListTodo,
  FolderKanban,
  Users,
  BarChart3,
  Calendar,
  ClipboardList,
  Folder,
  Activity,
  UserCheck,
  ListChecks,
  Sun,
  Moon,
  LogOut,
  Settings,
  User
} from 'lucide-react';
import { cn } from '@/utils';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavSubItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavCategoryGroup {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavSubItem[];
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const isEmployee = user?.role === 'Member';

  // Manage collapsible category sections
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Workspace: true,
    'My Work': true,
    Workflow: true,
    Management: true
  });

  const toggleCategory = (title: string) => {
    setExpanded(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const categories: NavCategoryGroup[] = [
    {
      title: 'Workspace',
      href: '/dashboard/projects',
      icon: Folder,
      items: [
        { name: 'Projects', href: '/dashboard/projects', icon: Folder }
      ]
    },
    {
      title: 'My Work',
      icon: CheckSquare,
      items: [
        { name: 'My Tasks', href: '/dashboard/my-tasks', icon: CheckSquare },
        { name: 'To Do', href: '/dashboard/to-do', icon: ListTodo },
        { name: 'Assigned by Me', href: '/dashboard/assigned-by-me', icon: UserCheck }
      ]
    },
    {
      title: 'Workflow',
      icon: FolderKanban,
      items: [
        { name: 'Kanban Board', href: '/dashboard/kanban', icon: FolderKanban },
        { name: 'Calendar View', href: '/dashboard/calendar', icon: Calendar },
        { name: 'Change Checklist', href: '/dashboard/change-checklists', icon: ListChecks },
        ...(!isEmployee ? [
          { name: 'Team Workload', href: '/dashboard/workload', icon: Activity }
        ] : [])
      ]
    },
    ...(!isEmployee ? [
      {
        title: 'Management',
        icon: ClipboardList,
        items: [
          { name: 'All Tasks', href: '/dashboard/all-tasks', icon: ClipboardList },
          { name: 'Team Members', href: '/dashboard/team', icon: Users },
          { name: 'Reports', href: '/dashboard/reports', icon: BarChart3 }
        ]
      }
    ] : [])
  ];

  const isItemActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="mobile-drawer-root">
          {/* Backdrop Overlay */}
          <motion.div
            key="mobile-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 z-50 md:hidden backdrop-blur-xs"
          />

          {/* Sliding Navigation Panel */}
          <motion.div
            key="mobile-drawer-panel"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] md:hidden flex flex-col glass-panel bg-card/98 border-r border-card-border shadow-2xl select-none"
          >
            {/* Header: Brand & Close Button */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-card-border shrink-0">
              <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm shadow-primary/20">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm leading-tight text-foreground">Apex Tasks</span>
                  <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">Enterprise</span>
                </div>
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-accent/40 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* User Profile Mini Banner */}
            {user && (
              <div className="px-4 py-3 border-b border-card-border/60 bg-accent/15 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-xs shrink-0 text-xs"
                    style={{ backgroundColor: user.avatarColor || '#3b82f6' }}
                  >
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-foreground truncate">{user.displayName}</p>
                      <span className="text-[8px] font-extrabold uppercase px-1 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {user.role === 'SuperAdmin' ? 'SuperAdmin' : user.role}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Scrollable Navigation Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
              {/* Direct Dashboard Link */}
              <Link
                href="/dashboard"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  pathname === '/dashboard'
                    ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20 font-bold"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                )}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span>Dashboard Overview</span>
              </Link>

              {/* Grouped & Collapsible Navigation Categories */}
              {categories.map((category) => {
                const isExpanded = expanded[category.title] ?? true;
                const hasActiveChild = category.items.some(item => isItemActive(item.href));

                return (
                  <div key={category.title} className="space-y-1">
                    {/* Collapsible Header */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.title)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/70 hover:bg-accent/30 transition-colors cursor-pointer",
                        hasActiveChild && "text-primary font-black"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <category.icon className="h-3.5 w-3.5" />
                        <span>{category.title}</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </button>

                    {/* Submenu items */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden space-y-0.5 pl-2"
                        >
                          {category.items.map((item) => {
                            const active = isItemActive(item.href);
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={cn(
                                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                                  active
                                    ? "bg-primary text-primary-foreground font-bold shadow-xs shadow-primary/20"
                                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                                )}
                              >
                                <item.icon className="h-4 w-4 shrink-0" />
                                <span className="truncate">{item.name}</span>
                              </Link>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Account Shortcuts */}
              <div className="pt-2 border-t border-card-border/60 space-y-1">
                <div className="px-2.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60">
                  Account
                </div>
                <Link
                  href="/dashboard/profile"
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    pathname === '/dashboard/profile'
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  )}
                >
                  <User className="h-4 w-4 shrink-0" />
                  <span>Profile</span>
                </Link>

                {user?.role === 'SuperAdmin' && (
                  <Link
                    href="/dashboard/settings"
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                      pathname === '/dashboard/settings'
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                    )}
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    <span>Settings</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Bottom Footer: Theme Switcher & Logout */}
            <div className="p-3 border-t border-card-border shrink-0 flex items-center justify-between gap-2 bg-card/60">
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-accent/40 hover:bg-accent/70 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Sun className="h-4 w-4 hidden dark:block text-amber-400" />
                <Moon className="h-4 w-4 dark:hidden text-indigo-600" />
                <span className="capitalize">{theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  logout();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
