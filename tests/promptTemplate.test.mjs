import assert from "node:assert/strict";
import test from "node:test";

import {
  TEMPLATE_VARIABLES,
  detectTemplatePlaceholders,
  getValidPromptDefaults,
  resolvePromptTemplate,
} from "../src/utils/promptTemplate.ts";

test("preserves a template with no placeholders", () => {
  const template = "Write a concise campaign summary.";
  assert.deepEqual(detectTemplatePlaceholders(template), []);
  assert.deepEqual(resolvePromptTemplate(template, {}), {
    text: template,
    unresolvedPlaceholders: [],
  });
});

test("resolves one placeholder", () => {
  assert.deepEqual(resolvePromptTemplate("Write about {topic}.", { topic: "TV advertising" }), {
    text: "Write about TV advertising.",
    unresolvedPlaceholders: [],
  });
});

test("reports an empty topic as unresolved", () => {
  assert.deepEqual(resolvePromptTemplate("Write about {topic}.", { topic: "" }), {
    text: "Write about {topic}.",
    unresolvedPlaceholders: ["topic"],
  });
});

test("resolves multiple placeholders deterministically", () => {
  const result = resolvePromptTemplate(
    "Write a {tone} LinkedIn post about {topic} for {audience}.",
    { tone: "Professional", topic: "TV advertising", audience: "Media Buyers" },
  );
  assert.equal(result.text, "Write a Professional LinkedIn post about TV advertising for Media Buyers.");
  assert.deepEqual(result.unresolvedPlaceholders, []);
});

test("resolves every occurrence of a repeated placeholder", () => {
  assert.deepEqual(resolvePromptTemplate("{topic}: insights about {topic}.", { topic: "CTV" }), {
    text: "CTV: insights about CTV.",
    unresolvedPlaceholders: [],
  });
  assert.deepEqual(detectTemplatePlaceholders("{topic} and {topic}"), ["topic"]);
});

test("detects and resolves all six supported placeholders", () => {
  const template = "{topic}|{audience}|{tone}|{objective}|{contentType}|{length}";
  assert.deepEqual(detectTemplatePlaceholders(template), TEMPLATE_VARIABLES);
  assert.deepEqual(resolvePromptTemplate(template, {
    topic: "CTV",
    audience: "Media Buyers",
    tone: "Professional",
    objective: "Educate",
    contentType: "LinkedIn Post",
    length: "Medium",
  }), {
    text: "CTV|Media Buyers|Professional|Educate|LinkedIn Post|Medium",
    unresolvedPlaceholders: [],
  });
});

test("retains unresolved supported placeholders and reports each once", () => {
  assert.deepEqual(resolvePromptTemplate("{topic} for {audience}; revisit {topic}.", { topic: "CTV" }), {
    text: "CTV for {audience}; revisit CTV.",
    unresolvedPlaceholders: ["audience"],
  });
});

test("reports only supported placeholders present in the template", () => {
  const template = "Write about {topic} in a {tone} voice.";
  assert.deepEqual(detectTemplatePlaceholders(template), ["topic", "tone"]);
  assert.deepEqual(resolvePromptTemplate(template, { topic: "CTV", audience: "CMOs" }).unresolvedPlaceholders, ["tone"]);
});

test("preserves ordinary and unsupported braces", () => {
  const template = "Use {unsupported}, JSON {\"key\": true}, and an empty pair {}.";
  assert.deepEqual(detectTemplatePlaceholders(template), []);
  assert.deepEqual(resolvePromptTemplate(template, {}), {
    text: template,
    unresolvedPlaceholders: [],
  });
});

test("handles an empty template", () => {
  assert.deepEqual(resolvePromptTemplate("", {}), { text: "", unresolvedPlaceholders: [] });
});

test("allows existing prompt records to omit nullable defaults at runtime", () => {
  const existingPrompt = {
    id: "00000000-0000-0000-0000-000000000000",
    name: "Existing prompt",
    category: "LinkedIn",
    template: "Write about {topic}.",
    description: null,
    uses: 0,
    is_favorite: false,
    created_at: "2026-01-01T00:00:00Z",
  };
  assert.equal(existingPrompt.template, "Write about {topic}.");
  assert.equal(existingPrompt.default_tone, undefined);
  assert.deepEqual(getValidPromptDefaults(existingPrompt), {});
});

test("accepts all valid prompt defaults", () => {
  assert.deepEqual(getValidPromptDefaults({
    content_type: "Newsletter",
    default_audience: "CMOs",
    default_tone: "Authoritative",
    default_objective: "Announce",
    default_output_length: "Long",
  }), {
    contentType: "Newsletter",
    audience: "CMOs",
    tone: "Authoritative",
    objective: "Announce",
    outputLength: "Long",
  });
});

test("accepts only valid non-null defaults from a partial prompt", () => {
  assert.deepEqual(getValidPromptDefaults({
    content_type: null,
    default_tone: "Friendly",
    default_objective: null,
  }), { tone: "Friendly" });
});

test("ignores invalid and stale stored defaults", () => {
  assert.deepEqual(getValidPromptDefaults({
    content_type: "Video",
    default_audience: "Everyone",
    default_tone: "Sarcastic",
    default_objective: "Convert",
    default_output_length: "Extra Long",
  }), {});
});
