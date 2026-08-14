import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTransformationRequest,
  canRevertTransformation,
  initialTransformationSession,
  transformationSessionReducer,
} from "../src/utils/contentTransformation.ts";
import {
  buildTransformationInstruction,
  isTransformationAction,
  TRANSFORMATION_GROUNDING_PRIORITY,
} from "../supabase/functions/_shared/contentTransformation.ts";

const sourceUsage = {
  requestedIds: ["requested-document"],
  foundIds: ["requested-document"],
  usableIds: ["requested-document"],
  usedIds: ["actual-source"],
  unavailableIds: [],
  unusableIds: [],
};

const originalResult = {
  headline: "CTV reaches 4.2 million viewers",
  content: "The verified campaign reached 4.2 million viewers.",
  cta: "Review the verified campaign results.",
  hashtags: ["CTV", "CampaignResults"],
  contentType: "LinkedIn Post",
  sourceUsage,
};

const snapshot = {
  params: {
    contentType: "LinkedIn Post",
    topic: "Verified CTV campaign",
    tone: "Professional",
    audience: "Media Buyers",
    outputLength: "Medium",
    documentIds: ["requested-document"],
    additionalInstructions: "Use only exact source facts.",
    templateInstructions: "Explain {topic} clearly.",
    objective: "Inform",
  },
  sourceUsage,
  prompt: { id: "prompt-id", name: "Campaign explainer" },
  resolvedTemplate: "Explain Verified CTV campaign clearly.",
};

test("supports only the four transformation actions", () => {
  for (const action of ["shorten", "expand", "change_tone", "improve"]) {
    assert.equal(isTransformationAction(action), true);
  }
  assert.equal(isTransformationAction("regenerate"), false);
});

test("shorten instruction preserves facts while reducing length", () => {
  const instruction = buildTransformationInstruction("shorten");
  assert.match(instruction, /Reduce.*length materially/i);
  assert.match(instruction, /preserv/i);
  assert.match(instruction, /Do not introduce new facts/i);
});

test("expand instruction forbids invented facts", () => {
  const instruction = buildTransformationInstruction("expand");
  assert.match(instruction, /Knowledge Base context/i);
  assert.match(instruction, /Never invent factual details/i);
});

test("strict grounding explicitly outranks transformation instructions", () => {
  assert.match(TRANSFORMATION_GROUNDING_PRIORITY, /Knowledge Base grounding/i);
  assert.match(TRANSFORMATION_GROUNDING_PRIORITY, /higher priority than transformation/i);
});

test("change tone requires a valid tone and preserves factual content", () => {
  assert.throws(
    () => buildTransformationRequest(snapshot, originalResult, originalResult.content, "change_tone"),
    /valid target tone/i,
  );
  const request = buildTransformationRequest(snapshot, originalResult, originalResult.content, "change_tone", "Friendly");
  assert.equal(request.targetTone, "Friendly");
  assert.equal(request.effectiveTone, "Friendly");
  assert.match(buildTransformationInstruction("change_tone", "Friendly"), /preserve all factual claims/i);
});

test("a later transformation can preserve the current transformed tone", () => {
  const request = buildTransformationRequest(
    snapshot,
    originalResult,
    originalResult.content,
    "shorten",
    undefined,
    "Friendly",
  );
  assert.equal(request.targetTone, undefined);
  assert.equal(request.effectiveTone, "Friendly");
});

test("improve instruction preserves meaning", () => {
  assert.match(buildTransformationInstruction("improve"), /without changing factual meaning/i);
});

test("transformation uses the successful snapshot and current manual edit", () => {
  const request = buildTransformationRequest(snapshot, originalResult, "Manually edited current content.", "shorten");
  assert.equal(request.attribution.topic, "Verified CTV campaign");
  assert.equal(request.attribution.tone, "Professional");
  assert.deepEqual(request.attribution.documentIds, ["requested-document"]);
  assert.deepEqual(request.attribution.actualSourceIds, ["actual-source"]);
  assert.equal(request.attribution.promptId, "prompt-id");
  assert.equal(request.currentResult.content, "Manually edited current content.");
});

test("no-template transformation remains valid", () => {
  const request = buildTransformationRequest(
    { ...snapshot, prompt: null, resolvedTemplate: null, params: { ...snapshot.params, templateInstructions: undefined } },
    originalResult,
    originalResult.content,
    "improve",
  );
  assert.equal(request.attribution.promptId, null);
  assert.equal(request.attribution.resolvedTemplate, null);
});

test("multiple transformations still revert to the first generated result", () => {
  const first = transformationSessionReducer(initialTransformationSession, {
    type: "generation_succeeded",
    result: originalResult,
  });
  const shortened = transformationSessionReducer(first, {
    type: "transformation_succeeded",
    action: "shorten",
    result: { ...originalResult, content: "Reached 4.2 million viewers." },
  });
  const improved = transformationSessionReducer(shortened, {
    type: "transformation_succeeded",
    action: "improve",
    result: { ...originalResult, content: "The campaign reached a verified audience of 4.2 million." },
  });
  assert.equal(improved.lineage.count, 2);
  assert.equal(canRevertTransformation(improved), true);

  const reverted = transformationSessionReducer(improved, { type: "revert" });
  assert.deepEqual(reverted.currentResult, originalResult);
  assert.deepEqual(reverted.originalResult, originalResult);
  assert.equal(reverted.editableContent, originalResult.content);
  assert.equal(reverted.lineage.transformed, false);
  assert.equal(canRevertTransformation(reverted), false);
});

test("manual edits make revert available without replacing the original", () => {
  const generated = transformationSessionReducer(initialTransformationSession, {
    type: "generation_succeeded",
    result: originalResult,
  });
  const edited = transformationSessionReducer(generated, {
    type: "content_edited",
    content: "Manual edit preserving the 4.2 million viewer fact.",
  });
  assert.equal(canRevertTransformation(edited), true);
  assert.equal(edited.originalResult.content, originalResult.content);
});

test("a normal regenerate establishes a new original result", () => {
  const first = transformationSessionReducer(initialTransformationSession, {
    type: "generation_succeeded",
    result: originalResult,
  });
  const regeneratedResult = { ...originalResult, content: "A newly generated campaign summary." };
  const regenerated = transformationSessionReducer(first, {
    type: "generation_succeeded",
    result: regeneratedResult,
  });
  assert.deepEqual(regenerated.originalResult, regeneratedResult);
  assert.equal(regenerated.lineage.count, 0);
});
