# 毕昇 · 中文排版引擎

把一段中文文字，按规则排进任意宽度的容器：断行、避头尾、标点挤压、中西混排、对齐、诊断，最后导出 PNG / JSON / PDF。

这是 15 天计划中 **D1–D6** 的完整实现。烛龙（一句话生成大屏）是另一个项目，不在本仓库。

## 能做什么

- **断行**：贪心 + Knuth-Plass 总代价 DP；关/基本/严格避头尾；行首不出现 `，。、；：？！）》」』】`
- **挤压**：行首开括号、行尾闭句读、连续标点 × ½ 字宽（`。」` ≈ 1em）
- **混排**：CJK ↔ 拉丁/数字边界 + ¼ em，标点两侧不加；justify 不拉伸拉丁单词内部
- **对齐**：左 / 两端 / 居中；末行不 justify；间隙 > 0.5em 自动降级左对齐
- **诊断**：四类标记、代价拆分（余量/挤压/禁则）、忽略类型、点击任意行查看候选与拒绝原因
- **渲染**：Canvas 预览、A4 分页预览、缩放/适合、字宽调试线、行号开关
- **大文档**：> 3 万字进 Web Worker；逐段进度、Esc/按钮取消；虚拟滚动只绘制视口行，支持行级诊断/点击行/行号
- **本地状态**：自动保存文本与规则；Ctrl+Z / Ctrl+Shift+Z 撤销重做
- **导出**：PNG 1x/2x/3x（超长按行分片）/ 排版 JSON / PDF（A4 图片版）/ PDF（文字版，需上传 TTF/OTF）
- **字体**：4 个系统字体栈 + 上传 TTF/OTF + 400/500/700 字重
- **对比**：浏览器默认 / 毕昇 / 导出 PNG 三栏；文字层逐像素 diff（2x）
- **测试**：151 条单测，覆盖禁则、挤压、混排、对齐、KP、诊断、分页、缓存与 10 万字

## 架构

```text
packages/core             纯 TS，不碰 DOM，可在 Worker / Node 跑
  types.ts                 Metrics / LayoutOptions / Glyph / Line / LayoutResult
  metrics.ts               FixedMetrics（测试用）
  typography.ts             行盒 / 半行距 / 基线 / 字距
  rules.ts                 禁则表 / isPunct / isCJK / isLatin / glyphWidth
  break.ts                 贪心 + Knuth-Plass 总代价 DP + BreakReason + 硬断保护
  justify.ts               左 / 两端 / 居中
  diagnostics.ts           四类诊断
  layout.ts                段落切分 + 段落缓存 + 对齐编排
  pagination.ts            分页 + 孤行控制
  text.ts                  字数 / 段数

packages/render-canvas     Canvas 渲染层
  metrics.ts               measureText 缓存 / 空格兜底 / 度量自检
  font.ts                  font shorthand / document.fonts
  dpr.ts                   dpr / backing store
  draw.ts                  多行绘制 / 字宽调试 / 视口绘制 / PNG 背景

apps/web                   React 工作台
  components/              Stage / Diagnostics / Compare / VirtualPreview / Export…
  hooks/                   useCanvasMetrics / useLayout（主线程 + Worker）
  workers/                 layout.worker.ts + protocol.ts
  lib/                     export.ts（PNG/JSON）/ pdf.ts（pdf-lib）
```

## 快速开始

```bash
pnpm install
pnpm test:run          # 151 tests
pnpm -r build          # core / render-canvas / web
pnpm --filter web dev  # http://127.0.0.1:5173
```

CI：`.github/workflows/ci.yml`（install → 151 tests → lint → build）。
演示：见 [DEMO.md](DEMO.md) 的 2 分钟脚本与演示前检查。

## 部署

仓库根目录的 `vercel.json` 已配置静态部署：

```bash
# 在仓库根目录
pnpm dlx vercel        # 首次登录/关联项目
pnpm dlx vercel --prod
```

- 构建命令：`pnpm --filter web build`
- 输出目录：`apps/web/dist`
- 无环境变量、无后端、无 API Key

Vercel 控制台导入仓库时保持 Root Directory 为仓库根目录即可；也可以把 `apps/web/dist` 放到任意静态托管/OSS。当前仓库**尚未实际部署**（需要你的 Vercel/Netlify 账号）。

工作台操作：

- 左侧编辑 / 示例 / 粘贴 / 清空 / **10 万字**压测；**撤销/重做**
- 中间拖右边缘或滑块改宽度；**行号** / **字宽** / **分页** / **缩放** 开关
- 右侧规则实时生效；**诊断**进入逐行断点解释、代价拆分、忽略类型
- 右侧可上传 TTF/OTF、切换 400/500/700 字重；文字版 PDF 需先上传字体
- 顶栏 **对比** 切换三栏（含 2x 文字层 diff）；**导出** PNG 1x/2x/3x、PDF 图片版/文字版、JSON
- 文本和规则自动保存到 localStorage；刷新不丢

## 验收数据

| 项目 | 实测 |
|---|---|
| 3,014 字、592px、热态重排 | **0.6–0.9 ms**（目标 < 50 ms） |
| 首次排版（含度量缓存冷启动） | ~105 ms |
| 100,000 字 Worker 排版 | 全 `中` 约 **50 ms**；复杂多段样例约 **440 ms**（目标 < 2 s） |
| 100,000 字虚拟滚动 | 2,703 / 3,252 行 / 总高 82,171 px / 视口 520 px |
| A4 分页预览 | 3,014 字 → **4 页**，页眉/页脚/页码 |
| PDF | 3,014 字 → **4 页 A4**，36pt 页边距，内容不溢出 |
| PNG | 3,014 字 → 592×3,010 @1x，或 1,184×6,020 @2x |
| 三栏 diff | 文字层 **0 px / 0.00%** |
| 单测 | **151/151** |

`docs/progress/` 里有工作台、A4 分页、KP、诊断、虚拟行号、对比、大文档、字体上传与 PDF 首页截图；`docs/progress/downloads*/` 保留了图片版/文字版 PDF、PNG 样例。

## 已知限制

- **文字版 PDF 的 ToUnicode 仍不完整**：已用上传 TTF/OTF 嵌入并绘制文字，视觉可显示；但 pdf-lib/jsPDF 对测试用的思源宋体、黑体生成的 ToUnicode 映射仍会让 pypdf/PyMuPDF 抽取出乱码，复制/搜索不保证正确。图片版 PDF 不受影响。
- **上传字体不持久化**：字体二进制只在当前会话内存中；刷新后需重新上传（文本/规则仍自动保存）。
- **挤压不改变行数**：按手册“先断后挤、不回头改断点”，开关挤压只改行宽/余量/标点占宽；15 天清单里“行数不同”与这条纪律冲突，本实现选择稳定。
- **对比固定 384px**：三栏按同一 384px 容器重排；超过 3 万字仍自动关闭对比（大文档保留诊断/行号/虚拟滚动）。
- **10 万字进度/取消**：Worker 已逐段回传百分比并支持取消；10 万字 textarea 的受控更新会占用主线程，进度条可能只在后段可见，Esc 取消仍可用。
- **OpenType 特性未接入**：字重和字体上传已有，但 kerning/liga/任意 feature 开关没有 UI。
- **未做英文断字与悬挂标点**：长英文词超宽时硬断；行首标点没有悬挂/溢出处理。
- **未做移动端/深色/无障碍审计**：工作台按 1080px 以上设计。
- **未做竖排/多栏/注音/网格**：超出 D1–D6 范围。
- **无后端 / 发布链接 / 账号**：纯前端工作台；D7–D15 的烛龙不在本仓库。静态部署配置已加，但尚未实际部署（需要账号）。
- **D4–D6 变更尚未提交**：仓库已有 D1–D3 的提交，本次改动仍在工作区。

## 设计参考

`ui/` 目录下是工作台、诊断、对比、导出、大文档和海报的静态视觉稿与截图；`Plan/` 是三份计划文档。实现以 `Plan/毕昇-实现手册.md` 的纪律为准。
