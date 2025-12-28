## 项目名称

Video To Text（视频转文字）

## 产品定位

一个 简单、快速、专业、可商用 的视频转文字 Web 工具，面向：

内容创作者

学习 / 教学用户

二次创作 / 剪辑用户

海外视频转译用户

## 设计风格（非常重要） 

- 极简
- 专业工具感
- 偏 ToB / SaaS
- 不娱乐化
- 不花哨

## 关键词 

minimal
clean
professional
SaaS
tool-like

## 颜色 & 视觉基调 

- 主色：中性蓝 / 深灰
- 背景：浅灰 / 白
- 状态色：
  - 进行中：蓝色
  - 成功：绿色
  - 错误：红色

## 页面结构（核心）
### PC 端布局（≥1024px） 

┌────────────────────────────────────┐
│ Header (Logo + Title)               │
├────────────────────────────────────┤
│ 左侧：输入区        │ 右侧：输出区 │
│ - URL 输入           │ - 状态提示   │
│ - 上传按钮           │ - 排队信息   │
│ - 开始按钮           │ - SSE 文本流 │
│                     │ - 时间戳文本 │
├────────────────────────────────────┤
│ Footer（版权/说明）                │
└────────────────────────────────────┘

### 移动端布局（<1024px）

┌────────────────────┐
│ Header             │
├────────────────────┤
│ 输入区             │
│ - URL / 上传       │
│ - 开始按钮         │
├────────────────────┤
│ 状态提示           │
│ SSE 文本流         │
├────────────────────┤
│ 下载 / 复制按钮    │
└────────────────────┘

## 交互重点 

状态提示必须  
- 始终可见
- 明确当前阶段
- 文案友好
  
- 示例文案：
正在排队中，前面还有 2 个任务
正在下载视频
正在转码音频
正在转译（已完成 35%）

### 开始按钮状态

- 默认：禁用
- URL 合法 / 上传完成 → 可点击
- 上传中 → 强制禁用
- 任务进行中 → 禁用

### SSE 文本展示样式

- 类聊天 / 日志流
- 新内容自动滚动
- 时间戳弱化显示
- 文本为视觉主体

### 示例视觉： 

[00:05 → 00:08] 这是什么语言的语言?


### 结果区按钮 

- 初始：禁用
- 完成后：高亮
- 明确主次
按钮优先级：

下载字幕（主）

复制文本（次）

### 多语言选择 

- 下拉选择
- 默认：自动识别
- 不干扰主流程

二、通用「AI 生成 UI」Prompt（设计稿级）

``` js
Design a clean, professional SaaS-style web UI for a "Video to Text" application.

The product converts videos into text subtitles.

Key features:
- Input video via URL or file upload
- Display real-time task progress (queueing, downloading, transcoding, transcribing)
- Stream transcription results with timestamps (SSE-like)
- Allow downloading subtitle files and copying text after completion
- Support multi-language selection

Layout requirements:
- Desktop: two-column layout
  - Left: input controls (URL input, upload button, start button, language selector)
  - Right: status indicator and streaming transcription output
- Mobile: single-column layout
  - Input on top, streaming output below

Design style:
- Minimal
- Clean
- Professional
- SaaS / tool-like
- Neutral colors (blue / gray / white)

UX notes:
- Fixed position status indicator
- Disabled start button during upload or processing
- Streaming transcription shown like chat or log output with timestamps
- Clear visual hierarchy

Avoid:
- Over-decorated UI
- Gamified or playful styles
- Excessive gradients

```
## 三、Next.js + Tailwind「直接生成代码」Prompt


Generate a Next.js page using TypeScript and Tailwind CSS for a "Video to Text" tool.

Requirements:
- Responsive layout
- Desktop: two-column layout
- Mobile: stacked layout
- Components:
  - VideoInput
  - UploadButton
  - LanguageSelector
  - StatusIndicator
  - TranscriptStream
  - ResultActions

Style:
- Clean SaaS UI
- Light background
- Minimal borders
- Clear spacing

Do not include backend logic.
Focus on UI structure and state placeholders.

## Prompt 2：SSE 文本流组件（重点）

Create a React component called TranscriptStream using Tailwind CSS.

Features:
- Display a list of transcription segments
- Each segment includes start time, end time, and text
- Auto-scroll to bottom when new segments arrive
- Monospace timestamp, normal text content
- Looks like a log or chat stream

No backend logic, mock data only.

## Prompt 3：状态提示组件

Create a StatusIndicator component.

Requirements:
- Fixed position
- Displays current task status
- Supports states:
  - queueing
  - downloading
  - transcoding
  - transcribing
  - completed
  - error
- Each state has different color and text
