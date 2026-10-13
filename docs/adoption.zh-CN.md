# 模板接入与多端仓库组织

更新日期：2026-10-13。本文的 workspace 目录和后续能力是建议方案，当前模板仍是一个独立的 Nuxt + Electron 项目。

## Nuxt 与 Vue + Vite 的选择

已有 Nuxt 业务、希望复用页面、插件、composables 和配置时，推荐首版继续使用 Nuxt。云乐坊的 `apps.yunle.fun` 属于这种情况。迁移到 Vue + Vite 需要适配 `useNuxtApp`、`useRuntimeConfig`、Nuxt 路由和模块；已有 Ionic／Capacitor 的移动端逻辑也需要桌面平台实现。

从零开发、界面主要承载标签页和远程网页的桌面容器，可以选择 Vue + Vite，以减少框架和构建链依赖。Electron 的内嵌网页能力与本地界面框架无关。

当前模板使用 `ssr: false`，通过 Nuxt 生成静态客户端。安装包加载 `app://shell`，只包含 `.output/public`；API 和其他服务端功能继续部署在云端。接入远程 API 时，需要配置明确的基址、客户端 CSP 和服务端 CORS，并验证本地 Origin 下的登录、刷新和退出。

| 模块 | 职责 |
| --- | --- |
| 本地 Nuxt 界面 | 业务页面、导航、账户展示，通过受限 preload 调用桌面能力 |
| Electron 主进程 | 窗口、WebContentsView、Session、导航策略、权限与更新 |
| guest 网页 | 内嵌应用自己的界面和网络请求，使用独立 Session |

主进程与 preload 不依赖 Nuxt composables。业务通过固定、类型化的接口访问平台能力；移动端和桌面端各自实现所需操作。

## 同一产品的移动端与桌面端放在同一仓库

推荐同一产品采用一个产品仓库。账号、应用目录、云同步规则和宿主协议能够在同一个 PR 中修改、验证，避免两个客户端长期复制业务逻辑。

适合共享的内容包括业务模型、API 客户端、协议类型、验证逻辑、设计变量和通用 Vue 组件。移动导航、桌面标签栏、原生权限、登录回调和系统集成使用各自的实现。通用 UI 包不直接导入 Electron、Capacitor 或 Ionic 的平台导航。

同仓库不要求所有端使用同一个页面入口、版本号或发布时间。Web、移动和桌面分别维护构建、环境设置、应用标识与发布流程。

### 先接入，再逐步拆分

现有项目可以先保留 Nuxt 应用和 `ios/`、`android/` 工程，在产品仓库加入 `electron/` 与显式的桌面构建目标。桌面主界面调用共享业务模块，平台差异集中到宿主实现和布局中。

等移动与桌面页面形成稳定、不同的入口后，再迁移到 pnpm workspace。以下是演进示例，并非已创建的目录：

```text
product/
  apps/
    web-mobile/           # Nuxt Web／移动界面及 ios/、android/
    desktop/              # Nuxt 桌面界面及 electron/、Forge 配置
  packages/
    domain/               # 业务模型、规则和纯逻辑
    api-client/           # 请求、会话接口；存储和平台行为由调用方提供
    host-contracts/       # Web／Capacitor／Electron 共用的协议类型
    ui/                   # 通用 Vue 组件和设计变量
    nuxt-layer/           # 有实际复用需求的 Nuxt 插件、composables 或页面
  pnpm-workspace.yaml
  pnpm-lock.yaml
```

Web 与移动也可以在界面需求明显分化时再拆成独立项目。已有共享包可以沿用名称；不必为了符合目录示例而新增或重命名一批包。

使用 `workspace:*` 声明实际的本地包依赖，统一根目录的 Node、pnpm 和锁文件管理。Nuxt Layer 用于共享 Nuxt 特有代码；各应用保留自己的页面组合与布局。项目自身文件优先于 Layer，不能依赖附加 Layer 覆盖项目现有的 `app.vue`。

### 构建与发布分别验收

- Web、移动和桌面使用各自的 Nuxt 缓存、静态输出和发布目录，防止构建互相覆盖。
- 移动端签名、商店上传与 Electron 签名、安装包、自动更新使用独立工作流和凭据。
- 平台目录变化验证对应应用；共享模块变化验证所有使用它的应用。先保留完整验证，再引入按依赖关系筛选任务。
- 在 workspace 中核对 Forge 的项目根目录、打包白名单和运行时依赖。共享代码须被构建进产物或作为实际运行依赖收集，安装包不能依赖仓库外的源码或软链接。

当产品、团队权限或核心业务已经独立，共享内容很少时，再考虑分仓并发布共享包。云乐坊首版的业务和协议重合度高，当前适合同仓库协作。

## 通用模板与产品仓库的关系

`vitesse-nuxt-electron` 保持为通用模板，维护安全 preload、静态协议、视图示例、构建和发布。云乐坊目录、登录服务、会员规则和其他业务留在产品仓库。

接入时移植经过验证的宿主实现和构建方式，并适配产品自己的依赖基线；产品仓库的 manifest 和锁文件继续由产品维护。通用修复回流模板。只有出现多个实际消费者、接口稳定后，才将宿主模块抽成共享包。

## 当前能力与完善顺序

模板已经实现隔离的 shell／guest preload、发送者和主 frame／Origin 校验、独立持久化 Session、静态协议、开发启动与重启、Forge 打包和客户端更新流程。CI 已验证 macOS arm64、Windows x64、Linux x64 的安装、类型、测试、原生打包和 ASAR／fuse 配置。

以下能力仍需完善：

| 顺序 | 改进 | 当前缺口 |
| --- | --- | --- |
| 1 | 统一应用配置与初始化 | 名称、可执行文件名、协议、Session 标识和更新仓库分散在多处 |
| 2 | AppManifest 与 ViewManager | 目前硬编码两个文档站，一次只保留一个 guest；需要标签管理、账号配置隔离和恢复机制 |
| 3 | 真实应用接入示例 | 验证 API、登录、受控弹窗、外链、下载和按请求授权的设备权限 |
| 4 | 开发与诊断 | `shared/` 变更触发桌面重启、窗口状态恢复、原生菜单、失败日志和截图 |
| 5 | 发布验收 | 补 macOS x64 常规 CI，用真实证书验证签名、公证、安装和跨版本更新 |

Vue 弹窗的 `z-index` 无法直接覆盖原生 WebContentsView，需要显式安排视图隐藏或可信原生窗口。发布工作流已配置签名和更新产物，但还没有完成真实签名版本之间的安装升级演练。

依赖采用人工升级。TypeScript 目前保留最新兼容版 6.0.3，Node 类型匹配 Node 24。移除过期的精确发布信任例外，并在上游采用已修复的 simple-git 后清理 DevTools 兼容补丁；运行时和完整工具链审计分别记录。

## 参考

- [pnpm Workspace 与 workspace 协议](https://pnpm.io/workspaces)
- [Nuxt Layers](https://nuxt.com/docs/4.x/guide/going-further/layers)
- [Electron 官方打包教程](https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging)
- [Forge Squirrel.Windows 安装与更新产物](https://www.electronforge.io/config/makers/squirrel.windows)
