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
