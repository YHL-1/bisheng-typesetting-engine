import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LayoutOptions } from "@typesetting-engine/core";
import type { CanvasMetrics, DrawStats } from "@typesetting-engine/render-canvas";
import { MAX_WIDTH, MIN_WIDTH, PAPER_PADDING, PREVIEW_HEIGHT } from "../constants";
import { clamp } from "../lib/math";
import { PreviewCanvas } from "./PreviewCanvas";

type Props = {
  title: string;
  text: string;
  options: LayoutOptions;
  fontLabel: string;
  metrics: CanvasMetrics | null;
  redrawKey: number;
  onWidthChange: (width: number) => void;
  onRender: (stats: DrawStats, metrics: CanvasMetrics) => void;
};

export function Stage({
  title,
  text,
  options,
  fontLabel,
  metrics,
  redrawKey,
  onWidthChange,
  onRender,
}: Props) {
  const paperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ center: number } | null>(null);
  const paperWidth = options.width + PAPER_PADDING * 2;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const paper = paperRef.current;
    if (!paper) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = paper.getBoundingClientRect();
    // The paper is centred, so its right edge moves at half the width delta.
    // Track the centre once, then solve for the width that puts the edge under
    // the pointer: paperWidth = 2 × (pointerX − centre).
    dragRef.current = { center: rect.left + rect.width / 2 };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const nextPaperWidth = 2 * (event.clientX - drag.center);
    onWidthChange(
      clamp(Math.round(nextPaperWidth - PAPER_PADDING * 2), MIN_WIDTH, MAX_WIDTH),
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section className="stage">
      <div className="stage-bar">
        <span className="dim">
          画布 {options.width} × {PREVIEW_HEIGHT}
        </span>
        <span className="dim divider">|</span>
        <label className="tool width-control">
          宽度
          <input
            type="range"
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            step={1}
            value={options.width}
            aria-label="容器宽度"
            onChange={(event) => onWidthChange(Number(event.target.value))}
          />
          <span className="mono width-value">{options.width}</span>
          <span className="unit">px</span>
        </label>
        <span className="spacer" />
        <span className="tool off" title="D1 暂不提供网格">
          网格
        </span>
        <span className="tool off" title="D5 接入诊断">
          诊断
        </span>
        <span className="d1-badge" title="D1：单行预览，断行在 D2 接入">
          D1 · 单行
        </span>
        <span className="dim">100%</span>
      </div>

      <div className="canvas-wrap">
        <div className="paper-col">
          <div className="ruler" style={{ width: paperWidth }}>
            <span className="ruler-label" style={{ marginRight: 8 }}>
              0
            </span>
            <div className="ruler-track" />
            <span className="ruler-label" style={{ marginLeft: 8 }}>
              {options.width}
            </span>
          </div>

          <div className="paper" ref={paperRef} style={{ width: paperWidth }}>
            <div className="paper-head">
              <div className="paper-title">{title}</div>
              <div className="paper-tag">
                {fontLabel} {options.fontSize} / {options.lineHeight} · 容器 {options.width}
              </div>
            </div>

            <div className="paper-text">
              <PreviewCanvas
                text={text}
                options={options}
                metrics={metrics}
                height={PREVIEW_HEIGHT}
                redrawKey={redrawKey}
                onRender={onRender}
              />
            </div>

            <div className="paper-foot">
              <span>毕昇 · 第 1 页</span>
              <span>1 / 1</span>
            </div>

            <div
              className="handle"
              role="separator"
              aria-orientation="vertical"
              aria-label="拖拽调整容器宽度"
              title="拖拽调整容器宽度"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          </div>

          <div className="legend">
            <b>
              <i className="lg-sq" />
              标点挤压 ½ 字
            </b>
            <b>
              <i className="lg-bar" />
              行末余量 &gt; 20%
            </b>
            <span className="legend-hint">
              拖拽右边缘调宽 · 点击行看断点原因（D5）
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
