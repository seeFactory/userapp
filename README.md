# seeFactory Mini App

seeFactory 是一个基于 Taro + React 的 AI 创作小程序原型，目标是提供与参考小程序一致的核心职能：用户可以浏览 AI 创作工具、查看案例提示词、进入生成工具填写提示词和参数、管理作品记录，并预留登录、客服与代理中心能力。

当前版本聚焦移动端小程序体验，已按 iPhone 14 视口进行 H5 验收，并采用深色视频工厂控制台风格：固定视频首页背景、玻璃质感卡片、品牌 logo 贯穿、深色默认导航栏适配、底部 tab 和表单组件统一视觉。

## 项目状态

- 产品阶段：前端原型 / 小程序视觉与交互验证。
- 数据来源：本地 mock 数据与本地存储模拟。
- 后端接口：暂未接入。
- 目标平台：微信小程序优先，同时支持 H5 预览。
- 品牌资源：`src/assets/logo.png` 来自项目文档资源 `docs/logo.png` 的应用内副本。

## 技术栈

- Taro `4.2.0`
- React `18`
- Webpack 5
- 微信小程序构建目标 `weapp`
- H5 预览目标 `h5`

## 快速开始

```bash
npm install
```

启动 H5 开发预览：

```bash
npm run dev:h5
```

默认 H5 地址：

```text
http://127.0.0.1:10086/#/pages/index/index
```

构建 H5：

```bash
npm run build:h5
```

构建微信小程序：

```bash
npm run build:weapp
```

构建产物输出到 `dist/`，该目录不纳入 git 版本管理。

## 目录结构

```text
app/
|-- config/
|   `-- index.js              # Taro 构建配置、H5 端口、资源复制配置
|-- src/
|   |-- assets/
|   |   `-- logo.png           # seeFactory 应用内品牌 logo
|   |-- components/
|   |   |-- AppIcon.jsx        # CSS 形状图标系统
|   |   |-- BrandLogo.jsx      # 全局品牌 logo 组件
|   |   |-- CustomerModal.jsx  # 客服弹窗
|   |   `-- Shell.jsx          # 页面壳、背景视频、底部 tab
|   |-- data/
|   |   `-- mock.js            # 工具、案例、作品、客服等 mock 数据
|   |-- pages/
|   |   |-- index/             # 首页
|   |   |-- create-center/     # 创作中心 / 案例与提示词
|   |   |-- works/             # 我的作品
|   |   |-- mine/              # 我的
|   |   |-- login/             # 登录页
|   |   |-- tool/              # 生成工具页
|   |   |-- prompt-detail/     # 提示词详情
|   |   |-- work-detail/       # 作品详情
|   |   `-- agent/             # 代理中心
|   |-- utils/
|   |   `-- storage.js         # 登录态与作品记录本地存储
|   |-- app.config.js          # 小程序页面注册与默认导航栏配置
|   |-- app.css                # 全局视觉系统与页面样式
|   |-- app.jsx                # 应用入口
|   `-- index.html             # H5 HTML 模板与 favicon
|-- package.json
|-- package-lock.json
|-- project.config.json        # 微信开发者工具项目配置
`-- README.md
```

## 页面职能

### 首页 `pages/index/index`

- 固定全屏动态视频背景，不随页面滚动改变相对位置。
- 展示 seeFactory 品牌入口、主行动按钮与案例入口。
- 以模块卡片形式展示 AI 绘画、快速作图、视频创作、图生视频、文生视频、多图融合、品牌漫画等工具入口。
- 底部 tab 提供首页、创作中心、我的作品、我的四个主导航。

### 创作中心 `pages/create-center/index`

- 展示案例与提示词素材库。
- 支持按工具分类筛选。
- 支持标题与标签关键字搜索。
- 点击案例进入提示词详情。

### 生成工具页 `pages/tool/index`

- 根据工具配置动态展示表单字段。
- 支持提示词输入、素材上传模拟、风格、画面比例、视频时长、模型等选项。
- 生成动作会写入本地作品记录并跳转作品详情。
- 当前为前端模拟生成流程，未调用真实 AI 接口。

### 我的作品 `pages/works/index`

- 登录后展示本地生成记录。
- 支持按类型筛选。
- 支持清理失败记录。
- 未登录时引导登录。

### 我的 `pages/mine/index`

- 展示账号状态、剩余额度与服务入口。
- 提供代理中心、联系客服、用户协议、隐私政策入口。
- 登录状态由本地存储模拟。

### 登录 `pages/login/index`

- 支持一键登录与账号密码两种模拟模式。
- 需要勾选协议后完成登录。
- 登录成功后根据 `redirect` 参数回跳。

### 代理中心 `pages/agent/index`

- 预留代理状态、邀请码、激活用户、累计收益和推广二维码展示。
- 当前数据为模拟内容。

## 视觉规范

整体视觉方向为“深色视频工厂控制台”：

- 主色：近黑底色，强调小程序沉浸感。
- 辅色：青蓝、品红、灰绿、暖金，呼应 logo 色彩并避免单一蓝紫。
- 背景：首页使用竖屏视频，叠加暗场遮罩与网格扫描感。
- 卡片：玻璃质感、细边缘光、低透明深色渐变。
- 图标：使用 `AppIcon` 的 CSS 形状图标，避免依赖外部图标库造成小程序端兼容差异。
- Logo：通过 `BrandLogo` 组件统一使用 `src/assets/logo.png`。
- 导航：不实现自定义顶部导航栏，依赖小程序默认导航栏；应用内部只保留底部 tab。

## Mock 数据与本地存储

核心 mock 数据位于 `src/data/mock.js`：

- `tabs`：底部导航配置。
- `homeVideo`：首页背景视频地址。
- `toolCategories`：工具分类。
- `tools`：工具配置与动态表单字段。
- `cases`：案例与提示词。
- `seedWorks`：默认作品记录。
- `customer`：客服展示信息。

本地状态位于 `src/utils/storage.js`：

- 登录态模拟。
- 作品记录初始化、追加、删除、清理失败记录。
- 登录拦截与 redirect 逻辑。

## 开发约定

- 新页面需要在 `src/app.config.js` 的 `pages` 中注册。
- 新工具优先在 `src/data/mock.js` 的 `tools` 中扩展，工具页会根据 `fields` 自动渲染部分表单项。
- 新图标优先扩展 `src/components/AppIcon.jsx` 与 `src/app.css` 中的 `.icon-shape-*` 样式。
- 品牌 logo 统一通过 `BrandLogo` 使用，不在页面中硬编码图片路径。
- 小程序端默认导航栏由 Taro 配置控制，不额外增加页面顶部导航组件。
- 构建产物、日志、依赖目录不提交到 git。

## 常用脚本

| 命令 | 用途 |
| --- | --- |
| `npm run dev:h5` | 启动 H5 watch 预览 |
| `npm run build:h5` | 构建 H5 产物 |
| `npm run dev:weapp` | 启动微信小程序 watch 构建 |
| `npm run build:weapp` | 构建微信小程序产物 |

## 验收建议

提交前建议至少执行：

```bash
npm run build:h5
npm run build:weapp
```

移动端视觉建议使用 iPhone 14 尺寸检查：

```text
390 x 844
```

重点检查：

- 首页背景视频是否正常播放并固定。
- 是否出现自定义顶部导航栏。
- 底部 tab 是否遮挡主要操作。
- 表单输入框、筛选 chip、上传框风格是否统一。
- 图标是否出现空缺或不可见状态。
- 页面是否存在横向滚动。

## 后续开发方向

- 接入真实登录体系与用户信息接口。
- 接入 AI 生成任务创建、轮询、结果回调与失败重试。
- 将 mock 案例库替换为接口分页数据。
- 增加素材上传、文件校验、上传进度与预览。
- 增加额度扣减、订单、代理收益和提现接口。
- 为关键流程补充自动化测试和小程序真机验收清单。
