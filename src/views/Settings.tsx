import { useState } from "react";
import { User, Bell, Shield, Palette, Globe, Check } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getDisplayName } from "../utils/auth";

export default function Settings() {
  const { user, profile, workspace, membership } = useAuth();
  const displayName = getDisplayName(profile?.display_name, user?.email);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [aiModel, setAiModel] = useState("GPT-4 Turbo");
  const [language, setLanguage] = useState("English");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
        enabled ? "bg-blue-600" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your account preferences and application configuration.</p>
      </div>

      {/* Profile */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-2">
          <User className="h-5 w-5 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">Profile Information</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Full Name</label>
            <input
              type="text"
              value={displayName}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Email</label>
            <input
              type="email"
              value={user?.email ?? ""}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Role</label>
            <input
              type="text"
              value={membership?.role === "owner" ? "Workspace Owner" : "Workspace Member"}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Company</label>
            <input
              type="text"
              value={workspace?.name ?? ""}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-2">
          <Bell className="h-5 w-5 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">Notification Preferences</h2>
        </div>
        <div className="space-y-4">
          {[
            { label: "Email Notifications", desc: "Receive email alerts for important updates", enabled: notifEmail, set: setNotifEmail },
            { label: "Push Notifications", desc: "Get real-time push notifications in your browser", enabled: notifPush, set: setNotifPush },
            { label: "Weekly Summary", desc: "A digest of your activity every Monday morning", enabled: notifWeekly, set: setNotifWeekly },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between border-b border-slate-50 pb-4 last:border-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-slate-700">{item.label}</p>
                <p className="mt-0.5 text-xs text-slate-400">{item.desc}</p>
              </div>
              <Toggle enabled={item.enabled} onChange={() => item.set(!item.enabled)} />
            </div>
          ))}
        </div>
      </div>

      {/* AI Configuration */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-2">
          <Palette className="h-5 w-5 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">AI Configuration</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">AI Model</label>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option>GPT-4 Turbo</option>
              <option>GPT-4o</option>
              <option>Claude 3.5 Sonnet</option>
              <option>Gemini 1.5 Pro</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Default Tone</label>
            <select className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option>Professional</option>
              <option>Conversational</option>
              <option>Authoritative</option>
              <option>Inspirational</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Max Words per Post</label>
            <input
              type="number"
              defaultValue={200}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex items-end">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 w-full">
              <div>
                <p className="text-sm font-medium text-slate-700">Auto-save drafts</p>
                <p className="mt-0.5 text-xs text-slate-400">Save drafts automatically while editing</p>
              </div>
              <Toggle enabled={autoSave} onChange={() => setAutoSave(!autoSave)} />
            </div>
          </div>
        </div>
      </div>

      {/* Language & Region */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-2">
          <Globe className="h-5 w-5 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">Language & Region</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
              <option>German</option>
              <option>Japanese</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Timezone</label>
            <select className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option>America/New_York (EST)</option>
              <option>America/Los_Angeles (PST)</option>
              <option>Europe/London (GMT)</option>
              <option>Asia/Tokyo (JST)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-2">
          <Shield className="h-5 w-5 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800">Security</h2>
        </div>
        <div className="space-y-3">
          <button className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            Change Password
            <span className="text-xs text-slate-400">Last changed 3 months ago</span>
          </button>
          <button className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            Enable Two-Factor Authentication
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Recommended</span>
          </button>
          <button className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            Active Sessions
            <span className="text-xs text-slate-400">2 devices</span>
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.98]"
        >
          {saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Settings Saved" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
