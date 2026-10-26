import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  Diagnostic,
  LayoutOptions,
  LayoutResult,
} from "@typesetting-engine/core";
import type { CanvasMetrics, DrawStats } from "@typesetting-engine/render-canvas";
import {
  MAX_WIDTH,
  MIN_WIDTH,
  MIN_PREVIEW_HEIGHT,
  PAPER_PADDING,
  VIRTUAL_VIEWPORT_HEIGHT,
} from "../constants";
import type { LayoutStatus } from "../hooks/useLayout";
import { clamp } from "../lib/math";
import { DiagnosticOverlay } from "./DiagnosticOverlay";
import { PagedPreview } from "./PagedPreview";
import { PreviewCanvas } from "./PreviewCanvas";
import { VirtualPreview } from "./VirtualPreview";

type Props = {
  title: string;
  text: string;
  options: LayoutOptions;
  fontLabel: string;
  metrics: CanvasMetrics | null;
  layout: LayoutResult | null;
  layoutStatus: LayoutStatus;
  layoutProgress: number | null;
  onCancelLayout: () => void;
  virtual: boolean;
  empty: boolean;
  redrawKey: number;
  diagnosticsOpen: boolean;
  selectedLine: number;
  ignoredTypes: ReadonlySet<Diagnostic["type"]>;
  onToggleDiagnostics: () => void;
  onSelectLine: (line: number) => void;
  onWidthChange: (width: number) => void;
  onRender: (stats: DrawStats) => void;
};

export function Stage({
  title,
  text,
  options,
  fontLabel,
  metrics,
  layout,
  layoutStatus,
  layoutProgress,
  onCancelLayout,
  virtual,
  empty,
  redrawKey,
  diagnosticsOpen,
  selectedLine,
  ignoredTypes,
  onToggleDiagnostics,
  onSelectLine,
  onWidthChange,
  onRender,
}: Props) {
  const paperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ center: number } | null>(null);
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [showGlyphWidths, setShowGlyphWidths] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pageMode, setPageMode] = useState(false);

  // Width changes come from pointermove and range input; collapse them to one
  // layout per animation frame instead of one per event.
  const latestWidthChange = useRef(onWidthChange);
  const pendingWidth = useRef<number | null>(null);
  const widthFrame = useRef<number | null>(null);

  useEffect(() => {
    latestWidthChange.current = onWidthChange;
  }, [onWidthChange]);

  useEffect(() => {
    return () => {
      if (widthFrame.current !== null) cancelAnimationFrame(widthFrame.current);
    };
  }, []);

  const scheduleWidth = useCallback((width: number) => {
    pendingWidth.current = width;
    if (widthFrame.current !== null) return;

    widthFrame.current = requestAnimationFrame(() => {
      widthFrame.current = null;
      const next = pendingWidth.current;
      pendingWidth.current = null;
      if (next !== null) latestWidthChange.current(next);
    });
  }, []);

  const paperWidth = options.width + PAPER_PADDING * 2;
  const canvasHeight = virtual
    ? VIRTUAL_VIEWPORT_HEIGHT
    : Math.max(layout?.height ?? 0, MIN_PREVIEW_HEIGHT);
  const lineCount = layout?.lines.length ?? 0;
  const baselineAscent = metrics?.ascent ?? options.fontSize * 0.88;
  const stateLabel =
    layoutStatus === "working"
      ? `Worker 排版中${layoutProgress === null ? "…" : ` ${layoutProgress}%`}`
      : layoutStatus === "cancelled"
        ? "排版已取消"
        : layoutStatus === "error"
          ? "排版失败"
          : "等待字体度量…";

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
    // getBoundingClientRect / pointer coordinates are in zoomed CSS pixels.
    const nextPaperWidth = (2 * (event.clientX - drag.center)) / zoom;
    scheduleWidth(
      clamp(Math.round(nextPaperWidth - PAPER_PADDING * 2), MIN_WIDTH, MAX_WIDTH),
    );
  };

  const setZoomClamped = (next: number) => {
    setZoom(clamp(Number(next.toFixed(2)), 0.5, 1.5));
  };

  const fitPaper = () => {
    const wrap = paperRef.current?.closest(".canvas-wrap") as HTMLElement | null;
    const available = (wrap?.clientWidth ?? 900) - 96;
    setZoomClamped(available / paperWidth);
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
          {virtual
            ? `视口 ${options.width} × ${canvasHeight} · 总高 ${Math.round(layout?.height ?? 0)}`
            : pageMode
              ? `A4 分页 · 容器 ${options.width}`
              : `画布 ${options.width} × ${Math.round(canvasHeight)}`}
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
            onChange={(event) => scheduleWidth(Number(event.target.value))}
          />
          <span className="mono width-value">{options.width}</span>
          <span className="unit">px</span>
        </label>
        <span className="spacer" />
        <span className="tool off" title="D5 接入网格">
          网格
        </span>
        <button
          type="button"
          className={`tool${diagnosticsOpen ? " active" : ""}`}
          aria-pressed={diagnosticsOpen}
          disabled={pageMode}
          title={
            pageMode
              ? "分页预览暂不叠加行级诊断"
              : "诊断模式：点击任意行查看断点原因"
          }
          onClick={onToggleDiagnostics}
        >
          诊断
        </button>
        <button
          type="button"
          className={`tool${showLineNumbers ? " active" : ""}`}
          aria-pressed={showLineNumbers}
          disabled={pageMode}
          title={pageMode ? "分页预览暂不显示行号" : "显示 / 隐藏行号"}
          onClick={() => setShowLineNumbers((value) => !value)}
        >
          行号
        </button>
        <button
          type="button"
          className={`tool${showGlyphWidths ? " active" : ""}`}
          aria-pressed={showGlyphWidths}
          title="显示每个字的实际占宽（挤压与混排）"
          onClick={() => setShowGlyphWidths((value) => !value)}
        >
          字宽
        </button>
        <button
          type="button"
          className={`tool${pageMode ? " active" : ""}`}
          aria-pressed={pageMode}
          disabled={virtual}
          title={virtual ? "大文档请直接导出 PDF 分页" : "A4 分页预览"}
          onClick={() => {
            if (!pageMode && diagnosticsOpen) onToggleDiagnostics();
            setPageMode((value) => !value);
          }}
        >
          分页
        </button>
        {layoutProgress !== null && layout !== null ? (
          <button type="button" className="tool" onClick={onCancelLayout}>
            取消排版 {layoutProgress}%
          </button>
        ) : null}
        <span className="milestone-badge" title="D6：Worker + 虚拟滚动 + PDF">
          D6 · 大文档
        </span>
        <div className="zoom-controls" role="group" aria-label="画布缩放">
          <button
            type="button"
            className="tool"
            aria-label="缩小"
            onClick={() => setZoomClamped(zoom - 0.1)}
          >
            −
          </button>
          <button
            type="button"
            className="tool mono"
            title="恢复 100%"
            onClick={() => setZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="tool"
            aria-label="放大"
            onClick={() => setZoomClamped(zoom + 0.1)}
          >
            +
          </button>
          <button type="button" className="tool" onClick={fitPaper}>
            适合
          </button>
        </div>
      </div>

      <div className="canvas-wrap">
        <div className="paper-col">
          {pageMode ? (
            layout ? (
              <PagedPreview
                layout={layout}
                options={options}
                text={text}
                title={title}
                fontLabel={fontLabel}
                paperWidth={paperWidth}
              />
            ) : (
              <div className="page-empty">{stateLabel}</div>
            )
          ) : (
            <>
          <div className="ruler" style={{ width: paperWidth, zoom }}>
            <span className="ruler-label" style={{ marginRight: 8 }}>
              0
            </span>
            <div className="ruler-track" />
            <span className="ruler-label" style={{ marginLeft: 8 }}>
              {options.width}
            </span>
          </div>

          <div className="paper" ref={paperRef} style={{ width: paperWidth, zoom }}>
            <div className="paper-head">
              <div className="paper-title">{title}</div>
              <div className="paper-tag">
                {fontLabel} {options.fontSize} / {options.lineHeight} · 容器 {options.width}
              </div>
            </div>

            <div className="paper-text">
              {layout === null ? (
                <div className="paper-state" style={{ height: canvasHeight }}>
                  <span>{stateLabel}</span>
                  {layoutStatus === "working" ? (
                    <button type="button" className="chip" onClick={onCancelLayout}>
                      取消
                    </button>
                  ) : null}
                </div>
              ) : virtual ? (
                <VirtualPreview
                  layout={layout}
                  options={options}
                  height={canvasHeight}
                  ascent={baselineAscent}
                  showGlyphWidths={showGlyphWidths}
                  showLineNumbers={showLineNumbers}
                  diagnosticsOpen={diagnosticsOpen}
                  selectedLine={selectedLine}
                  ignoredTypes={ignoredTypes}
                  onSelectLine={onSelectLine}
                />
              ) : (
                <>
                  <PreviewCanvas
                    layout={layout}
                    options={options}
                    height={canvasHeight}
                    redrawKey={redrawKey}
                    showGlyphWidths={showGlyphWidths}
                    onRender={onRender}
                  />

                  {diagnosticsOpen ? (
                    <DiagnosticOverlay
                      layout={layout}
                      options={options}
                      height={canvasHeight}
                      ascent={baselineAscent}
                      selectedLine={selectedLine}
                      ignoredTypes={ignoredTypes}
                      onSelectLine={onSelectLine}
                    />
                  ) : null}

                  {showLineNumbers && layout.lines.length > 0 ? (
                    <div className="line-numbers" aria-hidden="true">
                      {layout.lines.map((line, index) => (
                        <span
                          key={`${line.start}-${index}`}
                          style={{ top: line.y - baselineAscent }}
                        >
                          {index + 1}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              )}

              {empty && layout !== null && layout.lines.length === 0 ? (
                <div className="paper-empty">把文案粘进来，或点左侧「示例」</div>
              ) : null}
            </div>

            <div className="paper-foot">
              <span>毕昇 · 第 1 页</span>
              <span>{lineCount} 行</span>
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
            </>
          )}
        </div>
      </div>
    </section>
  );
}
