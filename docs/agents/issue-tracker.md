# Issue tracker: Local Markdown

本仓库用本地 Markdown 管理任务，适合个人项目，不需要会 GitHub Issues。

## 目录约定

- 每个功能一个文件夹：`.scratch/<功能英文名>/`
- 需求说明：`.scratch/<功能英文名>/PRD.md`
- 具体任务：`.scratch/<功能英文名>/issues/01-xxx.md`（从 01 编号）
- 任务状态写在文件顶部的 `Status:` 行（见 `triage-labels.md`）
- 讨论记录写在文件底部 `## Comments` 下

## 技能要「发布任务」时

在 `.scratch/` 下新建或更新对应 Markdown 文件。

## 技能要「读取任务」时

读取用户给出的路径，或 `.scratch/` 里对应的 issue 文件。
