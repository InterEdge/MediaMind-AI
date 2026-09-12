import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as validation from "../supabase/functions/_shared/contentValidation.ts";
import * as transformation from "../supabase/functions/_shared/contentTransformation.ts";
import { initialTransformationSession, transformationSessionReducer, canRevertTransformation } from "../src/utils/contentTransformation.ts";

const documentId = "12345678-1234-1234-1234-123456789abc";
const config = { contentType: "LinkedIn Post", tone: "Professional", audience: "Media Buyers", objective: "Inform", topic: "Campaign", documentIds: [documentId] };
const result = { content: "Verified campaign results.", headline: "Campaign", cta: null, hashtags: ["Media"] };

// Vite resolves import.meta.env in browser builds. Inject an isolated fixture
// instead when compiling the real service for this CommonJS test harness.
function compileForHarness(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    transformers: { before: [(context) => {
      const visit = (node) => {
        if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === "meta") {
          return context.factory.createIdentifier("testImportMeta");
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (sourceFile) => ts.visitNode(sourceFile, visit);
    }] },
  }).outputText;
}

test("request validation rejects wrong types and excessive document selections", () => {
  validation.validateContentRequest(config);
  for (const bad of [null, [], { ...config, audience: 3 }, { ...config, topic: {} }, { ...config, documentIds: "all" }, { ...config, documentIds: Array(21).fill(documentId) }, { ...config, documentIds: ["invalid"] }, { mode: "transform" }]) {
    assert.throws(() => validation.validateContentRequest(bad), validation.ContentValidationError);
  }
});

test("AI output validation rejects malformed JSON and nested objects in display fields", () => {
  for (const value of ["not json", "null", "[]", '{"content":""}', '{"content":"good","headline":{}}', '{"content":"good","hashtags":[3]}']) {
    assert.throws(() => validation.parseGeneratedContent(value), (error) => error.status === 502);
  }
  assert.deepEqual(validation.parseGeneratedContent('```json\n{"content":" good ","hashtags":["#Media","Media",""]}\n```'), { content: "good", headline: null, cta: null, hashtags: ["Media"] });
});

test("selected sources must provide usable context while topic-only generation remains supported", () => {
  assert.throws(() => validation.requireUsableSources([documentId], []), (error) => error.status === 422);
  validation.requireUsableSources([], []);
  validation.requireUsableSources([documentId], [documentId]);
});

test("editing structured fields preserves the original and revert restores it", () => {
  const original = { ...result, contentType: "LinkedIn Post", sourceUsage: { requestedIds: [], foundIds: [], usableIds: [], usedIds: [], unavailableIds: [], unusableIds: [] } };
  const session = transformationSessionReducer(initialTransformationSession, { type: "generation_succeeded", result: original });
  const edited = transformationSessionReducer(session, { type: "fields_edited", fields: { headline: "Edited", hashtags: ["New"] } });
  assert.ok(edited, "The current production reducer does not implement fields_edited; this is not a harness error.");
  assert.equal(edited.originalResult.headline, "Campaign");
  assert.equal(edited.currentResult.headline, "Edited");
  assert.equal(canRevertTransformation(edited), true);
  assert.deepEqual(transformationSessionReducer(edited, { type: "revert" }).currentResult, original);
});

const edgeSource = readFileSync(new URL("../supabase/functions/generate-content/index.ts", import.meta.url), "utf8");
const edgeCode = compileForHarness(edgeSource);
function edgeFixture({ docs = [{ id: documentId, title: "Campaign", extracted_text: "Verified campaign results." }], providerContent = JSON.stringify(result), denied = false, providerTimeout = false } = {}) {
  let handler;
  const providerCalls = [];
  const query = { select() { return this; }, in() { return this; }, eq() { return this; }, then(resolve) { return Promise.resolve({ data: docs, error: null }).then(resolve); } };
  const client = { from: () => query };
  const authHelpers = {
    authenticateEdgeRequest: async () => ({ serviceClient: client }),
    requireWorkspaceMembership: async () => { if (denied) throw Object.assign(new Error("Forbidden"), { status: 403 }); return "workspace"; },
    edgeAuthorizationResponse: (error, headers) => error.status === 403 ? new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers }) : null,
  };
  new Function("require", "exports", "Deno", "fetch", "console", edgeCode)((name) => {
    if (name === "npm:@supabase/supabase-js@2.57.4") return { createClient: () => client };
    if (name.endsWith("/contentValidation.ts")) return validation;
    if (name.endsWith("/contentTransformation.ts")) return transformation;
    if (name.endsWith("/edgeAuth.ts")) return authHelpers;
    if (name.endsWith("/openrouter.ts")) return { getOpenRouterApiKey: () => "test-only" };
    throw new Error(`Unexpected dependency: ${name}`);
  }, {}, {
    serve: (fn) => { handler = fn; },
    env: { get: (name) => ({ SUPABASE_URL: "https://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "test-only" })[name] },
  }, async (_url, options) => {
    providerCalls.push(JSON.parse(options.body));
    if (providerTimeout) throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    return new Response(JSON.stringify({ choices: [{ message: { content: providerContent } }] }));
  }, { error() {}, log() {} });
  return { call: (body = config, method = "POST") => handler(new Request("http://test.local", { method, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) })), providerCalls };
}

test("Edge handler rejects invalid input before provider invocation", async () => {
  const fixture = edgeFixture();
  assert.equal((await fixture.call({ ...config, documentIds: {} })).status, 400);
  assert.equal((await fixture.call({ ...config, topic: "x".repeat(65000) })).status, 413);
  assert.equal((await fixture.call(config, "GET")).status, 405);
  assert.equal(fixture.providerCalls.length, 0);
});

test("Edge handler blocks unauthorized workspaces and unavailable documents", async () => {
  for (const fixture of [edgeFixture({ denied: true }), edgeFixture({ docs: [] })]) {
    assert.equal((await fixture.call()).status, 403);
    assert.equal(fixture.providerCalls.length, 0);
  }
});

test("Edge handler refuses generation when all selected sources lack text", async () => {
  const fixture = edgeFixture({ docs: [{ id: documentId, title: "Empty", extracted_text: "" }] });
  assert.equal((await fixture.call()).status, 422);
  assert.equal(fixture.providerCalls.length, 0);
});

test("Edge handler returns validated content and actual source attribution", async () => {
  const fixture = edgeFixture();
  const response = await fixture.call();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.content, result.content);
  assert.deepEqual(data.sourceUsage.usedIds, [documentId]);
  assert.match(fixture.providerCalls[0].messages[1].content, /Verified campaign results/);
});

test("Edge handler reports malformed output, overlong X content, and timeouts as retryable errors", async () => {
  assert.equal((await edgeFixture({ providerContent: "raw invalid content" }).call()).status, 502);
  assert.equal((await edgeFixture({ providerContent: JSON.stringify({ content: "x".repeat(281) }) }).call({ ...config, contentType: "X Post" })).status, 502);
  assert.equal((await edgeFixture({ providerTimeout: true }).call()).status, 504);
});

const serviceSource = readFileSync(new URL("../src/services/contentGenerator.ts", import.meta.url), "utf8");
const serviceCode = compileForHarness(serviceSource);
test("draft save succeeds with a warning when secondary activity tracking fails", async () => {
  for (const throws of [false, true]) {
    const exports = {};
    let inserted;
    const client = { from: (table) => ({ insert(payload) {
      if (table === "activities") {
        if (throws) throw new Error("offline");
        return Promise.resolve({ error: new Error("denied") });
      }
      inserted = payload;
      return { select: () => ({ single: async () => ({ data: { id: "draft-1" }, error: null }) }) };
    } }) };
    new Function("require", "exports", "testImportMeta", serviceCode)((name) => {
      if (name === "../lib/supabase") return { supabase: client };
      if (name === "../utils/workspaceOwnership") return { withActiveWorkspace: (payload) => ({ ...payload, workspace_id: "workspace-1" }) };
      if (name === "./edgeFunctions") return {};
      if (name.endsWith("/contentValidation")) return validation;
      throw new Error(`Unexpected dependency: ${name}`);
    }, exports, { env: { VITE_SUPABASE_URL: "https://supabase.test", VITE_SUPABASE_ANON_KEY: "test-only" } });
    const saved = await exports.saveGeneratedDraft({ title: "Draft", content: "Content", generationConfig: {} });
    assert.equal(saved.id, "draft-1");
    assert.match(saved.warning, /Draft saved/);
    assert.equal(inserted.workspace_id, "workspace-1");
  }
});
