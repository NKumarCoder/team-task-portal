'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { dbService } from '@/services/dbService';
import { Project, ProjectChangeChecklist, ProductionRelease, getChecklistPoints } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/utils';
import CreateChangeDialog from '@/components/changes/CreateChangeDialog';
import ChangeDetailModal from '@/components/changes/ChangeDetailModal';
import CreateReleaseDialog from '@/components/changes/CreateReleaseDialog';
import ReleaseVerificationView from '@/components/changes/ReleaseVerificationView';
import toast from 'react-hot-toast';

export default function ChangeChecklistsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'checklists' | 'releases' | 'qa'>('checklists');

  // Data states
  const [checklists, setChecklists] = useState<ProjectChangeChecklist[]>([]);
  const [releases, setReleases] = useState<ProductionRelease[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // Modals & Dialogs
  const [isCreateChangeOpen, setIsCreateChangeOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<ProjectChangeChecklist | null>(null);
  const [viewingChecklist, setViewingChecklist] = useState<ProjectChangeChecklist | null>(null);
  const [isCreateReleaseOpen, setIsCreateReleaseOpen] = useState(false);
  const [activeVerificationRelease, setActiveVerificationRelease] = useState<ProductionRelease | null>(null);

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
      // If actively verifying a release, update its instance
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

  // Status badge styling
  const renderStatusBadge = (status: ProjectChangeChecklist['status']) => {
    switch (status) {
      case 'Available for Release':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">
            <Clock className="h-3 w-3" />
            Available for Release
          </span>
        );
      case 'Included in Release':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/25">
            <Layers className="h-3 w-3" />
            Included in Release
          </span>
        );
      case 'Rejected by QA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25">
            <AlertCircle className="h-3 w-3" />
            Rejected by QA
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  const isReleaseManager = user?.role === 'SuperAdmin' || user?.role === 'Admin';

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ListChecks className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Project Change Checklist & Release QA
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Document developer changes, group them into production releases, and verify release readiness
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setEditingChecklist(null);
              setIsCreateChangeOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            <span>Create Change Checklist</span>
          </button>

          {isReleaseManager && (
            <button
              onClick={() => setIsCreateReleaseOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition-all cursor-pointer shadow-md shadow-purple-600/20"
            >
              <Layers className="h-4 w-4" />
              <span>Create Release</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-card-border pb-1 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('checklists');
            setActiveVerificationRelease(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'checklists'
              ? 'bg-primary/15 text-primary border border-primary/25 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Project Change Checklists ({checklists.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('releases');
            setActiveVerificationRelease(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'releases'
              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Production Releases ({releases.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('qa')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'qa'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Release Verification & QA</span>
        </button>
      </div>

      {/* TAB 1: Project Change Checklists */}
      {activeTab === 'checklists' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl glass-panel bg-card/60 border border-card-border">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by change title, developer, or project..."
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
                <option value="Available for Release">Available for Release</option>
                <option value="Included in Release">Included in Release</option>
                <option value="Rejected by QA">Rejected by QA</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {/* List of Changes */}
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
                {searchQuery || selectedProjectFilter !== 'all' || selectedStatusFilter !== 'all'
                  ? 'No results match your search filters.'
                  : 'Start by documenting your first technical change points under an existing project.'}
              </p>
              <button
                onClick={() => setIsCreateChangeOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer shadow-md shadow-primary/20"
              >
                <Plus className="h-4 w-4" />
                <span>Create Change Checklist</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredChecklists.map((item) => {
                const isRejected = item.status === 'Rejected by QA';
                const isAvailable = item.status === 'Available for Release';
                const canEdit = isAvailable || isRejected;

                return (
                  <div
                    key={item.id}
                    className={`glass-panel p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                      isRejected 
                        ? 'border-rose-500/30 bg-rose-500/[0.03] hover:border-rose-500/50' 
                        : 'border-card-border bg-card/60 hover:bg-accent/20'
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-primary px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/20">
                          {item.projectName}
                        </span>
                        {renderStatusBadge(item.status)}
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-foreground leading-snug hover:text-primary transition-colors">
                        {item.title}
                      </h3>

                      {/* Description */}
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      {/* Rejection Alert snippet if rejected */}
                      {isRejected && item.rejectionHistory && item.rejectionHistory.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 space-y-0.5">
                          <p className="font-bold flex items-center gap-1 text-[11px]">
                            <AlertCircle className="h-3 w-3" />
                            QA Rejection Reason:
                          </p>
                          <p className="text-[11px] text-foreground/90 italic line-clamp-2 pl-4">
                            "{item.rejectionHistory[item.rejectionHistory.length - 1].reason}"
                          </p>
                        </div>
                      )}

                      {/* Points count strip */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <strong className="text-foreground">{getChecklistPoints(item).length}</strong> change / verification point{getChecklistPoints(item).length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-card-border/60 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-semibold text-foreground truncate max-w-[120px]">{item.createdByName}</span>
                        <span>&bull;</span>
                        <span>{formatDate(item.createdDate)}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingChecklist(item)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/40 hover:bg-accent/70 text-foreground font-semibold transition-colors cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View</span>
                        </button>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingChecklist(item);
                              setIsCreateChangeOpen(true);
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                              isRejected 
                                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-xs' 
                                : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20'
                            }`}
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>{isRejected ? 'Correct' : 'Edit'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Production Releases */}
      {activeTab === 'releases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-2xl glass-panel bg-card/60 border border-card-border">
            <p className="text-xs text-muted-foreground font-medium">
              Production releases group multiple project changes for structured QA verification and deployment.
            </p>
            {isReleaseManager && (
              <button
                onClick={() => setIsCreateReleaseOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition-all cursor-pointer shadow-md shadow-purple-600/20 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Production Release</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-400" />
              <p className="text-xs text-muted-foreground">Loading production releases...</p>
            </div>
          ) : releases.length === 0 ? (
            <div className="py-16 px-4 text-center glass-panel rounded-2xl border border-dashed border-card-border space-y-3">
              <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-bold text-foreground">No production releases yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Release Managers can group ready project changes into a dated production release.
              </p>
              {isReleaseManager && (
                <button
                  onClick={() => setIsCreateReleaseOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition-all cursor-pointer shadow-md shadow-purple-600/20"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Production Release</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {releases.map((rel) => {
                const total = rel.items.length;
                const completed = rel.items.filter(it => it.status === 'Completed').length;
                const rejected = rel.items.filter(it => it.status === 'Rejected').length;

                return (
                  <div
                    key={rel.id}
                    className="glass-panel p-5 rounded-2xl border border-card-border bg-card/60 hover:bg-accent/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          rel.status === 'Completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                          rel.status === 'Partially Rejected' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' :
                          'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                        }`}>
                          {rel.status}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Release Date: <strong className="text-foreground">{rel.releaseDate}</strong>
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-foreground">
                        {rel.name}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>Includes <strong className="text-foreground">{total}</strong> project changes</span>
                        <span>&bull;</span>
                        <span className="text-emerald-400 font-semibold">{completed} passed</span>
                        {rejected > 0 && (
                          <>
                            <span>&bull;</span>
                            <span className="text-rose-400 font-semibold">{rejected} rejected</span>
                          </>
                        )}
                        <span>&bull;</span>
                        <span>Created by {rel.createdByName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveVerificationRelease(rel);
                          setActiveTab('qa');
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>Verify in QA</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Release Verification & QA */}
      {activeTab === 'qa' && (
        <div className="space-y-4">
          {activeVerificationRelease ? (
            <ReleaseVerificationView
              release={activeVerificationRelease}
              onBack={() => setActiveVerificationRelease(null)}
            />
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl glass-panel bg-card/60 border border-card-border">
                <h3 className="text-sm font-bold text-foreground">Select a Production Release to Verify</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose an active release to review each developer's implemented changes and execute point-wise verification.
                </p>
              </div>

              {releases.length === 0 ? (
                <div className="py-16 text-center text-xs text-muted-foreground">
                  No releases created yet. Create a release from the Production Releases tab first.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {releases.map((rel) => (
                    <div
                      key={rel.id}
                      onClick={() => setActiveVerificationRelease(rel)}
                      className="glass-panel p-5 rounded-2xl border border-card-border bg-card/60 hover:bg-accent/25 transition-all cursor-pointer space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          rel.status === 'Completed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                          rel.status === 'Partially Rejected' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' :
                          'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                        }`}>
                          {rel.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{rel.releaseDate}</span>
                      </div>

                      <h4 className="text-sm font-bold text-foreground leading-snug">
                        {rel.name}
                      </h4>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-card-border/60">
                        <span className="text-muted-foreground">{rel.items.length} project change(s)</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          Open QA Checklist &rarr;
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dialogs & Modals */}
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
        onClose={() => setIsCreateReleaseOpen(false)}
        onSuccess={(id) => {
          setActiveTab('releases');
        }}
      />
    </div>
  );
}
