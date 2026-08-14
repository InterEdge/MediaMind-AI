export const CONTENT_TYPES = [
  "LinkedIn Post",
  "Facebook Post",
  "X Post",
  "X Thread",
  "Instagram Caption",
  "Press Release",
  "Newsletter",
  "Blog Article",
  "Sales Email",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_OBJECTIVES = [
  "Inform",
  "Educate",
  "Promote",
  "Announce",
  "Engage",
  "Persuade",
] as const;

export type ContentObjective = (typeof CONTENT_OBJECTIVES)[number];

export const OUTPUT_LENGTHS = ["Short", "Medium", "Long"] as const;

export type OutputLength = (typeof OUTPUT_LENGTHS)[number];

export const TONE_OPTIONS = [
  "Professional",
  "Conversational",
  "Authoritative",
  "Friendly",
  "Persuasive",
  "Educational",
] as const;

export const AUDIENCE_OPTIONS = [
  "Media Buyers",
  "Agency Leaders",
  "Brand Marketers",
  "Ad Tech Professionals",
  "CMOs",
  "General Audience",
] as const;

export function isContentType(value: unknown): value is ContentType {
  return typeof value === "string" && CONTENT_TYPES.some((item) => item === value);
}

export function isContentObjective(value: unknown): value is ContentObjective {
  return typeof value === "string" && CONTENT_OBJECTIVES.some((item) => item === value);
}

export function isOutputLength(value: unknown): value is OutputLength {
  return typeof value === "string" && OUTPUT_LENGTHS.some((item) => item === value);
}

export function isToneOption(value: unknown): value is (typeof TONE_OPTIONS)[number] {
  return typeof value === "string" && TONE_OPTIONS.some((item) => item === value);
}

export function isAudienceOption(value: unknown): value is (typeof AUDIENCE_OPTIONS)[number] {
  return typeof value === "string" && AUDIENCE_OPTIONS.some((item) => item === value);
}

export const CONTENT_TYPE_PLATFORM: Record<ContentType, string> = {
  "LinkedIn Post": "LinkedIn",
  "Facebook Post": "Facebook",
  "X Post": "X",
  "X Thread": "X",
  "Instagram Caption": "Instagram",
  "Press Release": "Press Release",
  "Newsletter": "Newsletter",
  "Blog Article": "Blog",
  "Sales Email": "Email",
};
