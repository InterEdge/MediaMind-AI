import { isToneOption } from "../types/content.ts";
import type {
  GenerateContentParams,
  GeneratedResult,
  TransformContentParams,
  TransformationAction,
} from "../services/contentGenerator.ts";

export interface SuccessfulGenerationSnapshot {
  params: GenerateContentParams;
  sourceUsage: GeneratedResult["sourceUsage"];
  prompt: { id: string; name: string } | null;
  resolvedTemplate: string | null;
}

export interface TransformationLineage {
  transformed: boolean;
  latestAction: TransformationAction | null;
  targetTone: string | null;
  count: number;
}

export interface TransformationSession {
  originalResult: GeneratedResult | null;
  currentResult: GeneratedResult | null;
  editableContent: string;
  lineage: TransformationLineage;
  status: "idle" | "transforming";
  activeAction: TransformationAction | null;
  error: string | null;
}

export type TransformationSessionAction =
  | { type: "generation_succeeded"; result: GeneratedResult }
  | { type: "transformation_started"; action: TransformationAction }
  | { type: "transformation_succeeded"; result: GeneratedResult; action: TransformationAction; targetTone?: string }
  | { type: "transformation_failed"; error: string }
  | { type: "content_edited"; content: string }
  | { type: "revert" }
  | { type: "clear" };

export const initialTransformationSession: TransformationSession = {
  originalResult: null,
  currentResult: null,
  editableContent: "",
  lineage: { transformed: false, latestAction: null, targetTone: null, count: 0 },
  status: "idle",
  activeAction: null,
  error: null,
};

export function cloneGeneratedResult(result: GeneratedResult, content = result.content): GeneratedResult {
  return {
    ...result,
    content,
    hashtags: [...result.hashtags],
    sourceUsage: {
      requestedIds: [...result.sourceUsage.requestedIds],
      foundIds: [...result.sourceUsage.foundIds],
      usableIds: [...result.sourceUsage.usableIds],
      usedIds: [...result.sourceUsage.usedIds],
      unavailableIds: [...result.sourceUsage.unavailableIds],
      unusableIds: [...result.sourceUsage.unusableIds],
    },
  };
}

export function buildTransformationRequest(
  snapshot: SuccessfulGenerationSnapshot,
  currentResult: GeneratedResult,
  editableContent: string,
  action: TransformationAction,
  targetTone?: string,
  effectiveTone = snapshot.params.tone,
): TransformContentParams {
  if (action === "change_tone" && !isToneOption(targetTone)) {
    throw new Error("Select a valid target tone before transforming content.");
  }

  return {
    action,
    targetTone: action === "change_tone" ? targetTone : undefined,
    effectiveTone: action === "change_tone" ? targetTone : effectiveTone,
    currentResult: {
      headline: currentResult.headline,
      content: editableContent,
      cta: currentResult.cta,
      hashtags: [...currentResult.hashtags],
    },
    attribution: {
      ...snapshot.params,
      documentIds: [...snapshot.params.documentIds],
      requestedDocumentIds: [...snapshot.sourceUsage.requestedIds],
      actualSourceIds: [...snapshot.sourceUsage.usedIds],
      promptId: snapshot.prompt?.id ?? null,
      promptName: snapshot.prompt?.name ?? null,
      resolvedTemplate: snapshot.resolvedTemplate,
    },
  };
}

export function transformationSessionReducer(
  state: TransformationSession,
  action: TransformationSessionAction,
): TransformationSession {
  switch (action.type) {
    case "generation_succeeded": {
      const originalResult = cloneGeneratedResult(action.result);
      return {
        originalResult,
        currentResult: cloneGeneratedResult(action.result),
        editableContent: action.result.content,
        lineage: { transformed: false, latestAction: null, targetTone: null, count: 0 },
        status: "idle",
        activeAction: null,
        error: null,
      };
    }
    case "transformation_started":
      return { ...state, status: "transforming", activeAction: action.action, error: null };
    case "transformation_succeeded":
      return {
        ...state,
        currentResult: cloneGeneratedResult(action.result),
        editableContent: action.result.content,
        lineage: {
          transformed: true,
          latestAction: action.action,
          targetTone: action.action === "change_tone"
            ? action.targetTone ?? null
            : state.lineage.targetTone,
          count: state.lineage.count + 1,
        },
        status: "idle",
        activeAction: null,
        error: null,
      };
    case "transformation_failed":
      return { ...state, status: "idle", activeAction: null, error: action.error };
    case "content_edited":
      return { ...state, editableContent: action.content };
    case "revert":
      return state.originalResult
        ? {
            ...state,
            currentResult: cloneGeneratedResult(state.originalResult),
            editableContent: state.originalResult.content,
            lineage: { transformed: false, latestAction: null, targetTone: null, count: 0 },
            status: "idle",
            activeAction: null,
            error: null,
          }
        : state;
    case "clear":
      return initialTransformationSession;
  }
}

export function canRevertTransformation(session: TransformationSession): boolean {
  const original = session.originalResult;
  const current = session.currentResult;
  if (!original || !current) return false;

  return session.editableContent !== original.content
    || current.headline !== original.headline
    || current.cta !== original.cta
    || current.content !== original.content
    || current.hashtags.length !== original.hashtags.length
    || current.hashtags.some((hashtag, index) => hashtag !== original.hashtags[index]);
}

export function summarizeOriginalResult(result: GeneratedResult | null) {
  if (!result) return null;
  return {
    wordCount: result.content.trim().split(/\s+/).filter(Boolean).length,
    hasHeadline: Boolean(result.headline),
    hasCta: Boolean(result.cta),
    hashtagCount: result.hashtags.length,
  };
}
