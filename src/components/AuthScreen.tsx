import { useEffect, useState, type FormEvent } from "react";
import { Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { validateNewPassword } from "../utils/auth";

type AuthMode = "login" | "signup" | "forgot-password" | "reset-password";

export default function AuthScreen() {
  const { passwordRecovery, callbackError, clearCallbackError, signInWithGoogle, login, signUp, requestPasswordReset, updatePassword, completePasswordRecovery } = useAuth();
  const [mode, setMode] = useState<AuthMode>(passwordRecovery ? "reset-password" : "login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetComplete, setResetComplete] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    setGoogleSubmitting(true);
    setError(null);
    setMessage(null);
    clearCallbackError();
    try {
      await signInWithGoogle();
    } catch {
      setError("Google sign-in could not be started. Please try again or use email and password.");
      setSubmitting(false);
      setGoogleSubmitting(false);
    }
  };

  useEffect(() => {
    if (callbackError) setMode("login");
    else if (passwordRecovery) setMode("reset-password");
  }, [passwordRecovery, callbackError]);

  useEffect(() => {
    // Returning from Google with the browser Back button can restore this page
    // from the back/forward cache, including its disabled redirect button.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setSubmitting(false);
        setGoogleSubmitting(false);
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const switchMode = (nextMode: AuthMode) => {
    if (submitting) return;
    clearCallbackError();
    setMode(nextMode);
    setError(null);
    setMessage(null);
    setPassword("");
    setConfirmation("");
  };

  const handleAuthSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    clearCallbackError();
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

  const handleRecoveryRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await requestPasswordReset(email);
      setMessage("Check your email for a password reset link.");
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : "Unable to send the password reset email.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordUpdate = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const newPassword = validateNewPassword({ password, confirmation });
      await updatePassword(newPassword);
      setResetComplete(true);
      setMessage("Your password has been updated successfully.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update your password.");
    } finally {
      setSubmitting(false);
    }
  };

  const heading = mode === "login" ? "Sign in to your workspace"
    : mode === "signup" ? "Create your account"
      : mode === "forgot-password" ? "Reset your password"
        : "Create a new password";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"><Sparkles className="h-5 w-5" /></div>
          <div><h1 className="text-xl font-bold text-slate-900">MediaMind AI</h1><p className="text-sm text-slate-500">{heading}</p></div>
        </div>

        {(mode === "login" || mode === "signup") && (
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
            <button type="button" onClick={() => switchMode("login")} className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "login" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Login</button>
            <button type="button" onClick={() => switchMode("signup")} className={`rounded-md px-3 py-2 text-sm font-medium ${mode === "signup" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Sign Up</button>
          </div>
        )}

        {(error || callbackError) && <div role="alert" aria-live="assertive" className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error || callbackError}</div>}
        {message && <div role="status" aria-live="polite" className="mb-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{message}</div>}

        {(mode === "login" || mode === "signup") && (
          <div className="mb-4">
            <button type="button" disabled={submitting} onClick={() => void handleGoogleSignIn()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
              {googleSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {googleSubmitting ? "Redirecting to Google..." : "Continue with Google"}
            </button>
            <p className="mt-4 text-center text-xs text-slate-500">or continue with email</p>
          </div>
        )}

        {(mode === "login" || mode === "signup") && (
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {mode === "signup" && <label className="block text-sm font-medium text-slate-700">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>}
            <label className="block text-sm font-medium text-slate-700">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
            <div>
              <label className="block text-sm font-medium text-slate-700">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
              {mode === "login" && <button type="button" onClick={() => switchMode("forgot-password")} className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700">Forgot password?</button>}
            </div>
            <SubmitButton submitting={submitting} label={mode === "login" ? "Login" : "Create Account"} />
          </form>
        )}

        {mode === "forgot-password" && (
          <form onSubmit={handleRecoveryRequest} className="space-y-4">
            <p className="text-sm text-slate-600">Enter the email address associated with your account.</p>
            <label className="block text-sm font-medium text-slate-700">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
            <SubmitButton submitting={submitting} label="Send Reset Link" />
            <button type="button" onClick={() => switchMode("login")} className="w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Back to Login</button>
          </form>
        )}

        {mode === "reset-password" && (
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            {!resetComplete && <>
              <label className="block text-sm font-medium text-slate-700">New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
              <label className="block text-sm font-medium text-slate-700">Confirm new password<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={6} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" /></label>
              <SubmitButton submitting={submitting} label="Update Password" />
            </>}
            {resetComplete && <button type="button" onClick={completePasswordRecovery} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Continue to MediaMind</button>}
          </form>
        )}
      </div>
    </div>
  );
}

function SubmitButton({ submitting, label }: { submitting: boolean; label: string }) {
  return <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
    {submitting ? "Please wait..." : label}
  </button>;
}
