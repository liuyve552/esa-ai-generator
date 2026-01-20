# ESA 控制台 Headers 配置

由于 Next.js `output: export` 模式限制，HTTP Headers 需要在 ESA 控制台手动配置。

## 缓存策略配置

### 1. HTML 文件（路径匹配：`*.html` 或 `/`）
```
Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400
```
- 浏览器缓存：5 分钟
- CDN 缓存：1 小时
- 过期后可返回旧版本并后台更新

### 2. Next.js 静态资源（路径匹配：`/_next/static/*`）
```
Cache-Control: public, max-age=31536000, immutable
```
- 永久缓存（1 年）
- 文件名包含哈希，内容变化时文件名也变

### 3. 静态资源（路径匹配：`/static/*`, `/images/*`, `/fonts/*`）
```
Cache-Control: public, max-age=2592000, s-maxage=31536000
```
- 浏览器缓存：30 天
- CDN 缓存：1 年

### 4. 根路径（路径匹配：`/`）
```
Cache-Control: public, max-age=180, s-maxage=1800, stale-while-revalidate=3600
```
- 浏览器缓存：3 分钟
- CDN 缓存：30 分钟

## 安全响应头配置

### 对所有路径（`/*`）添加以下响应头：

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(self)
```

### Content Security Policy（CSP）
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https: blob:; font-src 'self' data: https://unpkg.com; connect-src 'self' https://webrd01.is.autonavi.com https://webrd02.is.autonavi.com https://webrd03.is.autonavi.com https://webrd04.is.autonavi.com https://dashscope.aliyuncs.com; frame-src 'none';
```

## 配置步骤（ESA 控制台）

1. 登录阿里云 ESA 控制台
2. 进入 `esa-ai-generator` 项目
3. 导航到 **配置管理** → **HTTP Headers**
4. 点击 **添加自定义响应头**
5. 按照上述规则逐条添加：
   - **匹配条件**：路径模式（如 `*.html`）
   - **响应头名称**：如 `Cache-Control`
   - **响应头值**：如 `public, max-age=300, s-maxage=3600`
6. 保存并发布配置

## 预期效果

### 缓存优化
- CDN 命中率：从 ~10% 提升到 ~80%+
- 首页 TTFB：降低 50-70%
- 回源请求：减少 60-80%

### 安全增强
- 防止点击劫持（X-Frame-Options）
- 防止 MIME 嗅探（X-Content-Type-Options）
- 防止 XSS 攻击（X-XSS-Protection, CSP）
- 限制浏览器权限（Permissions-Policy）

## 验证方法

配置完成后，使用以下命令验证：

```bash
# 检查缓存头
curl -I https://esa-ai-generator.7d7df28e.er.aliyun-esa.net/

# 检查安全头
curl -I https://esa-ai-generator.7d7df28e.er.aliyun-esa.net/ | grep -E "X-|Content-Security"
```

预期输出应包含上述配置的响应头。
