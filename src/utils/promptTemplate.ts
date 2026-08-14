export const TEMPLATE_VARIABLES = [
  "topic",
  "audience",
  "tone",
  "objective",
  "contentType",
  "length",
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export type TemplateValues = Partial<Record<TemplateVariable, string | null | undefined>>;

export interface ResolvedTemplate {
  text: string;
  unresolvedPlaceholders: TemplateVariable[];
}

export interface PromptDefaultsSource {
  content_type?: unknown;
  default_audience?: unknown;
  default_tone?: unknown;
  default_objective?: unknown;
  default_output_length?: unknown;
}

export interface ValidPromptDefaults {
  contentType?: ContentType;
  audience?: string;
  tone?: string;
  objective?: ContentObjective;
  outputLength?: OutputLength;
}

const supportedVariables = new Set<string>(TEMPLATE_VARIABLES);
const placeholderPattern = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

export function detectTemplatePlaceholders(template: string): TemplateVariable[] {
  const detected: TemplateVariable[] = [];
  const seen = new Set<TemplateVariable>();

  for (const match of template.matchAll(placeholderPattern)) {
    const variable = match[1];
    if (supportedVariables.has(variable) && !seen.has(variable as TemplateVariable)) {
      const supportedVariable = variable as TemplateVariable;
      detected.push(supportedVariable);
      seen.add(supportedVariable);
    }
  }

  return detected;
}

export function getValidPromptDefaults(prompt: PromptDefaultsSource): ValidPromptDefaults {
  const defaults: ValidPromptDefaults = {};
  if (isContentType(prompt.content_type)) defaults.contentType = prompt.content_type;
  if (isAudienceOption(prompt.default_audience)) defaults.audience = prompt.default_audience;
  if (isToneOption(prompt.default_tone)) defaults.tone = prompt.default_tone;
  if (isContentObjective(prompt.default_objective)) defaults.objective = prompt.default_objective;
  if (isOutputLength(prompt.default_output_length)) defaults.outputLength = prompt.default_output_length;
  return defaults;
}

export function resolvePromptTemplate(template: string, values: TemplateValues): ResolvedTemplate {
  const unresolvedPlaceholders: TemplateVariable[] = [];
  const unresolved = new Set<TemplateVariable>();

  const text = template.replace(placeholderPattern, (placeholder, variable: string) => {
    if (!supportedVariables.has(variable)) return placeholder;

    const supportedVariable = variable as TemplateVariable;
    const value = values[supportedVariable];
    if (typeof value === "string" && value.length > 0) return value;

    if (!unresolved.has(supportedVariable)) {
      unresolvedPlaceholders.push(supportedVariable);
      unresolved.add(supportedVariable);
    }
    return placeholder;
  });

  return { text, unresolvedPlaceholders };
}
import {
  isAudienceOption,
  isContentObjective,
  isContentType,
  isOutputLength,
  isToneOption,
  type ContentObjective,
  type ContentType,
  type OutputLength,
} from "../types/content.ts";
