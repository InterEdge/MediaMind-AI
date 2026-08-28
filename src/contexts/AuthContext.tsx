import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  loginWithPassword,
  logout,
  resolveAuthWorkspace,
  restoreSession,
  signUpWithPassword,
  type Profile,
  type Workspace,
  type WorkspaceMembership,
} from "../services/auth";
import type { AuthCredentials, SignUpCredentials } from "../utils/auth";
import { setActiveWorkspaceId } from "../utils/workspaceOwnership";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  workspace: Workspace | null;
  membership: WorkspaceMembership | null;
  restoring: boolean;
  resolutionError: string | null;
  login: (credentials: AuthCredentials) => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<{ confirmationRequired: boolean }>;
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
        setResolutionError(error instanceof Error ? error.message : "Failed to restore session.");
        setRestoring(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
      login: loginWithPassword,
      signUp: signUpWithPassword,
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
