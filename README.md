# Book Companion / 家庭阅读助手

面向家庭纸质阅读的伴读入口。首页只用于选择系列；当前提供 `不一样的卡梅拉` 12 册故事伴读，以及 `工作细胞` 27 个科学主题伴读。站点提供内容回顾、问答卡片、背景补充、剧情百科、科学小站、页面线索和音频，不是电子书、进度或打卡产品。

## Portfolio status

```text
PORTFOLIO_STATUS: SEALED
PROJECT_MODE: MAINTENANCE
LAST_COMPLETED_PHASE: FR-P6
FR_P6_BASE_MAIN: f55859186f69e98a1cae689f77d7162f1bf565e0
FINAL_MAIN_SHA: RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF
PAGES_STATUS: RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF
WORKSPACE_STATUS: RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF
NEXT_RECOMMENDED_PHASE: NONE
```

FR-P6 已完成进入封板事务所需的本地证据对账、全站浏览器验收、媒体与 Source 复核、构建和证据生成，因此 tracked 状态已切换为 `SEALED` / `MAINTENANCE`，供唯一一次完整 release gate 启用 final-mode 校验。这个 tracked 状态不提前声称包含它的提交、Actions、Pages、分支删除或最终干净工作区已经存在；这些自引用事实由 post-commit 最终交接解决。

```text
LOCAL_ACCEPTANCE: PASS
EXPECTED_FINAL_TEST_COUNT: 211
QUALITY_COMPROMISES: 0
POST_COMMIT_CLOSEOUT: RESOLVED_POST_COMMIT_IN_FINAL_HANDOFF
```

在 post-commit 哨兵被真实 Git、GitHub、Pages 和工作区证据解决前，只允许继续 FR-P6 收尾，不启动普通维护任务或新 Phase。当前阶段账本见 `reports/portfolio/fr-p6/fr-p6-phase-ledger.json`，最终状态见 `docs/portfolio/FR-PORTFOLIO-FINAL-STATUS.md`，维护协议见 `docs/maintenance/Family-Reading-maintenance-protocol.md`。

## Repository identity

本次仓库重命名完成后的唯一当前仓库为：

- GitHub：`Archmays/Family-Reading-Codex`
- GitHub Pages：`https://archmays.github.io/Family-Reading-Codex/`
- 本地项目目录名：`Family-Reading-Codex`

旧名称 `Archmays/Family-Reading` 只作为重命名前的历史身份保留。不要重新创建同名旧仓库，否则 GitHub 对旧仓库地址的自动重定向可能失效。FR-P4B 已完成原位重命名并将本地 `origin` 更新到 canonical URL；发布验收只以新 Pages 地址的 exact-SHA 结果为准。

## 本地构建

需要 Node.js。项目没有数据库、登录系统或运行时服务器依赖。

```bash
npm run verify:release
```

该命令是本机作者环境的完整门禁，按顺序验证 tracked runtime、媒体 inventory、派生图、owner shards、精确 release plan、历史封存与当前维护覆盖层、完整测试、公开仓库边界和静态 build/dist。CI 使用不依赖本机作者素材的 `npm run verify:public-release`；两者共享同一 release plan 和 dist 审计。

当 authoring JSON 合法变更后，先更新并验证跟踪的运行时投影：

```bash
npm run generate:runtime
npm run validate:runtime
```

当前响应式媒体由确定性 inventory、质量 policy、media manifest、owner shards 和 release plan 管理；不得手工修改派生文件或 manifest。

## GitHub Pages 部署

1. 将仓库推送到 GitHub。
2. 打开仓库的 `Settings` -> `Pages`。
3. 在 `Build and deployment` 中选择 `Source: GitHub Actions`。
4. 推送到 `main` 后，`.github/workflows/pages.yml` 会运行 `npm run verify:public-release`；只有 Git 中可携带的完整发布门禁通过才会上传 `dist`。
5. 部署完成后，在 `Actions` 页面或 `Settings` -> `Pages` 中确认访问地址为 `https://archmays.github.io/Family-Reading-Codex/`。

资源路径使用相对路径，兼容 GitHub Pages 项目子路径部署。仓库改名后只以新 URL 的 exact-SHA live smoke 为验收依据。

## 原始素材说明

`source/` 下的原始素材，以及 Carmela 页面图、Work Cells 高分辨率/缩略/小站作者素材、OCR 实验等重建输入，均保留在本机并被 Git 忽略；确定性的 WebP 派生图、运行时 JSON 与音频才进入公开发布闭包。构建不会将本地作者素材复制到 `dist`。用户提供或指定的项目资源适用全局授权，当前状态为 `RIGHTS_STATUS: PASS_BY_USER_AUTHORIZATION`；Source 不可变、隐私与发布工程边界仍独立执行。

12 册音频当前均有 `public/audio/carmela-s1/` 发布副本。播放器使用 `preload="none"`，且只在用户主动播放或操作原生控件后挂载音频路径；不自动播放，也不保存播放位置。不以额外版权或许可记录作为发布前置条件。

更完整的部署检查和体积说明见 `docs/github-pages-deployment.md`。项目封板后的变更必须遵循维护协议。
