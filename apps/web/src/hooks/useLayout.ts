import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { measureLayout } from "@typesetting-engine/core";
import type { LayoutOptions, LayoutResult, Metrics } from "@typesetting-engine/core";
import type { LayoutRequest, LayoutResponse } from "../workers/protocol";

export type LayoutStatus = "loading" | "working" | "ready" | "error" | "cancelled";

export type LayoutState = {
  layout: LayoutResult | null;
  /** Full layout pass (break + squeeze + justify + diagnostics). */
  elapsedMs: number | null;
  status: LayoutStatus;
  error?: string;
  /** 0–100 while a worker is running, otherwise null. */
  progress: number | null;
  cancel: () => void;
  /** Large documents use the worker and the virtualised paper viewport. */
  virtual: boolean;
};

type WorkerState = {
  signature: string;
  layout: LayoutResult | null;
  elapsedMs: number | null;
  error?: string;
};

const LARGE_TEXT = 30_000;

const metricsIds = new WeakMap<Metrics, number>();
let nextMetricsId = 0;

function metricsId(metrics: Metrics): number {
  let id = metricsIds.get(metrics);
  if (id === undefined) {
    nextMetricsId += 1;
    id = nextMetricsId;
    metricsIds.set(metrics, id);
  }
  return id;
}

function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function useLayout(
  text: string,
  options: LayoutOptions,
  metrics: Metrics | null,
): LayoutState {
  const large = text.length > LARGE_TEXT;

  const signature = useMemo(
    () =>
      `${hashText(text)}|${JSON.stringify(options)}|${metrics === null ? 0 : metricsId(metrics)}`,
    [text, options, metrics],
  );

  const main = useMemo(() => {
    if (large || !metrics) return null;
    return measureLayout(text, options, metrics);
  }, [large, text, options, metrics]);

  const widthTable = useMemo(() => {
    if (!large || !metrics) return null;
    const widths: Record<string, number> = {};
    for (const ch of new Set(Array.from(text))) widths[ch] = metrics.width(ch);
    return widths;
  }, [large, text, metrics]);

  const [workerState, setWorkerState] = useState<WorkerState | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!large || !metrics || !widthTable) return;

    let alive = true;
    const worker = new Worker(new URL("../workers/layout.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<LayoutResponse>) => {
      if (!alive) return;
      const data = event.data;
      if ("type" in data) {
        setProgress(data.percent);
        return;
      }
      setProgress(null);
      if (data.ok) {
        setWorkerState({
          signature,
          layout: data.result,
          elapsedMs: data.elapsedMs,
        });
      } else {
        setWorkerState({ signature, layout: null, elapsedMs: null, error: data.error });
      }
    };

    worker.onerror = (event) => {
      if (!alive) return;
      console.error("[bisheng] worker failed:", event.message);
      setProgress(null);
      // Degrade to the main thread rather than leaving a blank document.
      const measured = measureLayout(text, options, metrics);
      setWorkerState({
        signature,
        layout: measured.result,
        elapsedMs: measured.elapsedMs,
        error: "worker",
      });
    };

    const request: LayoutRequest = {
      text,
      options,
      widths: widthTable,
      ascent: metrics.ascent,
      descent: metrics.descent,
    };
    worker.postMessage(request);

    return () => {
      alive = false;
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [large, text, options, metrics, widthTable, signature]);

  const cancel = useCallback(() => {
    const worker = workerRef.current;
    if (worker) {
      worker.terminate();
      workerRef.current = null;
    }
    setProgress(null);
    setWorkerState({
      signature,
      layout: null,
      elapsedMs: null,
      error: "cancelled",
    });
  }, [signature]);

  if (!large) {
    return {
      layout: main?.result ?? null,
      elapsedMs: main?.elapsedMs ?? null,
      status: metrics === null ? "loading" : "ready",
      progress: null,
      cancel: () => undefined,
      virtual: false,
    };
  }

  const current = workerState?.signature === signature ? workerState : null;

  return {
    layout: current?.layout ?? null,
    elapsedMs: current?.elapsedMs ?? null,
    status:
      current === null
        ? metrics === null
          ? "loading"
          : "working"
        : current.error === "cancelled"
          ? "cancelled"
          : current.error !== undefined && current.layout === null
            ? "error"
            : "ready",
    error: current?.error,
    progress,
    cancel,
    virtual: true,
  };
}
