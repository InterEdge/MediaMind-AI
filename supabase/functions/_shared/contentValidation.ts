export class ContentValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateContentRequest(value: unknown): void {
  if (!record(value)) throw new ContentValidationError("A content request object is required.");
  if (value.mode !== undefined && value.mode !== "generate" && value.mode !== "transform") {
    throw new ContentValidationError("Invalid generation mode.");
  }
  const config = value.mode === "transform" ? value.attribution : value;
  if (!record(config)) throw new ContentValidationError("Generation settings are required.");
  for (const field of ["contentType", "tone", "audience", "objective"]) {
    if (typeof config[field] !== "string" || !config[field].trim() || config[field].length > 500) {
      throw new ContentValidationError(`Invalid ${field}.`);
    }
  }
  for (const field of ["topic", "additionalInstructions", "templateInstructions", "outputLength"]) {
    if (config[field] !== undefined && (typeof config[field] !== "string" || config[field].length > 10000)) {
      throw new ContentValidationError(`Invalid ${field}.`);
    }
  }
  const ids = config.documentIds ?? [];
  if (!Array.isArray(ids) || ids.length > 20 || ids.some((id) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    throw new ContentValidationError("Select at most 20 valid documents.");
  }
  if (config.promptId != null && (typeof config.promptId !== "string" || !/^[0-9a-f-]{36}$/i.test(config.promptId))) {
    throw new ContentValidationError("Invalid prompt ID.");
  }
  if (value.mode === "transform") {
    normalizeGeneratedContent(value.currentResult, 400);
    for (const field of ["action", "targetTone", "effectiveTone"]) {
      if (value[field] !== undefined && typeof value[field] !== "string") throw new ContentValidationError(`Invalid ${field}.`);
    }
  }
}

export function normalizeGeneratedContent(value: unknown, status = 502) {
  const fail = () => { throw new ContentValidationError("AI returned an invalid content format. Please try again.", status); };
  if (!record(value) || typeof value.content !== "string" || !value.content.trim() || value.content.length > 40000) return fail();
  for (const field of ["headline", "cta"]) {
    if (value[field] != null && (typeof value[field] !== "string" || value[field].length > 4000)) return fail();
  }
  if (value.hashtags != null && (!Array.isArray(value.hashtags) || value.hashtags.length > 50 || value.hashtags.some((tag) => typeof tag !== "string" || tag.length > 100))) return fail();
  return {
    content: value.content.trim(),
    headline: typeof value.headline === "string" ? value.headline.trim() || null : null,
    cta: typeof value.cta === "string" ? value.cta.trim() || null : null,
    hashtags: [...new Set(((value.hashtags ?? []) as string[]).map((tag) => tag.trim().replace(/^#+/, "")).filter(Boolean))],
  };
}

export function parseGeneratedContent(raw: unknown) {
  if (typeof raw !== "string") return normalizeGeneratedContent(null);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    throw new ContentValidationError("AI returned an invalid content format. Please try again.", 502);
  }
  return normalizeGeneratedContent(parsed);
}

export function requireUsableSources(requested: string[], used: string[]): void {
  if (requested.length && !used.length) {
    throw new ContentValidationError("Selected documents have no usable source text. Process them or choose other documents before generating.", 422);
  }
}
