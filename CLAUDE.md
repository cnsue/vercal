# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # 本地开发服务器（Vite HMR）
npm run build    # tsc -b 类型检查 + 生产构建（零错误即通过）
npm run preview  # 预览生产包
```

无 lint、test 脚本。TypeScript strict 模式（`noUnusedLocals`、`noUnusedParameters`），`npm run build` 是唯一校验入口；沙盒中 Rollup 原生模块可能签名失败，用 `npx tsc -b` 单独做类型检查。

## Architecture

### Routing（无路由库）
`App.tsx` 用 4 个 tab + discriminated union `Subpage` 类型手动管理导航。新增二级页需在 `App.tsx` 顶部扩展 `Subpage` 类型，并在 App shell 中渲染对应 Page 组件。

### State（Zustand v5 + localStorage）
两个独立 store：
- `src/store/useAssetStore.ts`：快照、汇率、年度目标、自定义平台/类别
- `src/store/useRetirementStore.ts`：养老金配置、股息持仓、体面标准、被动收入

持久化统一走 `src/store/storage.ts`（key 前缀 `asset-tracker:`）。每个 mutation 内部自调用 StorageService。storage.ts 包含多版本迁移逻辑（pension v0.2→v0.4），加字段前先查看 `getRetirementPlan` 的 merge 模式。

### 退休体面覆盖计算链

```
RetirementStore
  → retirementCalc.ts: computeDividendSummary / computePensionProjection
  → retirementCalc.ts: computeCoverage → { nowRatio, retiredRatio }
  → retirementCalc.ts: computeDimensionCoverage（优先级瀑布分摊）
  → CoverageHero.tsx（退休幸福指数卡片）
  → DimensionDetailSheet.tsx（单维度详情）
```

体面标准由 `DecentStandard.breakdown[]` 驱动，每条有 `builtinKey`（映射到 `DECENT_DIMENSIONS`）或自定义。`computeDimensionCoverage` 先满足 priority=1 维度（衣食住行），再分配剩余给 priority=2（医乐爱及自定义）。

### 覆盖率层级系统
`src/types/retirement.ts` 中的 `COVERAGE_LEVELS`（5 档：温饱/安稳/体面/从容/圆满）和 `BUDGET_PRESETS_FAMILY3_TIER1` 是静态查找表。`getCoverageLevel(ratio)` / `getNextCoverageLevel(ratio)` 为纯函数，供 CoverageHero 直接调用。城市等级系数（4 档）和家庭规模系数（4 档）通过 `buildPresetBreakdown()` 组合计算推荐套餐。

### Domain Calculators
- `src/utils/retirementCalc.ts`：退休规划全链路
- `src/utils/mortgageCalc.ts`：商贷/公积金/组合贷提前还款，`computePaidMonths` 从 `firstRepaymentDate`（"YYYY-MM"）推算已还月数；LPR 5Y=3.5%，公积金基准=2.85%
- `src/utils/formatters.ts`：`formatCNY`（>10000 自动显示万）

### Static Data（只读表格）
- `src/data/dividendStocks.ts`：高股息股票库（硬编码）
- `src/data/pensionCities.ts`：城市养老金参数

### CSS & Theming
纯 CSS 变量（`src/index.css`），无框架。主题由 `document.documentElement.dataset.theme` 控制，在 `main.tsx` 首次初始化、`App.tsx` 切换时更新。

### PWA
`vite.config.ts` 内联 Workbox 配置，汇率 API NetworkFirst（3600s TTL）。`__APP_VERSION__` 编译时从 `package.json` 注入。
