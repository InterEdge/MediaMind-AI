import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, CheckCircle2, Sparkles } from "lucide-react";
import type { Post } from "../lib/supabase";

interface CalendarProps {
  posts: Post[];
  loading: boolean;
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar({ posts, loading }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const scheduledByDay = useMemo(() => {
    const map = new Map<number, Post[]>();
    posts.forEach((post) => {
      if (post.scheduled_at) {
        const d = new Date(post.scheduled_at);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          if (!map.has(day)) map.set(day, []);
          map.get(day)!.push(post);
        }
      }
    });
    return map;
  }, [posts, year, month]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const upcomingPosts = posts
    .filter((p) => p.scheduled_at && new Date(p.scheduled_at) >= new Date())
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Calendar</h1>
        <p className="mt-1 text-sm text-slate-500">View and manage your scheduled posts across all platforms.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {monthNames[month]} {year}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={goToday} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100">
                  Today
                </button>
                <button onClick={prevMonth} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={nextMonth} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Day names */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {dayNames.map((day) => (
                <div key={day} className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {day}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square rounded-lg" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayPosts = scheduledByDay.get(day) ?? [];
                return (
                  <div
                    key={day}
                    className={`group relative flex aspect-square flex-col rounded-lg border p-1.5 transition ${
                      isToday(day)
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`text-xs font-semibold ${isToday(day) ? "text-blue-600" : "text-slate-600"}`}>
                      {day}
                    </span>
                    {dayPosts.length > 0 && (
                      <div className="mt-auto flex flex-wrap gap-0.5">
                        {dayPosts.slice(0, 3).map((p) => (
                          <div
                            key={p.id}
                            className={`h-1.5 w-1.5 rounded-full ${
                              p.status === "Published" ? "bg-emerald-500" : "bg-blue-500"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    {dayPosts.length > 0 && (
                      <div className="absolute left-1.5 right-1.5 top-7 z-10 hidden space-y-1 group-hover:block">
                        {dayPosts.map((p) => (
                          <div key={p.id} className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-slate-600 shadow-md ring-1 ring-slate-100">
                            {p.title.length > 30 ? p.title.slice(0, 30) + "..." : p.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upcoming */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Upcoming Posts</h2>
          </div>
          <div className="max-h-[500px] space-y-3 overflow-y-auto p-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))
            ) : upcomingPosts.length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <p className="text-sm text-slate-400">No upcoming posts</p>
              </div>
            ) : (
              upcomingPosts.map((post) => (
                <div key={post.id} className="rounded-xl border border-slate-100 p-3 transition hover:border-slate-200 hover:shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      post.status === "Published" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                    }`}>
                      {post.status === "Published" ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{post.title}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                        <CalendarDays className="h-3 w-3" />
                        {post.scheduled_at ? new Date(post.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{post.platform}</span>
                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                      <Sparkles className="h-2.5 w-2.5" /> {post.engagement_score}/100
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
