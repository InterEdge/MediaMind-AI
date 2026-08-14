import { useCallback, useReducer } from "react";
import {
  transformContent,
  type GeneratedResult,
  type TransformationAction,
} from "../services/contentGenerator";
import {
  buildTransformationRequest,
  cloneGeneratedResult,
  initialTransformationSession,
  transformationSessionReducer,
  type SuccessfulGenerationSnapshot,
} from "../utils/contentTransformation";

export function useContentTransformation() {
  const [session, dispatch] = useReducer(transformationSessionReducer, initialTransformationSession);

  const captureGeneration = useCallback((result: GeneratedResult) => {
    dispatch({ type: "generation_succeeded", result });
  }, []);

  const transform = useCallback(async (
    snapshot: SuccessfulGenerationSnapshot,
    currentResult: GeneratedResult,
    editableContent: string,
    action: TransformationAction,
    targetTone?: string,
    effectiveTone?: string,
  ) => {
    dispatch({ type: "transformation_started", action });
    try {
      const request = buildTransformationRequest(
        snapshot,
        currentResult,
        editableContent,
        action,
        targetTone,
        effectiveTone,
      );
      const transformed = await transformContent(request);
      dispatch({ type: "transformation_succeeded", result: transformed, action, targetTone });
      return transformed;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Content transformation failed.";
      dispatch({ type: "transformation_failed", error: message });
      throw error;
    }
  }, []);

  const revert = useCallback(() => {
    if (!session.originalResult) return null;
    const original = cloneGeneratedResult(session.originalResult);
    dispatch({ type: "revert" });
    return original;
  }, [session.originalResult]);

  const clear = useCallback(() => dispatch({ type: "clear" }), []);
  const editContent = useCallback((content: string) => dispatch({ type: "content_edited", content }), []);

  return { session, captureGeneration, transform, revert, clear, editContent };
}
