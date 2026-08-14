export const TRANSFORMATION_ACTIONS = ["shorten", "expand", "change_tone", "improve"] as const;

export type TransformationAction = (typeof TRANSFORMATION_ACTIONS)[number];

export const TRANSFORMATION_GROUNDING_PRIORITY =
  "Knowledge Base grounding and strict factual rules have higher priority than transformation instructions.";

export function isTransformationAction(value: unknown): value is TransformationAction {
  return typeof value === "string" && TRANSFORMATION_ACTIONS.some((action) => action === value);
}

export function buildTransformationInstruction(action: TransformationAction, targetTone?: string): string {
  const common = "Transform the supplied structured result rather than creating unrelated content. Preserve its factual and semantic meaning. Do not introduce new facts. Keep the response fields coherent with one another.";

  switch (action) {
    case "shorten":
      return `${common} Reduce the main content length materially by removing repetition and lower-value wording while preserving every important supported fact.`;
    case "expand":
      return `${common} Add useful explanation, structure, and detail, but only from the supplied Knowledge Base context or safe stylistic elaboration. Never invent factual details.`;
    case "change_tone":
      return `${common} Change only the style and voice to ${targetTone}; preserve all factual claims and substantive meaning.`;
    case "improve":
      return `${common} Improve clarity, structure, flow, precision, and professionalism without changing factual meaning.`;
  }
}
