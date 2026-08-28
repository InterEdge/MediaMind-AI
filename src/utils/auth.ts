export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends AuthCredentials {
  displayName: string;
}

export type AuthShellState = "restoring" | "unauthenticated" | "resolving" | "authenticated" | "error";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateLoginCredentials(credentials: AuthCredentials): AuthCredentials {
  const email = normalizeEmail(credentials.email);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
  if (!credentials.password) throw new Error("Password is required.");
  return { email, password: credentials.password };
}

export function validateSignUpCredentials(credentials: SignUpCredentials): SignUpCredentials {
  const login = validateLoginCredentials(credentials);
  const displayName = credentials.displayName.trim();
  if (!displayName) throw new Error("Display name is required.");
  if (credentials.password.length < 6) throw new Error("Password must be at least 6 characters.");
  return { ...login, displayName };
}

export function getAuthShellState(params: {
  restoring: boolean;
  hasSession: boolean;
  hasWorkspace: boolean;
  resolutionError: string | null;
}): AuthShellState {
  if (params.restoring) return "restoring";
  if (params.resolutionError) return "error";
  if (!params.hasSession) return "unauthenticated";
  if (!params.hasWorkspace) return "resolving";
  return "authenticated";
}

export function getDisplayName(profileName: string | null | undefined, email: string | null | undefined): string {
  const profile = profileName?.trim();
  if (profile) return profile;
  const emailPrefix = email?.split("@")[0]?.trim();
  return emailPrefix || "MediaMind User";
}

export function getInitials(displayName: string): string {
  const initials = displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "MU";
}

export function requireResolvedWorkspace<TProfile, TMembership, TWorkspace>(
  profile: TProfile | null,
  membership: TMembership | null,
  workspace: TWorkspace | null,
): { profile: TProfile; membership: TMembership; workspace: TWorkspace } {
  if (!profile) throw new Error("Your profile has not been provisioned. Please contact support.");
  if (!membership) throw new Error("Your workspace has not been provisioned. Please contact support.");
  if (!workspace) throw new Error("Your workspace is unavailable. Please contact support.");
  return { profile, membership, workspace };
}
