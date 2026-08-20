'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, X, Search, Users } from 'lucide-react';
import { Member } from '@/types';

interface MultiAssigneeSelectProps {
  members: Member[];
  selectedEmails: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
  hasError?: boolean;
  placeholder?: string;
  className?: string;
}

export default function MultiAssigneeSelect({
  members,
  selectedEmails = [],
  onChange,
  disabled = false,
  hasError = false,
  placeholder = 'Select team members...',
  className = '',
}: MultiAssigneeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Keyboard navigation (Escape key)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Map of selected members
  const selectedMembers = useMemo(() => {
    const emailSet = new Set(selectedEmails.map((e) => e.toLowerCase()));
    return members.filter((m) => emailSet.has(m.email.toLowerCase()));
  }, [members, selectedEmails]);

  // Filtered members based on search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.role && m.role.toLowerCase().includes(q))
    );
  }, [members, searchQuery]);

  const toggleMember = (email: string) => {
    if (disabled) return;
    const lower = email.toLowerCase();
    const isSelected = selectedEmails.some((e) => e.toLowerCase() === lower);
    if (isSelected) {
      onChange(selectedEmails.filter((e) => e.toLowerCase() !== lower));
    } else {
      onChange([...selectedEmails, lower]);
    }
  };

  const removeMember = (e: React.MouseEvent, email: string) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedEmails.filter((item) => item.toLowerCase() !== email.toLowerCase()));
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button / Chips Container */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-[32px] px-2.5 py-1 border rounded-lg bg-background/50 outline-none text-xs flex items-center justify-between gap-1.5 transition-all select-none cursor-pointer ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/50'
        } ${
          hasError
            ? 'border-destructive ring-1 ring-destructive/25'
            : isOpen
            ? 'border-primary ring-2 ring-primary/25'
            : 'border-border'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0 pr-1">
          {selectedMembers.length > 0 ? (
            selectedMembers.map((member, idx) => (
              <span
                key={member.email || member.id || `sel-${idx}`}
                className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-md bg-accent/80 border border-border/60 text-[11px] font-medium text-foreground max-w-[180px] truncate animate-in fade-in zoom-in-95 duration-150"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-white text-[8px] shrink-0"
                  style={{ backgroundColor: member.avatarColor || '#6366f1' }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{member.name}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => removeMember(e, member.email)}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-0.5 p-0.5 cursor-pointer"
                    aria-label={`Remove ${member.name}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground font-normal py-0.5 text-xs">
              {placeholder}
            </span>
          )}
        </div>

        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
        />
      </div>

      {/* Multi-Select Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="multi-assignee-dropdown-panel"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 top-full mt-1.5 z-50 w-full min-w-[280px] rounded-xl glass-panel bg-slate-900/95 dark:bg-zinc-900/95 border border-card-border/80 shadow-2xl p-2 text-xs backdrop-blur-md"
          >
            {/* Search Input Box */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team members..."
                className="w-full pl-8 pr-3 py-1.5 bg-background/50 border border-border/70 rounded-lg text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/25 placeholder:text-muted-foreground text-foreground"
              />
            </div>

            {/* Member List */}
            <div className="max-h-[180px] overflow-y-auto space-y-0.5 pr-1">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((m, idx) => {
                  const isSelected = selectedEmails.some(
                    (e) => e.toLowerCase() === m.email.toLowerCase()
                  );
                  return (
                    <div
                      key={m.email || m.id || `m-${idx}`}
                      onClick={() => toggleMember(m.email)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                        isSelected
                          ? 'bg-primary/15 text-foreground font-semibold'
                          : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0 shadow-xs"
                          style={{ backgroundColor: m.avatarColor || '#6366f1' }}
                        >
                          {m.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 truncate">
                          <span className="text-foreground font-medium block truncate text-xs">
                            {m.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {m.email}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ml-2 ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-border bg-background/50'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-muted-foreground text-xs">
                  No members found matching &quot;{searchQuery}&quot;
                </div>
              )}
            </div>

            {/* Footer Summary / Quick Actions */}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/50 px-1 text-[11px] text-muted-foreground">
              <span className="font-medium">
                {selectedEmails.length} selected
              </span>
              {selectedEmails.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer font-medium"
                >
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
