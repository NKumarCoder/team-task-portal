'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  const [mounted, setMounted] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const activeTriggerRef = useRef<HTMLElement | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);

  const isEmployee = user?.role === 'Member';

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Calculate coordinates aligned with the category trigger button
  const updateDropdownCoords = (triggerEl: HTMLElement) => {
    const rect = triggerEl.getBoundingClientRect();
    const dropdownWidth = 288; // w-72 (18rem = 288px)
    // Keep dropdown inside viewport boundaries with minimum 16px horizontal margins
    const safeLeft = Math.max(16, Math.min(rect.left, window.innerWidth - dropdownWidth - 16));
    setDropdownPosition({
      top: rect.bottom + 6,
      left: safeLeft
    });
  };

  // Safe hover handlers with bridge debounce to eliminate cursor-gap flickering
  const handleTriggerMouseEnter = (title: string, triggerEl: HTMLElement) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    activeTriggerRef.current = triggerEl;
    updateDropdownCoords(triggerEl);
    setOpenCategory(title);
  };

  const handleTriggerMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setOpenCategory(null);
    }, 200);
  };

  const handleDropdownMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleDropdownMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setOpenCategory(null);
    }, 200);
  };

  // Click handler for category button (also supports touch devices)
  const handleCategoryClick = (category: NavCategoryItem, triggerEl: HTMLElement) => {
    if (category.items.length === 1 && category.href) {
      setOpenCategory(null);
      router.push(category.href);
      return;
    }
    if (openCategory === category.title) {
      setOpenCategory(null);
    } else {
      activeTriggerRef.current = triggerEl;
      updateDropdownCoords(triggerEl);
      setOpenCategory(category.title);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        navRef.current && !navRef.current.contains(target) &&
        dropdownMenuRef.current && !dropdownMenuRef.current.contains(target)
      ) {
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

  // Close dropdown on scroll or resize
  useEffect(() => {
    if (!openCategory) return;
    const handleClose = () => setOpenCategory(null);
    window.addEventListener('scroll', handleClose, { passive: true });
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose);
      window.removeEventListener('resize', handleClose);
    };
  }, [openCategory]);

  // Close dropdown on route transition
  useEffect(() => {
    setOpenCategory(null);
  }, [pathname]);

  const activeCategory = categories.find(c => c.title === openCategory);

  return (
    <>
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
              onMouseEnter={(e) => handleTriggerMouseEnter(category.title, e.currentTarget)}
              onMouseLeave={handleTriggerMouseLeave}
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
                  onClick={(e) => handleCategoryClick(category, e.currentTarget)}
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
            </div>
          );
        })}
      </nav>

      {/* Portaled Dropdown Submenu - Escapes all parent stacking contexts and overflow boundaries */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {openCategory && activeCategory && activeCategory.items.length > 0 && (
            <motion.div
              ref={dropdownMenuRef}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              style={{
                position: 'fixed',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                zIndex: 9999
              }}
              className="w-72 select-none before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-3"
              onMouseEnter={handleDropdownMouseEnter}
              onMouseLeave={handleDropdownMouseLeave}
            >
              {/* Solid, 100% Opaque Container with Elevated Shadow & Border */}
              <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl shadow-slate-900/10 dark:shadow-black/50 rounded-2xl p-1.5 space-y-0.5 overflow-hidden">
                {/* Visual Category Header */}
                <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-800/80 mb-1 flex items-center justify-between bg-slate-50 dark:bg-zinc-900/60 rounded-t-xl">
                  <span>{activeCategory.title}</span>
                  <span className="text-[9px] font-semibold text-slate-400 dark:text-zinc-500">{activeCategory.items.length} items</span>
                </div>

                {/* Submenu Item Links */}
                {activeCategory.items.map((item) => {
                  const itemActive = isItemActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenCategory(null)}
                      className={cn(
                        "flex items-start gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-150 group cursor-pointer",
                        itemActive
                          ? "bg-primary text-white font-semibold shadow-sm shadow-primary/25"
                          : "text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900"
                      )}
                    >
                      <div className={cn(
                        "p-1.5 rounded-lg shrink-0 mt-0.5 transition-colors",
                        itemActive 
                          ? "bg-white/20 text-white" 
                          : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
                      )}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={cn(
                          "font-bold leading-tight truncate text-xs",
                          itemActive 
                            ? "text-white" 
                            : "text-slate-900 dark:text-zinc-100 group-hover:text-primary transition-colors"
                        )}>
                          {item.name}
                        </span>
                        {item.description && (
                          <span className={cn(
                            "text-[10px] leading-snug line-clamp-1 mt-0.5",
                            itemActive 
                              ? "text-white/80" 
                              : "text-slate-500 dark:text-zinc-400"
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
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
