import { useRef } from "react";
import type { Kinsoku, LayoutOptions } from "@typesetting-engine/core";
import { MAX_WIDTH, MIN_WIDTH } from "../constants";
import { FONT_OPTIONS } from "../fonts";
import type { FontOption } from "../fonts";
import type { RuleSettings } from "../rules";
import { NumberField } from "./NumberField";
import { Segmented } from "./Segmented";
import type { SegmentedOption } from "./Segmented";
import { Toggle } from "./Toggle";

type Props = {
  settings: RuleSettings;
  customFont: FontOption | null;
  onChange: (patch: Partial<RuleSettings>) => void;
  onUploadFont: (file: File) => void;
  onReset: () => void;
};

const STRATEGY_OPTIONS: ReadonlyArray<SegmentedOption<"greedy" | "knuth-plass">> = [
  { value: "greedy", label: "贪心" },
  {
    value: "knuth-plass",
    label: "Knuth-Plass",
    title: "总代价 DP：全段候选，末行免罚",
  },
];

const KINSOKU_OPTIONS: ReadonlyArray<SegmentedOption<Kinsoku>> = [
  { value: "off", label: "关" },
  { value: "basic", label: "基本" },
  { value: "strict", label: "严格" },
];

const ALIGN_OPTIONS: ReadonlyArray<SegmentedOption<LayoutOptions["align"]>> = [
  { value: "left", label: "左" },
  { value: "justify", label: "两端" },
  { value: "center", label: "居中" },
];

export function RulesPanel({
  settings,
  customFont,
  onChange,
  onUploadFont,
  onReset,
}: Props) {
  const fontInputRef = useRef<HTMLInputElement>(null);
  const fontOptions = customFont
    ? [...FONT_OPTIONS, customFont]
    : settings.fontId === "uploaded"
      ? [
          ...FONT_OPTIONS,
          {
            id: "uploaded",
            label: "已上传字体（请重新上传）",
            family: "serif",
            probe: "serif",
          },
        ]
      : FONT_OPTIONS;

  return (
    <aside className="panel right">
      <div className="panel-head">
        <h2>规则</h2>
        <button type="button" className="link" onClick={onReset}>
          重置
        </button>
      </div>

      <div className="panel-body">
        <section className="group">
          <div className="glabel">
            <b>断行</b>
          </div>
          <Segmented
            small
            label="断行策略"
            value={settings.strategy}
            options={STRATEGY_OPTIONS}
            onChange={(strategy) => onChange({ strategy })}
          />
        </section>

        <section className="group">
          <div className="glabel">
            <b>避头尾</b>
            <span className="note">{settings.kinsoku === "strict" ? "严格" : ""}</span>
          </div>
          <Segmented
            small
            label="避头尾"
            value={settings.kinsoku}
            options={KINSOKU_OPTIONS}
            onChange={(kinsoku) => onChange({ kinsoku })}
          />
          <div className="hint">
            行首禁止：<span className="mono">，。、；：？！）</span>
          </div>
        </section>

        <section className="group">
          <Toggle
            label="标点挤压"
            description="行首 / 行尾 / 连续标点 × ½ 字宽"
            checked={settings.squeeze}
            onChange={(squeeze) => onChange({ squeeze })}
          />
          <Toggle
            label="中西混排"
            description="中文与拉丁之间 ¼ em"
            checked={settings.autospace}
            onChange={(autospace) => onChange({ autospace })}
          />
        </section>

        <section className="group">
          <div className="glabel">
            <b>对齐</b>
          </div>
          <Segmented
            small
            label="对齐方式"
            value={settings.align}
            options={ALIGN_OPTIONS}
            onChange={(align) => onChange({ align })}
          />
        </section>

        <section className="group">
          <div className="glabel">
            <b>字号与行距</b>
          </div>
          <div className="grid2">
            <NumberField
              label="字号"
              value={settings.fontSize}
              unit="px"
              min={10}
              max={48}
              step={1}
              onChange={(fontSize) => onChange({ fontSize })}
            />
            <NumberField
              label="行高"
              value={settings.lineHeight}
              unit="倍数"
              min={1}
              max={3}
              step={0.1}
              onChange={(lineHeight) => onChange({ lineHeight })}
            />
            <NumberField
              label="字距"
              value={settings.letterSpacing}
              unit="px"
              min={-2}
              max={8}
              step={0.1}
              onChange={(letterSpacing) => onChange({ letterSpacing })}
            />
            <NumberField
              label="首行缩进"
              value={settings.indentChars}
              unit="字"
              min={0}
              max={6}
              step={1}
              onChange={(indentChars) => onChange({ indentChars })}
            />
            <label className="field full">
              <span className="k">字体</span>
              <span className="v">
                <select
                  value={settings.fontId}
                  onChange={(event) => onChange({ fontId: event.target.value })}
                >
                  {fontOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="field full">
              <span className="k">字重</span>
              <span className="v">
                <select
                  value={settings.fontWeight}
                  onChange={(event) => onChange({ fontWeight: Number(event.target.value) })}
                >
                  <option value={400}>400 · Regular</option>
                  <option value={500}>500 · Medium</option>
                  <option value={700}>700 · Bold</option>
                </select>
              </span>
            </label>
            <div className="field full font-upload">
              <span className="k">上传字体</span>
              <button
                type="button"
                className="chip"
                onClick={() => fontInputRef.current?.click()}
              >
                选择 TTF / OTF
              </button>
              <input
                ref={fontInputRef}
                type="file"
                accept=".ttf,.otf,font/ttf,font/otf"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUploadFont(file);
                  event.target.value = "";
                }}
              />
            </div>
          </div>
        </section>

        <section className="group">
          <div className="glabel">
            <b>容器宽度</b>
            <span className="mono value-note">{settings.width}px</span>
          </div>
          <input
            className="slider"
            type="range"
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            step={1}
            value={settings.width}
            aria-label="容器宽度"
            onChange={(event) => onChange({ width: Number(event.target.value) })}
          />
        </section>
      </div>

      <div className="panel-foot">
        <button type="button" className="btn full" disabled title="D5 接入诊断">
          <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M1 7h3m6 0h3M7 1v3m0 6v3"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <circle cx="7" cy="7" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          查看诊断
        </button>
      </div>
    </aside>
  );
}
