import { useState, type FormEvent } from "react";
import { Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function AuthScreen() {
  const { login, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const switchMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        const result = await signUp({ displayName, email, password });
        if (result.confirmationRequired) {
          setMessage("Account created. Check your email to confirm your address, then log in.");
          setMode("login");
          setPassword("");
        }
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"><Sparkles className="h-5 w-5" /></div>
          <div><h1 className="text-xl font-bold text-slate-900">MediaMind AI</h1><p className="text-sm text-slate-500">{mode === "login" ? "Sign in to your workspace" : "Create your account"}</p></div>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          <button type="button" onClick={() => switchMode("login")} className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "login" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Login</button>
          <button type="button" onClick={() => switchMode("signup")} className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "signup" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Sign Up</button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
        {message && <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && <label className="block text-sm font-medium text-slate-700">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>}
          <label className="block text-sm font-medium text-slate-700">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
          <label className="block text-sm font-medium text-slate-700">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
          <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            {submitting ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
