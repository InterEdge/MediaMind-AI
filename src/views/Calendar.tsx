import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { Post } from "../lib/supabase";
import {
  cancelCalendarPost,
  deleteCalendarPost,
  markCalendarPostPublished,
  rescheduleCalendarPost,
  updateCalendarPost,
} from "../services/postWorkflow";
import { isCalendarVisiblePost, isUpcomingPost } from "../utils/postWorkflow";

interface CalendarProps {
  posts: Post[];
  loading: boolean;
  onRefresh: () => void;
}

type DetailMode = "view" | "edit" | "reschedule";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatDateTime = (value: string | null) => value
  ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
  : "Not scheduled";

const statusBadge = (status: string) => {
  if (status === "Scheduled") return "bg-blue-100 text-blue-700";
  if (status === "Published") return "bg-emerald-100 text-emerald-700";
  if (status === "Cancelled") return "bg-slate-200 text-slate-600";
  return "bg-amber-100 text-amber-700";
};

function localScheduleParts(value: string | null) {
  if (!value) return { date: "", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  const pad = (part: number) => String(part).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export default function Calendar({ posts, loading, onRefresh }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selected, setSelected] = useState<Post | null>(null);
  const [mode, setMode] = useState<DetailMode>("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const scheduledByDay = useMemo(() => {
    const map = new Map<number, Post[]>();
    posts.filter(isCalendarVisiblePost).forEach((post) => {
      const date = new Date(post.scheduled_at!);
      if (date.getFullYear() === year && date.getMonth() === month) {
        const dayPosts = map.get(date.getDate()) ?? [];
        dayPosts.push(post);
        map.set(date.getDate(), dayPosts);
      }
    });
    return map;
  }, [posts, year, month]);

  const upcomingPosts = useMemo(() => posts
    .filter((post) => isUpcomingPost(post))
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
    .slice(0, 5), [posts]);

  const openPost = (post: Post) => {
    setSelected(post);
    setMode("view");
    setError(null);
    setWarning(null);
    setNotice(null);
  };

  const startEdit = () => {
    if (!selected) return;
    setEditTitle(selected.title);
    setEditContent(selected.content);
    setEditPlatform(selected.platform);
    setEditHashtags((selected.hashtags ?? []).map((tag) => `#${tag.replace(/^#/, "")}`).join(" "));
    setError(null);
    setMode("edit");
  };

  const startReschedule = () => {
    if (!selected) return;
    const parts = localScheduleParts(selected.scheduled_at);
    setScheduleDate(parts.date);
    setScheduleTime(parts.time);
    setError(null);
    setMode("reschedule");
  };

  const completeMutation = (message: string, activityWarning: string | null) => {
    setWarning(activityWarning);
    setNotice(message);
    onRefresh();
  };

  const handleEdit = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const result = await updateCalendarPost(selected, {
        title: editTitle,
        content: editContent,
        platform: editPlatform,
        hashtags: editHashtags.split(/[\s,]+/).filter(Boolean),
      });
      setSelected({ ...selected, ...(result.patch ?? {}) } as Post);
      setMode("view");
      completeMutation("Post updated.", result.activityWarning);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to update post.");
    } finally {
      setBusy(false);
    }
  };

  const handleReschedule = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const result = await rescheduleCalendarPost(selected, scheduleDate, scheduleTime);
      setSelected({ ...selected, ...(result.patch ?? {}) } as Post);
      setMode("view");
      completeMutation(selected.status === "Cancelled" ? "Post restored and scheduled." : "Post rescheduled.", result.activityWarning);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to reschedule post.");
    } finally {
      setBusy(false);
    }
  };

  const handleStatusAction = async (nextStatus: "Cancelled" | "Published") => {
    if (!selected) return;
    const action = nextStatus === "Cancelled" ? "cancel" : "mark as Published";
    if (!window.confirm(`Are you sure you want to ${action} this post?`)) return;
    setBusy(true);
    setError(null);
    try {
      const result = nextStatus === "Cancelled"
        ? await cancelCalendarPost(selected)
        : await markCalendarPostPublished(selected);
      completeMutation(nextStatus === "Cancelled" ? "Post cancelled." : "Post marked Published.", result.activityWarning);
      setSelected(null);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : `Failed to ${action} post.`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected || !window.confirm("Delete this post? The linked draft will not be deleted.")) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteCalendarPost(selected);
      completeMutation("Post deleted. The linked draft is unchanged.", result.activityWarning);
      setSelected(null);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to delete post.");
    } finally {
      setBusy(false);
    }
  };

  const today = new Date();
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Calendar</h1>
        <p className="mt-1 text-sm text-slate-500">View and manage your scheduled posts across all platforms.</p>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="rounded p-1 hover:bg-emerald-100"><X className="h-4 w-4" /></button>
        </div>
      )}
      {warning && !selected && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{warning}</span></div>
          <button onClick={() => setWarning(null)} className="rounded p-1 hover:bg-amber-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{monthNames[month]} {year}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentDate(new Date())} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">Today</button>
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mb-2 grid grid-cols-7 gap-1">
              {dayNames.map((day) => <div key={day} className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, index) => <div key={`empty-${index}`} className="aspect-square rounded-lg" />)}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const dayPosts = scheduledByDay.get(day) ?? [];
                return (
                  <div key={day} className={`group relative flex aspect-square flex-col rounded-lg border p-1.5 ${isToday(day) ? "border-blue-500 bg-blue-50" : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"}`}>
                    <span className={`text-xs font-semibold ${isToday(day) ? "text-blue-600" : "text-slate-600"}`}>{day}</span>
                    {dayPosts.length > 0 && (
                      <div className="mt-auto flex flex-wrap gap-1">
                        {dayPosts.slice(0, 3).map((post) => (
                          <button key={post.id} onClick={() => openPost(post)} title={post.title} className="h-2 w-2 rounded-full bg-blue-500 ring-offset-1 hover:ring-2 hover:ring-blue-300" />
                        ))}
                      </div>
                    )}
                    {dayPosts.length > 0 && (
                      <div className="absolute left-1.5 right-1.5 top-7 z-10 hidden space-y-1 group-hover:block">
                        {dayPosts.map((post) => (
                          <button key={post.id} onClick={() => openPost(post)} className="block w-full rounded-md bg-white px-2 py-1 text-left text-[10px] font-medium text-slate-600 shadow-md ring-1 ring-slate-100 hover:text-blue-600">
                            {post.title.length > 30 ? `${post.title.slice(0, 30)}...` : post.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-800">Upcoming Posts</h2></div>
          <div className="max-h-[500px] space-y-3 overflow-y-auto p-4">
            {loading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />)
              : upcomingPosts.length === 0 ? <div className="flex h-32 items-center justify-center"><p className="text-sm text-slate-400">No upcoming posts</p></div>
                : upcomingPosts.map((post) => (
                  <button key={post.id} onClick={() => openPost(post)} className="block w-full rounded-xl border border-slate-100 p-3 text-left transition hover:border-blue-200 hover:shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Clock className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{post.title}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400"><CalendarDays className="h-3 w-3" />{formatDateTime(post.scheduled_at)}</div>
                      </div>
                    </div>
                    <span className="mt-2 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{post.platform}</span>
                  </button>
                ))}
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => !busy && setSelected(null)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-slate-900">{selected.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>{selected.platform}</span><span>·</span><span>{formatDateTime(selected.scheduled_at)}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${statusBadge(selected.status)}`}>{selected.status}</span>
                </div>
              </div>
              <button disabled={busy} onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
            </div>

            {(error || warning) && (
              <div className={`mx-6 mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error ?? warning}</span>
              </div>
            )}
            {notice && (
              <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                <Check className="h-4 w-4 shrink-0" /><span>{notice}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {mode === "edit" ? (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-500">Title<input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                  <label className="block text-xs font-semibold text-slate-500">Platform<input value={editPlatform} onChange={(event) => setEditPlatform(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                  <label className="block text-xs font-semibold text-slate-500">Content<textarea rows={10} value={editContent} onChange={(event) => setEditContent(event.target.value)} className="mt-1 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm leading-relaxed" /></label>
                  <label className="block text-xs font-semibold text-slate-500">Hashtags<input value={editHashtags} onChange={(event) => setEditHashtags(event.target.value)} placeholder="#campaign #launch" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                </div>
              ) : mode === "reschedule" ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-800">{selected.status === "Cancelled" ? "Restore and schedule" : "Reschedule post"}</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-medium text-slate-600">Date<input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                    <label className="text-xs font-medium text-slate-600">Time<input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Date and time use your local timezone.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{selected.content}</pre>
                  {(selected.hashtags ?? []).length > 0 && <div className="flex flex-wrap gap-2">{(selected.hashtags ?? []).map((tag) => <span key={tag} className="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700">#{tag.replace(/^#/, "")}</span>)}</div>}
                  <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-xs sm:grid-cols-2">
                    <div><dt className="font-semibold text-slate-400">Linked draft</dt><dd className="mt-1 break-all text-slate-700">{selected.draft_id ?? "None"}</dd></div>
                    <div><dt className="font-semibold text-slate-400">Created</dt><dd className="mt-1 text-slate-700">{formatDateTime(selected.created_at)}</dd></div>
                    <div><dt className="font-semibold text-slate-400">Updated</dt><dd className="mt-1 text-slate-700">{formatDateTime(selected.updated_at)}</dd></div>
                  </dl>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
              <button disabled={busy} onClick={handleDelete} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" />Delete</button>
              <div className="flex flex-wrap justify-end gap-2">
                {mode !== "view" ? (
                  <>
                    <button disabled={busy} onClick={() => { setMode("view"); setError(null); }} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
                    <button disabled={busy} onClick={mode === "edit" ? handleEdit : handleReschedule} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Check className="h-4 w-4" />{busy ? "Saving..." : "Save"}</button>
                  </>
                ) : (
                  <>
                    <button disabled={busy} onClick={startEdit} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"><Edit3 className="h-4 w-4" />Edit</button>
                    {(selected.status === "Scheduled" || selected.status === "Cancelled") && <button disabled={busy} onClick={startReschedule} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"><RotateCcw className="h-4 w-4" />{selected.status === "Cancelled" ? "Restore" : "Reschedule"}</button>}
                    {selected.status === "Scheduled" && <button disabled={busy} onClick={() => handleStatusAction("Published")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Mark Published</button>}
                    {selected.status === "Scheduled" && <button disabled={busy} onClick={() => handleStatusAction("Cancelled")} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel Post</button>}
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
