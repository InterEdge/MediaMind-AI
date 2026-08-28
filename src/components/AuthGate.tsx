import { Loader2 } from "lucide-react";
import App from "../App";
import { useAuth } from "../contexts/AuthContext";
import { getAuthShellState } from "../utils/auth";
import AuthScreen from "./AuthScreen";

export default function AuthGate() {
  const { session, workspace, restoring, resolutionError, retryResolution, signOut } = useAuth();
  const state = getAuthShellState({
    restoring,
    hasSession: Boolean(session),
    hasWorkspace: Boolean(workspace),
    resolutionError,
  });

  if (state === "restoring" || state === "resolving") {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 text-slate-600"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /><p className="text-sm">Restoring your MediaMind workspace...</p></div>;
  }
  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-lg">
          <h1 className="text-lg font-bold text-slate-900">Account setup needs attention</h1>
          <p className="mt-2 text-sm text-red-700">{resolutionError}</p>
          <div className="mt-5 flex justify-center gap-3">
            <button onClick={() => void retryResolution()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Retry</button>
            {session && <button onClick={() => void signOut()} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Sign Out</button>}
          </div>
        </div>
      </div>
    );
  }
  if (state === "unauthenticated") return <AuthScreen />;
  return <App />;
}
