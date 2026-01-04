# 全球边缘 AI 实时个性化体验生成器（ESA Pages 大赛）

本仓库为 ESA Pages 大赛提交，源码公开原创。

本项目采用 **Next.js App Router（静态导出）+ ESA 边缘函数（Functions）**：
- 前端用 Next.js 构建现代 UI，并通过 `next.config.js` 的 `output: "export"` 产出静态站点到 `out/`。
- 动态能力（定位 / 天气 / AI / 缓存 / 分享）由 ESA 边缘函数入口 `edge/index.js` 提供，路径为 `/api/*`。

> 说明：ESA 当前对 Next.js 采用“静态站点生成”方式部署，因此不能直接部署 Next 的 Route Handlers（`app/api/*`）。本仓库已将 API 迁移到 ESA 边缘函数入口。

## 亮点（冲技术探索金奖）

- **边缘函数全链路**：`edge/index.js` 在边缘完成 Geo → Weather → AI → Cache，并提供 `/api/generate`、`/api/share/*`、`/api/view/*`。
- **边缘缓存（5–10 分钟）**：同一 `{prompt, lang, location}` 自动命中缓存，减少外部 API 调用。
- **多语言支持（i18next）**：自动检测浏览器语言 + 手动选择；AI 输出也随语言变化。
- **全球节点可视化（Leaflet）**：世界地图标注用户位置 + 模拟边缘节点分布。
- **分享链接 + 计数 Demo（边缘缓存模拟）**：生成结果可分享，访问次数演示（非强一致，比赛展示足够）。
- **暗黑模式 + 现代动效（Tailwind + Framer Motion）**。
- **PWA（基础）**：Manifest + Service Worker 注册。

## 本地说明

- 本项目的 `/api/*` 由 **ESA 边缘函数**提供，推荐以 ESA 线上环境为准进行演示。
- 你仍可本地启动前端开发：`npm i` → `npm run dev`（UI 可看，但本地 `/api/*` 不会自动生效）。

## 新手超详细部署到 ESA（从 0 到上线）

以下步骤按“你完全没有部署经验”写，照做即可。由于我无法在本地替你截图，这里用“截图应出现的画面描述”替代。

### A. 准备：注册并登录 GitHub

1. 打开浏览器，访问 GitHub 官网并注册账号。
2. 登录后，看到右上角头像（截图描述：右上角出现你的头像圆形图标）。

### B. 创建公开仓库（必须 Public）

1. 右上角头像 → `Your repositories` → `New`。
2. 填写仓库名，例如：`esa-ai-generator`。
3. 选择 **Public**。
4. 点击 `Create repository`。

### C. 上传项目文件到 GitHub

打开终端（Windows 可用 PowerShell），进入项目目录（包含 `package.json` 的目录）：

- `cd D:\该死的群友web基础竟如此扎实`
- `git init`
- `git add .`
- `git commit -m "init"`
- `git branch -M main`
- `git remote add origin https://github.com/<你的用户名>/esa-ai-generator.git`
- `git push -u origin main`

### D. 在 ESA 控制台导入 GitHub 仓库并部署

1. 打开 ESA 控制台 → 左侧 **函数和 Pages**。
2. 选择创建应用并导入 GitHub 仓库（截图描述：出现 GitHub 授权/选择仓库界面）。
3. 选择你的 **Public** 仓库：`esa-ai-generator`，分支 `main`。
4. 构建配置建议直接使用仓库根目录的 `esa.jsonc`（ESA 会优先使用它）：
   - 静态资源目录：`./out`
   - 函数入口：`./edge/index.js`
   - 构建命令：`npm run build`
5. 点击部署，等待构建完成。

### E. 设置环境变量（AI Key 等）

在 ESA 项目设置中找到环境变量，按需添加：

- `DASHSCOPE_API_KEY`：通义千问 DashScope Key（可空，空则自动 mock）
- `AI_TEXT_MODEL`：默认 `qwen-max`

保存后触发重新部署。

### F. 获取线上 URL 并验证

1. 部署成功后会得到一个访问地址。
2. 打开 URL：
   - 首页输入提示词 → 生成 → 结果页展示位置/天气/延迟信息与地图。
3. 点击“Copy share link”并打开分享链接：
   - 分享链接形如：`/s?id=<ID>`

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
