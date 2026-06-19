# Domain Docs

工程技能读代码前，按下面规则找项目说明。

## 先读这些（有就读，没有就跳过）

- 根目录 **`CONTEXT.md`** — 项目术语和模块说明
- **`docs/adr/`** — 重要技术决定记录

若文件不存在，不要提醒用户去建，需要时由 `/grill-with-docs` 等技能慢慢补。

## 布局

单上下文（本仓库）：

```
shiloku/
├── CONTEXT.md
├── docs/adr/
├── index.html
├── aether-music.css
└── scripts/
```

## 用词

写 issue、重构建议、测试名时，优先用 `CONTEXT.md` 里的叫法。
