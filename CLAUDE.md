# projectwizard_shadow — 开发文档

## 项目定位

这是一个独立的 VS Code 插件，是 `projectwizard` 的精简分支，专门服务于 HiSpark AI 系列芯片。
它与 `projectwizard` 并列存在，互不干扰，使用独立的项目列表文件。

**同级目录结构：**
```
temp/
  code/               ← HiSpark IDE 主插件（参考，勿改）
  projectwizard/      ← 原始向导插件（参考，勿改）
  projectwizard_shadow/ ← 本插件，CC 负责开发
```

## 核心功能（只有这三个）

1. **新建工程** — 弹窗让用户选 SOC、Platform、填写项目名和路径，生成最简 .hiproj 文件并打开文件夹
2. **导入已有工程** — 扫描用户指定目录内的 .hiproj 文件，批量加入项目列表
3. **历史记录** — 记录最近使用过的工程（本插件暂不提供 Welcome 页，历史由 code 插件调用）

## SOC 与 Platform 的约束关系

| SOC    | Platform 默认值 | 是否可修改 |
|--------|----------------|-----------|
| ws63   | CPU            | 否（disabled） |
| 3322   | NPU            | 否（disabled） |
| mcu    | CPU            | 是（可切换 CPU/NPU） |
| 1156e  | CPU            | 是（可切换 CPU/NPU） |

这个逻辑由前端 `PLATFORM_MAP` 常量控制，SOC 切换时同步更新 Platform 字段的值和 disabled 状态。

## 生成的 .hiproj 文件格式（最简占位）

```ini
[information]
board_build.mcu=ws63
board=ws63
platform=CPU
project_name=myProject
project_path=/path/to/myProject
sdk_path=
series_name=shadow
project_type=SHADOW

[compile]

[debug]
```

用 `ini` 库生成，不含原 projectwizard 中复杂的多核/GUI/MCU 分支逻辑。

## 技术栈

- **语言**: TypeScript（前后端均是）
- **前端**: React 18 + Redux + redux-saga + Ant Design 4.x + Less
- **后端**: VS Code Extension API（WebviewPanel, commands, globalStorageUri）
- **构建**: Webpack 5，双 bundle（前端 webview + 后端 extension）
- **主题**: Less 变量系统，dark/light 两套主题通过 modifyVars 注入

## 目录结构

```
src/
  extension.ts                    ← 插件入口，注册4个命令
  backEnd/
    command.ts                    ← 所有后端操作（创建/导入/列表/路径选择等）
    utils.ts                      ← 文件工具（项目列表读写、hiproj 扫描）
    interface/
      api.ts                      ← 消息类型定义
      apiMethod.ts                ← 消息方法枚举
      model.ts                    ← 数据模型（ShadowProjectData 等）
    panels/
      panel.ts                    ← WebviewPanel 基类
      chipConfigPanel.ts          ← 新建工程面板
      projectImportPanel.ts       ← 导入工程面板
    resourceManage/
      resourceManager.ts          ← 资源路径管理
      resourcePath.ts
  frontEnd/
    index.html                    ← Webview HTML 模板（含 flagCreate / flagImport span）
    index.tsx                     ← React 入口，根据 flag 路由到不同组件
    projectWizard.tsx             ← 新建工程弹窗组件（主要 UI）
    projectImport/
      projectImport.tsx           ← 导入工程弹窗组件
    actions.ts                    ← Redux action creators
    sagas.ts                      ← Redux saga（处理异步消息）
    state.ts                      ← Redux state 类型
    core/
      command.ts                  ← 前端收到消息后的分发处理
      store/
        store.ts / reducers.ts / sagas.ts / actions.ts
    component/
      drag.ts                     ← 弹窗可拖拽逻辑
    a-styles/
      index.less                  ← 全局样式（antd 覆写 + 自定义）
      themes/
        dark.less                 ← 暗色主题变量
        light.less                ← 亮色主题变量
  i18n/
    fronEndTrans.ts / backEndTrans.ts
    lang/en.json / zh.json        ← 国际化文案

resources/
  chips/chiplist.json             ← 只含4个 SOC 的芯片列表
scripts/
  webpack.front.config.js         ← 前端 webpack 配置
  webpack.pro.config.js           ← 后端 webpack 配置
```

## 注册的 VS Code 命令

| 命令 ID              | 功能 |
|---------------------|------|
| `showProjectWizard` | 打开新建工程弹窗 |
| `showProjectImport` | 打开导入工程弹窗 |
| `openProject`       | 打开指定 .hiproj 所在目录 |
| `deleteProject`     | 从项目列表删除一条记录 |

## 前后端通信机制

使用 VS Code Webview 的 postMessage / `window.addEventListener('message')` 机制：

- 前端 → 后端：`vscode.postMessage({ method, params })` 
- 后端 → 前端：`panel.webview.postMessage(msg)`
- 消息方法名在 `ApiMethod` 枚举中定义
- 前端 saga 监听消息并 dispatch 到 Redux store；后端 `Command` 类按 method 分发

## 项目列表存储

使用独立文件，路径在 `context.globalStorageUri.fsPath` 下：
- `shadow_projectlist.json` — 全量列表
- `shadow_latestlist.json` — 最近使用

与原 projectwizard 的 `projectlist.json` / `latestlist.json` 完全独立。

## 构建命令

```bash
# 安装依赖
npm install

# 构建（dark + light 前端 + 后端）
npm run build

# 只构建前端（dark 主题，开发用）
npm run watch
```

## 样式一致性

- `a-styles/themes/dark.less` 和 `light.less` 与原 projectwizard 完全一致
- `a-styles/index.less` 包含完整的 antd 组件覆写 + 弹窗/表单/按钮样式
- 弹窗圆角 16px，按钮圆角 16px，输入框圆角 8px

## 开发注意事项

- 不要修改 `code/` 和 `projectwizard/` 下的任何文件，它们仅供参考
- 插件是 WebviewPanel，不是普通 webview；面板关闭后需调用 `extension.deactivate()`
- Less 变量必须在 webpack modifyVars 中注入，不要硬编码颜色值
- 前端是独立 bundle，不能直接 import Node.js 模块
- `acquireVsCodeApi()` 在 webview 中全局可用，已在 `index.tsx` 中导出为 `vscode`
