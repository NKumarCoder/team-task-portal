'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value?: string; // Stored in YYYY-MM-DD
  onChange?: (dateStr: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  minDate?: string; // Optional minimum selectable date in YYYY-MM-DD
  align?: 'left' | 'right';
  className?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function DatePicker({
  value = '',
  onChange,
  placeholder = 'mm/dd/yyyy',
  disabled = false,
  hasError = false,
  minDate,
  align = 'left',
  className = '',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize view date based on current value or today
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(d.getTime())) return d;
      }
    }
    return new Date();
  });

  // Keep viewDate synchronized when value changes externally
  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(d.getTime())) {
          setViewDate(d);
        }
      }
    }
  }, [value]);

  // Click outside to close
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

  // Formatted display value (MM/DD/YYYY)
  const displayValue = useMemo(() => {
    if (!value) return '';
    const parts = value.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${month}/${day}/${year}`;
    }
    return value;
  }, [value]);

  // Format date object to YYYY-MM-DD
  const formatToYMD = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelectDate = (dateObj: Date) => {
    if (disabled) return;
    const ymd = formatToYMD(dateObj);
    onChange?.(ymd);
    setIsOpen(false);
  };

  const handleToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    setViewDate(today);
    onChange?.(formatToYMD(today));
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
    setIsOpen(false);
  };

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean; isSelected: boolean }[] = [];

    const todayStr = formatToYMD(new Date());

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const dStr = formatToYMD(d);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === value,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const d = new Date(year, month, day);
      const dStr = formatToYMD(d);
      days.push({
        date: d,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSelected: dStr === value,
      });
    }

    // Next month padding days to make full 5 or 6 weeks (total multiple of 7)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const d = new Date(year, month + 1, day);
      const dStr = formatToYMD(d);
      days.push({
        date: d,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === value,
      });
    }

    return days;
  }, [viewDate, value]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-1.5 border rounded-lg bg-background/50 outline-none text-xs flex items-center justify-between transition-all select-none cursor-pointer ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/50'
        } ${
          hasError
            ? 'border-destructive focus:ring-2 focus:ring-destructive/25'
            : isOpen
            ? 'border-primary ring-2 ring-primary/25'
            : 'border-border focus:border-primary'
        }`}
      >
        <span className={displayValue ? 'text-foreground font-medium' : 'text-muted-foreground font-normal'}>
          {displayValue || placeholder}
        </span>
        <CalendarIcon className={`h-3.5 w-3.5 transition-colors ${isOpen ? 'text-primary' : 'text-muted-foreground'}`} />
      </button>

      {/* Calendar Popup Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="datepicker-calendar-dropdown"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute top-full mt-1.5 z-50 w-[270px] rounded-xl glass-panel bg-slate-900/95 dark:bg-zinc-900/95 border border-card-border/80 shadow-2xl p-3 text-xs backdrop-blur-md ${
              align === 'right' ? 'right-0 left-auto' : 'left-0'
            }`}
          >
            {/* Header: Month Year + Navigation */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50">
              <span className="font-bold text-xs text-foreground tracking-tight">
                {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                  aria-label="Previous Month"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                  aria-label="Next Month"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Weekday Names Row */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEKDAY_NAMES.map((name) => (
                <span key={name} className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 py-0.5">
                  {name}
                </span>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(({ date, isCurrentMonth, isToday, isSelected }, idx) => {
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDate(date)}
                    className={`h-7 w-7 rounded-lg text-xs font-medium flex items-center justify-center transition-all cursor-pointer select-none mx-auto ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/25 scale-105'
                        : isToday
                        ? 'border border-primary/50 text-primary font-semibold hover:bg-accent/60'
                        : isCurrentMonth
                        ? 'text-foreground hover:bg-accent/60 hover:text-primary'
                        : 'text-muted-foreground/35 hover:text-muted-foreground/70 hover:bg-accent/30 text-[11px]'
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Footer Actions: Today & Clear */}
            <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/50">
              <button
                type="button"
                onClick={handleToday}
                className="text-[11px] font-semibold text-primary hover:underline transition-all cursor-pointer focus:outline-none"
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors cursor-pointer focus:outline-none"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
