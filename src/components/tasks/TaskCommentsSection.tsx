'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Reply,
  Edit2,
  Trash2,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  AlertCircle,
  AtSign,
  Loader2,
  Smile
} from 'lucide-react';
import { Comment, Member, Task } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { dbService } from '@/services/dbService';
import { formatDate, formatTimeAgo } from '@/utils';
import toast from 'react-hot-toast';

interface TaskCommentsSectionProps {
  task: Task;
}

const COMMENTS_PER_PAGE = 20;

export default function TaskCommentsSection({ task }: TaskCommentsSectionProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const targetCommentId = searchParams.get('commentId');

  const [comments, setComments] = useState<Comment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // New root comment input
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Replying state: parentId -> boolean
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Editing state: commentId -> text
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Expanded replies set: Set<parentId>
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  // Pagination
  const [visibleCount, setVisibleCount] = useState(COMMENTS_PER_PAGE);

  // Autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [activeInputType, setActiveInputType] = useState<'new' | 'reply' | 'edit' | null>(null);

  const newTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = user?.role === 'SuperAdmin';
  const isAdmin = user?.role === 'Admin' || isSuperAdmin;

  // Subscribe to comments
  useEffect(() => {
    if (!task.id) return;
    setLoading(true);

    const unsubscribe = dbService.subscribeComments(task.id, (fetched) => {
      setComments(fetched);
      setLoading(false);

      // Auto-expand thread if targetCommentId is a reply
      if (targetCommentId) {
        const found = fetched.find(c => c.id === targetCommentId);
        if (found?.parentId) {
          setExpandedReplies(prev => new Set(prev).add(found.parentId!));
        }
      }
    });

    return () => unsubscribe();
  }, [task.id, targetCommentId]);

  // Load team members for @mention autocomplete
  useEffect(() => {
    let mounted = true;
    dbService.getMembers().then((fetched) => {
      if (mounted) {
        setMembers(fetched.filter(m => m.isActive !== false));
      }
    }).catch(err => {
      console.error('Failed to load team members for mentions:', err);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-scroll to target comment if specified
  useEffect(() => {
    if (!targetCommentId || comments.length === 0) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`comment-${targetCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary', 'bg-primary/5');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary', 'bg-primary/5');
        }, 3000);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [targetCommentId, comments]);

  // Group comments: Root comments and their replies
  const { rootComments, repliesMap, totalCount } = useMemo(() => {
    const roots: Comment[] = [];
    const replies = new Map<string, Comment[]>();
    let total = 0;

    comments.forEach(c => {
      total++;
      if (c.parentId) {
        const existing = replies.get(c.parentId) || [];
        existing.push(c);
        replies.set(c.parentId, existing);
      } else {
        roots.push(c);
      }
    });

    // Chronological order: oldest to newest
    roots.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Sort replies chronologically
    replies.forEach((rList) => {
      rList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });

    return { rootComments: roots, repliesMap: replies, totalCount: total };
  }, [comments]);

  // Paginated roots
  const displayedRoots = useMemo(() => {
    return rootComments.slice(0, visibleCount);
  }, [rootComments, visibleCount]);

  // Toggle expand replies
  const toggleReplies = (parentId: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  // Mention autocomplete filtered members
  const filteredMentionMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase().trim();
    return members.filter(m => {
      const name = (m.name || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [members, mentionQuery]);

  // Handle typing & mention detection
  const handleTextChange = (
    value: string,
    setText: (val: string) => void,
    inputType: 'new' | 'reply' | 'edit',
    textarea: HTMLTextAreaElement | null
  ) => {
    setText(value);
    setActiveInputType(inputType);

    if (!textarea) return;
    const cursorPos = textarea.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      const queryPart = textBeforeCursor.slice(lastAtPos + 1);
      // Valid mention query: letters/numbers/spaces without newline
      if (!/[\n]/.test(queryPart) && queryPart.length <= 25) {
        setMentionQuery(queryPart);
        setMentionIndex(0);
        return;
      }
    }
    setMentionQuery(null);
  };

  // Select a mention from autocomplete
  const applyMention = (member: Member) => {
    let currentText = '';
    let setText: (val: string) => void = () => {};
    let textarea: HTMLTextAreaElement | null = null;

    if (activeInputType === 'new') {
      currentText = newCommentText;
      setText = setNewCommentText;
      textarea = newTextareaRef.current;
    } else if (activeInputType === 'reply') {
      currentText = replyText;
      setText = setReplyText;
      textarea = replyTextareaRef.current;
    } else if (activeInputType === 'edit') {
      currentText = editText;
      setText = setEditText;
      textarea = editTextareaRef.current;
    }

    if (!textarea) return;

    const cursorPos = textarea.selectionStart || currentText.length;
    const textBeforeCursor = currentText.slice(0, cursorPos);
    const textAfterCursor = currentText.slice(cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      const displayName = (member.name && member.name.trim()) || member.email.split('@')[0];
      const memberRef = member.email.toLowerCase().trim();
      const mentionTag = `@[${displayName}](${memberRef}) `;
      const newFullText = textBeforeCursor.slice(0, lastAtPos) + mentionTag + textAfterCursor;
      setText(newFullText);
      setMentionQuery(null);

      // Restore cursor position after the inserted mention
      setTimeout(() => {
        if (textarea) {
          const newPos = lastAtPos + mentionTag.length;
          textarea.focus();
          textarea.setSelectionRange(newPos, newPos);
        }
      }, 50);
    }
  };

  // Helper to extract structured mention objects from comment content
  const extractStructuredMentions = (content: string) => {
    const list: { userId: string; userName: string; userEmail?: string; uid?: string }[] = [];
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    let mMatch;
    while ((mMatch = mentionRegex.exec(content)) !== null) {
      const rawName = mMatch[1].trim();
      const rawRef = mMatch[2].toLowerCase().trim();
      const foundMember = members.find(
        (m) =>
          (m.email && m.email.toLowerCase() === rawRef) ||
          m.uid === rawRef ||
          m.id === rawRef
      );

      if (foundMember) {
        list.push({
          userId: foundMember.email.toLowerCase(),
          userName: foundMember.name || rawName,
          userEmail: foundMember.email.toLowerCase(),
          uid: foundMember.uid || foundMember.id,
        });
      } else {
        list.push({
          userId: rawRef,
          userName: rawName,
          userEmail: rawRef.includes('@') ? rawRef : undefined,
        });
      }
    }
    return list;
  };

  // Autocomplete keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredMentionMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredMentionMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredMentionMembers.length) % filteredMentionMembers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyMention(filteredMentionMembers[mentionIndex]);
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
      }
    }
  };

  // Submit root comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCommentText.trim();
    if (!clean || submittingComment || !user?.email || !task.id) return;

    setSubmittingComment(true);
    try {
      const structuredMentions = extractStructuredMentions(clean);
      const res = await dbService.addComment(
        {
          taskId: task.id,
          userId: user.email.toLowerCase(),
          userName: user.displayName || user.email.split('@')[0],
          userAvatarColor: (user as any).avatarColor || '#6366f1',
          content: clean,
          mentions: structuredMentions,
          timestamp: new Date().toISOString()
        },
        task.taskId,
        task.title
      );
      setNewCommentText('');
      setMentionQuery(null);

      // Feedback for auto-co-assignees
      const autoAssigned = res.autoAssignedMembers || [];
      if (autoAssigned.length === 1) {
        toast.success(`Comment posted. ${autoAssigned[0].name} was automatically added as a co-assignee.`);
      } else if (autoAssigned.length > 1) {
        const names = autoAssigned.map((m) => m.name).join(' and ');
        toast.success(`Comment posted. ${names} were added as co-assignees.`);
      } else {
        toast.success('Comment posted successfully.');
      }
    } catch (err: any) {
      console.error('Failed to post comment:', err);
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Submit reply
  const handlePostReply = async (parentId: string) => {
    const clean = replyText.trim();
    if (!clean || submittingReply || !user?.email || !task.id) return;

    setSubmittingReply(true);
    try {
      const structuredMentions = extractStructuredMentions(clean);
      const res = await dbService.addComment(
        {
          taskId: task.id,
          parentId,
          userId: user.email.toLowerCase(),
          userName: user.displayName || user.email.split('@')[0],
          userAvatarColor: (user as any).avatarColor || '#6366f1',
          content: clean,
          mentions: structuredMentions,
          timestamp: new Date().toISOString()
        },
        task.taskId,
        task.title
      );
      setReplyText('');
      setReplyingToId(null);
      setMentionQuery(null);
      // Auto-expand this parent's replies
      setExpandedReplies(prev => new Set(prev).add(parentId));

      // Feedback for auto-co-assignees
      const autoAssigned = res.autoAssignedMembers || [];
      if (autoAssigned.length === 1) {
        toast.success(`Reply posted. ${autoAssigned[0].name} was automatically added as a co-assignee.`);
      } else if (autoAssigned.length > 1) {
        const names = autoAssigned.map((m) => m.name).join(' and ');
        toast.success(`Reply posted. ${names} were added as co-assignees.`);
      } else {
        toast.success('Reply posted successfully.');
      }
    } catch (err) {
      console.error('Failed to post reply:', err);
      toast.error('Failed to post reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Save comment edit
  const handleSaveEdit = async (comment: Comment) => {
    const clean = editText.trim();
    if (!clean || submittingEdit || !comment.id) return;

    setSubmittingEdit(true);
    try {
      await dbService.updateComment(
        comment.id,
        clean,
        user?.email || '',
        user?.displayName || 'User',
        task.id!,
        Boolean(comment.parentId),
        task.taskId,
        task.title
      );
      setEditingCommentId(null);
      setEditText('');
      toast.success('Comment updated');
    } catch (err) {
      console.error('Failed to update comment:', err);
      toast.error('Failed to update comment');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Delete comment or reply
  const handleDelete = async (comment: Comment) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await dbService.deleteComment(
        comment,
        user?.email || '',
        user?.displayName || 'User',
        task.taskId,
        task.title
      );
      toast.success('Comment deleted');
    } catch (err) {
      console.error('Failed to delete comment:', err);
      toast.error('Failed to delete comment');
    }
  };

  // Helper to render comment text with styled @mention chips displaying ONLY the user's name
  const renderContentWithMentions = (content: string) => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Text before mention
      if (match.index > lastIndex) {
        elements.push(content.substring(lastIndex, match.index));
      }
      const rawName = match[1].trim();
      const rawRef = match[2].trim().toLowerCase();

      // Look up member to find real full name and email
      const matchedMember = members.find(
        (m) =>
          (m.email && m.email.toLowerCase() === rawRef) ||
          m.uid === rawRef ||
          m.id === rawRef ||
          (m.name && m.name.toLowerCase() === rawName.toLowerCase())
      );

      // Extract clean display name (strip any embedded "(email)" in legacy formats or email prefixes)
      let cleanName = rawName;
      const parenEmailMatch = cleanName.match(/^([^(]+)\s*\([^)]+@[^)]+\)$/);
      if (parenEmailMatch) {
        cleanName = parenEmailMatch[1].trim();
      } else if (cleanName.includes('@')) {
        cleanName = matchedMember?.name && matchedMember.name !== cleanName
          ? matchedMember.name
          : cleanName.split('@')[0];
      }
      const displayName = matchedMember?.name || cleanName;
      const displayEmail = matchedMember?.email || (rawRef.includes('@') ? rawRef : '');

      elements.push(
        <span
          key={`mention-${match.index}`}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-semibold bg-primary/15 text-primary border border-primary/25 select-none"
          title={displayEmail ? `Mentioned: ${displayName} (${displayEmail})` : `Mentioned: ${displayName}`}
        >
          <AtSign className="h-3 w-3 shrink-0" />
          <span>{displayName}</span>
        </span>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      elements.push(content.substring(lastIndex));
    }

    return (
      <span className="whitespace-pre-wrap break-words leading-relaxed">
        {elements}
      </span>
    );
  };

  // Autocomplete dropdown popup
  const renderMentionDropdown = () => {
    if (mentionQuery === null || filteredMentionMembers.length === 0) return null;
    return (
      <div className="absolute z-50 bottom-full mb-2 left-3 w-72 sm:w-80 bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <AtSign className="h-3 w-3 text-primary" />
            Mention Team Member
          </span>
          <span className="text-[9px] lowercase font-normal opacity-70">↑↓ navigate &bull; Enter select</span>
        </div>
        <div
          className="max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
        >
          {filteredMentionMembers.map((m, idx) => (
            <button
              key={m.email || m.id || `mention-${idx}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                applyMention(m);
              }}
              className={`w-full flex items-center justify-between gap-2 p-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                idx === mentionIndex
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'hover:bg-slate-800 text-foreground'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0 border border-slate-700"
                  style={{ backgroundColor: m.avatarColor || '#6366f1' }}
                >
                  {(m.name || m.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 truncate">
                  <span className="block truncate font-semibold leading-tight">
                    {m.name || m.email}
                  </span>
                  <span className="block text-[10px] opacity-75 truncate leading-tight">
                    {m.email}
                  </span>
                </div>
              </div>
              {m.role && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono shrink-0 ${
                    idx === mentionIndex
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {m.role}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div ref={commentsContainerRef} className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">
            Comments & Discussion
          </h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-muted-foreground">
            {totalCount}
          </span>
        </div>
      </div>

      {/* Main Comment Creation Input */}
      <form onSubmit={handlePostComment} className="relative space-y-2">
        {activeInputType === 'new' && renderMentionDropdown()}
        <div className="flex gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm mt-1"
            style={{ backgroundColor: (user as any)?.avatarColor || '#6366f1' }}
          >
            {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 space-y-2">
            <textarea
              ref={newTextareaRef}
              rows={3}
              value={newCommentText}
              onChange={(e) => handleTextChange(e.target.value, setNewCommentText, 'new', newTextareaRef.current)}
              onKeyDown={handleKeyDown}
              placeholder="Write a comment... (Type @ to mention team members)"
              disabled={submittingComment}
              className="w-full px-3.5 py-2.5 bg-background/50 border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AtSign className="h-3 w-3 text-primary/70" />
                <span>Tip: Type @ to mention anyone on the team</span>
              </span>
              <button
                type="submit"
                disabled={submittingComment || !newCommentText.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                {submittingComment ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Posting...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Post Comment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-4 pt-2">
        {loading ? (
          <div className="space-y-3 py-4 animate-pulse">
            <div className="h-16 bg-accent/40 rounded-xl" />
            <div className="h-16 bg-accent/40 rounded-xl" />
          </div>
        ) : rootComments.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-xl bg-background/20 space-y-2">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs font-semibold text-foreground">No comments yet</p>
            <p className="text-[11px] text-muted-foreground">
              Be the first to share an update, question, or note on this task.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedRoots.map((comment) => {
              const replies = repliesMap.get(comment.id!) || [];
              const replyCount = replies.length || comment.replyCount || 0;
              const isReplying = replyingToId === comment.id;
              const isEditing = editingCommentId === comment.id;
              const isExpanded = expandedReplies.has(comment.id!);
              const canEdit = !comment.isDeleted && (user?.email?.toLowerCase() === comment.userId.toLowerCase());
              const canDelete = user && (isAdmin || user.email?.toLowerCase() === comment.userId.toLowerCase());

              return (
                <div
                  key={comment.id}
                  id={`comment-${comment.id}`}
                  className="p-3.5 rounded-xl bg-background/40 border border-border/80 space-y-3 transition-all"
                >
                  {/* Root Comment Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0"
                        style={{ backgroundColor: comment.userAvatarColor || '#6366f1' }}
                      >
                        {comment.userName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            {comment.userName}
                          </span>
                          {comment.edited && (
                            <span className="text-[9px] text-muted-foreground italic">(edited)</span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTimeAgo(comment.timestamp)} • {formatDate(comment.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
                      {canEdit && !isEditing && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCommentId(comment.id!);
                            setEditText(comment.content);
                          }}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                          title="Edit Comment"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(comment)}
                          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          title="Delete Comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Comment Body / Edit Form */}
                  {isEditing ? (
                    <div className="relative space-y-2 pl-9">
                      {activeInputType === 'edit' && renderMentionDropdown()}
                      <textarea
                        ref={editTextareaRef}
                        rows={2}
                        value={editText}
                        onChange={(e) => handleTextChange(e.target.value, setEditText, 'edit', editTextareaRef.current)}
                        onKeyDown={handleKeyDown}
                        disabled={submittingEdit}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCommentId(null);
                            setEditText('');
                          }}
                          className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(comment)}
                          disabled={submittingEdit || !editText.trim()}
                          className="px-3 py-1 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/90 transition-all disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pl-9 text-xs text-foreground/90">
                      {comment.isDeleted ? (
                        <span className="italic text-muted-foreground">[Comment deleted]</span>
                      ) : (
                        renderContentWithMentions(comment.content)
                      )}
                    </div>
                  )}

                  {/* Actions Bar: Reply Button & Toggle Replies */}
                  <div className="pl-9 flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                    {!comment.isDeleted && (
                      <button
                        type="button"
                        onClick={() => {
                          if (replyingToId === comment.id) {
                            setReplyingToId(null);
                          } else {
                            setReplyingToId(comment.id!);
                            setReplyText('');
                          }
                        }}
                        className="font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Reply className="h-3 w-3" />
                        <span>Reply</span>
                      </button>
                    )}

                    {replyCount > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleReplies(comment.id!)}
                        className="font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            <span>Hide {replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            <span>Show {replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Inline Reply Form */}
                  <AnimatePresence>
                    {isReplying && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pl-9 pt-2 relative space-y-2"
                      >
                        {activeInputType === 'reply' && renderMentionDropdown()}
                        <div className="flex gap-2">
                          <CornerDownRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />
                          <div className="flex-1 space-y-2">
                            <textarea
                              ref={replyTextareaRef}
                              rows={2}
                              value={replyText}
                              onChange={(e) => handleTextChange(e.target.value, setReplyText, 'reply', replyTextareaRef.current)}
                              onKeyDown={handleKeyDown}
                              placeholder={`Reply to @${comment.userName}... (Type @ to mention)`}
                              disabled={submittingReply}
                              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary resize-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingToId(null);
                                  setReplyText('');
                                }}
                                className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePostReply(comment.id!)}
                                disabled={submittingReply || !replyText.trim()}
                                className="px-3 py-1 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/90 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                              >
                                {submittingReply ? 'Posting...' : 'Post Reply'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Threaded Replies (Nested 1 Level Only) */}
                  {replyCount > 0 && isExpanded && (
                    <div className="pl-6 ml-3 border-l-2 border-border/60 space-y-3 pt-2">
                      {replies.map((reply) => {
                        const canEditReply = !reply.isDeleted && (user?.email?.toLowerCase() === reply.userId.toLowerCase());
                        const canDeleteReply = user && (isAdmin || user.email?.toLowerCase() === reply.userId.toLowerCase());
                        const isEditingThisReply = editingCommentId === reply.id;

                        return (
                          <div
                            key={reply.id}
                            id={`comment-${reply.id}`}
                            className="p-3 rounded-lg bg-background/50 border border-border/60 space-y-2 transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-5.5 h-5.5 rounded-full flex items-center justify-center font-bold text-white text-[9px] shrink-0"
                                  style={{ backgroundColor: reply.userAvatarColor || '#6366f1' }}
                                >
                                  {reply.userName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-foreground">
                                      {reply.userName}
                                    </span>
                                    {reply.edited && (
                                      <span className="text-[9px] text-muted-foreground italic">(edited)</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatTimeAgo(reply.timestamp)}
                                  </span>
                                </div>
                              </div>

                              {/* Reply Action Buttons */}
                              <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
                                {canEditReply && !isEditingThisReply && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(reply.id!);
                                      setEditText(reply.content);
                                    }}
                                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                                    title="Edit Reply"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                )}
                                {canDeleteReply && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(reply)}
                                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                    title="Delete Reply"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Reply Content or Edit Form */}
                            {isEditingThisReply ? (
                              <div className="relative space-y-2 pl-7">
                                {activeInputType === 'edit' && renderMentionDropdown()}
                                <textarea
                                  ref={editTextareaRef}
                                  rows={2}
                                  value={editText}
                                  onChange={(e) => handleTextChange(e.target.value, setEditText, 'edit', editTextareaRef.current)}
                                  onKeyDown={handleKeyDown}
                                  disabled={submittingEdit}
                                  className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary resize-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(null);
                                      setEditText('');
                                    }}
                                    className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(reply)}
                                    disabled={submittingEdit || !editText.trim()}
                                    className="px-3 py-1 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/90 transition-all disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="pl-7 text-xs text-foreground/90">
                                {renderContentWithMentions(reply.content)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination / Lazy Loading Button */}
            {rootComments.length > visibleCount && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount(prev => prev + COMMENTS_PER_PAGE)}
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/80 text-foreground text-xs font-semibold transition-colors cursor-pointer"
                >
                  Load More Comments ({rootComments.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
