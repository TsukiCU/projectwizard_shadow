# 起始 Prompt — projectwizard_shadow

## 任务背景

你接手的是 `projectwizard_shadow`，一个 VS Code 插件项目，位于 `temp/projectwizard_shadow/`。
旁边有 `temp/projectwizard/`（原始插件，只读参考）和 `temp/code/`（主插件，只读参考）。

项目功能和架构已在 `CLAUDE.md` 中描述，请先通读它。

## 你的首要任务

1. **通读 CLAUDE.md**，理解整体架构和约束
2. **快速扫描核心源文件**，重点是：
   - `src/extension.ts`
   - `src/backEnd/command.ts`
   - `src/frontEnd/projectWizard.tsx`
   - `src/frontEnd/projectImport/projectImport.tsx`
   - `src/frontEnd/index.tsx`
   - `src/frontEnd/core/store/` 目录下各文件
   - `src/frontEnd/sagas.ts`、`src/frontEnd/actions.ts`
3. **尝试构建**（`npm install && npm run build`），看看有没有编译错误
4. **梳理出潜在问题**：类型错误、引用缺失、逻辑漏洞、与 Redux/saga 流程不匹配的地方等
5. **修复发现的问题**，使项目能够干净地编译通过

## 开发原则

- 以让插件真正可运行为目标，不是只让它能编译
- 遇到不确定的地方，可以参考 `../projectwizard/` 中对应的实现，但不要照搬不适用的逻辑
- 保持代码风格与现有代码一致（TypeScript strict，Apache 2.0 文件头）
- Less 样式不要改动 `a-styles/` 下已有内容，除非有明确的 bug

## 参考资源

- 原始插件参考：`../projectwizard/src/`
- 芯片数据：`resources/chips/chiplist.json`（只有4个 SOC，不要添加其他的）
- 国际化文案：`src/i18n/lang/en.json` 和 `zh.json`

开始吧，先读 CLAUDE.md，再扫描代码，再构建，再告诉我发现了什么。
