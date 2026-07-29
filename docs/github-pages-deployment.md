# GitHub Pages 部署检查

## 目标

将 `Book Companion / 家庭阅读助手` 作为静态站点部署到 GitHub Pages。首页系列标题保持为 `不一样的卡梅拉`，首页只做系列入口，不恢复 dashboard、阅读进度、打卡或账号模块。

当前仓库重命名完成后的 canonical identity：

- GitHub：`Archmays/Family-Reading-Codex`
- Pages：`https://archmays.github.io/Family-Reading-Codex/`

旧名称 `Archmays/Family-Reading` 只保留为历史身份，不得重新创建同名仓库。FR-P4B 已完成原位重命名并更新本地 `origin`；后续发布仍必须对新项目 Pages URL 做 exact-SHA 验证。

## 发布验证与构建方式

- 本机完整验证命令：`npm run verify:release`
- GitHub Actions 可移植验证命令：`npm run verify:public-release`
- 构建命令：`npm run build`
- 本机门禁：作者输入 staleness/inventory/derivative check → 完整测试一次 → 默认拒绝的 GitHub 同步边界 → 静态复制 → dist audit
- CI 门禁：owner shards/release plan → 封存与维护覆盖层 → tracked-only tests → privacy/sync validators → 静态复制 → dist audit
- 输出目录：`dist`
- 部署方式：GitHub Actions 上传 `dist` 到 GitHub Pages

项目是静态页面，不需要服务器、数据库、登录系统或私有运行时服务。

## GitHub Pages 设置步骤

1. 推送仓库到 GitHub。
2. 进入仓库 `Settings` -> `Pages`。
3. 将 `Build and deployment` 的 `Source` 设为 `GitHub Actions`。
4. 推送到 `main`，或在 `Actions` 页面手动运行 `Deploy GitHub Pages`。
5. 工作流会执行 `npm run verify:public-release`；任何门禁失败都会在上传 `dist` 前停止。
6. 仓库重命名完成后，确认线上地址精确为 `https://archmays.github.io/Family-Reading-Codex/`。

## 子路径资源规则

应用使用相对路径加载：

- `assets/styles.css`
- `assets/science-companion.css`
- `assets/science-companion.js`
- `assets/app.js`
- `public/runtime/index.json`
- `public/runtime/carmela/books.json`
- `public/runtime/work-cells/topics.json`
- `public/runtime/work-cells/topics/*.json`
- 12 册 Carmela 的当前详情与媒体
- Work Cells 当前 runtime 引用的媒体
- `public/audio/carmela-s1/*.mp3`

这些路径可以在 GitHub Pages 项目子路径下工作，例如 `https://用户名.github.io/仓库名/`。仓库重命名后，项目型 Pages URL 不应假定从旧路径自动重定向，必须对新地址独立验证。

## 不发布的内容

`scripts/build.mjs` 只复制当前精确 release plan 声明的 runtime、应用资源、Carmela 详情与音频，以及 Work Cells 当前 WebP 派生媒体。当前构建包含 12 册 Carmela 和 27 个 Work Cells 主题：

- 不复制 `source/`
- 不复制 PDF 或 EPUB
- 不复制 `ocr/` OCR 中间文件夹
- 不复制 Work Cells authoring manifest
- 不复制 `data/cells-at-work/page-map.json`
- 不复制完整页面目录、动画源素材、私有 review 资料或任务 scratch
- 不复制不必要的大型中间文件

同一边界也适用于 Git：`operations/github-sync/public-github-sync-policy.json` 默认拒绝未列入清单的路径。本机作者素材可以继续为生成器提供输入，但不属于公开仓库工作集。

`source/` 是受保护的本地原始素材来源，不进入 GitHub Pages 发布目录。不得因仓库体积删除、迁移、压缩、重编码或重写其历史；任何 visibility、历史清理或存储迁移都需要单独明确授权。用户提供或指定的项目资源状态为 `RIGHTS_STATUS: PASS_BY_USER_AUTHORIZATION`；隐私、Source 不可变和发布工程门禁独立执行。

## 音频策略

当前 12 册音频位于 `public/audio/carmela-s1/`，播放器使用 `preload="none"`。音频路径只在用户主动播放或操作原生控件后挂载；不自动播放，不保存播放位置，离开页面后释放当前音频。P3B 已验证 206 Range、seek、错误恢复和路由清理。

Work Cells 不接入音频，`hasAudio` 必须保持 `false`。

如果 Carmela 音频路径不可访问，页面会显示友好提示，其他伴读内容仍可使用。

## Work Cells 主题媒体策略

P4B 后 Work Cells 详情页必须遵循：

- 初始只请求一张主题 Hero 缩略图；
- 科学小站解释图初始请求为 0；
- 关联漫画页面初始请求为 0；
- 展开当前媒体组时才挂载图片；
- 灯箱只浏览当前内容组；
- print 不触发媒体请求；
- FR-P5 之后的维护版继续使用确定性的响应式 WebP、`srcset` 与按需加载；任何质量或尺寸变化必须新建维护策略并重建 manifest，不得手工替换派生图。

## 体积检查

每次发布前运行：

```bash
npm run verify:release
```

然后检查：

- runtime generated tree 是否 deterministic 且 current；
- `dist` 总体积是否符合阶段预算；
- `dist` 中没有 `source/`、PDF、EPUB、authoring manifest、page map 或 OCR 中间文件；
- Carmela 音频只包含当前发布副本；
- Work Cells 详情仍保持 3 个 JSON 请求，旧 manifest/page-map 请求为 0；
- P4B 新增代码不改变 P4A runtime manifest，除非有明确 schema 修复证据。

GitHub Actions 只运行：

```bash
npm run verify:public-release
```

该命令必须能在只含 Git tracked files 的干净 checkout 中通过，不能隐式依赖本机 pages、generated、Work Cells authoring images 或 `source/`。

P4A 最终基线：

- runtime：31 个文件 / 393,121 B；
- 五类路由 JSON 请求：1 / 2 / 4 / 2 / 3；
- `dist`：835,921,437 B；
- Work Cells authoring manifest 与 page map 不进入 `dist`；
- runtime、构建、Pages 在 Windows/Linux checkout 下 byte-identical；
- exact-SHA Pages 与线上请求合同通过。

更早的 P0/P2/P3 体积数据继续作为历史测量保留，不是当前发布基线。后续 FR-P5 才处理响应式媒体派生、runtime 引用媒体边界和 Pages artifact 深度优化。
