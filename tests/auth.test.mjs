import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as authUtils from "../src/utils/auth.ts";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

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

// Execute the actual service with a mocked SDK and browser, without network access.
const serviceJavaScript = ts.transpileModule(authServiceSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function loadAuthService(auth, href = "http://localhost:5173/") {
  const browser = {
    location: new URL(href),
    history: { state: null, replaceState(_state, _title, url) { browser.location = new URL(url); } },
  };
  const exports = {};
  new Function("require", "exports", "window", serviceJavaScript)((name) => {
    if (name === "../lib/supabase") return { supabase: { auth } };
    if (name === "../utils/auth") return authUtils;
    throw new Error(`Unexpected import: ${name}`);
  }, exports, browser);
  return { service: exports, browser };
}

test("Google OAuth uses the current origin on localhost and production", async () => {
  for (const origin of ["http://localhost:5173", "https://mediamind-ai-app.vercel.app"]) {
    const calls = [];
    const { service } = loadAuthService({ signInWithOAuth: async (options) => { calls.push(options); return { error: null }; } }, `${origin}/?next=https://untrusted.example`);
    await service.signInWithGoogle();
    assert.deepEqual(calls, [{ provider: "google", options: { redirectTo: origin } }]);
  }
});

test("Google OAuth sanitizes returned errors and thrown failures", async () => {
  for (const throws of [false, true]) {
    const { service } = loadAuthService({ signInWithOAuth: async () => {
      const error = new Error("private callback access_token=secret");
      if (throws) throw error;
      return { error };
    } });
    await assert.rejects(service.signInWithGoogle(), { message: "Google sign-in could not be started. Please try again or use email and password." });
  }
});

test("failed callback detection handles query and fragment errors including cancellation", () => {
  for (const suffix of ["?error=access_denied", "#error_description=private", "?error_code=failed", "#error="]) {
    assert.equal(authUtils.hasAuthCallbackError(new URL(`http://localhost:5173/${suffix}`)), true);
  }
  assert.equal(authUtils.hasAuthCallbackError(new URL("http://localhost:5173/#access_token=test&type=recovery")), false);
});

test("failed callback cleanup strips auth details and preserves unrelated parameters", () => {
  const result = new URL(authUtils.cleanFailedAuthCallbackUrl("http://localhost:5173/?view=login&error=denied&code=private#access_token=private&refresh_token=private&provider_token=private&provider_refresh_token=private&type=recovery&error_description=private&tab=welcome"));
  assert.equal(result.search, "?view=login");
  assert.equal(result.hash, "#tab=welcome");
  const recovery = "http://localhost:5173/#access_token=test&refresh_token=test&type=recovery";
  assert.equal(authUtils.cleanFailedAuthCallbackUrl(recovery), recovery);
});

test("callback errors are sanitized and cleaned only after SDK initialization", async () => {
  for (const sdkError of [null, new Error("private-token")]) {
    let initialized = false;
    const { service, browser } = loadAuthService({
      initialize: async () => { assert.match(browser.location.hash, /private-token/); initialized = true; return { error: sdkError }; },
      getSession: async () => { assert.fail("Failed callback must not restore a session"); },
    }, "http://localhost:5173/#error=access_denied&error_description=private-token&access_token=private-token");
    await assert.rejects(service.restoreSession(), (error) => error instanceof service.AuthCallbackError && error.message === authUtils.AUTH_CALLBACK_ERROR);
    assert.equal(initialized, true);
    assert.equal(browser.location.href, "http://localhost:5173/");
  }
});

test("SDK initialization failures without error parameters also remove callback credentials", async () => {
  const { service, browser } = loadAuthService({ initialize: async () => ({ error: new Error("private-token") }) }, "http://localhost:5173/#access_token=private-token");
  await assert.rejects(service.restoreSession(), { message: authUtils.AUTH_CALLBACK_ERROR });
  assert.equal(browser.location.hash, "");
});

test("successful Google and recovery callbacks restore the SDK session without clearing recovery parameters", async () => {
  for (const type of ["signup", "recovery"]) {
    const session = { user: { id: "user-1" } };
    const calls = [];
    const { service, browser } = loadAuthService({
      initialize: async () => { calls.push("initialize"); return { error: null }; },
      getSession: async () => { calls.push("getSession"); return { data: { session }, error: null }; },
    }, `http://localhost:5173/#access_token=test&type=${type}`);
    assert.equal(await service.restoreSession(), session);
    assert.deepEqual(calls, ["initialize", "getSession"]);
    assert.equal(authUtils.isPasswordRecoveryUrl(browser.location), type === "recovery");
  }
});

test("Google button is limited to login/signup and callbacks retain the recovery route", () => {
  assert.match(authScreenSource, /\(mode === "login" \|\| mode === "signup"\) && \([\s\S]*?onClick=\{\(\) => void handleGoogleSignIn\(\)\}/);
  assert.match(authScreenSource, /type="button" disabled=\{submitting\} onClick=\{\(\) => void handleGoogleSignIn/);
  assert.match(authScreenSource, /Continue with Google/);
  assert.match(authScreenSource, /if \(callbackError\) setMode\("login"\)/);
  assert.match(authContextSource, /error instanceof AuthCallbackError/);
  const clientSource = readFileSync(new URL("../src/lib/supabase.ts", import.meta.url), "utf8");
  assert.doesNotMatch(clientSource, /flowType\s*:\s*["']pkce/);
  assert.doesNotMatch(authServiceSource, /linkIdentity|service_role|GOOGLE_CLIENT_SECRET/);
});

test("rendered login and signup offer Google alongside email; recovery views do not", () => {
  const compiled = ts.transpileModule(authScreenSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const mode of ["login", "signup", "forgot-password", "reset-password"]) {
    let stateIndex = 0;
    const exports = {};
    const mockedReact = { ...React, useEffect() {}, useState(initial) {
      return [stateIndex++ === 0 ? mode : initial, () => {}];
    } };
    new Function("require", "exports", compiled)((name) => {
      if (name === "react") return mockedReact;
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "lucide-react") return icons;
      if (name === "../contexts/AuthContext") return { useAuth: () => ({ passwordRecovery: mode === "reset-password" }) };
      if (name === "../utils/auth") return authUtils;
      throw new Error(`Unexpected import: ${name}`);
    }, exports);
    const html = renderToStaticMarkup(exports.default());
    if (mode === "login" || mode === "signup") {
      assert.match(html, /Continue with Google/);
      assert.match(html, /type="email"/);
      assert.match(html, /type="password"/);
      assert.match(html, mode === "signup" ? /Create Account/ : /Forgot password/);
    } else {
      assert.doesNotMatch(html, /Continue with Google/);
      assert.match(html, mode === "reset-password" ? /Update Password/ : /Send Reset Link/);
    }
  }
});

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
