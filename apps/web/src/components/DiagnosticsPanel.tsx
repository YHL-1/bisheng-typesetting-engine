import type {
  BreakReason,
  Diagnostic,
  LayoutOptions,
  LayoutResult,
} from "@typesetting-engine/core";

type Props = {
  layout: LayoutResult;
  text: string;
  options: LayoutOptions;
  selectedLine: number;
  ignoredTypes: ReadonlySet<Diagnostic["type"]>;
  onSelectLine: (line: number) => void;
  onToggleIgnored: (type: Diagnostic["type"]) => void;
  onClose: () => void;
  onExportJson: () => void;
};

const TYPE_LABEL: Record<string, string> = {
  kinsoku: "禁则避让",
  squeeze: "标点压缩",
  slack: "余量 > 20%",
  orphan: "孤行 / 寡行",
};

const TYPE_ORDER = ["kinsoku", "squeeze", "slack", "orphan"] as const;

function blockedText(
  blockedBy: BreakReason["blockedBy"],
  chosen: number,
  blockedAt: number | undefined,
  chars: string[],
): string {
  switch (blockedBy) {
    case "kinsoku-start": {
      const at = blockedAt ?? chosen;
      return `第 ${at} 字符「${chars[at] ?? ""}」是禁则首字，不能放在行首 → 断点前移到 ${chosen}。`;
    }
    case "kinsoku-end": {
      const at = blockedAt ?? chosen - 1;
      return `第 ${at} 字符「${chars[at] ?? ""}」是禁则尾字，不能留在行尾。`;
    }
    case "word": {
      const at = blockedAt ?? chosen;
      return `第 ${at} 字符落在拉丁单词内部，strict 模式拒绝了这个断点。`;
    }
    case "overflow":
      return `找不到合法断点，只能硬断在第 ${chosen} 字符后。`;
    default:
      return "断点由规则算出；没有触发禁则或单词保护。";
  }
}

export function DiagnosticsPanel({
  layout,
  text,
  options,
  selectedLine,
  ignoredTypes,
  onSelectLine,
  onToggleIgnored,
  onClose,
  onExportJson,
}: Props) {
  const chars = Array.from(text);
  const selected = layout.lines[selectedLine];
  const reason = selected?.breakReason;
  const chosen = reason?.chosen ?? selected?.end ?? 0;
  const candidates = reason?.candidates ?? [];
  const nearbyCandidates = candidates.slice(-6);
  const blockedBy = reason?.blockedBy;
  const blockedAt = reason?.blockedAt;
  const lineBox = options.fontSize * options.lineHeight;

  const span = 7;
  let rangeStart = Math.max(0, chosen - 4);
  const rangeEnd = Math.min(chars.length, rangeStart + span);
  rangeStart = Math.max(0, rangeEnd - span);

  const candidateChars = new Set(candidates.map((candidate) => candidate - 1));
  const blockedIndex =
    blockedAt ??
    (blockedBy === "kinsoku-start"
      ? chosen
      : blockedBy === "kinsoku-end"
        ? chosen - 1
        : -1);

  const diagnostics = layout.diagnostics;
  const visibleDiagnostics = diagnostics.filter(
    (diagnostic) => !ignoredTypes.has(diagnostic.type),
  );
  const diagnosticLines = [
    ...new Set(visibleDiagnostics.map((diagnostic) => diagnostic.line)),
  ].sort((a, b) => a - b);
  const position = diagnosticLines.indexOf(selectedLine);
  const prevLine =
    position > 0 ? diagnosticLines[position - 1] : (diagnosticLines[0] ?? selectedLine);
  const nextLine =
    position >= 0 && position < diagnosticLines.length - 1
      ? diagnosticLines[position + 1]
      : (diagnosticLines[diagnosticLines.length - 1] ?? selectedLine);

  const counts = TYPE_ORDER.map((type) => ({
    type,
    count: diagnostics.filter((diagnostic) => diagnostic.type === type).length,
  }));
  const breakCount = layout.lines.filter((line) => line.breakReason).length;
  const nonEmpty = layout.lines.filter((line) => line.glyphs.length > 0);
  const averageSlack =
    nonEmpty.length === 0
      ? 0
      : (nonEmpty.reduce((sum, line) => sum + line.slack, 0) / nonEmpty.length / options.width) *
        100;
  const squeezedCount = layout.lines.reduce(
    (sum, line) => sum + line.glyphs.filter((glyph) => glyph.squeezed).length,
    0,
  );

  const parts = reason?.costParts;
  const costWidths = parts
    ? (() => {
        const total = Math.max(
          0.0001,
          parts.slack + parts.squeeze + parts.kinsoku + parts.overflow,
        );
        return [
          (parts.slack / total) * 100,
          (parts.squeeze / total) * 100,
          ((parts.kinsoku + parts.overflow) / total) * 100,
        ];
      })()
    : null;

  const selectedType =
    diagnostics.find(
      (diagnostic) =>
        diagnostic.line === selectedLine && !ignoredTypes.has(diagnostic.type),
    )?.type ??
    diagnostics.find((diagnostic) => diagnostic.line === selectedLine)?.type;
  const selectedTypeIgnored = selectedType !== undefined && ignoredTypes.has(selectedType);

  return (
    <aside className="panel right diagnostics-panel">
      <div className="panel-head">
        <h2>诊断</h2>
        <span className="meta">
          {ignoredTypes.size > 0
            ? `${visibleDiagnostics.length} / ${diagnostics.length} 处`
            : `${diagnostics.length} 处`}
        </span>
      </div>

      <div className="panel-body">
        <div className="diag-card">
          <div className="diag-card-head">
            <b>为什么断在这</b>
            <span className="mono">
              {selectedLine + 1} / {layout.lines.length}
            </span>
          </div>
          <div className="diag-card-body">
            <div className="kv">
              <span className="k">断点</span>
              <span className="v">
                第 <span className="mono">{chosen}</span> 字符后
              </span>
            </div>
            <div className="kv">
              <span className="k">候选</span>
              <span className="v mono">
                {nearbyCandidates.length > 0
                  ? `${candidates.length > nearbyCandidates.length ? "… · " : ""}${nearbyCandidates.join(" · ")}`
                  : "—"}
              </span>
            </div>
            <div className="cost-row">
              <span className="k">代价</span>
              <span className="cost-value">{reason?.cost.toFixed(2) ?? "—"}</span>
              <span className="unit">归一化</span>
            </div>
            {costWidths ? (
              <>
                <div className="cost-stack" aria-hidden="true">
                  <i className="cost-slack" style={{ width: `${costWidths[0]}%` }} />
                  <i className="cost-squeeze" style={{ width: `${costWidths[1]}%` }} />
                  <i className="cost-kinsoku" style={{ width: `${costWidths[2]}%` }} />
                </div>
                <div className="cost-legend">
                  <span>余量 {parts!.slack.toFixed(2)}</span>
                  <span>挤压 {parts!.squeeze.toFixed(2)}</span>
                  <span>禁则 {parts!.kinsoku.toFixed(2)}</span>
                  {parts!.overflow > 0 ? <span>硬断 {parts!.overflow.toFixed(2)}</span> : null}
                </div>
              </>
            ) : null}
            <div className="blocked">{blockedText(blockedBy, chosen, blockedAt, chars)}</div>

            <div className="pager">
              <button
                type="button"
                className="pager-btn"
                onClick={() => onSelectLine(prevLine)}
                aria-label="上一处诊断"
              >
                ‹
              </button>
              <span className="pager-count">
                第 {selectedLine + 1} 行 · {diagnosticLines.length} 处
              </span>
              <button
                type="button"
                className="pager-btn"
                onClick={() => onSelectLine(nextLine)}
                aria-label="下一处诊断"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        <section className="group">
          <div className="glabel">
            <b>候选断点</b>
            <span>
              第 {rangeStart}–{rangeEnd} 字符
            </span>
          </div>
          <div className="cands">
            {chars.slice(rangeStart, rangeEnd).map((ch, offset) => {
              const index = rangeStart + offset;
              const className = [
                "cd",
                index === chosen - 1 ? "on" : "",
                index === blockedIndex ? "no" : "",
                candidateChars.has(index) && index !== chosen - 1 ? "cand" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div className={className} key={`${index}-${ch}`}>
                  <span className="n">{index}</span>
                  <span className="ch">{ch}</span>
                </div>
              );
            })}
          </div>
          <div className="hint">
            {chosen} 被选中；{blockedIndex >= 0 ? `${blockedIndex} 被规则排除。` : "没有禁则冲突。"}
          </div>
        </section>

        {diagnostics.length === 0 ? (
          <div className="diag-empty">没有发现可报告的异常。</div>
        ) : (
          <section className="group">
            <div className="glabel">
              <b>全部标记</b>
              <span>按行号</span>
            </div>
            <div className="diag-list">
              {counts.map(({ type, count }) => {
                const lines = diagnostics
                  .filter((diagnostic) => diagnostic.type === type)
                  .map((diagnostic) => diagnostic.line + 1);
                return (
                  <div className={`diag-li${ignoredTypes.has(type) ? " is-ignored" : ""}`} key={type}>
                    <span className={`diag-dot ${type}`} />
                    {TYPE_LABEL[type]}
                    <span className="n">
                      {count} 处{lines.length > 0 ? ` · ${lines.slice(0, 4).join(" · ")}` : ""}
                    </span>
                    <button
                      type="button"
                      className="diag-toggle"
                      onClick={() => onToggleIgnored(type)}
                    >
                      {ignoredTypes.has(type) ? "恢复" : "忽略"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="group" style={{ borderBottom: 0 }}>
          <div className="glabel">
            <b>本次统计</b>
          </div>
          <div className="diag-stats">
            <div className="diag-stat">
              <span>行数 / 断点</span>
              <span className="mono">
                {layout.lines.length} / {breakCount}
              </span>
            </div>
            <div className="diag-stat">
              <span>平均行末余量</span>
              <span className="mono">{averageSlack.toFixed(1)}%</span>
            </div>
            <div className="diag-stat">
              <span>压缩掉的标点</span>
              <span className="mono">{squeezedCount} 处</span>
            </div>
            <div className="diag-stat">
              <span>行高</span>
              <span className="mono">{lineBox.toFixed(1)}px</span>
            </div>
          </div>
        </section>
      </div>

      <div className="panel-foot diag-foot">
        <button
          type="button"
          className="chip"
          disabled={selectedType === undefined}
          onClick={() => selectedType && onToggleIgnored(selectedType)}
        >
          {selectedTypeIgnored ? "恢复此类" : "忽略此类"}
        </button>
        <button type="button" className="chip" onClick={onExportJson}>
          导出 JSON
        </button>
        <button type="button" className="chip" onClick={onClose}>
          返回规则
        </button>
      </div>
    </aside>
  );
}
