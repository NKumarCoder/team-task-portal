'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Filter, 
  Folder, 
  Clock, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  User, 
  ListChecks, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  Eye,
  Edit3,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Trash2,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  Flame,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  Tag
} from 'lucide-react';
import { dbService } from '@/services/dbService';
import { 
  Project, 
  ProjectChangeChecklist, 
  ProductionRelease, 
  ReleaseType,
  getChecklistPoints,
  getChecklistItems,
  getReleaseItemPoints
} from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatTimeAgo, checkRelease7DayEligibility } from '@/utils';
import CreateChangeDialog from '@/components/changes/CreateChangeDialog';
import ChangeDetailModal from '@/components/changes/ChangeDetailModal';
import CreateReleaseDialog from '@/components/changes/CreateReleaseDialog';
import ReleaseVerificationView from '@/components/changes/ReleaseVerificationView';
import DeleteReleaseConfirmationModal from '@/components/changes/DeleteReleaseConfirmationModal';
import DeleteChangeChecklistModal from '@/components/changes/DeleteChangeChecklistModal';
import toast from 'react-hot-toast';

type ActiveTab = 
  | 'checklists' 
  | 'uat-releases' 
  | 'uat-qa' 
  | 'prod-releases' 
  | 'prod-qa' 
  | 'hotfix-releases' 
  | 'hotfix-qa';

export default function ChangeChecklistsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('checklists');

  // Data states (single shared listeners)
  const [checklists, setChecklists] = useState<ProjectChangeChecklist[]>([]);
  const [releases, setReleases] = useState<ProductionRelease[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // View mode (List View is the default and primary display)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Dialogs & Modals
  const [isCreateChangeOpen, setIsCreateChangeOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<ProjectChangeChecklist | null>(null);
  const [viewingChecklist, setViewingChecklist] = useState<ProjectChangeChecklist | null>(null);
  const [checklistToDelete, setChecklistToDelete] = useState<ProjectChangeChecklist | null>(null);

  // Release Creation & Follow-up State
  const [isCreateReleaseOpen, setIsCreateReleaseOpen] = useState(false);
  const [createReleaseType, setCreateReleaseType] = useState<ReleaseType>('UAT');
  const [followUpParentRelease, setFollowUpParentRelease] = useState<ProductionRelease | null>(null);
  const [activeVerificationRelease, setActiveVerificationRelease] = useState<ProductionRelease | null>(null);

  // Hard Deletion & Selection States (7-Day Terminal Cleanup)
  const [selectedReleaseIds, setSelectedReleaseIds] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [releasesToDelete, setReleasesToDelete] = useState<ProductionRelease[]>([]);
  const [isDeleteAllActive, setIsDeleteAllActive] = useState(false);

  // Subscriptions to live data
  useEffect(() => {
    setLoading(true);
    let unsubChecklists = () => {};
    let unsubReleases = () => {};

    dbService.getProjects()
      .then(projs => setProjects(projs))
      .catch(err => console.error(err));

    unsubChecklists = dbService.subscribeProjectChangeChecklists((items) => {
      setChecklists(items);
      setLoading(false);
    });

    unsubReleases = dbService.subscribeProductionReleases((items) => {
      setReleases(items);
      setActiveVerificationRelease(prev => {
        if (!prev) return null;
        const updated = items.find(r => r.id === prev.id);
        return updated || prev;
      });
    });

    return () => {
      unsubChecklists();
      unsubReleases();
    };
  }, []);

  // Reset page when switching tabs or filters
  useEffect(() => {
    setCurrentPage(1);
    setSelectedReleaseIds(new Set());
  }, [activeTab, searchQuery, selectedProjectFilter, selectedStatusFilter]);

  // Authorization checks
  const isReleaseManager = user?.role === 'Admin' || 
    user?.role === 'SuperAdmin' || 
    (user?.email && ['admin@i2space.com', 'rr@i2space.com'].includes(user.email.toLowerCase()));

  // Categorized releases
  const uatReleases = useMemo(() => {
    return releases.filter(r => (r.releaseType || 'Production') === 'UAT');
  }, [releases]);

  const prodReleases = useMemo(() => {
    return releases.filter(r => (r.releaseType || 'Production') === 'Production');
  }, [releases]);

  const hotfixReleases = useMemo(() => {
    return releases.filter(r => (r.releaseType || 'Production') === 'Hotfix');
  }, [releases]);

  // Filtered change checklists
  const filteredChecklists = useMemo(() => {
    return checklists.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const points = getChecklistPoints(item);
      const matchesSearch = 
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.projectName.toLowerCase().includes(q) ||
        item.createdByName.toLowerCase().includes(q) ||
        points.some(c => c.toLowerCase().includes(q));

      const matchesProject = 
        selectedProjectFilter === 'all' || item.projectId === selectedProjectFilter;

      const matchesStatus = 
        selectedStatusFilter === 'all' || item.status === selectedStatusFilter;

      return matchesSearch && matchesProject && matchesStatus;
    });
  }, [checklists, searchQuery, selectedProjectFilter, selectedStatusFilter]);

  // Generic release filtering helper
  const filterReleases = (list: ProductionRelease[]) => {
    return list.filter((rel) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        rel.name.toLowerCase().includes(q) ||
        rel.createdByName.toLowerCase().includes(q) ||
        rel.items.some(it => it.title.toLowerCase().includes(q) || it.projectName.toLowerCase().includes(q));

      const matchesProject = 
        selectedProjectFilter === 'all' || rel.items.some(it => it.projectId === selectedProjectFilter);

      const matchesStatus = 
        selectedStatusFilter === 'all' || rel.status === selectedStatusFilter;

      return matchesSearch && matchesProject && matchesStatus;
    });
  };

  const filteredUatReleases = useMemo(() => filterReleases(uatReleases), [uatReleases, searchQuery, selectedProjectFilter, selectedStatusFilter]);
  const filteredProdReleases = useMemo(() => filterReleases(prodReleases), [prodReleases, searchQuery, selectedProjectFilter, selectedStatusFilter]);
  const filteredHotfixReleases = useMemo(() => filterReleases(hotfixReleases), [hotfixReleases, searchQuery, selectedProjectFilter, selectedStatusFilter]);

  // Current active data set for pagination
  const activeDatasetCount = useMemo(() => {
    switch (activeTab) {
      case 'checklists': return filteredChecklists.length;
      case 'uat-releases':
      case 'uat-qa': return filteredUatReleases.length;
      case 'prod-releases':
      case 'prod-qa': return filteredProdReleases.length;
      case 'hotfix-releases':
      case 'hotfix-qa': return filteredHotfixReleases.length;
      default: return 0;
    }
  }, [activeTab, filteredChecklists, filteredUatReleases, filteredProdReleases, filteredHotfixReleases]);

  const totalPages = Math.max(1, Math.ceil(activeDatasetCount / pageSize));

  // Paginated slices
  const paginatedChecklists = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredChecklists.slice(start, start + pageSize);
  }, [filteredChecklists, currentPage, pageSize]);

  const paginatedUatReleases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUatReleases.slice(start, start + pageSize);
  }, [filteredUatReleases, currentPage, pageSize]);

  const paginatedProdReleases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProdReleases.slice(start, start + pageSize);
  }, [filteredProdReleases, currentPage, pageSize]);

  const paginatedHotfixReleases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHotfixReleases.slice(start, start + pageSize);
  }, [filteredHotfixReleases, currentPage, pageSize]);

  // Selection helpers for terminal release deletion
  const getCurrentTabReleases = (): ProductionRelease[] => {
    if (activeTab === 'uat-releases' || activeTab === 'uat-qa') return filteredUatReleases;
    if (activeTab === 'prod-releases' || activeTab === 'prod-qa') return filteredProdReleases;
    if (activeTab === 'hotfix-releases' || activeTab === 'hotfix-qa') return filteredHotfixReleases;
    return [];
  };

  const getTerminalReleases = (): ProductionRelease[] => {
    return getCurrentTabReleases().filter(r => 
      r.status === 'Completed' || r.status === 'Partially Rejected' || r.status === 'Rejected'
    );
  };

  const toggleSelectRelease = (id: string) => {
    setSelectedReleaseIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllTerminal = () => {
    const terminal = getTerminalReleases();
    const next = new Set<string>();
    terminal.forEach(r => { if (r.id) next.add(r.id); });
    setSelectedReleaseIds(next);
  };

  const handleClearSelection = () => {
    setSelectedReleaseIds(new Set());
  };

  const openIndividualDelete = (rel: ProductionRelease) => {
    setReleasesToDelete([rel]);
    setIsDeleteAllActive(false);
    setIsDeleteModalOpen(true);
  };

  const openBulkDelete = () => {
    const terminal = getTerminalReleases();
    const selected = terminal.filter(r => r.id && selectedReleaseIds.has(r.id));
    if (selected.length === 0) return;
    setReleasesToDelete(selected);
    setIsDeleteAllActive(false);
    setIsDeleteModalOpen(true);
  };

  const openDeleteAllEligible = () => {
    const terminal = getTerminalReleases();
    if (terminal.length === 0) return;
    setReleasesToDelete(terminal);
    setIsDeleteAllActive(true);
    setIsDeleteModalOpen(true);
  };

  // Follow-up release handler
  const handleStartFollowUpRelease = (rel: ProductionRelease) => {
    setFollowUpParentRelease(rel);
    setCreateReleaseType(rel.releaseType || 'UAT');
    setIsCreateReleaseOpen(true);
  };

  // Status badge styling
  const renderChecklistStatusBadge = (status: ProjectChangeChecklist['status']) => {
    switch (status) {
      case 'Available for UAT':
      case 'Available for Release':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
            <Clock className="h-3 w-3" />
            Available for UAT
          </span>
        );
      case 'Included in UAT':
      case 'Included in Release':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
            <Layers className="h-3 w-3" />
            Included in UAT
          </span>
        );
      case 'Failed in UAT – Developer Action Required':
      case 'Rejected by QA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25">
            <AlertCircle className="h-3 w-3" />
            Failed in UAT – Dev Action
          </span>
        );
      case 'UAT Approved':
      case 'Available for Production':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/25">
            <CheckCircle2 className="h-3 w-3" />
            UAT Approved (Ready for Prod)
          </span>
        );
      case 'Included in Production':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/25">
            <Layers className="h-3 w-3" />
            Included in Prod
          </span>
        );
      case 'Failed in Production – Developer Action Required':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25">
            <AlertCircle className="h-3 w-3" />
            Failed in Prod – Dev Action
          </span>
        );
      case 'Available for Hotfix':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25">
            <Flame className="h-3 w-3" />
            Available for Hotfix
          </span>
        );
      case 'Included in Hotfix':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/25">
            <Flame className="h-3 w-3" />
            Included in Hotfix
          </span>
        );
      case 'Completed':
      case 'Hotfix Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/40 text-muted-foreground border border-card-border">
            {status}
          </span>
        );
    }
  };

  const renderReleaseStatusBadge = (status: ProductionRelease['status']) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case 'Partially Rejected':
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25">
            <AlertCircle className="h-3 w-3" />
            Partially Rejected
          </span>
        );
      case 'In QA':
      case 'Pending QA':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">
            <Clock className="h-3 w-3" />
            In QA
          </span>
        );
    }
  };

  const render7DayCleanupBadge = (rel: ProductionRelease) => {
    const analysis = checkRelease7DayEligibility({
      status: rel.status,
      terminalDate: rel.terminalDate,
      createdDate: rel.createdDate
    });

    if (!analysis.isTerminal) {
      return (
        <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-blue-400" />
          Active
        </span>
      );
    }

    if (analysis.isEligible) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Passed 7-day terminal retention; eligible for hard deletion">
          <CheckCircle2 className="h-3 w-3" />
          Eligible (&ge;7d)
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20" title={`Eligible for cleanup on ${analysis.eligibleDateStr}`}>
        <Clock className="h-3 w-3" />
        {analysis.daysRemaining}d left
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ListChecks className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Release Lifecycle, QA Verification & Cleanup
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Point-wise UAT & Production release workflows, follow-up retries, and policy-based 7-day hard deletion
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setEditingChecklist(null);
              setIsCreateChangeOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            <span>Create Change Checklist</span>
          </button>

          {isReleaseManager && (
            <>
              <button
                onClick={() => {
                  setFollowUpParentRelease(null);
                  setCreateReleaseType('UAT');
                  setIsCreateReleaseOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-cyan-600/20"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create UAT Release</span>
              </button>

              <button
                onClick={() => {
                  setFollowUpParentRelease(null);
                  setCreateReleaseType('Production');
                  setIsCreateReleaseOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-purple-600/20"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Production Release</span>
              </button>

              <button
                onClick={() => {
                  setFollowUpParentRelease(null);
                  setCreateReleaseType('Hotfix');
                  setIsCreateReleaseOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-600/20"
              >
                <Flame className="h-3.5 w-3.5" />
                <span>Create Hotfix</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Primary Tab Navigation across all 7 Sections */}
      <div className="flex items-center gap-1.5 border-b border-card-border pb-1 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => {
            setActiveTab('checklists');
            setActiveVerificationRelease(null);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'checklists'
              ? 'bg-primary/15 text-primary border border-primary/25 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Change Checklists ({checklists.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('uat-releases');
            setActiveVerificationRelease(null);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'uat-releases'
              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <Layers className="h-3.5 w-3.5 text-cyan-400" />
          <span>UAT Releases ({uatReleases.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('uat-qa');
            setActiveVerificationRelease(null);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'uat-qa'
              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
          <span>UAT QA</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('prod-releases');
            setActiveVerificationRelease(null);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'prod-releases'
              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <Layers className="h-3.5 w-3.5 text-purple-400" />
          <span>Production Releases ({prodReleases.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('prod-qa');
            setActiveVerificationRelease(null);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'prod-qa'
              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
          <span>Production QA</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('hotfix-releases');
            setActiveVerificationRelease(null);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'hotfix-releases'
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <Flame className="h-3.5 w-3.5 text-rose-400" />
          <span>Hotfix Releases ({hotfixReleases.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('hotfix-qa');
            setActiveVerificationRelease(null);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'hotfix-qa'
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-rose-400" />
          <span>Hotfix QA</span>
        </button>
      </div>

      {/* Global Filter Bar (Search, Project, Status, Date) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl glass-panel bg-card/60 border border-card-border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, developer, project, or task ID..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-accent/30 border border-card-border text-foreground text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Project filter */}
          <select
            value={selectedProjectFilter}
            onChange={(e) => setSelectedProjectFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-accent/40 border border-card-border text-xs font-semibold text-foreground cursor-pointer focus:outline-none"
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-accent/40 border border-card-border text-xs font-semibold text-foreground cursor-pointer focus:outline-none"
          >
            <option value="all">All Statuses</option>
            {activeTab === 'checklists' ? (
              <>
                <option value="Available for UAT">Available for UAT</option>
                <option value="Included in UAT">Included in UAT</option>
                <option value="Failed in UAT – Developer Action Required">Failed in UAT</option>
                <option value="UAT Approved">UAT Approved (Ready for Prod)</option>
                <option value="Included in Production">Included in Production</option>
                <option value="Completed">Completed</option>
                <option value="Available for Hotfix">Available for Hotfix</option>
              </>
            ) : (
              <>
                <option value="In QA">In QA</option>
                <option value="Completed">Completed</option>
                <option value="Partially Rejected">Partially Rejected</option>
              </>
            )}
          </select>

          {/* Optional Card toggle for Checklists section only */}
          {activeTab === 'checklists' && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-accent/40 border border-card-border">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                title="List View (Default)"
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'card'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                title="Card View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: Project Change Checklists */}
      {activeTab === 'checklists' && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-xs text-muted-foreground">Loading change checklists...</p>
            </div>
          ) : filteredChecklists.length === 0 ? (
            <div className="py-16 px-4 text-center glass-panel rounded-2xl border border-dashed border-card-border space-y-3">
              <ListChecks className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-bold text-foreground">No change checklists found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Start by documenting verification points under an active project.
              </p>
              <button
                onClick={() => setIsCreateChangeOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-md shadow-primary/20"
              >
                <Plus className="h-4 w-4" />
                <span>Create Change Checklist</span>
              </button>
            </div>
          ) : viewMode === 'list' ? (
            /* Primary Compact List View */
            <div className="space-y-3">
              <div className="glass-panel rounded-2xl border border-card-border overflow-hidden bg-card/60 shadow-xs">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-card-border/80 bg-accent/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider whitespace-nowrap">
                        <th className="py-3 px-4">Project</th>
                        <th className="py-3 px-4 min-w-[200px]">Change Title</th>
                        <th className="py-3 px-4">Developer</th>
                        <th className="py-3 px-4">Verification Points</th>
                        <th className="py-3 px-4">Release Status</th>
                        <th className="py-3 px-4">Created Date</th>
                        <th className="py-3 px-4">Last Updated</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border/40">
                      {paginatedChecklists.map((item) => {
                        const isRejected = item.status.includes('Failed') || item.status === 'Rejected by QA';
                        const isCreator = Boolean(user?.email && item.createdBy && item.createdBy.toLowerCase() === user.email.toLowerCase());
                        const canEdit = !item.currentReleaseId || isRejected;
                        const canDeleteChecklist = (isCreator || isReleaseManager) && !item.currentReleaseId;
                        const pointsCount = getChecklistPoints(item).length;

                        return (
                          <tr key={item.id} className={`transition-colors hover:bg-accent/30 ${isRejected ? 'bg-rose-500/[0.03]' : ''}`}>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="text-[11px] font-bold text-primary px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/20">
                                {item.projectName}
                              </span>
                            </td>

                            <td className="py-3 px-4 font-bold text-foreground min-w-[200px]">
                              <Link 
                                href={`/dashboard/change-checklists/${item.id}`}
                                className="hover:text-primary transition-colors block leading-snug truncate max-w-xs"
                                title={item.title}
                              >
                                {item.title}
                              </Link>
                              {item.description && (
                                <p className="text-[11px] text-muted-foreground font-normal truncate max-w-xs mt-0.5">
                                  {item.description}
                                </p>
                              )}
                            </td>

                            <td className="py-3 px-4 text-foreground whitespace-nowrap">
                              <span className="font-medium truncate block max-w-[130px]" title={item.createdByName}>
                                {item.createdByName}
                              </span>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 font-semibold text-foreground bg-accent/40 px-2 py-0.5 rounded-md border border-card-border text-[11px]">
                                <Sparkles className="h-3 w-3 text-primary" />
                                <span>{pointsCount} point{pointsCount === 1 ? '' : 's'}</span>
                              </span>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              {renderChecklistStatusBadge(item.status)}
                            </td>

                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap text-[11px]">
                              {formatDate(item.createdDate)}
                            </td>

                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap text-[11px]">
                              {formatTimeAgo(item.updatedDate || item.createdDate)}
                            </td>

                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/dashboard/change-checklists/${item.id}`}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/40 hover:bg-accent/70 text-foreground font-semibold text-xs transition-colors cursor-pointer"
                                  title="View Details"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>View</span>
                                </Link>

                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingChecklist(item);
                                      setIsCreateChangeOpen(true);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                      isRejected 
                                        ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-xs' 
                                        : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20'
                                    }`}
                                    title={isRejected ? 'Correct & Resubmit Failed Points' : 'Edit'}
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </button>
                                )}

                                {canDeleteChecklist && (
                                  <button
                                    type="button"
                                    onClick={() => setChecklistToDelete(item)}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                    title="Delete Checklist"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* Card View (secondary view option) */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedChecklists.map((item) => {
                const isRejected = item.status.includes('Failed') || item.status === 'Rejected by QA';
                const isCreator = Boolean(user?.email && item.createdBy && item.createdBy.toLowerCase() === user.email.toLowerCase());
                const canEdit = !item.currentReleaseId || isRejected;
                const canDeleteChecklist = (isCreator || isReleaseManager) && !item.currentReleaseId;

                return (
                  <div key={item.id} className="glass-panel p-5 rounded-2xl border border-card-border bg-card/60 flex flex-col justify-between gap-4">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-primary px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/20">
                          {item.projectName}
                        </span>
                        {renderChecklistStatusBadge(item.status)}
                      </div>

                      <h3 className="text-sm font-bold text-foreground leading-snug hover:text-primary transition-colors">
                        <Link href={`/dashboard/change-checklists/${item.id}`}>
                          {item.title}
                        </Link>
                      </h3>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-card-border/60 text-xs">
                      <span className="text-muted-foreground">{item.createdByName} &bull; {formatDate(item.createdDate)}</span>
                      <Link href={`/dashboard/change-checklists/${item.id}`} className="px-2.5 py-1 rounded-lg bg-accent/40 hover:bg-accent/70 font-semibold">
                        View
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTIONS 2, 4, 6: Releases Tables (UAT, Production, Hotfix) */}
      {(activeTab === 'uat-releases' || activeTab === 'prod-releases' || activeTab === 'hotfix-releases') && (
        <div className="space-y-4">
          {/* Header Action Bar with 7-Day Terminal Cleanup Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl glass-panel bg-card/60 border border-card-border gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                {activeTab === 'uat-releases' && <Layers className="h-4 w-4 text-cyan-400" />}
                {activeTab === 'prod-releases' && <Layers className="h-4 w-4 text-purple-400" />}
                {activeTab === 'hotfix-releases' && <Flame className="h-4 w-4 text-rose-400" />}
                <span>
                  {activeTab === 'uat-releases' ? 'UAT Releases' : activeTab === 'prod-releases' ? 'Production Releases' : 'Hotfix Releases'}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Terminal records become eligible for hard cleanup 7 days after reaching terminal status.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {isReleaseManager && selectedReleaseIds.size > 0 && (
                <button
                  type="button"
                  onClick={openBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-600/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Selected ({selectedReleaseIds.size})</span>
                </button>
              )}

              {isReleaseManager && getTerminalReleases().length > 0 && (
                <button
                  type="button"
                  onClick={openDeleteAllEligible}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/25 text-xs font-bold transition-all cursor-pointer"
                  title="Purge eligible terminal release records"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete All Eligible ({getTerminalReleases().length})</span>
                </button>
              )}

              {isReleaseManager && (
                <button
                  onClick={() => {
                    setFollowUpParentRelease(null);
                    setCreateReleaseType(
                      activeTab === 'uat-releases' ? 'UAT' :
                      activeTab === 'hotfix-releases' ? 'Hotfix' : 'Production'
                    );
                    setIsCreateReleaseOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-md shadow-primary/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Release</span>
                </button>
              )}
            </div>
          </div>

          {/* Release Table in List View */}
          {(() => {
            const list = 
              activeTab === 'uat-releases' ? paginatedUatReleases :
              activeTab === 'hotfix-releases' ? paginatedHotfixReleases :
              paginatedProdReleases;

            if (loading) {
              return (
                <div className="py-16 text-center space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  <p className="text-xs text-muted-foreground">Loading releases...</p>
                </div>
              );
            }

            if (list.length === 0) {
              return (
                <div className="py-16 px-4 text-center glass-panel rounded-2xl border border-dashed border-card-border space-y-3">
                  <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-bold text-foreground">No releases found</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Create a new release to group ready project changes for QA verification.
                  </p>
                </div>
              );
            }

            return (
              <div className="glass-panel rounded-2xl border border-card-border overflow-hidden bg-card/60 shadow-xs">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-card-border/80 bg-accent/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider whitespace-nowrap">
                        {isReleaseManager && <th className="py-3 px-3 w-8">Select</th>}
                        <th className="py-3 px-4 min-w-[200px]">Release Name</th>
                        <th className="py-3 px-4">Release Date</th>
                        <th className="py-3 px-4">Included Changes</th>
                        <th className="py-3 px-4">Passed</th>
                        <th className="py-3 px-4">Rejected</th>
                        <th className="py-3 px-4">Pending</th>
                        <th className="py-3 px-4">Release Status</th>
                        <th className="py-3 px-4">7-Day Cleanup</th>
                        <th className="py-3 px-4">Created By</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border/40">
                      {list.map((rel) => {
                        const totalChanges = rel.items.length;
                        const passedCount = rel.items.filter(it => it.status === 'Completed').length;
                        const rejectedCount = rel.items.filter(it => it.status === 'Rejected').length;
                        const pendingCount = rel.items.filter(it => it.status === 'Pending QA').length;
                        const isTerminal = rel.status === 'Completed' || rel.status === 'Partially Rejected' || rel.status === 'Rejected';
                        const isSelected = Boolean(rel.id && selectedReleaseIds.has(rel.id));

                        return (
                          <tr key={rel.id} className={`transition-colors hover:bg-accent/30 ${isSelected ? 'bg-primary/[0.05]' : ''}`}>
                            {isReleaseManager && (
                              <td className="py-3 px-3 whitespace-nowrap text-center">
                                {isTerminal ? (
                                  <button
                                    type="button"
                                    onClick={() => rel.id && toggleSelectRelease(rel.id)}
                                    className="text-primary hover:opacity-80 transition-opacity cursor-pointer"
                                  >
                                    {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-muted-foreground/60" />}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground/30">&mdash;</span>
                                )}
                              </td>
                            )}

                            <td className="py-3 px-4 font-bold text-foreground min-w-[200px]">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveVerificationRelease(rel);
                                  setActiveTab(
                                    rel.releaseType === 'UAT' ? 'uat-qa' :
                                    rel.releaseType === 'Hotfix' ? 'hotfix-qa' : 'prod-qa'
                                  );
                                }}
                                className="hover:text-primary transition-colors text-left font-bold"
                              >
                                {rel.name}
                              </button>
                              {rel.isFollowUp && (
                                <span className="block text-[10px] text-amber-400 font-semibold mt-0.5">
                                  Follow-up / Retry Release
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                              {rel.releaseDate}
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-semibold text-foreground">{totalChanges} change{totalChanges === 1 ? '' : 's'}</span>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-bold text-emerald-400">{passedCount}</span>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`font-bold ${rejectedCount > 0 ? 'text-rose-400' : 'text-muted-foreground'}`}>{rejectedCount}</span>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`font-bold ${pendingCount > 0 ? 'text-blue-400' : 'text-muted-foreground'}`}>{pendingCount}</span>
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              {renderReleaseStatusBadge(rel.status)}
                            </td>

                            <td className="py-3 px-4 whitespace-nowrap">
                              {render7DayCleanupBadge(rel)}
                            </td>

                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                              {rel.createdByName}
                            </td>

                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveVerificationRelease(rel);
                                    setActiveTab(
                                      rel.releaseType === 'UAT' ? 'uat-qa' :
                                      rel.releaseType === 'Hotfix' ? 'hotfix-qa' : 'prod-qa'
                                    );
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                                >
                                  <ShieldCheck className="h-3 w-3" />
                                  <span>Verify</span>
                                </button>

                                {(rel.status === 'Partially Rejected' || rel.status === 'Rejected') && isReleaseManager && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartFollowUpRelease(rel)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/40 hover:bg-accent/70 text-foreground font-semibold text-xs transition-colors cursor-pointer"
                                    title="Create Follow-up Release for failed points"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    <span>Follow-up</span>
                                  </button>
                                )}

                                {isTerminal && isReleaseManager && (
                                  <button
                                    type="button"
                                    onClick={() => openIndividualDelete(rel)}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                    title="Hard delete terminal record"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* SECTIONS 3, 5, 7: Release Verification & QA (UAT QA, Production QA, Hotfix QA) */}
      {(activeTab === 'uat-qa' || activeTab === 'prod-qa' || activeTab === 'hotfix-qa') && (
        <div className="space-y-4">
          {activeVerificationRelease ? (
            <ReleaseVerificationView
              release={activeVerificationRelease}
              onBack={() => setActiveVerificationRelease(null)}
              onCreateFollowUp={(rel) => handleStartFollowUpRelease(rel)}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl glass-panel bg-card/60 border border-card-border gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {activeTab === 'uat-qa' ? 'Select UAT Release to Verify' : activeTab === 'prod-qa' ? 'Select Production Release to Verify' : 'Select Hotfix Release to Verify'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Execute point-wise verification. Failed points return for developer correction, while passed points remain locked as Passed.
                  </p>
                </div>
              </div>

              {/* Table of releases for this QA section */}
              {(() => {
                const list = 
                  activeTab === 'uat-qa' ? paginatedUatReleases :
                  activeTab === 'hotfix-qa' ? paginatedHotfixReleases :
                  paginatedProdReleases;

                if (list.length === 0) {
                  return (
                    <div className="py-16 text-center text-xs text-muted-foreground glass-panel rounded-2xl border border-dashed border-card-border">
                      No releases available in this section.
                    </div>
                  );
                }

                return (
                  <div className="glass-panel rounded-2xl border border-card-border overflow-hidden bg-card/60 shadow-xs">
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-card-border/80 bg-accent/30 text-muted-foreground uppercase text-[10px] font-bold tracking-wider whitespace-nowrap">
                            <th className="py-3 px-4 min-w-[200px]">Release Name</th>
                            <th className="py-3 px-4">Release Type</th>
                            <th className="py-3 px-4">Project(s)</th>
                            <th className="py-3 px-4">Total Points</th>
                            <th className="py-3 px-4">Passed</th>
                            <th className="py-3 px-4">Failed</th>
                            <th className="py-3 px-4">Pending</th>
                            <th className="py-3 px-4">QA Status</th>
                            <th className="py-3 px-4">Created Date</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-card-border/40">
                          {list.map((rel) => {
                            const allPoints = rel.items.flatMap(it => getReleaseItemPoints(it));
                            const passedPts = allPoints.filter(p => p.status === 'Passed').length;
                            const failedPts = allPoints.filter(p => p.status === 'Failed').length;
                            const pendingPts = allPoints.filter(p => p.status === 'Pending').length;
                            const projectNames = Array.from(new Set(rel.items.map(it => it.projectName))).join(', ');

                            return (
                              <tr key={rel.id} className="transition-colors hover:bg-accent/30">
                                <td className="py-3 px-4 font-bold text-foreground">
                                  <button
                                    type="button"
                                    onClick={() => setActiveVerificationRelease(rel)}
                                    className="hover:text-primary transition-colors text-left"
                                  >
                                    {rel.name}
                                  </button>
                                  {rel.isFollowUp && (
                                    <span className="block text-[10px] text-amber-400 font-semibold mt-0.5">
                                      Follow-up / Retry
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    (rel.releaseType || 'Production') === 'UAT' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25' :
                                    (rel.releaseType || 'Production') === 'Hotfix' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' :
                                    'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                                  }`}>
                                    {rel.releaseType || 'Production'}
                                  </span>
                                </td>

                                <td className="py-3 px-4 text-muted-foreground max-w-xs truncate" title={projectNames}>
                                  {projectNames || '—'}
                                </td>

                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className="font-semibold text-foreground">{allPoints.length} point{allPoints.length === 1 ? '' : 's'}</span>
                                </td>

                                <td className="py-3 px-4 whitespace-nowrap font-bold text-emerald-400">
                                  {passedPts}
                                </td>

                                <td className="py-3 px-4 whitespace-nowrap font-bold text-rose-400">
                                  {failedPts}
                                </td>

                                <td className="py-3 px-4 whitespace-nowrap font-bold text-blue-400">
                                  {pendingPts}
                                </td>

                                <td className="py-3 px-4 whitespace-nowrap">
                                  {renderReleaseStatusBadge(rel.status)}
                                </td>

                                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                                  {formatDate(rel.createdDate)}
                                </td>

                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setActiveVerificationRelease(rel)}
                                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer"
                                    >
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                      <span>Open QA</span>
                                    </button>

                                    {(rel.status === 'Partially Rejected' || rel.status === 'Rejected') && isReleaseManager && (
                                      <button
                                        type="button"
                                        onClick={() => handleStartFollowUpRelease(rel)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/40 hover:bg-accent/70 text-foreground font-semibold text-xs transition-colors cursor-pointer"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                        <span>Follow-up</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Shared Pagination Controls across all 7 views */}
      {activeDatasetCount > pageSize && !activeVerificationRelease && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl glass-panel bg-card/60 border border-card-border text-xs text-muted-foreground">
          <div>
            Showing <strong className="text-foreground">{(currentPage - 1) * pageSize + 1}</strong> to <strong className="text-foreground">{Math.min(currentPage * pageSize, activeDatasetCount)}</strong> of <strong className="text-foreground">{activeDatasetCount}</strong> records
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-card-border bg-accent/30 text-foreground font-semibold hover:bg-accent/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 font-medium">Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-card-border bg-accent/30 text-foreground font-semibold hover:bg-accent/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Sticky Action Bar for Selected Terminal Releases */}
      {selectedReleaseIds.size > 0 && isReleaseManager && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-card border border-primary/40 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Selected: <strong className="text-primary">{selectedReleaseIds.size}</strong> release{selectedReleaseIds.size === 1 ? '' : 's'}
            </span>
          </div>
          <div className="h-4 w-px bg-card-border" />
          <button 
            type="button"
            onClick={handleClearSelection}
            className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1 rounded-lg hover:bg-accent/40 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={openBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-600/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Selected</span>
          </button>
        </div>
      )}

      {/* Modals & Dialogs */}
      <CreateChangeDialog
        isOpen={isCreateChangeOpen}
        onClose={() => {
          setIsCreateChangeOpen(false);
          setEditingChecklist(null);
        }}
        initialData={editingChecklist}
      />

      <ChangeDetailModal
        checklist={viewingChecklist}
        isOpen={viewingChecklist !== null}
        onClose={() => setViewingChecklist(null)}
        canEdit={true}
        onEdit={(item) => {
          setViewingChecklist(null);
          setEditingChecklist(item);
          setIsCreateChangeOpen(true);
        }}
        onDeleted={(id) => {
          setChecklists(prev => prev.filter(c => c.id !== id));
          setViewingChecklist(null);
        }}
        onChecklistUpdated={(updated) => {
          setChecklists(prev => prev.map(c => c.id === updated.id ? updated : c));
          setViewingChecklist(updated);
        }}
      />

      <CreateReleaseDialog
        isOpen={isCreateReleaseOpen}
        onClose={() => {
          setIsCreateReleaseOpen(false);
          setFollowUpParentRelease(null);
        }}
        defaultReleaseType={createReleaseType}
        parentRelease={followUpParentRelease}
        onSuccess={(id) => {
          if (createReleaseType === 'UAT') setActiveTab('uat-releases');
          else if (createReleaseType === 'Hotfix') setActiveTab('hotfix-releases');
          else setActiveTab('prod-releases');
          setFollowUpParentRelease(null);
        }}
      />

      <DeleteReleaseConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setReleasesToDelete([]);
          setIsDeleteAllActive(false);
        }}
        releasesToDelete={releasesToDelete}
        isDeleteAll={isDeleteAllActive}
        onSuccess={(deletedCount) => {
          setSelectedReleaseIds(new Set());
          if (activeVerificationRelease && releasesToDelete.some(r => r.id === activeVerificationRelease.id)) {
            setActiveVerificationRelease(null);
          }
        }}
      />

      <DeleteChangeChecklistModal
        isOpen={checklistToDelete !== null}
        onClose={() => setChecklistToDelete(null)}
        checklist={checklistToDelete}
        onSuccess={(deletedId) => {
          setChecklists(prev => prev.filter(c => c.id !== deletedId));
          setChecklistToDelete(null);
        }}
      />
    </div>
  );
}
