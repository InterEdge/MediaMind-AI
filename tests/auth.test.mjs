import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getAuthShellState,
  getDisplayName,
  getInitials,
  isPasswordRecoveryUrl,
  requireResolvedWorkspace,
  validateLoginCredentials,
  validateNewPassword,
  validateRecoveryEmail,
  validateSignUpCredentials,
} from "../src/utils/auth.ts";

const authScreenSource = readFileSync(new URL("../src/components/AuthScreen.tsx", import.meta.url), "utf8");
const authContextSource = readFileSync(new URL("../src/contexts/AuthContext.tsx", import.meta.url), "utf8");
const authServiceSource = readFileSync(new URL("../src/services/auth.ts", import.meta.url), "utf8");

test("unauthenticated users receive the authentication screen state", () => {
  assert.equal(getAuthShellState({ restoring: false, hasSession: false, hasWorkspace: false, resolutionError: null }), "unauthenticated");
});

test("authenticated sessions with a resolved workspace receive the application shell", () => {
  assert.equal(getAuthShellState({ restoring: false, hasSession: true, hasWorkspace: true, resolutionError: null }), "authenticated");
});

test("session restoration blocks both auth screen and application shell", () => {
  assert.equal(getAuthShellState({ restoring: true, hasSession: false, hasWorkspace: false, resolutionError: null }), "restoring");
  assert.equal(getAuthShellState({ restoring: true, hasSession: true, hasWorkspace: false, resolutionError: null }), "restoring");
});

test("authenticated session waits for profile and workspace resolution", () => {
  assert.equal(getAuthShellState({ restoring: false, hasSession: true, hasWorkspace: false, resolutionError: null }), "resolving");
  assert.equal(getAuthShellState({ restoring: false, hasSession: true, hasWorkspace: false, resolutionError: "Missing workspace" }), "error");
});

test("profile and workspace resolution requires every provisioned record", () => {
  const profile = { id: "user-1", display_name: "Amina" };
  const membership = { user_id: "user-1", workspace_id: "workspace-1", role: "owner" };
  const workspace = { id: "workspace-1", name: "Amina's Workspace" };
  assert.deepEqual(requireResolvedWorkspace(profile, membership, workspace), { profile, membership, workspace });
  assert.throws(() => requireResolvedWorkspace(null, membership, workspace), /profile has not been provisioned/);
  assert.throws(() => requireResolvedWorkspace(profile, null, workspace), /workspace has not been provisioned/);
});

test("logout session synchronization returns to unauthenticated state", () => {
  const afterSignOut = getAuthShellState({ restoring: false, hasSession: false, hasWorkspace: false, resolutionError: null });
  assert.equal(afterSignOut, "unauthenticated");
});

test("login validation normalizes email and requires credentials", () => {
  assert.deepEqual(validateLoginCredentials({ email: " USER@Example.COM ", password: "secret" }), { email: "user@example.com", password: "secret" });
  assert.throws(() => validateLoginCredentials({ email: "invalid", password: "secret" }), /valid email/);
  assert.throws(() => validateLoginCredentials({ email: "user@example.com", password: "" }), /Password is required/);
});

test("signup validation requires display name and a six-character password", () => {
  assert.deepEqual(validateSignUpCredentials({ displayName: " Amina ", email: "A@Example.com", password: "secret" }), {
    displayName: "Amina",
    email: "a@example.com",
    password: "secret",
  });
  assert.throws(() => validateSignUpCredentials({ displayName: "", email: "a@example.com", password: "secret" }), /Display name/);
  assert.throws(() => validateSignUpCredentials({ displayName: "Amina", email: "a@example.com", password: "short" }), /at least 6/);
});

test("real identity helpers prefer profile data and safely fall back to email", () => {
  assert.equal(getDisplayName("Amina Yusuf", "a@example.com"), "Amina Yusuf");
  assert.equal(getDisplayName(null, "owner@example.com"), "owner");
  assert.equal(getInitials("Amina Yusuf"), "AY");
});

test("forgot password view remains in the existing auth screen", () => {
  assert.match(authScreenSource, /Forgot password\?/);
  assert.match(authScreenSource, /forgot-password/);
  assert.match(authScreenSource, /Back to Login/);
});

test("recovery email validation normalizes valid addresses and rejects invalid ones", () => {
  assert.equal(validateRecoveryEmail(" USER@Example.COM "), "user@example.com");
  assert.throws(() => validateRecoveryEmail("not-an-email"), /valid email/);
});

test("password recovery requests use Supabase with the current application origin", () => {
  assert.match(authServiceSource, /resetPasswordForEmail\(normalizedEmail/);
  assert.match(authServiceSource, /redirectTo: `\$\{window\.location\.origin\}`/);
  assert.match(authScreenSource, /Check your email for a password reset link\./);
});

test("password recovery links and Supabase recovery events select reset mode", () => {
  assert.equal(isPasswordRecoveryUrl({ hash: "#access_token=token&type=recovery", search: "" }), true);
  assert.equal(isPasswordRecoveryUrl({ hash: "", search: "?type=recovery" }), true);
  assert.equal(isPasswordRecoveryUrl({ hash: "", search: "" }), false);
  assert.match(authContextSource, /event === "PASSWORD_RECOVERY"/);
  assert.match(authScreenSource, /passwordRecovery \? "reset-password" : "login"/);
});

test("new passwords require six characters and matching confirmation", () => {
  assert.equal(validateNewPassword({ password: "secret", confirmation: "secret" }), "secret");
  assert.throws(() => validateNewPassword({ password: "short", confirmation: "short" }), /at least 6/);
  assert.throws(() => validateNewPassword({ password: "secret", confirmation: "different" }), /do not match/);
});

test("successful password reset updates the Supabase user and exposes completion", () => {
  assert.match(authServiceSource, /updateUser\(\{ password \}\)/);
  assert.match(authScreenSource, /Your password has been updated successfully\./);
  assert.match(authScreenSource, /Continue to MediaMind/);
  assert.match(authContextSource, /completePasswordRecovery/);
});

test("existing login and signup actions remain wired through the auth context", () => {
  assert.match(authScreenSource, /await login\(\{ email, password \}\)/);
  assert.match(authScreenSource, /await signUp\(\{ displayName, email, password \}\)/);
  assert.match(authScreenSource, />Login</);
  assert.match(authScreenSource, />Sign Up</);
});
