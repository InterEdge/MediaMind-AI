export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends AuthCredentials {
  displayName: string;
}

export interface NewPasswordCredentials {
  password: string;
  confirmation: string;
}

export type AuthShellState = "restoring" | "unauthenticated" | "resolving" | "authenticated" | "error";

export const AUTH_CALLBACK_ERROR = "Sign-in could not be completed. Please try again or use email and password.";

export function hasAuthCallbackError(location: Pick<Location, "hash" | "search">): boolean {
  return [location.search, location.hash].some((part) => {
    const params = new URLSearchParams(part.replace(/^[?#]/, ""));
    return ["error", "error_code", "error_description"].some((key) => params.has(key));
  });
}

// Only clean failed callbacks, after the SDK has finished reading the URL.
export function cleanFailedAuthCallbackUrl(href: string, initializationFailed = false): string {
  const url = new URL(href);
  if (!initializationFailed && !hasAuthCallbackError(url)) return href;
  const authKeys = ["error", "error_code", "error_description", "access_token", "refresh_token", "provider_token", "provider_refresh_token", "token_type", "expires_in", "expires_at", "code", "type", "state"];
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  for (const key of authKeys) {
    url.searchParams.delete(key);
    hash.delete(key);
  }
  url.hash = hash.toString();
  return url.toString();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateRecoveryEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error("Enter a valid email address.");
  return normalized;
}

export function validateNewPassword(credentials: NewPasswordCredentials): string {
  if (credentials.password.length < 6) throw new Error("Password must be at least 6 characters.");
  if (credentials.password !== credentials.confirmation) throw new Error("Passwords do not match.");
  return credentials.password;
}

export function isPasswordRecoveryUrl(location: Pick<Location, "hash" | "search">): boolean {
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(location.search);
  return hashParams.get("type") === "recovery" || searchParams.get("type") === "recovery";
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
