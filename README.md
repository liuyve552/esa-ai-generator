# 全球边缘神谕（Alibaba Cloud ESA Pages 边缘开发大赛）

一句话简介：把「定位 → 天气 → AI/模板 → 缓存 → 分享」全部搬到 ESA 边缘节点，做成一个**打开即生成、可打卡、可传播（海报/朗读/分享链接）**的“全球边缘神谕”应用。

> 本项目由阿里云 ESA 提供加速、计算和保护：
>
> ![阿里云ESA Pages，构建、加速并保护你的网站](./public/esa-pages-banner.png)

---

## 评委 1 分钟验收路径（零输入）

1) 打开首页：立刻看到「零输入演示（自动生成）」卡片（无需输入、无需权限）。

2) 点击「打开完整结果」：预期看到
- 边缘节点信息（provider/node）
- 缓存状态（hit/miss）、TTL、延迟对比图（边缘 vs 中心模拟基线）
- “今日小任务（可打卡）”清单 + 进度
- 可传播动作：复制分享链接 / 系统分享 / 下载海报 / 朗读 / 收藏

3) 返回首页，切换模式（今日神谕/旅行助手/专注清单/情绪安抚/社交卡片），**不输入任何提示**直接点「生成」：输出明显不同。

4) 用**同一模式 + 同一提示词**再生成一次：预期 **cache hit**，端到端延迟明显降低。

5) 点击「复制分享链接」，在新标签页多次打开/刷新：预期**不会出现** `{"error":"Not found"}`（分享快照 + 404 回放兜底）。

---

## 核心架构（边缘化到极致）

```text
浏览器(静态页面)
   │
   ├─(GET) /api/generate?mode=...&lang=...&prompt=...
   │        │
   │        ├─ 边缘读 Geo（优先 Header，缺失时 IP 接口兜底）
   │        ├─ 边缘拉 Weather（Open‑Meteo）
   │        ├─ 边缘生成内容（通义千问 / 无 Key 模板降级）
   │        ├─ caches.default + 内存 Map 做边缘缓存（5–10 分钟）
   │        └─ 生成可分享链接：/s/?id=...&d=...（d 为快照，可回放）
   │
   ├─(GET) /api/share?id=...   → KV/缓存取分享结果
   ├─(GET) /api/replay?d=...   → 无 KV 也能回放（永不 404）
   └─(POST) /api/view/:id      → 访问次数 Demo（有 KV 更稳定）
```

---

## 为什么这次能拿高分（对齐评审维度）

### 创意卓越（“哇”点）
- **零输入神谕**：打开就自动生成，不再让评委面对空白页面。
- **边缘纹章（Sigil）**：由 mode + 日期 + 城市 + 天气种子生成的可视化符号（每个地点/模式都不一样）。
- **每日小任务（打卡）**：把生成内容从“一次性输出”变成“可持续的互动/留存”。
- **海报导出 + 朗读**：一键生成可传播图片，配合系统分享与 TTS，天然适合社交平台扩散。

### 实用价值（能留住人）
- 五种模式直连真实场景：**旅行建议 / 专注清单 / 情绪安抚 / 社交卡片 / 今日神谕**。
- **无 Key 也好用**：没有通义 Key 也能稳定输出模板内容，保证演示不翻车。
- **收藏与历史**：结果页可收藏，支持用户形成自己的“城市神谕收藏夹”。

### 技术探索（在 81 的基础上再抬一档）
- **边缘缓存可观测**：同一 mode+prompt+lang+location 命中缓存，明显降低端到端延迟。
- **分享链接“永不 404”**：`d` 参数携带快照，可在 KV/缓存丢失时回放（评委复测友好）。
- **边缘韧性**：对外部 API 增加超时与多源兜底（位置 IP API 多源兜底、天气字段缺失兜底）。
- **隐私友好**：结果不暴露用户 IP（只用于边缘侧定位兜底）。

---

## 部署到 ESA Pages（简版但够用）

1. 确保 GitHub 仓库是 **Public**（大赛要求提供公开仓库地址）。
2. ESA 控制台创建 Pages 应用 → 选择「从 GitHub 导入」→ 选择分支 `main`。
3. 构建配置使用仓库根目录 `esa.jsonc`（推荐直接沿用）：
   - `installCommand`: `npm install`
   - `buildCommand`: `npm run build`
   - `assets.directory`: `./out`
   - Functions 入口：`./edge/index.js`
4. 环境变量（可选，不配也能演示模板）：
   - `DASHSCOPE_API_KEY`：通义千问 DashScope Key（可空）
   - `AI_TEXT_MODEL`：默认 `qwen-max`
5. 部署成功后，按「评委 1 分钟验收路径」验证即可。

---

## 目录结构（核心）

```
app/
  result/page.tsx
  s/page.tsx
  layout.tsx
  page.tsx
  globals.css
components/
  Providers.tsx
  HomeForm.tsx
  HomeAutoDemo.tsx
  ResultView.tsx
  ResultPageClient.tsx
  SharePageClient.tsx
  WorldMap.tsx
  LatencyChart.tsx
  ParticlesBackdrop.tsx
  ThemeToggle.tsx
  PwaRegister.tsx
edge/
  index.js
lib/
  i18n/
  edge/
public/
  icon.svg
  manifest.webmanifest
  sw.js
```

---

## 调试 / 常见问题

- 构建日志提示 `Assets directory not set`：检查 `esa.jsonc` 是否包含 `assets.directory`，并且构建后确实生成了 `out/`。
- 结果一直是模板：检查 ESA 环境变量是否设置了 `DASHSCOPE_API_KEY`，并确认已触发重新部署。
- 地图空白：确认网络可访问 OpenStreetMap Tile；或在企业网络下更换 tile 源。
- 位置不准：不同平台提供的地理 Header 不同；本项目优先读 Header，缺失时再用 IP 接口兜底。
- 访问次数不稳定：演示用缓存实现，非强一致；启用 KV 后更稳定。

---

## 合规声明

- 作品为参赛者原创，不抄袭、不作假、不侵权。
- 引用第三方服务（如 Open‑Meteo / OpenStreetMap / IP 地理接口）仅用于合法范围内的接口调用与展示。
- 内容输出由模型或模板生成，已避免违法、暴力、仇恨、误导等不当信息；如需更严格可在边缘函数侧增加过滤。

