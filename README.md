# seeFactory Mini App

seeFactory 用户端是基于 Taro + React 构建的深色 AI 创作小程序/H5 前端。当前版本已从早期本地 mock 原型升级为后端接口驱动：工具、案例、作品、广场、用户、客服、生成任务、平台钱包和支付流程均通过 `src/services/api.js` 接入 `backend/` 提供的 `/api/v1` 接口。

视觉基准为 iPhone 14 逻辑视口 `390 x 844`。首页使用固定视口的动态视频背景，页面内容采用深色玻璃质感、透明渐变主卡片、统一 logo、统一图标系统、底部 tab 与小程序默认顶部导航栏。

## 项目状态

- 产品形态：Taro 多端用户端，优先小程序移动端体验，同时保留 H5 预览。
- 数据来源：真实后端接口，不再保留 `src/data/mock.js` 作为业务数据源。
- 运行配置：`/app/config.feature` 控制生成、广场、充值、代理四类能力；用户端会同步隐藏或禁用入口，并阻止对应提交动作。
- 默认接口：`http://127.0.0.1:10087/api/v1`，可通过 `SEEFACTORY_API_BASE` 覆盖。
- 设计基准：iPhone 14 逻辑视口 `390 x 844`，H5 内容最大宽度按移动端处理。
- 品牌资源：`src/assets/logo.png` 来自 `docs/logo.png`，通过 `BrandLogo` 统一使用。
- 状态体系：页面级 loading、骨架屏、toast、modal、confirm、empty、error 与支付/生成轮询状态。

## 技术栈

- Taro `4.2.0`
- React `18`
- Webpack 5
- 微信小程序构建目标 `weapp`
- 支付宝小程序构建目标 `alipay`
- 抖音小程序构建目标 `tt`
- QQ 小程序构建目标 `qq`
- Telegram Mini App 使用 H5 构建目标 `h5`
- H5 预览目标 `h5`

## 快速开始

```bash
pnpm install
```

启动 H5 开发预览：

```bash
pnpm dev:h5
```

默认 H5 地址：

```text
http://127.0.0.1:10086/#/pages/index/index
```

构建 H5：

```bash
pnpm build:h5
```

构建微信小程序：

```bash
pnpm build:weapp
```

构建其他平台：

```bash
pnpm build:alipay
pnpm build:tt
pnpm build:qq
pnpm build:tma
```

顺序构建并验收全部用户端目标：

```bash
pnpm verify
```

Taro 多平台构建默认共用 `dist/` 输出目录，请不要并发执行多个 `build:*` 命令；并发构建可能互相清理产物并造成假失败。正式小程序 `build:*` 脚本会先清理 `dist/`，H5 会通过 `prepare:h5-dist` 预建必要 CSS 路径，避免平台切换时复用旧产物目录。

构建产物输出到 `dist/`，该目录不纳入 git 版本管理。

## 环境配置

用户端 API 地址通过 Taro 编译期常量注入：

```bash
SEEFACTORY_API_BASE=https://api.example.com/api/v1 pnpm build:h5
```

Windows PowerShell 示例：

```powershell
$env:SEEFACTORY_API_BASE="https://api.example.com/api/v1"; pnpm build:h5
```

未设置时默认使用本地后端地址 `http://127.0.0.1:10087/api/v1`。本地可复制 `.env.example` 作为部署配置参考，但当前构建以进程环境变量为准。

登录相关编译变量：

```bash
SEEFACTORY_GOOGLE_CLIENT_ID=your-google-client-id
SEEFACTORY_X_REDIRECT_URI=https://h5.example.com/#/pages/login/index
SEEFACTORY_DEV_LOGIN_ENABLED=false
```

`SEEFACTORY_DEV_LOGIN_ENABLED` 默认关闭。只有后端同时开启 `ALLOW_DEV_LOGIN=true` 时，开发账号入口才可完成登录。

## 目录结构

```text
app/
|-- config/
|   `-- index.js              # Taro 构建配置、H5 端口、资源复制配置
|-- .env.example              # 用户端构建环境变量示例
|-- scripts/
|   `-- preview-static.mjs    # H5 静态产物预览脚本
|-- src/
|   |-- assets/
|   |   `-- logo.png          # seeFactory 应用内品牌 logo
|   |-- components/
|   |   |-- AppIcon.jsx       # CSS 形状图标系统
|   |   |-- BrandLogo.jsx     # 全局品牌 logo 组件
|   |   |-- CustomerModal.jsx # 客服弹窗
|   |   |-- PaymentSheet.jsx  # 多端支付弹窗与轮询状态
|   |   `-- Shell.jsx         # 页面壳、背景视频、底部 tab
|   |-- pages/
|   |   |-- index/            # 首页
|   |   |-- create-center/    # 创作中心 / 案例与提示词
|   |   |-- gallery/          # 作品广场
|   |   |-- works/            # 我的作品
|   |   |-- mine/             # 我的
|   |   |-- login/            # 登录页
|   |   |-- tool/             # 生成工具页
|   |   |-- prompt-detail/    # 提示词详情
|   |   |-- work-detail/      # 作品详情
|   |   |-- agent/            # 代理中心展示
|   |   `-- wallet/           # 平台钱包、crypto 充值、提现申请
|   |-- platform/
|   |   `-- invite.js         # 邀请码、渠道参数处理
|   |-- services/
|   |   `-- api.js            # 后端 API、token refresh、支付与生成接口
|   |-- utils/
|   |   `-- storage.js        # token、用户资料与本地轻量状态
|   |-- app.config.js         # 小程序页面注册与默认导航栏配置
|   |-- app.css               # 全局视觉系统与页面样式
|   |-- app.jsx               # 应用入口
|   `-- index.html            # H5 HTML 模板与 favicon
|-- package.json
|-- pnpm-lock.yaml
|-- project.config.json       # 微信开发者工具项目配置
`-- README.md
```

## 页面职能

### 首页 `pages/index/index`

- 固定全屏动态视频背景，不随页面滚动改变相对位置。
- 展示 seeFactory 品牌主入口、深色透明渐变主卡片、快捷工具与案例入口。
- 从后端读取应用配置、工具和精选内容。
- 底部 tab 提供首页、创作中心、作品广场、我的作品、我的五个主导航。

### 创作中心 `pages/create-center/index`

- 通过 `/prompt-cases` 展示案例与提示词素材库。
- 支持工具分类筛选、关键词搜索、分页加载和空状态。
- 点击案例进入提示词详情，案例提示词完整可见。

### 作品广场 `pages/gallery/index`

- 通过 `/gallery/works` 展示公开作品。
- 支持精选大卡、双列瀑布流、工具筛选、同款创作入口和公开作品详情。
- 从广场进入详情时使用公开作品模式，未登录用户也可以浏览公开作品详情；后端返回 `downloadEnabled=false` 时禁用保存/下载入口。

### 生成工具页 `pages/tool/index`

- 通过 `/tools/:toolKey` 获取工具配置和动态表单字段。
- 支持提示词、公开生成渠道、图片/视频/音频素材、风格、比例、模型和时长等配置。
- 素材上传按工具/模式校验格式、大小、数量和槽位，支持多参考图、真实预览、进度和失败原因。
- 有公开渠道时通过 `/generation-quotes` 获取请求绑定报价，再携带报价创建生成任务。
- 通过 `/generation-tasks` 创建生成任务，并使用轮询展示排队、处理中、成功和失败状态。
- 需要付费时唤起 `PaymentSheet`，按平台拉起微信/支付宝/抖音/QQ/Telegram Stars/Crypto 支付。
- TMA 内 Telegram Stars 使用 `Telegram.WebApp.openInvoice` 拉起，完成或处理中后刷新订单状态。

### 我的作品 `pages/works/index`

- 登录后通过 `/works` 展示用户作品记录。
- 支持状态筛选、分页、失败提示、作品详情跳转和空状态。
- 未登录时引导进入登录页。

### 作品详情 `pages/work-detail/index`

- 支持用户作品和广场作品详情展示。
- 展示结果媒体、提示词、工具信息、任务状态、保存下载和同款创作入口。
- “做同款/重新生成”通过复用上下文恢复模式、参数、渠道和参考素材。
- 视频缺少图片封面时，H5 捕获首帧作为预览，用户点击后再挂载播放组件。
- 作品发布、下载限制和失败原因均以后端返回为准。
- 排队中或生成中的任务会自动轮询状态，并提供立即刷新和取消任务入口。
- H5 保存会打开下载地址；小程序保存远程 OSS/CDN 图片或视频时，会先下载为临时文件再保存到相册。

### 我的 `pages/mine/index`

- 展示登录状态、点数余额、钱包余额、服务入口、客服入口、协议入口和代理中心入口。
- 用户资料、点数余额与钱包余额由后端接口返回。
- 钱包充值入口跳转到 `pages/wallet/index`，不再直接创建旧点数充值支付单。
- 客服信息由 `/app/config` 提供，前端不写死运营联系方式。

### 平台钱包 `pages/wallet/index`

- 通过 `/wallet/account` 展示可用余额、冻结余额和累计充值。
- 通过 `/wallet/recharge-options` 展示可用支付链和代币。
- 通过 `/wallet/recharge/crypto/order` 创建真实 crypto bridge 充值订单。
- 展示打币地址、需支付金额、支付币种、过期时间和订单状态，支持复制地址和轮询刷新。
- 支持保存提现地址、填写 Memo / Tag、提交提现申请、取消待审核提现和查看提现记录。

### 登录 `pages/login/index`

- 根据当前运行环境识别 H5、TMA、微信小程序、支付宝小程序、抖音小程序、QQ 小程序。
- Telegram Mini App 会加载 Telegram WebApp SDK，并在应用启动时调用 `ready`、`expand` 和视口同步。
- H5 展示 Google 与 X 登录入口；Google 使用 Google Identity Services，X 使用后端授权 URL 与 PKCE。
- 开发账号入口必须通过 `SEEFACTORY_DEV_LOGIN_ENABLED=true` 显式开启。
- 登录完成后保存 access token、refresh token 和用户资料。
- access token 失效时由 `src/services/api.js` 自动尝试 refresh，失败后跳转登录页。

### 代理中心 `pages/agent/index`

- 仅做代理信息展示和客服跳转，不开放代理申请入口。
- 展示邀请码、邀请数据、收益概览等后端返回信息。

## 接口约定

- 用户端 API 前缀为 `/api/v1`。
- 成功响应读取 `data` 字段；失败响应使用后端结构化错误中的 `message`、`userMessage`、`code`、`action` 和 `fieldErrors`。
- H5/TMA token 默认存储在 `localStorage`；小程序端使用平台 storage。
- 登录、支付、生成任务、作品广场和客服配置均不得依赖本地 mock。
- 生产环境 API 地址通过 `SEEFACTORY_API_BASE` 在构建时注入，不在业务代码中写死。

## 视觉规范

整体视觉方向为“深邃视频工厂控制台”：

- 主色：近黑底色，强调沉浸式小程序体验。
- 辅色：青蓝、品红、灰绿、暖金，配合 logo 色彩并避免单一蓝紫。
- 背景：首页使用竖屏视频，叠加暗场遮罩与网格扫描感。
- 卡片：玻璃质感、细边缘光、较高透明度深色渐变。
- 图标：使用 `AppIcon` 的 CSS 形状图标，避免外部图标库造成小程序端兼容差异。
- Logo：通过 `BrandLogo` 组件统一使用 `src/assets/logo.png`。
- 导航：不实现自定义顶部导航栏，依赖小程序默认导航栏；应用内部保留底部 tab。

## 开发约定

- 新页面需要在 `src/app.config.js` 的 `pages` 中注册。
- 新工具、案例、客服和支付规则优先进入后端与 Admin 配置，不在前端写死。
- 新接口统一通过 `src/services/api.js` 封装，并复用 token refresh 与结构化错误处理。
- 新图标优先扩展 `src/components/AppIcon.jsx` 与 `src/app.css` 中的 `.icon-shape-*` 样式。
- 品牌 logo 统一通过 `BrandLogo` 使用，不在页面中硬编码图片路径。
- 所有页面必须覆盖 loading、empty、error、toast 或等价反馈状态。
- 小程序端默认导航栏由 Taro 配置控制，不额外增加页面顶部导航组件。
- 构建产物、日志、依赖目录不提交到 git。

## 常用脚本

| 命令 | 用途 |
| --- | --- |
| `pnpm dev:h5` | 启动 H5 watch 预览 |
| `pnpm build:h5` | 构建 H5 产物 |
| `pnpm dev:tma` | 启动 Telegram Mini App H5 watch 预览 |
| `pnpm build:tma` | 构建 Telegram Mini App H5 产物 |
| `pnpm dev:weapp` | 启动微信小程序 watch 构建 |
| `pnpm build:weapp` | 构建微信小程序产物 |
| `pnpm dev:alipay` | 启动支付宝小程序 watch 构建 |
| `pnpm build:alipay` | 构建支付宝小程序产物 |
| `pnpm dev:tt` | 启动抖音小程序 watch 构建 |
| `pnpm build:tt` | 构建抖音小程序产物 |
| `pnpm dev:qq` | 启动 QQ 小程序 watch 构建 |
| `pnpm build:qq` | 构建 QQ 小程序产物 |
| `pnpm build:all` | 顺序构建 H5、微信、支付宝、抖音、QQ 产物 |
| `pnpm verify` | 用户端多端构建验收入口 |
| `pnpm clean:dist` | 清理 Taro 构建产物目录 |
| `pnpm prepare:h5-dist` | 清理并预建 H5 构建所需的 CSS 产物路径 |
| `pnpm preview:h5` | 预览 H5 静态构建产物 |

## 验收建议

提交前建议至少执行：

```bash
pnpm verify
```

移动端视觉建议使用 iPhone 14 尺寸检查：

```text
390 x 844
```

重点检查：

- 首页背景视频是否正常播放并固定在视口。
- 是否出现自定义顶部导航栏或顶部导航重复。
- 底部 tab 是否遮挡主要操作。
- 表单输入框、筛选 chip、上传框、支付弹窗风格是否统一。
- 图标是否出现空缺或不可见状态。
- 页面是否存在横向滚动、文字溢出或安全区遮挡。
- 登录过期后是否能 refresh，失败时是否回到登录页。
- 支付和生成任务轮询是否有明确 loading、成功、失败与重试提示。

## Changelog

### 2026-08-06 - 灾备上传签名头全端同步

- 上传工具在 `Taro.uploadFile` 中原样转发后端策略的 `headers`；正式 OSS signed POST 保持兼容，服务器本地存储灾备模式可携带短期 `x-upload-token`，用户端仍按 `/assets/upload-token -> 上传 -> /assets` 原流程工作。
- H5、TMA、微信、支付宝、抖音、QQ 和 Android Web 目标构建均通过；H5 与 TMA 已部署，四类小程序和 Android 产物已完成平台发布前校验。公网只上传并清理 1x1 PNG 验收文件，未调用任何生图或生视频模型。

### 2026-07-25 - 小程序图片上传失败系统修复

- 临时素材缺少 MIME 时按标准 MIME、文件扩展名和素材类型依次推断，避免微信 `chooseMedia` 返回空 MIME 后产生不完整的 OSS 签名表单。
- signed POST 继续消费 Backend 策略，但 Backend 会为小程序返回已加入合法域名的 OSS CNAME；素材写库优先采用服务端最终 MIME，保持签名对象与资产记录一致。
- 上传失败信息区分 `uploadFile` 域名白名单、网络超时、用户取消、文件超限、OSS HTTP 状态和签名凭证错误，便于现场判断失败层级。
- 工具素材上传和 Workflow 动态上传同步修复，GIF/M4V 与服务端允许格式对齐，并纳入生成核心契约；H5 类产物将上传工具抽为单一公共 chunk，维持既有体积预算；本轮不调用生图或生视频任务。

### 2026-07-25 - Provider 多参考图策略与多端归档

- 生成工具继续使用服务端配置驱动的素材槽位：9 个图生图模式支持可选 `0-6` 张参考图，视频模式按业务语义分别保持可选单图、必选单图或无参考图。
- 上传交互会按当前已选数量计算剩余额度，支持一次多选和分次“继续添加”；旧作品的扁平素材可迁移到新的首个参考图槽位。
- `verify:generation-core-upgrades` 增加剩余数量、继续添加和旧素材迁移断言，防止各运行端退回单图限制。
- 本次只验证用户端调用链、构建产物和静态契约，没有发起真实生图或生视频任务；价格、推荐顺序和渠道可选/置灰状态保持服务端配置结果。

### 2026-07-21 - 多运行端公共源码对齐

- Main、TMA、微信、支付宝、抖音、QQ、Android 和 APK 正式分支已统一公共生成、渠道状态与功能门禁源码，仅保留分支白名单中的平台登录、支付、构建和原生工程差异。
- 公共体积校验按运行端使用独立预算：H5/TMA 保持 4560 KiB，Android APK Web 使用 4570 KiB；单文件和入口预算保持不变。

### 2026-07-20 - 渠道置灰与不可选状态

- 渠道选项支持 `selectable/availabilityStatus/disabledReason`，保留展示测试中、维护中、暂未开放和价格配置中的渠道。
- 不可选渠道使用灰态和锁定原因展示，不响应点击，也不会被选为默认渠道或参与自动报价。
- 全部渠道不可选时，报价区域显示“渠道配置中”，生成按钮显示“暂无可用渠道”并禁止提交。
- 该行为已同步到 Main、TMA、微信、支付宝、抖音、QQ 和 Android Web 分支，并纳入生成核心契约检查。

### 2026-07-17 - 生成核心六项能力

- **N-002 公开渠道**：工具页读取 `channelOffers`，展示公开名称、质量、延迟和锁定点数；
  存在公开渠道时不再从客户端提交内部模型标识。
- **N-003 持久报价**：表单有效时防抖调用 `/generation-quotes`，提交任务和生成支付时
  绑定 `quoteId/channelOfferId`，报价过期或失配时自动要求刷新。
- **N-004 完整复用**：作品详情“做同款/重新生成”调用
  `/works/{id}/reuse-context`，恢复提示词、模式、参数、渠道、扁平素材和槽位素材。
- **N-005 多参考素材**：支持工具配置的最小/最大数量、素材类型、槽位和继续添加；
  H5 视频参考图自动归一到横屏或竖屏标准尺寸，并保存宽、高、时长。
- **N-007 双上传模式**：根据后端策略执行 signed PUT 或 signed POST，保留进度和错误反馈。
- **N-008 视频预览**：过滤无效视频封面，H5 缺少封面时捕获首帧，点击预览后再挂载播放组件。
- 新增 `verify:generation-core-upgrades`，并纳入用户端验证链。
- 已同步到 Main、TMA、微信、支付宝、抖音、QQ 和 Android Web 分支。
- 本次未修改品牌、功能入口、点数称呼和全局主题色。

验证：H5/TMA、微信、支付宝、抖音、QQ、APK Web 实际编译通过；各平台生成核心契约通过。
