'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { 
  LayoutDashboard, 
  CheckSquare, 
  FolderKanban, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Sparkles,
  Calendar,
  UserCircle,
  ClipboardList,
  Folder,
  Activity
} from 'lucide-react';
import { cn } from '@/utils';

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

export default function Sidebar({ className, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const getMenuItems = () => {
    if (!user) return [];
    const isEmployee = user.role === 'Member';
    const isTeamLead = user.role === 'Admin' || user.role === 'SuperAdmin';

    const items = [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Projects', href: '/dashboard/projects', icon: Folder },
      { name: 'My Tasks', href: '/dashboard/my-tasks', icon: CheckSquare },
      { name: 'Kanban Board', href: '/dashboard/kanban', icon: FolderKanban },
      { name: 'Calendar View', href: '/dashboard/calendar', icon: Calendar },
    ];

    if (!isEmployee) {
      items.push({ name: 'Team Workload', href: '/dashboard/workload', icon: Activity });
      items.push({ name: 'All Tasks', href: '/dashboard/all-tasks', icon: ClipboardList });
      items.push({ name: 'Team Members', href: '/dashboard/team', icon: Users });
      items.push({ name: 'Reports', href: '/dashboard/reports', icon: BarChart3 });
    }

    if (user.role === 'SuperAdmin') {
      items.push({ name: 'Settings', href: '/dashboard/settings', icon: Settings });
    }

    items.push({ name: 'User Profile', href: '/dashboard/profile', icon: UserCircle });

    return items;
  };

  const menuItems = getMenuItems();

  return (
    <aside className={cn(
      "w-64 h-screen glass-panel flex flex-col justify-between border-r border-card-border p-4 select-none",
      className
    )}>
      {/* Top Brand Logo */}
      <div className="flex items-center gap-3 px-3 py-4 mb-6">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base leading-tight tracking-tight">Apex Tasks</span>
          <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Enterprise</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 px-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all group duration-200 cursor-pointer",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15" 
                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 transition-transform duration-200 group-hover:scale-105",
                isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
              )} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Profile Info & Logout */}
      <div className="border-t border-card-border pt-4 mt-auto space-y-3">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner"
              style={{ backgroundColor: user.avatarColor || '#3b82f6' }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-semibold text-sm leading-tight truncate">{user.displayName}</span>
              <span className="text-xs text-muted-foreground capitalize font-medium">{user.role}</span>
            </div>
          </div>
        )}

        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
