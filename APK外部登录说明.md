# APK 外部登录说明

## 登录策略

- Android APK 登录页使用外部浏览器授权，不依赖 WebView 内部跳转完成 OAuth。
- Google、Telegram、X 都通过 Deep Link 回到 APK。
- 微信、支付宝、抖音、QQ 后续应走各自 Android Native SDK，不通过普通 H5 OAuth 链路硬接。

## 回跳地址

| 平台 | APK Deep Link |
| --- | --- |
| Google | `seefactory://auth/google/callback` |
| Telegram | `seefactory://auth/telegram/callback` |
| X | `seefactory://auth/x/callback` |

## Google

- 前端生成 PKCE `codeVerifier` 和 `codeChallenge`。
- 前端请求 `/auth/h5/google/authorize-url` 获取 Google 授权 URL。
- APK 使用 Capacitor Browser 打开外部浏览器。
- Google 回跳 `seefactory://auth/google/callback`。
- APK 使用 `/auth/h5/google-login` 提交 `code`、`state`、`codeVerifier`、`redirectUri` 完成登录。

## Telegram

- APK 打开 `/auth/h5/telegram-bridge`。
- 桥接页加载 Telegram Login Widget。
- Telegram 授权后访问 `/auth/h5/telegram-callback`。
- 后端回跳 `seefactory://auth/telegram/callback`，并携带 Telegram Login Widget 签名参数。
- APK 使用 `/auth/h5/telegram-login` 提交 `telegramAuth` 完成后端签名校验和登录。

## X

- 前端生成 PKCE `codeVerifier` 和 `codeChallenge`。
- 前端请求 `/auth/h5/x/authorize-url` 获取 X 授权 URL。
- APK 使用 Capacitor Browser 打开外部浏览器。
- X 回跳 `seefactory://auth/x/callback`。
- APK 使用 `/auth/h5/x-login` 提交 `code`、`state`、`codeVerifier`、`redirectUri` 完成登录。

## 后端配置

```env
PUBLIC_API_BASE_URL=https://api.seefactory.xyz/api/v1
TELEGRAM_BOT_USERNAME=seefactory_bot
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
X_CLIENT_ID=<x-client-id>
X_CLIENT_SECRET=<x-client-secret>
```
