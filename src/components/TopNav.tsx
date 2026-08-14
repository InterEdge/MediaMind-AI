import { useState, useRef, useEffect } from "react";
import { Menu, Search, Bell, ChevronDown } from "lucide-react";
import type { Notification } from "../lib/supabase";
import type { ViewId } from "../App";

interface TopNavProps {
  onMenuClick: () => void;
  unreadCount: number;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigate: (v: ViewId) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function TopNav({ onMenuClick, unreadCount, notifications, onMarkRead, onMarkAllRead, onNavigate, searchQuery, onSearchChange }: TopNavProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return "Just now";
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const notifColor = (type: string) => {
    if (type === "success") return "bg-emerald-500";
    if (type === "warning") return "bg-amber-500";
    return "bg-blue-500";
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      {/* Left: menu + search */}
      <div className="flex flex-1 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search documents, drafts, prompts..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Right: notifications + avatar */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 origin-top-right rounded-xl border border-slate-200 bg-white shadow-xl transition animate-in">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span className="text-sm font-semibold text-slate-800">Notifications</span>
                <button disabled={unreadCount === 0} onClick={onMarkAllRead} className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:cursor-default disabled:text-slate-300">
                  Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onMarkRead(n.id)}
                      disabled={n.read}
                      className={`flex gap-3 border-b border-slate-50 px-4 py-3 transition hover:bg-slate-50 ${
                        !n.read ? "bg-blue-50/40" : ""
                      } w-full text-left disabled:cursor-default`}
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notifColor(n.type)}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">{n.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{formatTime(n.created_at)}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-lg p-1 pr-2 transition hover:bg-slate-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-semibold text-white">
              AM
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold text-slate-700">Alex Morgan</p>
              <p className="text-xs text-slate-400">Media Director</p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white shadow-xl transition animate-in">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">Alex Morgan</p>
                <p className="text-xs text-slate-400">alex@mediamind.ai</p>
              </div>
              <div className="py-1">
                <button onClick={() => onNavigate("settings")} className="block w-full px-4 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50">My Profile</button>
                <button onClick={() => onNavigate("settings")} className="block w-full px-4 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50">Account Settings</button>
                <button onClick={() => onNavigate("settings")} className="block w-full px-4 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50">Billing & Plan</button>
                <button onClick={() => onNavigate("knowledge")} className="block w-full px-4 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50">Help Center</button>
              </div>
              <div className="border-t border-slate-100 py-1">
                <button onClick={() => onNavigate("dashboard")} className="block w-full px-4 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50">Sign Out</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
