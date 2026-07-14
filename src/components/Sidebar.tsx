import {
  LayoutDashboard,
  BookOpen,
  PenSquare,
  FileText,
  CalendarDays,
  Library,
  BarChart3,
  Settings as SettingsIcon,
  Brain,
  X,
} from "lucide-react";
import type { ViewId } from "../App";

interface SidebarProps {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  open: boolean;
  onClose: () => void;
}

const navItems: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
  { id: "generator", label: "Content Generator", icon: PenSquare },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "prompts", label: "Prompt Library", icon: Library },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar({ view, onNavigate, open, onClose }: SidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 transition-transform duration-300 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-600/30">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">MediaMind</span>
              <span className="ml-1 text-base font-bold tracking-tight text-blue-400">AI</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Menu
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Upgrade card */}
        <div className="p-3">
          <div className="rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 p-4 shadow-lg">
            <p className="text-sm font-semibold text-white">Upgrade to Pro</p>
            <p className="mt-1 text-xs text-blue-100">Unlock unlimited AI generations and advanced analytics.</p>
            <button className="mt-3 w-full rounded-lg bg-white py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50">
              Upgrade Now
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
