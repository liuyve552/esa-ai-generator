# 全球边缘 AI 实时个性化体验生成器（ESA Pages 大赛）

本仓库为 ESA Pages 大赛提交，源码公开原创。

一个基于 **Next.js App Router + Edge Runtime** 的“全球边缘 AI 实时个性化体验生成器”：自动检测用户位置 → 获取实时天气（Open‑Meteo）→ 调用 AI 生成本地化内容（优先通义千问/Qwen，缺少 Key 自动降级到模板）→ 通过 **边缘缓存（Cache API）** 实现 5–10 分钟去重与分享链接缓存，突出全球低延迟体验。

## 亮点（冲技术探索金奖）

- **全链路边缘化**：`app/api/generate/route.ts` 使用 `runtime = "edge"`，地理定位/天气/AI 都在边缘完成。
- **边缘缓存（5–10 分钟）**：对同一 `{prompt, lang, location}` 请求自动命中缓存，减少外部 API 调用。
- **多语言支持（i18next）**：自动检测浏览器语言 + 手动选择；AI 输出也随语言变化。
- **全球节点可视化（Leaflet）**：世界地图标注用户位置 + 模拟边缘节点分布。
- **分享链接 + 计数 Demo（边缘 KV/缓存模拟）**：生成结果可分享；访问次数使用边缘缓存方式演示（注意：非强一致，仅用于比赛展示）。
- **暗黑模式 + 现代动效（Tailwind + Framer Motion）**：首页极简交互与结果卡片动画。
- **PWA（基础）**：Manifest + Service Worker 注册（用于比赛展示“可安装/离线壳”）。

## 本地运行

1. 安装依赖
   - `npm i`
2. 环境变量
   - 复制 `./.env.example` 为 `./.env.local`，按需填写：
     - `DASHSCOPE_API_KEY`（通义千问 DashScope Key）
     - `AI_TEXT_MODEL`（默认 `qwen-max`）
3. 启动
   - `npm run dev`
4. 访问
   - 打开 `http://localhost:3000`

> 没有 `DASHSCOPE_API_KEY` 也能跑：会自动 fallback 到 mock/template（用于演示边缘定位/天气/缓存/可视化/分享链路）。

## 新手超详细部署到 ESA Pages（从 0 到上线）

以下步骤按“你完全没有部署经验”写，照做即可。由于我无法在本地替你截图，这里用“截图应出现的画面描述”替代。

### A. 准备：注册并登录 GitHub

1. 打开浏览器，访问 GitHub 官网并注册账号。
2. 登录后，看到右上角头像（截图描述：右上角出现你的头像圆形图标）。

### B. 创建公开仓库（必须 Public）

1. 右上角头像 → `Your repositories` → `New`。
2. 填写仓库名，例如：`esa-edge-ai-personalizer`。
3. 选择 **Public**（截图描述：`Public` 单选框被选中；旁边会提示公开仓库）。
4. 勾选/不勾选 README 都可以（本项目自带 `README.md`，建议不勾选，避免冲突）。
5. 点击 `Create repository`。

### C. 上传项目文件到 GitHub

你可以用两种方式：

#### 方式 1：Git 命令行（推荐）

1. 打开终端（Windows 可用 PowerShell）。
2. 进入项目目录（包含 `package.json` 的目录）：
   - `cd D:\\该死的群友web基础竟如此扎实`
3. 初始化并提交：
   - `git init`
   - `git add .`
   - `git commit -m "init: ESA edge AI personalizer"`
4. 绑定远程仓库（替换为你自己的仓库地址）：
   - `git remote add origin https://github.com/<你的用户名>/esa-edge-ai-personalizer.git`
5. 推送：
   - `git branch -M main`
   - `git push -u origin main`
6. 检查 GitHub 页面（截图描述：仓库首页出现一堆文件，例如 `app/`, `components/`, `README.md` 等）。

#### 方式 2：网页上传（无 Git 也能上）

1. 打开你的仓库页面 → 点击 `Add file` → `Upload files`。
2. 把项目文件夹里的所有文件拖进去（截图描述：页面出现文件列表，底部有绿色 `Commit changes`）。
3. 填写提交说明并提交。

### D. 在 ESA Pages 控制台导入 GitHub 仓库并部署

1. 打开 ESA Pages 控制台，创建新项目（截图描述：有“新建项目/导入仓库”的按钮）。
2. 选择 `Import from GitHub`（截图描述：出现 GitHub 授权/选择仓库界面）。
3. 授权后选择你的 **Public** 仓库：`esa-edge-ai-personalizer`。
4. 构建配置：
   - Framework/框架：选择 `Next.js`
   - Build Command：`npm run build`
   - Output Directory：`.next`
   - 也可以直接使用仓库根目录的 `esa.jsonc`（截图描述：控制台显示读取到构建命令与输出目录）。
5. 点击 `Deploy` 开始部署（截图描述：出现构建日志滚动、状态从 Building → Deploying → Success）。

### E. 设置环境变量（AI Key 等）

1. 在 ESA Pages 项目设置中找到 `Environment Variables/环境变量`。
2. 添加以下变量（按需）：
   - `DASHSCOPE_API_KEY`：你的通义千问 DashScope Key
   - `AI_TEXT_MODEL`：建议 `qwen-max`
3. 保存并触发重新部署（截图描述：保存后提示会触发新一轮构建或有“Redeploy”按钮）。

### F. 获取线上 URL 并验证

1. 部署成功后会得到一个访问地址（截图描述：项目页上方/右侧出现 `https://xxx.pages.xxx`）。
2. 打开 URL：
   - 首页输入提示词 → 生成 → 结果页展示位置/天气/延迟信息与地图。
3. 点击“复制分享链接”并在无痕窗口打开：
   - 应该能看到同样的内容（命中边缘缓存），并且查看次数增加。

## 目录结构（核心）

```
app/
  api/
    generate/route.ts
    share/route.ts
    share/[id]/route.ts
    view/[id]/route.ts
  result/page.tsx
  s/[id]/page.tsx
  layout.tsx
  page.tsx
  globals.css
components/
  Providers.tsx
  HomeForm.tsx
  ResultView.tsx
  WorldMap.tsx
  LatencyChart.tsx
  ParticlesBackdrop.tsx
  ThemeToggle.tsx
  PwaRegister.tsx
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

## 为什么技术深度足够（写给评委）

- **边缘函数强依赖**：定位、天气、AI、缓存、分享都在边缘侧完成，天然贴合“全球低延迟”与“就近计算”。
- **缓存策略明确**：5–10 分钟 TTL 对抗重复请求，既省外部 API 成本，又突出“边缘缓存”可观测价值（结果页展示命中/耗时）。
- **多 API 串联**：Geo → Weather → AI，完整链路可复现且可观测（输出包括 location/weather/edgeInfo）。
- **可视化 + 对比实验**：地图展示用户位置与模拟节点；图表展示“中心 vs 边缘”延迟差异，利于现场演示。
- **可扩展**：如果 ESA 提供 KV/对象存储，可把 `lib/edge/share.ts` 替换为真实 KV 实现，快速获得强一致计数与长期缓存。

## 调试 / 常见问题

- 结果一直是 mock：检查是否设置了 `DASHSCOPE_API_KEY`，并在 ESA 控制台确认变量已保存且部署使用的是最新版本。
- 地图空白：确认网络可访问 OpenStreetMap Tile；或在企业网络下更换 tile 源。
- 位置不准：不同平台提供的地理 Header 不同，本项目优先读 Header，缺失时 fallback 到 `ipwho.is`。
- 查看次数不准确：演示用缓存实现，非原子递增；比赛展示足够，生产建议用真正 KV。

