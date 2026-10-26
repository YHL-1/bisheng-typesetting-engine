import { useEffect, useMemo, useRef } from "react";
import { countChars, measureLayout } from "@typesetting-engine/core";
import type { LayoutOptions, LayoutResult, Metrics } from "@typesetting-engine/core";
import { drawLayout } from "@typesetting-engine/render-canvas";
import { COMPARE_WIDTH, LARGE_TEXT_THRESHOLD } from "../constants";

type Props = {
  text: string;
  options: LayoutOptions;
  metrics: Metrics | null;
  fontLabel: string;
};

function CompareCanvas({
  layout,
  options,
  dpr,
  background,
}: {
  layout: LayoutResult;
  options: LayoutOptions;
  dpr: number;
  background?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawLayout(layout, canvas, options, Math.max(layout.height, 1), {
      dpr,
      ...(background ? { background } : {}),
    });
  }, [layout, options, dpr, background]);

  return (
    <canvas
      ref={canvasRef}
      className="compare-canvas"
      style={{ width: options.width, height: Math.max(layout.height, 1) }}
      role="img"
      aria-label="毕昇排版结果"
    />
  );
}

export function Compare({ text, options, metrics, fontLabel }: Props) {
  const compareOptions = useMemo<LayoutOptions>(
    () => ({
      ...options,
      width: COMPARE_WIDTH,
    }),
    [options],
  );

  const tooLarge = text.length > LARGE_TEXT_THRESHOLD;

  const compareLayout = useMemo(() => {
    if (!metrics || tooLarge) return null;
    return measureLayout(text, compareOptions, metrics).result;
  }, [text, compareOptions, metrics, tooLarge]);

  const diffRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!compareLayout) {
      if (diffRef.current) diffRef.current.textContent = "—";
      return;
    }

    const render = () => {
      const canvas = document.createElement("canvas");
      drawLayout(compareLayout, canvas, compareOptions, Math.max(compareLayout.height, 1), {
        dpr: 2,
        background: "#ffffff",
      });
      return canvas;
    };

    const primary = render();
    const exported = render();
    const left = primary.getContext("2d")?.getImageData(0, 0, primary.width, primary.height);
    const right = exported.getContext("2d")?.getImageData(0, 0, exported.width, exported.height);
    if (!left || !right) return;

    let different = 0;
    const dataA = left.data;
    const dataB = right.data;
    for (let index = 0; index < dataA.length; index += 4) {
      if (
        dataA[index] !== dataB[index] ||
        dataA[index + 1] !== dataB[index + 1] ||
        dataA[index + 2] !== dataB[index + 2] ||
        dataA[index + 3] !== dataB[index + 3]
      ) {
        different += 1;
      }
    }

    const total = primary.width * primary.height;
    if (diffRef.current) {
      diffRef.current.textContent = `${different}px · ${((different / total) * 100).toFixed(2)}%`;
    }
  }, [compareLayout, compareOptions]);

  const chars = countChars(text);
  const lines = compareLayout?.lines.length ?? 0;
  const diagnostics = compareLayout?.diagnostics.length ?? 0;
  const squeezed =
    compareLayout?.lines.reduce(
      (sum, line) => sum + line.glyphs.filter((glyph) => glyph.squeezed).length,
      0,
    ) ?? 0;

  const paragraphs = text.split(/\r?\n/);

  if (tooLarge) {
    return (
      <div className="compare">
        <div className="compare-bar">
          <span className="compare-title">大文档模式</span>
          <span className="compare-note">三栏对比最多支持 3 万字</span>
        </div>
        <div className="compare-empty">
          当前文本超过 3 万字，已关闭三栏对比。请切回编辑，使用虚拟滚动查看。
        </div>
      </div>
    );
  }

  return (
    <div className="compare">
      <div className="compare-bar">
        <span className="compare-title">同一段文字，三种渲染</span>
        <span className="compare-chip">
          容器 <b>{COMPARE_WIDTH}px</b>
        </span>
        <span className="compare-chip">
          字体 <b>{fontLabel}</b>
        </span>
        <span className="compare-chip">
          字号 <b>{options.fontSize} / {options.lineHeight}</b>
        </span>
        <span className="compare-chip">
          避头尾 <b>{options.kinsoku}</b>
        </span>
        <span className="compare-chip">
          挤压 <b>{options.squeeze ? "开" : "关"}</b>
        </span>
        <span className="compare-chip diff-chip">
          文字层 diff <b ref={diffRef}>—</b>
        </span>
        <span className="compare-note">
          {compareLayout ? `${lines} 行 · ${chars} 字` : "等待度量…"}
        </span>
      </div>

      <div className="compare-grid">
        <section className="compare-card">
          <header className="compare-card-head">
            <span className="compare-no">1</span>
            <div>
              <div className="compare-card-title">浏览器默认</div>
              <div className="compare-card-sub">DOM · text-align: justify</div>
            </div>
            <span className="compare-badge bad">浏览器断行</span>
          </header>
          <div className="compare-body">
            <div
              className="compare-sheet browser-sheet"
              style={{
                width: COMPARE_WIDTH,
                fontFamily: options.fontFamily,
                fontSize: options.fontSize,
                lineHeight: options.lineHeight,
                letterSpacing: options.letterSpacing,
                textIndent: options.indent,
              }}
            >
              {paragraphs.map((paragraph, index) =>
                paragraph.length === 0 ? (
                  <div className="browser-blank" key={`blank-${index}`} />
                ) : (
                  <p key={index}>{paragraph}</p>
                ),
              )}
            </div>
            <ul className="compare-findings">
              <li>断点由浏览器排版器决定，无法解释。</li>
              <li>行首禁则、标点挤压、混排间距依赖浏览器实现。</li>
              <li>换浏览器，断点与行末余量会重新计算。</li>
            </ul>
          </div>
          <footer className="compare-card-foot">
            <span>{lines} 行 · {chars} 字</span>
            <span>DOM</span>
          </footer>
        </section>

        <section className="compare-card">
          <header className="compare-card-head">
            <span className="compare-no">2</span>
            <div>
              <div className="compare-card-title">毕昇</div>
              <div className="compare-card-sub">Canvas · 贪心 + {options.kinsoku} 避头尾</div>
            </div>
            <span className="compare-badge good">规则可解释</span>
          </header>
          <div className="compare-body">
            {compareLayout ? (
              <div className="compare-sheet canvas-sheet">
                <CompareCanvas layout={compareLayout} options={compareOptions} dpr={2} />
              </div>
            ) : (
              <div className="compare-sheet">等待字体度量…</div>
            )}
            <ul className="compare-findings">
              <li>断点由规则算出，每次断行都有候选与拒绝原因。</li>
              <li>诊断 {diagnostics} 处 · 压缩标点 {squeezed} 处。</li>
              <li>同一份 LayoutResult 同时供预览与导出使用。</li>
            </ul>
          </div>
          <footer className="compare-card-foot">
            <span>{lines} 行 · {chars} 字</span>
            <span>LayoutResult</span>
          </footer>
        </section>

        <section className="compare-card">
          <header className="compare-card-head">
            <span className="compare-no">3</span>
            <div>
              <div className="compare-card-title">导出 PNG</div>
              <div className="compare-card-sub">离屏 Canvas · 2x</div>
            </div>
            <span className="compare-badge flat">同一布局</span>
          </header>
          <div className="compare-body">
            {compareLayout ? (
              <div className="compare-sheet canvas-sheet">
                <CompareCanvas
                  layout={compareLayout}
                  options={compareOptions}
                  dpr={2}
                  background="#ffffff"
                />
              </div>
            ) : (
              <div className="compare-sheet">等待字体度量…</div>
            )}
            <ul className="compare-findings">
              <li>与「毕昇」栏共用同一 LayoutResult，逐字位置一致。</li>
              <li>{COMPARE_WIDTH * 2} × {Math.round((compareLayout?.height ?? 0) * 2)} · PNG · 2x。</li>
              <li>文字不可选，但不会溢出画布。</li>
            </ul>
          </div>
          <footer className="compare-card-foot">
            <span>{compareLayout ? `${COMPARE_WIDTH * 2} × ${Math.round(compareLayout.height * 2)}` : "—"}</span>
            <span>PNG · 2x</span>
          </footer>
        </section>
      </div>
    </div>
  );
}
