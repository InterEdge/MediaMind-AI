import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  AuthCallbackError,
  signInWithGoogle,
  loginWithPassword,
  logout,
  requestPasswordReset,
  resolveAuthWorkspace,
  restoreSession,
  signUpWithPassword,
  updatePassword,
  type Profile,
  type Workspace,
  type WorkspaceMembership,
} from "../services/auth";
import { isPasswordRecoveryUrl, type AuthCredentials, type SignUpCredentials } from "../utils/auth";
import { setActiveWorkspaceId } from "../utils/workspaceOwnership";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  workspace: Workspace | null;
  membership: WorkspaceMembership | null;
  restoring: boolean;
  resolutionError: string | null;
  passwordRecovery: boolean;
  callbackError: string | null;
  clearCallbackError: () => void;
  signInWithGoogle: () => Promise<void>;
  login: (credentials: AuthCredentials) => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<{ confirmationRequired: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completePasswordRecovery: () => void;
  signOut: () => Promise<void>;
  retryResolution: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [membership, setMembership] = useState<WorkspaceMembership | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(() => isPasswordRecoveryUrl(window.location));
  const resolutionSequence = useRef(0);

  const applySession = useCallback(async (nextSession: Session | null) => {
    const sequence = ++resolutionSequence.current;
    setSession(nextSession);
    setProfile(null);
    setWorkspace(null);
    setActiveWorkspaceId(null);
    setMembership(null);
    setResolutionError(null);
    if (!nextSession) {
      setRestoring(false);
      return;
    }

    setRestoring(true);
    try {
      const resolved = await resolveAuthWorkspace(nextSession.user);
      if (sequence !== resolutionSequence.current) return;
      setProfile(resolved.profile);
      setWorkspace(resolved.workspace);
      setActiveWorkspaceId(resolved.workspace.id);
      setMembership(resolved.membership);
    } catch (error) {
      if (sequence !== resolutionSequence.current) return;
      setResolutionError(error instanceof Error ? error.message : "Failed to resolve your account workspace.");
    } finally {
      if (sequence === resolutionSequence.current) setRestoring(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((initialSession) => { if (active) void applySession(initialSession); })
      .catch((error) => {
        if (!active) return;
        if (error instanceof AuthCallbackError) {
          setPasswordRecovery(false);
          setCallbackError(error.message);
          setRestoring(false);
          return;
        }
        setResolutionError(error instanceof Error ? error.message : "Failed to restore session.");
        setRestoring(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (active) setTimeout(() => { if (active) void applySession(nextSession); }, 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const retryResolution = useCallback(async () => {
    if (session) {
      await applySession(session);
      return;
    }
    setRestoring(true);
    try {
      await applySession(await restoreSession());
    } catch (error) {
      setResolutionError(error instanceof Error ? error.message : "Failed to restore session.");
      setRestoring(false);
    }
  }, [applySession, session]);

  const handleSignOut = useCallback(async () => {
    setPasswordRecovery(false);
    setResolutionError(null);
    try {
      await logout();
    } catch (error) {
      setResolutionError(error instanceof Error ? error.message : "Failed to sign out.");
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      workspace,
      membership,
      restoring,
      resolutionError,
      passwordRecovery,
      callbackError,
      clearCallbackError: () => setCallbackError(null),
      signInWithGoogle,
      login: loginWithPassword,
      signUp: signUpWithPassword,
      requestPasswordReset,
      updatePassword,
      completePasswordRecovery: () => setPasswordRecovery(false),
      signOut: handleSignOut,
      retryResolution,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
