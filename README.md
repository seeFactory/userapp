# seeFactory Mini App

seeFactory 用户端是基于 Taro + React 构建的深色 AI 创作小程序/H5 前端。当前版本已从早期本地 mock 原型升级为后端接口驱动：工具、案例、作品、广场、用户、客服、生成任务和支付流程均通过 `src/services/api.js` 接入 `backend/` 提供的 `/api/v1` 接口。

视觉基准为 iPhone 14 逻辑视口 `390 x 844`。首页使用固定视口的动态视频背景，页面内容采用深色玻璃质感、透明渐变主卡片、统一 logo、统一图标系统、底部 tab 与小程序默认顶部导航栏。

## 项目状态

- 产品形态：Taro 多端用户端，优先小程序移动端体验，同时保留 H5 预览。
- 数据来源：真实后端接口，不再保留 `src/data/mock.js` 作为业务数据源。
- 默认接口：`http://127.0.0.1:10087/api/v1`。
- 设计基准：iPhone 14 逻辑视口 `390 x 844`，H5 内容最大宽度按移动端处理。
- 品牌资源：`src/assets/logo.png` 来自 `docs/logo.png`，通过 `BrandLogo` 统一使用。
- 状态体系：页面级 loading、骨架屏、toast、modal、confirm、empty、error 与支付/生成轮询状态。

## 技术栈

- Taro `4.2.0`
- React `18`
- Webpack 5
- 微信小程序构建目标 `weapp`
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

构建产物输出到 `dist/`，该目录不纳入 git 版本管理。

## 目录结构

```text
app/
|-- config/
|   `-- index.js              # Taro 构建配置、H5 端口、资源复制配置
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
|   |   `-- agent/            # 代理中心展示
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
- 后端返回 `downloadEnabled=false` 时隐藏保存/下载入口。

### 生成工具页 `pages/tool/index`

- 通过 `/tools/:toolKey` 获取工具配置和动态表单字段。
- 支持提示词输入、素材选择、风格、比例、模型、时长等配置。
- 通过 `/generation-tasks` 创建生成任务，并使用轮询展示排队、处理中、成功和失败状态。
- 需要付费时唤起 `PaymentSheet`，按平台拉起微信/支付宝/抖音/QQ/Telegram Stars/Crypto 支付。

### 我的作品 `pages/works/index`

- 登录后通过 `/works` 展示用户作品记录。
- 支持状态筛选、分页、失败提示、作品详情跳转和空状态。
- 未登录时引导进入登录页。

### 作品详情 `pages/work-detail/index`

- 支持用户作品和广场作品详情展示。
- 展示结果媒体、提示词、工具信息、任务状态、保存下载和同款创作入口。
- 作品发布、下载限制和失败原因均以后端返回为准。

### 我的 `pages/mine/index`

- 展示登录状态、点数余额、服务入口、客服入口、协议入口和代理中心入口。
- 用户资料与点数余额由后端接口返回。
- 客服信息由 `/app/config` 提供，前端不写死运营联系方式。

### 登录 `pages/login/index`

- 根据当前运行环境识别 H5、TMA、微信小程序、支付宝小程序、抖音小程序、QQ 小程序。
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
- 生产环境 API 地址后续应通过构建环境变量或配置注入替换 `src/services/api.js` 中的本地地址。

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
| `pnpm dev:weapp` | 启动微信小程序 watch 构建 |
| `pnpm build:weapp` | 构建微信小程序产物 |
| `pnpm preview:h5` | 预览 H5 静态构建产物 |

## 验收建议

提交前建议至少执行：

```bash
pnpm build:h5
pnpm build:weapp
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
