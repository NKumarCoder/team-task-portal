'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Layers,
  User,
  Users,
  MessageSquare,
  Eye,
  EyeOff,
  Bell,
  Sliders,
  Calendar,
  Clock,
  History,
  Shield,
  Search,
  CornerDownRight,
  GitCompare,
  Check,
  X,
  FileText,
  Bookmark
} from 'lucide-react';
import IssueTypeBadge from '@/components/tasks/IssueTypeBadge';
import PriorityBadge from '@/components/tasks/PriorityBadge';
import StatusBadge from '@/components/tasks/StatusBadge';
import { IssueType, TaskPriority, TaskStatus } from '@/types';
import { TASK_STATUS_CONFIG } from '@/constants';

interface FeatureComparison {
  id: string;
  category: 'core' | 'collaboration' | 'audit' | 'productivity';
  categoryLabel: string;
  batch: string;
  title: string;
  summary: string;
  appRoute: string;
  appRouteLabel: string;
  status: 'Implemented' | 'Pending';
  before: {
    title: string;
    description: string;
    limitations: string[];
    previewType: 'issue-type' | 'hierarchy' | 'detail-page' | 'qa-owner' | 'comments' | 'replies' | 'mentions' | 'timeline' | 'audit' | 'roles' | 'uat-reject' | 'watchers' | 'preferences';
  };
  after: {
    title: string;
    description: string;
    improvements: string[];
    previewType: 'issue-type' | 'hierarchy' | 'detail-page' | 'qa-owner' | 'comments' | 'replies' | 'mentions' | 'timeline' | 'audit' | 'roles' | 'uat-reject' | 'watchers' | 'preferences';
  };
}

const COMPARISONS: FeatureComparison[] = [
  // --- BATCH 1: CORE ISSUE MANAGEMENT ---
  {
    id: 'issue-types',
    category: 'core',
    categoryLabel: 'Core Issue Management',
    batch: 'Batch 1',
    title: '1. Issue Type Classification (Bug, Task, Story, Epic)',
    summary: 'Standardized agile classification for work items with distinct visual iconography and color-coded tags.',
    appRoute: '/dashboard/all-tasks',
    appRouteLabel: 'View in All Tasks',
    status: 'Implemented',
    before: {
      title: 'Legacy: Unclassified Tasks Only',
      description: 'All tasks had no type differentiation or agile hierarchy. A critical defect looked identical to a long-term story.',
      limitations: [
        'No Bug, Story, or Epic tags',
        'Inability to filter tasks by type',
        'Flat and ambiguous task list'
      ],
      previewType: 'issue-type'
    },
    after: {
      title: 'Enhanced: 4 Distinct Agile Issue Types',
      description: 'Full support for Bug (Rose), Task (Blue), Story (Emerald), and Epic (Purple) across all table listings, drawers, and creation forms.',
      improvements: [
        'Color-coded icons for Bug, Task, Story, Epic',
        'Integrated issue type selector in task creation/editing dialogs',
        'Instant visual recognition across Kanban and table views'
      ],
      previewType: 'issue-type'
    }
  },
  {
    id: 'hierarchy',
    category: 'core',
    categoryLabel: 'Core Issue Management',
    batch: 'Batch 1',
    title: '2. Parent-Child Task Hierarchy & Progress Tracking',
    summary: 'Bidirectional linking between Epics, Stories, and sub-tasks with circular prevention and real-time progress rollups.',
    appRoute: '/dashboard/all-tasks',
    appRouteLabel: 'View in All Tasks',
    status: 'Implemented',
    before: {
      title: 'Legacy: Completely Flat Task Structure',
      description: 'Tasks had no awareness of parent or child relationships. Epics could not track sub-stories, and checklists were merely flat items.',
      limitations: [
        'No parent task references',
        'No sub-task breakdown for complex stories',
        'No aggregate completion tracking'
      ],
      previewType: 'hierarchy'
    },
    after: {
      title: 'Enhanced: Bidirectional Hierarchy & Completion Meter',
      description: 'Tasks cleanly link to parent Epics/Stories with child progress percentage, circular link validation, and fast child navigation.',
      improvements: [
        'Direct Parent Task banner with 1-click navigation',
        'Child Tasks list displaying statuses and child count',
        'Automatic progress percentage rollup (e.g. 2/3 done = 67%)'
      ],
      previewType: 'hierarchy'
    }
  },
  {
    id: 'detail-page',
    category: 'core',
    categoryLabel: 'Core Issue Management',
    batch: 'Batch 1',
    title: '3. Dedicated Task Detail Page (/dashboard/tasks/[id])',
    summary: 'Replaced constrained side drawer with an expansive, responsive 2-column dedicated detail route with shareable URLs.',
    appRoute: '/dashboard/all-tasks',
    appRouteLabel: 'Open All Tasks to View',
    status: 'Implemented',
    before: {
      title: 'Legacy: Constrained Side Drawer Only',
      description: 'Clicking any task opened a slide-out drawer. Space for discussions, checklist items, and audit logs was heavily restricted.',
      limitations: [
        'Drawer cramped on laptops and mobile',
        'No direct link or shareable URL for team members',
        'Discussions and checklists competed for narrow vertical space'
      ],
      previewType: 'detail-page'
    },
    after: {
      title: 'Enhanced: Full-Screen 2-Column Responsive Page',
      description: 'Dedicated route (/dashboard/tasks/[id]) featuring 2/3 main workspace for description, checklist, comments, and audit log, plus 1/3 sidebar.',
      improvements: [
        'Direct shareable URL e.g. /dashboard/tasks/TASK-000001',
        'Dedicated sections for checklists, attachments, comments, and audit',
        'Sidebar with status transitions, classifications, and roster'
      ],
      previewType: 'detail-page'
    }
  },
  {
    id: 'qa-owner',
    category: 'core',
    categoryLabel: 'Core Issue Management',
    batch: 'Batch 1',
    title: '4. Dedicated QA Owner Assignment',
    summary: 'Separation of concerns between development assignees and the designated Quality Assurance verifier.',
    appRoute: '/dashboard/all-tasks',
    appRouteLabel: 'View in All Tasks',
    status: 'Implemented',
    before: {
      title: 'Legacy: Developers Doubled as QA',
      description: 'Tasks only had primary assignees. Testing ownership was undocumented, leading to confusion during UAT and release.',
      limitations: [
        'No designated tester role',
        'Ambiguous responsibility during verification',
        'No QA-specific workflow restrictions'
      ],
      previewType: 'qa-owner'
    },
    after: {
      title: 'Enhanced: Dedicated QA Owner Field & Badge',
      description: 'Independent QA Owner assignment with prominent badge styling, dedicated QA workflow status permissions, and roster display.',
      improvements: [
        'Dedicated QA Owner selector in creation/edit forms',
        'Prominent QA badge in tables, drawers, and detail pages',
        'Enables QA-specific UAT transition rights'
      ],
      previewType: 'qa-owner'
    }
  },

  // --- BATCH 2: COLLABORATION FEATURES ---
  {
    id: 'comments',
    category: 'collaboration',
    categoryLabel: 'Collaboration Features',
    batch: 'Batch 2',
    title: '5. Rich Text-Based Task Comments',
    summary: 'Real-time collaborative discussions inside the Task Detail Page with author profiles, relative time, and soft deletion.',
    appRoute: '/dashboard/all-tasks',
    appRouteLabel: 'Open Task to View Comments',
    status: 'Implemented',
    before: {
      title: 'Legacy: Static Remarks Field Only',
      description: 'Tasks only supported a single remarks text box. Users could not have an asynchronous conversation or review comment history.',
      limitations: [
        'No threaded discussion history',
        'Overwriting remarks destroyed previous notes',
        'No user attribution or timestamps'
      ],
      previewType: 'comments'
    },
    after: {
      title: 'Enhanced: Dedicated Task Discussion Stream',
      description: 'Modern comments section with member avatar, formatted timestamps, edit history, soft deletion, and real-time Firestore sync.',
      improvements: [
        'Real-time comment timeline under dedicated task page',
        'Full member attribution with avatar colors and timestamps',
        'Editing and soft-deletion preserving reply integrity'
      ],
      previewType: 'comments'
    }
  },
  {
    id: 'replies',
    category: 'collaboration',
    categoryLabel: 'Collaboration Features',
    batch: 'Batch 2',
    title: '6. Threaded Comment Replies (1-Level Nesting)',
    summary: 'Inline contextual replies under parent comments preventing cluttered discussion threads.',
    appRoute: '/dashboard/all-tasks',
    appRouteLabel: 'Open Task to View Replies',
    status: 'Implemented',
    before: {
      title: 'Legacy: Flat Discussion Structure',
      description: 'No nesting capability. Replies had to be posted as separate root items, obscuring which message was being addressed.',
      limitations: [
        'Lacks contextual replies',
        'Hard to track multi-party conversations',
        'Parent comment authors never notified of follow-ups'
      ],
      previewType: 'replies'
    },
    after: {
      title: 'Enhanced: 1-Level Threaded Inline Replies',
      description: 'Structured reply threads with Reply action buttons, reply count indicators, indent styling, and notifications to parent authors.',
      improvements: [
        'Clean indented reply styling with direct author reference',
        'Reply counter badges e.g. "2 Replies"',
        'Automatic notification sent to original comment author'
      ],
      previewType: 'replies'
    }
  },
  {
    id: 'mentions',
    category: 'collaboration',
    categoryLabel: 'Collaboration Features',
    batch: 'Batch 2',
    title: '7. @Mentions Autocomplete & Real-Time Alerts',
    summary: 'Interactive member tagging in comments with instant in-app alerts and 1-click deep linking.',
    appRoute: '/dashboard/all-tasks',
    appRouteLabel: 'Test @Mentions in Task',
    status: 'Implemented',
    before: {
      title: 'Legacy: No Direct Member Tagging',
      description: 'Typing member names had no special effect. Team members had no way to pull specific colleagues into a discussion.',
      limitations: [
        'No mention autocomplete popover',
        'No highlighted mention badges',
        'Colleagues unaware when their input was requested'
      ],
      previewType: 'mentions'
    },
    after: {
      title: 'Enhanced: @Mentions Autocomplete & Deep Linking',
      description: 'Type @ to display a searchable member popup. Mentions render as styled pills, and recipients get instant alerts with 1-click navigation.',
      improvements: [
        'Keyboard-driven @autocomplete popup filter',
        'Mention tags rendered with pill styling and member badges',
        'Instant in-app bell notification linking straight to comment'
      ],
      previewType: 'mentions'
    }
  },

  // --- BATCH 3: AUDIT & WORKFLOW ENHANCEMENTS ---
  {
    id: 'activity-timeline',
    category: 'audit',
    categoryLabel: 'Audit & Workflow',
    batch: 'Batch 3',
    title: '8. Comprehensive Activity Timeline (12+ Event Types)',
    summary: 'End-to-end tracking of all meaningful task lifecycle changes with relative time and pagination.',
    appRoute: '/dashboard/all-tasks',
    appRouteLabel: 'View Activity Timeline',
    status: 'Implemented',
    before: {
      title: 'Legacy: Minimal Status-Only Activity Log',
      description: 'Activity logs were limited to raw status changes. Title, description, assignees, due date, and priority changes were lost.',
      limitations: [
        'Only status changes were recorded',
        'No before/after diff for assignees or priority',
        'No pagination for high-activity tasks'
      ],
      previewType: 'timeline'
    },
    after: {
      title: 'Enhanced: Full Lifecycle Event Tracking & Pagination',
      description: 'Tracks task creation, titles, descriptions, status, priority, due dates, co-assignees, QA owner, comments, and subtasks with Load More pagination.',
      improvements: [
        'Comprehensive 12+ lifecycle event capture',
        'Previous and new value diff badges (e.g. Medium → High)',
        'Pagination control (10 items per batch) with live count'
      ],
      previewType: 'timeline'
    }
  },
  {
    id: 'field-audit',
    category: 'audit',
    categoryLabel: 'Audit & Workflow',
    batch: 'Batch 3',
    title: '9. Structured Field-Level Audit History',
    summary: 'Dedicated tabular view of all field mutations with timestamp, field name, action, previous value, new value, and actor.',
    appRoute: '/dashboard/all-tasks',
    appRouteLabel: 'View Field Audit Log',
    status: 'Implemented',
    before: {
      title: 'Legacy: No Dedicated Audit Table',
      description: 'Field mutations could only be pieced together from narrative logs. Administrators could not perform structured compliance audits.',
      limitations: [
        'No tabular audit view',
        'No explicit fieldName attribute',
        'History could theoretically be altered without strict rules'
      ],
      previewType: 'audit'
    },
    after: {
      title: 'Enhanced: Tabular Field Audit Log & Tamper-Proof Rules',
      description: 'Dual-mode switcher on Task Detail: Activity Timeline vs Field Audit Log. Secure Firestore rules restrict log tampering.',
      improvements: [
        'Tabular audit columns: Timestamp, Field, Action, Old, New, Actor',
        'Explicit field categorization (Status, Priority, QA Owner, etc.)',
        'Firestore security rules strictly prevent audit deletion'
      ],
      previewType: 'audit'
    }
  },
  {
    id: 'role-restrictions',
    category: 'audit',
    categoryLabel: 'Audit & Workflow',
    batch: 'Batch 3',
    title: '10. Role-Based Status Restrictions (10-Stage Matrix)',
    summary: 'Enforced workflow separation: Developers manage dev stages, QA manages testing/rejections, and Admins manage deployments.',
    appRoute: '/dashboard/kanban',
    appRouteLabel: 'Test in Kanban Board',
    status: 'Implemented',
    before: {
      title: 'Legacy: Unrestricted Status Updating',
      description: 'Any assigned developer could transition tasks directly to Production Deployed or Completed without QA verification or approval.',
      limitations: [
        'No role differentiation between Dev and QA',
        'Developers could sign off their own code without review',
        'No status dropdown validation or permission feedback'
      ],
      previewType: 'roles'
    },
    after: {
      title: 'Enhanced: Strict 10-Stage Workflow Permission Matrix',
      description: 'Devs can only access dev stages; QA Owners control verification & UAT rejections; Admins hold deployment rights. Enforced in UI & dbService.',
      improvements: [
        'Disabled unauthorized options with clear explanation badges',
        'Kanban drag-and-drop validates permissions before dropping',
        'Backend service validation throws errors on unauthorized attempts'
      ],
      previewType: 'roles'
    }
  },
  {
    id: 'uat-rejection',
    category: 'audit',
    categoryLabel: 'Audit & Workflow',
    batch: 'Batch 3',
    title: '11. Mandatory UAT Rejection Reason & Multi-Cycle History',
    summary: 'Requires non-empty rejection comment modal and records a permanent rejection history array across multiple cycles.',
    appRoute: '/dashboard/all-tasks',
    appRouteLabel: 'View Rejection History',
    status: 'Implemented',
    before: {
      title: 'Legacy: Optional Remarks Overwritten Each Cycle',
      description: 'UAT rejection could be clicked without explanation. A subsequent rejection erased all notes from prior rejection cycles.',
      limitations: [
        'Developers left wondering why a task was rejected',
        'Previous rejection feedback overwritten and lost',
        'No multi-cycle rejection audit trail'
      ],
      previewType: 'uat-reject'
    },
    after: {
      title: 'Enhanced: Mandatory Reason Modal & Cumulative History',
      description: 'Mandatory non-whitespace comment modal on UAT rejection. Stores rejectionHistory array retaining every rejection event permanently.',
      improvements: [
        'StatusUpdateModal requires non-empty reason before proceeding',
        'Cumulative rejectionHistory array preserves past rejection cycles',
        'Highlighted UAT Rejection History card rendered on task detail'
      ],
      previewType: 'uat-reject'
    }
  },

  // --- BATCH 4: PRODUCTIVITY & NOTIFICATIONS ---
  {
    id: 'watchers',
    category: 'productivity',
    categoryLabel: 'Productivity & Notifications',
    batch: 'Batch 4',
    title: '12. Task Watchers (Follow Without Assignment)',
    summary: 'Allows team members to follow tasks without being assigned, receive automated updates, and view watcher rosters.',
    appRoute: '/dashboard/all-tasks',
    appRouteLabel: 'Open Task to Watch',
    status: 'Implemented',
    before: {
      title: 'Legacy: Assignment-Only Notifications',
      description: 'Only assigned developers received task updates. Stakeholders had to be assigned to tasks just to stay informed.',
      limitations: [
        'No Watch / Follow action',
        'Assigning stakeholders distorted workload points and reports',
        'No watcher roster or follower metrics'
      ],
      previewType: 'watchers'
    },
    after: {
      title: 'Enhanced: 1-Click Watch / Unwatch & Watcher Roster',
      description: 'Follow tasks with 1 click. Watchers receive alerts for status, priority, comments, and UAT rejections with deduplication.',
      improvements: [
        'Watch / Stop Watching action button with active state',
        'Live watcher counter badge and roster with avatars',
        'Automated watcher alerts with actor and assignee deduplication'
      ],
      previewType: 'watchers'
    }
  },
  {
    id: 'notification-preferences',
    category: 'productivity',
    categoryLabel: 'Productivity & Notifications',
    batch: 'Batch 4',
    title: '13. Granular Notification Preferences (8 Categories)',
    summary: 'Individual notification toggles for assignments, status changes, updates, comments, replies, mentions, rejections, and watchers.',
    appRoute: '/dashboard/settings',
    appRouteLabel: 'Open Notification Settings',
    status: 'Implemented',
    before: {
      title: 'Legacy: All-or-Nothing Global Notifications',
      description: 'Users could not customize which alerts they received. High-volume comments or status updates could not be muted.',
      limitations: [
        'No category-based controls',
        'Bell flooded with notifications users did not care about',
        'Members could not mute comments while keeping assignment alerts'
      ],
      previewType: 'preferences'
    },
    after: {
      title: 'Enhanced: 8 Granular Category Toggles in Settings',
      description: 'Dedicated Notification Preferences tab in Settings with 8 individual toggles, sensible defaults, and centralized suppression.',
      improvements: [
        'Individual toggles for Assignments, Status, Comments, Mentions, Watchers',
        'Centralized check in addNotification prevents unwanted DB writes',
        'Persistent to user profile in Firestore across login sessions'
      ],
      previewType: 'preferences'
    }
  }
];

export default function UIComparisonPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'both' | 'before' | 'after'>('both');
  const [activeFeatureId, setActiveFeatureId] = useState<string>(COMPARISONS[0].id);

  // Filtered comparisons
  const filtered = useMemo(() => {
    return COMPARISONS.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch =
        searchQuery.trim() === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.batch.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const activeFeature = useMemo(() => {
    return COMPARISONS.find(c => c.id === activeFeatureId) || COMPARISONS[0];
  }, [activeFeatureId]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-20 select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-card-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="uppercase tracking-wider">Apex Tasks · 4 Enhancement Batches</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            UI & Feature Evolution Review
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Side-by-side visual comparison of the legacy UI versus the enhanced implementations across all 13 core features.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            13 of 13 Implemented
          </span>
          <Link
            href="/dashboard"
            className="px-3.5 py-1.5 rounded-xl border border-border bg-card hover:bg-accent text-foreground text-xs font-semibold transition-all cursor-pointer shadow-xs"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Control Bar: Categories & View Mode */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-card-border">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Enhancements (13)' },
            { id: 'core', label: 'Core Issue (4)' },
            { id: 'collaboration', label: 'Collaboration (3)' },
            { id: 'audit', label: 'Audit & Workflow (4)' },
            { id: 'productivity', label: 'Productivity (2)' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* View Mode Toggle & Search */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1 sm:w-48">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center bg-background border border-border rounded-xl p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                viewMode === 'both' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Both
            </button>
            <button
              type="button"
              onClick={() => setViewMode('before')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                viewMode === 'before' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Before
            </button>
            <button
              type="button"
              onClick={() => setViewMode('after')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                viewMode === 'after' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              After
            </button>
          </div>
        </div>
      </div>

      {/* Feature Fast Selector Carousel / Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {filtered.map((item) => {
          const isActive = activeFeatureId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveFeatureId(item.id)}
              className={`px-3 py-2 rounded-xl text-left border transition-all shrink-0 cursor-pointer max-w-[210px] ${
                isActive
                  ? 'bg-primary/10 border-primary text-primary shadow-xs'
                  : 'bg-card border-card-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono font-bold mb-0.5">
                <span>{item.batch}</span>
                <span className="text-emerald-400">✓ Done</span>
              </div>
              <p className="text-xs font-bold truncate leading-tight">{item.title.split('. ')[1] || item.title}</p>
            </button>
          );
        })}
      </div>

      {/* Active Feature Comparison Spotlight */}
      <motion.div
        key={activeFeature.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        {/* Feature Header Card */}
        <div className="bg-card border border-card-border p-5 rounded-2xl shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-bold">
                {activeFeature.batch}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">
                {activeFeature.categoryLabel}
              </span>
            </div>

            <Link
              href={activeFeature.appRoute}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <span>{activeFeature.appRouteLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
            {activeFeature.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {activeFeature.summary}
          </p>
        </div>

        {/* Side-by-Side Comparison Container */}
        <div className={`grid gap-6 ${viewMode === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* LEFT: EXISTING / BEFORE */}
          {(viewMode === 'both' || viewMode === 'before') && (
            <div className="space-y-4 flex flex-col">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center font-bold text-xs">
                    ✕
                  </div>
                  <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
                    Legacy UI (Before)
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                  Prior Implementation
                </span>
              </div>

              {/* Before Card Component Container */}
              <div className="bg-slate-900/60 border border-rose-900/30 rounded-2xl p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-rose-300 mb-1">{activeFeature.before.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {activeFeature.before.description}
                  </p>

                  {/* Render Mock / Visual Demonstration of Before */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 shadow-inner">
                    <RenderBeforePreview type={activeFeature.before.previewType} />
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Previous Limitations:
                  </span>
                  <ul className="space-y-1">
                    {activeFeature.before.limitations.map((lim, idx) => (
                      <li key={idx} className="text-xs text-rose-300/80 flex items-start gap-1.5">
                        <span className="text-rose-500 font-bold">•</span>
                        <span>{lim}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* RIGHT: ENHANCED / AFTER */}
          {(viewMode === 'both' || viewMode === 'after') && (
            <div className="space-y-4 flex flex-col">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide">
                    Enhanced UI (After)
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  Active in Test
                </span>
              </div>

              {/* After Card Component Container */}
              <div className="bg-card border border-emerald-500/30 rounded-2xl p-5 flex-1 flex flex-col justify-between space-y-4 shadow-sm">
                <div>
                  <h4 className="text-sm font-bold text-emerald-400 mb-1">{activeFeature.after.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {activeFeature.after.description}
                  </p>

                  {/* Render Live / Actual Component Demonstration of After */}
                  <div className="p-4 rounded-xl bg-background/80 border border-border shadow-inner">
                    <RenderAfterPreview type={activeFeature.after.previewType} />
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Newly Added Capabilities:
                  </span>
                  <ul className="space-y-1">
                    {activeFeature.after.improvements.map((imp, idx) => (
                      <li key={idx} className="text-xs text-emerald-400/90 flex items-start gap-1.5 font-medium">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Grid of All 13 Features Quick Directory */}
      <div className="pt-8 border-t border-card-border space-y-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Complete Feature Matrix (All 13 Enhancements)</h3>
          <p className="text-xs text-muted-foreground">Select any item below to load its comparison spotlight above.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {COMPARISONS.map((comp) => {
            const isSelected = activeFeatureId === comp.id;
            return (
              <div
                key={comp.id}
                onClick={() => setActiveFeatureId(comp.id)}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-primary/10 border-primary ring-1 ring-primary/30'
                    : 'bg-card border-card-border hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-primary font-bold">{comp.batch}</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Implemented
                  </span>
                </div>
                <h4 className="text-xs font-bold text-foreground leading-snug">{comp.title}</h4>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{comp.summary}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// RENDERERS FOR "BEFORE" (LEGACY PREVIEWS)
// ==========================================
function RenderBeforePreview({ type }: { type: string }) {
  switch (type) {
    case 'issue-type':
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground">Task Row (Legacy):</div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="font-mono text-xs text-gray-400">TASK-000042</span>
            <span className="text-xs text-gray-200 font-semibold">Payment gateway timeout</span>
            {/* Old: No IssueTypeBadge existed */}
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-gray-400">Task</span>
          </div>
          <p className="text-[10px] text-gray-500 italic">No distinction between Bugs, Stories, or Epics.</p>
        </div>
      );

    case 'hierarchy':
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground">Task Model (Legacy):</div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
            <p className="text-gray-300 font-semibold">Epic: Mobile Redesign</p>
            <p className="text-gray-500 text-[11px]">Subtasks were flat boolean checkboxes only.</p>
            <div className="pt-2 text-[10px] text-gray-500 italic border-t border-slate-800">
              parentTaskId: undefined · childTasks: []
            </div>
          </div>
        </div>
      );

    case 'detail-page':
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground">Navigation (Legacy):</div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-gray-400">
              <span className="px-2 py-0.5 bg-slate-800 rounded font-mono">/dashboard/all-tasks</span>
              <span>→ Drawer Popup</span>
            </div>
            <p className="text-gray-500 text-[11px] mt-2 italic">
              No direct URL to link or share via Slack or email.
            </p>
          </div>
        </div>
      );

    case 'qa-owner':
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground">People Roster (Legacy):</div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
            <span className="text-gray-400">Assigned To:</span>
            <span className="text-gray-300 font-medium">Alex Developer</span>
          </div>
          <p className="text-[10px] text-gray-500 italic">QA Owner field did not exist.</p>
        </div>
      );

    case 'comments':
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground">Remarks Box (Legacy):</div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-gray-400">
            <p className="font-semibold text-gray-300 mb-1">Remarks:</p>
            <p className="italic">"Checked the server logs yesterday, error persists."</p>
          </div>
          <p className="text-[10px] text-gray-500 italic">Single text string with no author or history.</p>
        </div>
      );

    case 'replies':
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground">Comment Threading (Legacy):</div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-gray-400 space-y-1">
            <p className="text-gray-300">Comment 1: Need clarification on API.</p>
            <p className="text-gray-300">Comment 2: Which endpoint?</p>
          </div>
          <p className="text-[10px] text-gray-500 italic">Flat stream only; replies were unlinked.</p>
        </div>
      );

    case 'mentions':
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground">Input Text (Legacy):</div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-gray-400">
            "Hey John, please take a look at this bug."
          </div>
          <p className="text-[10px] text-gray-500 italic">Plain string. John receives no notification.</p>
        </div>
      );

    case 'timeline':
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground">Activity Stream (Legacy):</div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-gray-400 space-y-1">
            <p className="text-gray-300">• Status Changed to In Progress</p>
            <p className="text-gray-300">• Status Changed to Testing</p>
          </div>
          <p className="text-[10px] text-gray-500 italic">Only 1 event type recorded.</p>
        </div>
      );

    case 'audit':
      return (
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-gray-400 text-center italic">
          No structured field audit table available in legacy application.
        </div>
      );

    case 'roles':
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground">Status Selector (Legacy):</div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-gray-300 flex items-center justify-between">
            <span>Any Member:</span>
            <span className="text-emerald-400 font-semibold">Allowed to mark "Completed"</span>
          </div>
          <p className="text-[10px] text-gray-500 italic">Zero role restrictions on workflow stages.</p>
        </div>
      );

    case 'uat-reject':
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground">Rejection (Legacy):</div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-gray-400">
            <span>Status switched to "UAT Rejected" without requiring reason.</span>
          </div>
          <p className="text-[10px] text-gray-500 italic">Prior cycle reasons overwritten.</p>
        </div>
      );

    case 'watchers':
      return (
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-gray-400 text-center italic">
          Task Watchers feature not available in legacy application.
        </div>
      );

    case 'preferences':
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-muted-foreground">Settings (Legacy):</div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-gray-400 flex items-center justify-between">
            <span>System Notifications:</span>
            <span className="text-gray-300 font-semibold">All ON or All OFF</span>
          </div>
          <p className="text-[10px] text-gray-500 italic">No category-level preference controls.</p>
        </div>
      );

    default:
      return null;
  }
}

// ==========================================
// RENDERERS FOR "AFTER" (ENHANCED LIVE PREVIEWS)
// ==========================================
function RenderAfterPreview({ type }: { type: string }) {
  switch (type) {
    case 'issue-type':
      return (
        <div className="space-y-2.5">
          <div className="text-[10px] font-mono text-primary font-semibold">Live Issue Type Badges:</div>
          <div className="flex flex-wrap gap-2">
            <IssueTypeBadge issueType="Bug" />
            <IssueTypeBadge issueType="Task" />
            <IssueTypeBadge issueType="Story" />
            <IssueTypeBadge issueType="Epic" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Standard agile tags with custom SVG icons and dedicated colors.
          </p>
        </div>
      );

    case 'hierarchy':
      return (
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              <span className="font-mono font-bold text-foreground">[EPIC-001]</span>
              <span className="font-semibold text-foreground">Mobile App 2.0</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              67% Complete (2/3)
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-400 h-full w-2/3" />
          </div>
        </div>
      );

    case 'detail-page':
      return (
        <div className="space-y-2 text-xs">
          <div className="p-2 rounded-lg bg-background border border-border flex items-center justify-between">
            <span className="font-mono text-primary font-bold">/dashboard/tasks/TASK-000042</span>
            <span className="text-[10px] text-emerald-400 font-semibold">Direct Route</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Full-screen 2-column layout with shareable link, breadcrumbs, comments, checklist, and sidebar.
          </p>
        </div>
      );

    case 'qa-owner':
      return (
        <div className="space-y-2 text-xs">
          <div className="p-2.5 rounded-lg bg-background border border-border flex items-center justify-between">
            <span className="text-muted-foreground font-semibold">QA Owner:</span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold text-[9px] flex items-center justify-center">
                S
              </div>
              <span className="font-semibold text-foreground">Sarah QA Lead</span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold px-1.5 py-0.2 rounded">
                QA
              </span>
            </div>
          </div>
        </div>
      );

    case 'comments':
      return (
        <div className="space-y-2 text-xs">
          <div className="p-2.5 rounded-lg bg-background border border-border space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[8px]">
                  A
                </div>
                <span>Alex Dev</span>
              </div>
              <span className="text-muted-foreground">10 mins ago</span>
            </div>
            <p className="text-foreground text-[11px]">
              Payment gateway timeout was resolved by increasing connection pool to 50.
            </p>
          </div>
        </div>
      );

    case 'replies':
      return (
        <div className="space-y-2 text-xs">
          <div className="p-2.5 rounded-lg bg-background border border-border space-y-2">
            <p className="text-[11px] text-foreground font-medium">Root Comment: Which endpoint was modified?</p>
            <div className="pl-3 border-l-2 border-primary/50 text-[10px] text-primary flex items-center gap-1">
              <CornerDownRight className="h-3 w-3" />
              <span>Sarah: Updated /api/v2/payments endpoint</span>
            </div>
          </div>
        </div>
      );

    case 'mentions':
      return (
        <div className="space-y-2 text-xs">
          <div className="p-2.5 rounded-lg bg-background border border-border">
            <span>Please review this, </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold text-[11px]">
              @Alex Developer
            </span>
            <span> before deployment.</span>
          </div>
          <p className="text-[10px] text-emerald-400 font-semibold">
            Recipient instantly receives deep-linked bell notification.
          </p>
        </div>
      );

    case 'timeline':
      return (
        <div className="space-y-1.5 text-xs">
          <div className="p-2 rounded-lg bg-background border border-border flex items-center justify-between text-[11px]">
            <span className="font-semibold text-foreground">Priority Changed</span>
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <span className="line-through text-muted-foreground">low</span>
              <span>→</span>
              <span className="text-rose-400 font-bold">critical</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-background border border-border flex items-center justify-between text-[11px]">
            <span className="font-semibold text-foreground">QA Owner Assigned</span>
            <span className="font-mono text-emerald-400 text-[10px]">Sarah QA</span>
          </div>
        </div>
      );

    case 'audit':
      return (
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left font-mono text-[10px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground uppercase">
                <th className="py-1">Field</th>
                <th className="py-1">Old</th>
                <th className="py-1">New</th>
                <th className="py-1">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr>
                <td className="py-1 text-primary font-bold">Status</td>
                <td className="py-1 line-through text-muted-foreground">assigned</td>
                <td className="py-1 text-emerald-400">in progress</td>
                <td className="py-1 text-foreground">Alex</td>
              </tr>
            </tbody>
          </table>
        </div>
      );

    case 'roles':
      return (
        <div className="space-y-2 text-xs">
          <div className="p-2 rounded-lg bg-background border border-border space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-semibold text-foreground">Developer (Member):</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/20 text-primary font-bold">
                Assigned → In Progress → Code Review
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Deployments and completions restricted to Admins.
            </p>
          </div>
        </div>
      );

    case 'uat-reject':
      return (
        <div className="space-y-2 text-xs">
          <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/40 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-rose-300 font-bold">
              <span>UAT Rejection History (Cycle 1)</span>
              <span>2 hours ago</span>
            </div>
            <p className="text-rose-200 text-[11px] border-l-2 border-rose-500 pl-2">
              "Regression bug: clicking submit on empty form crashes UI."
            </p>
          </div>
        </div>
      );

    case 'watchers':
      return (
        <div className="space-y-2 text-xs">
          <div className="p-2.5 rounded-lg bg-background border border-border flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-primary font-bold">
              <Eye className="h-4 w-4" />
              <span>Watching (3 Followers)</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold">
              Active
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Follow tasks without altering assignees or distorting workload points.
          </p>
        </div>
      );

    case 'preferences':
      return (
        <div className="space-y-1.5 text-xs">
          {[
            { label: 'Task Assignments', on: true },
            { label: 'UAT Rejections', on: true },
            { label: 'Watcher Updates', on: false },
          ].map((item, idx) => (
            <div key={idx} className="p-1.5 rounded-md bg-background border border-border flex items-center justify-between text-[11px]">
              <span className="text-foreground font-medium">{item.label}</span>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${item.on ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                {item.on ? 'ENABLED' : 'MUTED'}
              </span>
            </div>
          ))}
        </div>
      );

    default:
      return null;
  }
}
