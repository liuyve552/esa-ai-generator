# Global Edge AI Personalizer（ESA Pages 大赛）

本仓库为 ESA Pages 大赛提交，源码公开原创。

> 本项目由阿里云 ESA 提供加速、计算和保护：
>
> ![阿里云ESA Pages，构建、加速并保护你的网站](./public/esa-pages-banner.png)

## 评委 1 分钟验收路径

1. 打开首页，输入任意提示词（示例见下），点击「生成」。
2. 用同一个提示词再生成一次：预期看到 **cache hit**，并且端到端延迟明显降低。
3. 点击「Copy share link」，在新标签页连续打开/刷新分享页：预期 **不会出现** `{"error":"Not found"}`。

示例提示词（任选其一）：
- `给我一个本地化的旅行建议，包括天气`
- `用一句小诗写下我所在城市的今晚`
- `给我一个 30 分钟的散步路线建议，结合实时天气`

本项目采用 **Next.js App Router（静态导出）+ ESA 边缘函数（Functions）**：
- 前端用 Next.js 构建现代 UI，并通过 `next.config.js` 的 `output: "export"` 产出静态站点到 `out/`。
- 动态能力（定位 / 天气 / AI / 缓存 / 分享）由 ESA 边缘函数入口 `edge/index.js` 提供，路径为 `/api/*`。

> 说明：ESA 当前对 Next.js 采用“静态站点生成”方式部署，因此不能直接部署 Next 的 Route Handlers（`app/api/*`）。本仓库已将 API 迁移到 ESA 边缘函数入口。

## 亮点（对齐“技术探索”）

- **边缘函数全链路**：`edge/index.js` 在边缘完成 Geo → Weather → AI → Cache，并提供 `/api/generate`、`/api/share`、`/api/view/:id`。
- **边缘缓存（5–10 分钟）**：同一 `{prompt, lang, location}` 自动命中缓存，减少外部 API 调用。
- **多语言支持（i18next）**：自动检测浏览器语言 + 手动选择；AI 输出也随语言变化。
- **全球节点可视化（Leaflet）**：世界地图标注用户位置 + 模拟边缘节点分布。
- **分享链接“永不 404”**：分享链接内嵌快照 payload，KV/缓存丢失时仍可回放结果（更稳更适合评委复测）。
- **浏览次数 Demo（非强一致）**：演示“边缘存储/缓存”思路；生产环境可换成真正 KV 的原子自增。
- **暗黑模式 + 现代动效（Tailwind + Framer Motion）**。
- **PWA（基础）**：Manifest + Service Worker 注册。

## 本地说明

- 本项目的 `/api/*` 由 **ESA 边缘函数**提供，推荐以 ESA 线上环境为准进行演示。
- 你仍可本地启动前端开发：`npm i` → `npm run dev`（UI 可看，但本地 `/api/*` 不会自动生效）。

## 部署到 ESA Pages（简版但够用）

1. 确保 GitHub 仓库是 **Public**（大赛要求提供公开仓库地址）。
2. ESA 控制台创建 Pages 应用 → 选择「从 GitHub 导入」→ 选择分支 `main`。
3. 构建配置使用仓库根目录 `esa.jsonc`（推荐直接沿用）：
   - `installCommand`: `npm install`
   - `buildCommand`: `npm run build`
   - `outputDirectory`: `out`
   - Functions 入口：`edge/index.js`
4. 配置环境变量（可选，不配也能演示 mock）：
   - `DASHSCOPE_API_KEY`：通义千问 DashScope Key（可空）
   - `AI_TEXT_MODEL`：默认 `qwen-max`
5. 部署成功后拿到访问 URL，按「评委 1 分钟验收路径」验证即可。

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
  edge/
    cache.ts
    geo.ts
    weather.ts
    qwen.ts
    share.ts
    types.ts
public/
  icon.svg
  manifest.webmanifest
  sw.js
```

## 调试 / 常见问题

- 构建日志提示 `Assets directory not set`：检查 `esa.jsonc` 是否包含 `assets.directory`，并且构建后确实生成了 `out/`。
- 结果一直是 mock：检查 ESA 环境变量是否设置了 `DASHSCOPE_API_KEY`，并确认已触发重新部署。
- 地图空白：确认网络可访问 OpenStreetMap Tile；或在企业网络下更换 tile 源。
- 位置不准：不同平台提供的地理 Header 不同，本项目优先读 Header，缺失时 fallback 到 `ipwho.is`。
- 查看次数不准确：演示用缓存实现，非原子递增；比赛展示足够，生产建议用真正 KV。

## 合规声明

- 作品为参赛者原创，不抄袭、不作假；如引用第三方服务（如 Open-Meteo / OSM），仅用于合法范围内的接口调用与展示。
- 内容输出由模型或模板生成，已避免违法、暴力、仇恨、误导等不当信息（如需更严格可在边缘函数侧增加过滤）。


