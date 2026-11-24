'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
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
  ChevronDown
} from 'lucide-react';
import { cn } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface NavSubItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

export interface NavCategoryItem {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavSubItem[];
}

export default function HorizontalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const isEmployee = user?.role === 'Member';

  // Navigation structure adhering strictly to specified categories and codebase routes
  const categories: NavCategoryItem[] = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      items: [
        {
          name: 'Dashboard Overview',
          href: '/dashboard',
          icon: LayoutDashboard,
          description: 'Live KPIs, task distributions, and priority summary'
        }
      ]
    },
    {
      title: 'Workspace',
      href: '/dashboard/projects',
      icon: Folder,
      items: [
        {
          name: 'Projects',
          href: '/dashboard/projects',
          icon: Folder,
          description: 'Project modules, team members, and milestones'
        }
      ]
    },
    {
      title: 'My Work',
      icon: CheckSquare,
      items: [
        {
          name: 'My Tasks',
          href: '/dashboard/my-tasks',
          icon: CheckSquare,
          description: 'Tasks assigned to you and co-assigned'
        },
        {
          name: 'To Do',
          href: '/dashboard/to-do',
          icon: ListTodo,
          description: 'Personal task checklist and quick actions'
        },
        {
          name: 'Assigned by Me',
          href: '/dashboard/assigned-by-me',
          icon: UserCheck,
          description: 'Tasks delegated or assigned to team members'
        }
      ]
    },
    {
      title: 'Workflow',
      icon: FolderKanban,
      items: [
        {
          name: 'Kanban Board',
          href: '/dashboard/kanban',
          icon: FolderKanban,
          description: 'Visual status pipeline with drag-and-drop transitions'
        },
        {
          name: 'Calendar View',
          href: '/dashboard/calendar',
          icon: Calendar,
          description: 'Timeline view and upcoming milestone deadlines'
        },
        {
          name: 'Change Checklist',
          href: '/dashboard/change-checklists',
          icon: ListChecks,
          description: 'Technical changes & QA production release verifications'
        },
        ...(!isEmployee ? [
          {
            name: 'Team Workload',
            href: '/dashboard/workload',
            icon: Activity,
            description: 'Team capacity, workload balance, and velocity metrics'
          }
        ] : [])
      ]
    },
    ...(!isEmployee ? [
      {
        title: 'Management',
        icon: ClipboardList,
        items: [
          {
            name: 'All Tasks',
            href: '/dashboard/all-tasks',
            icon: ClipboardList,
            description: 'Complete organization-wide task database and filters'
          },
          {
            name: 'Team Members',
            href: '/dashboard/team',
            icon: Users,
            description: 'Team directory, assigned roles, and user statuses'
          },
          {
            name: 'Reports',
            href: '/dashboard/reports',
            icon: BarChart3,
            description: 'Productivity metrics, QA velocity, and export reports'
          }
        ]
      }
    ] : [])
  ];

  // Helper: check if a specific item is active
  const isItemActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  // Helper: check if any item within a category is active
  const isCategoryActive = (category: NavCategoryItem) => {
    return category.items.some(item => isItemActive(item.href));
  };

  // Safe hover handlers with debounce bridge to eliminate cursor gap flicker
  const handleMouseEnter = (title: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpenCategory(title);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setOpenCategory(null);
    }, 180);
  };

  // Click handler for category button
  const handleCategoryClick = (category: NavCategoryItem) => {
    if (category.items.length === 1 && category.href) {
      setOpenCategory(null);
      router.push(category.href);
      return;
    }
    setOpenCategory(prev => prev === category.title ? null : category.title);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenCategory(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenCategory(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on route transition
  useEffect(() => {
    setOpenCategory(null);
  }, [pathname]);

  return (
    <nav ref={navRef} className="flex items-center gap-1 sm:gap-1.5 select-none overflow-visible">
      {categories.map((category) => {
        const active = isCategoryActive(category);
        const isOpen = openCategory === category.title;
        const hasSubmenu = category.items.length > 0;
        const isSingleLink = category.items.length === 1 && category.href;

        return (
          <div
            key={category.title}
            className="relative"
            onMouseEnter={() => handleMouseEnter(category.title)}
            onMouseLeave={handleMouseLeave}
          >
            {/* Category Trigger Button */}
            {isSingleLink ? (
              <Link
                href={category.href!}
                onClick={() => setOpenCategory(null)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer relative",
                  active
                    ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20 font-bold"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <category.icon className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-150",
                  active ? "text-primary-foreground" : "text-muted-foreground/80 group-hover:text-foreground"
                )} />
                <span>{category.title}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => handleCategoryClick(category)}
                aria-expanded={isOpen}
                aria-haspopup="true"
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer relative",
                  active
                    ? "bg-primary/10 text-primary border border-primary/25 shadow-xs font-bold"
                    : isOpen
                      ? "bg-accent/70 text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <category.icon className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground/80"
                )} />
                <span>{category.title}</span>
                {hasSubmenu && (
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200 opacity-70",
                      isOpen && "rotate-180 opacity-100",
                      active && "text-primary"
                    )}
                  />
                )}
              </button>
            )}

            {/* Hover and Click-Based Dropdown Submenu */}
            <AnimatePresence>
              {isOpen && hasSubmenu && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 pt-1.5 z-50 min-w-[240px] max-w-sm"
                  onMouseEnter={() => handleMouseEnter(category.title)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="glass-panel bg-card/98 dark:bg-card/95 border border-card-border shadow-xl rounded-xl p-1.5 space-y-0.5 backdrop-blur-md">
                    {/* Category Label Header */}
                    <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/60 border-b border-card-border/40 mb-1">
                      {category.title}
                    </div>

                    {category.items.map((item) => {
                      const itemActive = isItemActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenCategory(null)}
                          className={cn(
                            "flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all duration-150 group cursor-pointer",
                            itemActive
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs shadow-primary/20"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          <div className={cn(
                            "p-1 rounded-md shrink-0 mt-0.5 transition-colors",
                            itemActive 
                              ? "bg-primary-foreground/15 text-primary-foreground" 
                              : "bg-accent/40 text-muted-foreground group-hover:text-foreground group-hover:bg-accent"
                          )}>
                            <item.icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={cn(
                              "font-semibold leading-tight truncate",
                              itemActive ? "text-primary-foreground" : "text-foreground"
                            )}>
                              {item.name}
                            </span>
                            {item.description && (
                              <span className={cn(
                                "text-[10px] leading-tight line-clamp-1 mt-0.5",
                                itemActive ? "text-primary-foreground/80" : "text-muted-foreground/75"
                              )}>
                                {item.description}
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}
