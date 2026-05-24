"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

type UseAutosaveOptions<TValue, TResult> = {
  debounceMs?: number;
  enabled: boolean;
  isDirty: (value: TValue) => boolean;
  onError?: (error: Error) => void;
  onSave: (value: TValue) => Promise<TResult>;
  onSaved?: (result: TResult) => void;
  resetKey: string;
  value: TValue;
};

export function useAutosave<TValue, TResult>({
  debounceMs = 900,
  enabled,
  isDirty,
  onError,
  onSave,
  onSaved,
  resetKey,
  value,
}: UseAutosaveOptions<TValue, TResult>) {
  const [saveState, setSaveState] = useState<{ error: string; key: string; status: AutosaveStatus }>({
    error: "",
    key: resetKey,
    status: "idle",
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const dirty = enabled && isDirty(value);
  const visibleState = saveState.key === resetKey ? saveState : { error: "", key: resetKey, status: "idle" as const };
  const visibleStatus: AutosaveStatus =
    dirty && visibleState.status !== "saving" && visibleState.status !== "error" ? "pending" : visibleState.status;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const saveNow = useCallback(async () => {
    clearTimer();

    if (!enabled || !isDirty(value)) {
      setSaveState({ error: "", key: resetKey, status: "saved" });
      return null;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setSaveState({ error: "", key: resetKey, status: "saving" });

    try {
      const result = await onSave(value);

      if (requestIdRef.current === requestId) {
        onSaved?.(result);
        setSaveState({ error: "", key: resetKey, status: "saved" });
      }

      return result;
    } catch (caught) {
      const nextError = caught instanceof Error ? caught : new Error("No se pudo guardar.");

      if (requestIdRef.current === requestId) {
        setSaveState({ error: nextError.message, key: resetKey, status: "error" });
        onError?.(nextError);
      }

      throw nextError;
    }
  }, [clearTimer, enabled, isDirty, onError, onSave, onSaved, resetKey, value]);

  useEffect(() => {
    clearTimer();
    requestIdRef.current += 1;
  }, [clearTimer, resetKey]);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    clearTimer();
    timerRef.current = setTimeout(() => {
      void saveNow().catch(() => undefined);
    }, debounceMs);

    return clearTimer;
  }, [clearTimer, debounceMs, dirty, saveNow]);

  return {
    dirty,
    error: visibleState.error,
    saveNow,
    status: visibleStatus,
  };
}
