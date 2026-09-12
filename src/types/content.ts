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

export const TONE_OPTIONS = [
  "Professional",
  "Conversational",
  "Friendly",
  "Authoritative",
  "Persuasive",
  "Educational",
] as const;

export type ContentTone = (typeof TONE_OPTIONS)[number];

export const AUDIENCE_OPTIONS = [
  "General",
  "Customers",
  "Leads",
  "Executives",
  "Technical",
  "Internal Team",
  "CMOs",
] as const;

export type ContentAudience = (typeof AUDIENCE_OPTIONS)[number];

export const OUTPUT_LENGTH_OPTIONS = [
  "Short",
  "Medium",
  "Long",
] as const;

export type OutputLength = (typeof OUTPUT_LENGTH_OPTIONS)[number];

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

export function isToneOption(value: string): value is ContentTone {
  return TONE_OPTIONS.includes(value as ContentTone);
}

export function isAudienceOption(value: string): value is ContentAudience {
  return AUDIENCE_OPTIONS.includes(value as ContentAudience);
}

export function isContentObjective(value: string): value is ContentObjective {
  return CONTENT_OBJECTIVES.includes(value as ContentObjective);
}

export function isContentType(value: string): value is ContentType {
  return CONTENT_TYPES.includes(value as ContentType);
}

export function isOutputLength(value: string): value is OutputLength {
  return OUTPUT_LENGTH_OPTIONS.includes(value as OutputLength);
}