import { useEffect, useState } from "react";
import {
  createCanvasMetrics,
  fontString,
  loadFont,
  verifyGlyphWidth,
} from "@typesetting-engine/render-canvas";
import type { CanvasMetrics, GlyphWidthCheck } from "@typesetting-engine/render-canvas";

export type FontStatus = "loading" | "ready" | "fallback";

type MetricsState = {
  metrics: CanvasMetrics | null;
  check: GlyphWidthCheck | null;
  available: boolean;
  /** The full font shorthand these metrics were built from. */
  key: string;
};

export type CanvasMetricsState = {
  metrics: CanvasMetrics | null;
  status: FontStatus;
  check: GlyphWidthCheck | null;
};

/**
 * Load the font, wait for `document.fonts.ready`, then build the metrics cache.
 *
 * The result is keyed by the full font shorthand. While a new font/size is
 * loading the previous metrics are withheld, so nothing is measured with one
 * font and drawn with another.
 */
export function useCanvasMetrics(
  font: string,
  probe: string,
  fontSize: number,
): CanvasMetricsState {
  const fontSpec = fontString(fontSize, font);
  const [state, setState] = useState<MetricsState>({
    metrics: null,
    check: null,
    available: false,
    key: "",
  });
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    const onLoadingDone = () => setEpoch((value) => value + 1);
    document.fonts.addEventListener("loadingdone", onLoadingDone);
    return () => document.fonts.removeEventListener("loadingdone", onLoadingDone);
  }, []);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const result = await loadFont(fontSpec);
      if (!alive) return;

      const metrics = createCanvasMetrics(fontSpec);
      const check = verifyGlyphWidth(metrics, fontSpec, "汉");
      const available = document.fonts.check(fontString(fontSize, probe));

      if (import.meta.env.DEV) {
        console.info(
          `[D1] metrics.width("汉")=${check.metric.toFixed(3)} · ctx.measureText=${check.measured.toFixed(3)} · Δ=${check.delta.toFixed(6)}px · ${fontSpec}`,
        );
        if (!available) {
          console.warn(
            `[D1] ${probe} is not available; the canvas falls back to the next family in the stack.`,
            result,
          );
        }
      }

      setState({ metrics, check, available, key: fontSpec });
    })().catch((error: unknown) => {
      console.error("[D1] metrics init failed", error);
      if (alive) {
        setState({ metrics: null, check: null, available: false, key: fontSpec });
      }
    });

    return () => {
      alive = false;
    };
  }, [fontSpec, probe, fontSize, epoch]);

  const current = state.key === fontSpec;

  return {
    metrics: current ? state.metrics : null,
    check: current ? state.check : null,
    status: current ? (state.available ? "ready" : "fallback") : "loading",
  };
}
