# seeFactory APK 封装说明

## 目标

`frontend/apk` 用于维护 seeFactory Android APK 版本。该版本基于 Taro H5 生产包，通过 Capacitor 封装为 Android WebView 应用。

## 首版策略

- 页面、视觉、工具、作品、广场、AI模板、Workflow 与 H5 主版本保持一致。
- 登录首版复用 H5 登录路线：Google 账户登录、X 登录、开发登录仅在显式开启时可用。
- 支付首版按 H5/Crypto 路线处理，不接入微信、支付宝、抖音、QQ 或 Telegram Stars。
- API 固定指向生产地址：`https://api.seefactory.xyz/api/v1`。
- 不加载 Telegram Mini App SDK，不保留 TMA 启动参数桥接。
- 支持 Android Deep Link：`seefactory://auth/x/callback`，用于 X 外部授权完成后回跳 APK。

## 目录说明

```text
frontend/apk/
  src/                    # Taro 用户端源码
  dist/                   # H5 生产构建产物，构建生成
  android/                # Capacitor Android 原生工程，初始化后生成
  capacitor.config.json   # APK 容器配置
```

## 常用命令

```bash
pnpm install --ignore-workspace
pnpm build:apk:web
pnpm sync:apk
pnpm build:apk
```

命令说明：

- `pnpm build:apk:web`：构建 Android APK 使用的 H5 生产资源。
- `pnpm sync:apk`：构建 H5 资源并同步到 Android 工程。
- `pnpm build:apk`：同步资源后构建 Android debug APK。
- `pnpm build:apk:release`：同步资源后构建 Android release APK，正式签名需要另行配置。
- `pnpm open:apk`：用 Android Studio 打开原生工程。

debug APK 输出路径：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 首次初始化 Android 工程

如果 `android/` 不存在，先执行：

```bash
pnpm exec cap add android
```

之后再执行：

```bash
pnpm sync:apk
pnpm build:apk
```

## 后续需要你确认的发布项

- Android 包名是否继续使用 `xyz.seefactory.app`。
- APK 正式签名证书、别名、密码与 keystore 管理方式。
- 是否上架 Google Play；如上架，支付是否改接 Google Play Billing。
- X 登录回调地址需要在 X 开发者后台和后端环境中登记为 `seefactory://auth/x/callback`。
- Google 登录当前仍使用 H5 Google ID Token 组件；如需改成系统浏览器外部授权回跳 APK，需要新增 Google OAuth redirect 链路和对应 Deep Link 回调。
