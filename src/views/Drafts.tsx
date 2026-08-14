import { useState, useMemo } from "react";
import { Search, FileText, Sparkles, Trash2, Eye, X, Edit3, Check, AlertCircle, Copy, Send, CalendarClock } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { Draft } from "../lib/supabase";
import { scheduleApprovedDraft, transitionDraftStatus } from "../services/draftWorkflow";
import {
  DRAFT_WORKFLOW_STATUSES,
  LEGACY_DRAFT_STATUSES,
  getAllowedDraftTransitions,
  type DraftWorkflowStatus,
} from "../utils/draftWorkflow";

interface DraftsProps {
  drafts: Draft[];
  loading: boolean;
  onRefresh: () => void;
}

const statuses = ["All", ...DRAFT_WORKFLOW_STATUSES, ...LEGACY_DRAFT_STATUSES];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    Draft: "bg-slate-100 text-slate-600",
    "In Review": "bg-amber-100 text-amber-700",
    Approved: "bg-emerald-100 text-emerald-700",
    Published: "bg-blue-100 text-blue-700",
  };
  return map[status] ?? "bg-slate-100 text-slate-600";
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function Drafts({ drafts, loading, onRefresh }: DraftsProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [workflowNote, setWorkflowNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showScheduling, setShowScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const filtered = useMemo(() => {
    return drafts.filter((d) => {
      const matchSearch = d.title.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || d.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [drafts, search, statusFilter]);

  const openDetail = (draft: Draft) => {
    setSelected(draft);
    setEditing(false);
    setWorkflowNote(draft.review_note ?? "");
    setShowScheduling(false);
    setScheduleDate("");
    setScheduleTime("");
    setError(null);
    setWarning(null);
  };

  const handleSchedule = async () => {
    if (!selected) return;
    setScheduling(true);
    setError(null);
    setWarning(null);
    try {
      const result = await scheduleApprovedDraft(selected, scheduleDate, scheduleTime, onRefresh);
      setWarning(result.activityWarning);
      setShowScheduling(false);
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Failed to schedule post.");
    } finally {
      setScheduling(false);
    }
  };

  const startEditing = () => {
    if (!selected) return;
    setEditTitle(selected.title);
    setEditContent(selected.content);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);

    const wordCount = editContent.split(/\s+/).filter(Boolean).length;

    const { error: updateError } = await supabase
      .from("drafts")
      .update({
        title: editTitle,
        content: editContent,
        word_count: wordCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(false);
    setSelected({
      ...selected,
      title: editTitle,
      content: editContent,
      word_count: wordCount,
    });
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("drafts").delete().eq("id", id);
    onRefresh();
    setSelected(null);
  };

  const handleStatusChange = async (draft: Draft, newStatus: DraftWorkflowStatus) => {
    setTransitioning(true);
    setError(null);
    setWarning(null);
    try {
      const { patch, activityWarning } = await transitionDraftStatus(draft, newStatus, workflowNote);
      const updatedDraft: Draft = {
        ...draft,
        status: patch.status,
        updated_at: patch.updated_at,
        approved_at: patch.approved_at !== undefined ? patch.approved_at : draft.approved_at,
        review_note: patch.review_note !== undefined ? patch.review_note : draft.review_note,
      };
      setSelected(updatedDraft);
      setWorkflowNote(updatedDraft.review_note ?? "");
      setWarning(activityWarning);
      onRefresh();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : "Failed to update draft status.");
    } finally {
      setTransitioning(false);
    }
  };

  const handleCopy = () => {
    if (!selected) return;
    navigator.clipboard.writeText(selected.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Drafts</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your content drafts across all platforms.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drafts..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === s
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((draft) => (
            <div
              key={draft.id}
              className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-slate-800">{draft.title}</h3>
                  {draft.ai_generated && (
                    <span className="flex items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">
                      <Sparkles className="h-2.5 w-2.5" /> AI
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                  <span>{draft.platform}</span>
                  <span>·</span>
                  <span>{draft.word_count} words</span>
                  <span>·</span>
                  <span>{formatDate(draft.created_at)}</span>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(draft.status)}`}>
                {draft.status}
              </span>
              <button
                onClick={() => openDetail(draft)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200">
              <p className="text-sm text-slate-400">No drafts found</p>
            </div>
          )}
        </div>
      )}

      {/* Detail / Edit Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => { setSelected(null); setEditing(false); }}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div className="min-w-0 flex-1">
                {editing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-lg font-bold text-slate-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{selected.title}</h3>
                    {selected.ai_generated && (
                      <span className="flex items-center gap-0.5 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-600">
                        <Sparkles className="h-3 w-3" /> AI Generated
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span>{selected.platform}</span>
                  <span>·</span>
                  <span>{selected.word_count} words</span>
                  <span>·</span>
                  <span>{formatDate(selected.created_at)}</span>
                  {!editing && (
                    <>
                      <span>·</span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ${statusBadge(selected.status)}`}>{selected.status}</span>
                    </>
                  )}
                </div>
              </div>
              <button onClick={() => { setSelected(null); setEditing(false); }} className="ml-2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {warning && (
              <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{warning}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Content</label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={14}
                      className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="mt-1 text-xs text-slate-400">{editContent.split(/\s+/).filter(Boolean).length} words</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {selected.status === "Approved" && showScheduling && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <CalendarClock className="h-4 w-4 text-blue-600" /> Schedule Post
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="text-xs font-medium text-slate-600">
                          Date
                          <input
                            type="date"
                            value={scheduleDate}
                            onChange={(event) => setScheduleDate(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Time
                          <input
                            type="time"
                            value={scheduleTime}
                            onChange={(event) => setScheduleTime(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                        </label>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Date and time use your local timezone.</p>
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          onClick={() => setShowScheduling(false)}
                          disabled={scheduling}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSchedule}
                          disabled={scheduling}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {scheduling ? "Scheduling..." : "Confirm Schedule"}
                        </button>
                      </div>
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{selected.content}</pre>
                  {getAllowedDraftTransitions(selected.status).length > 0 && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Review Note (optional)
                      </label>
                      <textarea
                        value={workflowNote}
                        onChange={(event) => setWorkflowNote(event.target.value)}
                        rows={2}
                        placeholder="Add a brief note for this workflow step"
                        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => handleDelete(selected.id)}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <div className="flex items-center gap-3">
                {editing ? (
                  <>
                    <button
                      onClick={() => setEditing(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? <Check className="h-4 w-4 animate-pulse" /> : <Check className="h-4 w-4" />}
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      onClick={startEditing}
                      className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      <Edit3 className="h-4 w-4" /> Edit
                    </button>
                    {selected.status === "Approved" && !showScheduling && (
                      <button
                        onClick={() => { setShowScheduling(true); setError(null); setWarning(null); }}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        <CalendarClock className="h-4 w-4" /> Schedule Post
                      </button>
                    )}
                    {getAllowedDraftTransitions(selected.status).map((nextStatus) => (
                      <button
                        key={nextStatus}
                        onClick={() => handleStatusChange(selected, nextStatus)}
                        disabled={transitioning}
                        className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          nextStatus === "Approved"
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : nextStatus === "Draft"
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        <Send className="h-4 w-4" />
                        {transitioning
                          ? "Updating..."
                          : nextStatus === "Approved"
                            ? "Approve"
                            : nextStatus === "Draft"
                              ? "Return to Draft"
                              : selected.status === "Approved"
                                ? "Return to In Review"
                                : "Move to In Review"}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
