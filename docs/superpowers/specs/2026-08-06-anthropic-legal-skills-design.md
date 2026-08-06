# Anthropic Legal Skills 工作台接入设计

## 目标

把本机已安装的 12 个 Anthropic `claude-for-legal` Skills 作为独立工具部署到“虞律团队 AI 工作台”，并建立团队可访问的 GitHub 保存库。

## 接入方式

- 新增分类 `Anthropic Legal`，每个 Skill 使用独立卡片和详情页。
- 卡片只提供本地 Codex 调用说明及 GitHub 源码入口，不增加上传功能。
- GitHub 仓库保存原始安装快照、Apache 2.0 许可、来源和本地化警示。
- 每个入口明确原始 Claude/美国法口径及律师复核边界。

## 验收

- 工作台工具总数为 20，其中 Anthropic Legal 为 12 项。
- 12 个详情页均显示 `$skill-name` 调用方式和对应 GitHub 目录。
- GitHub 仓库不含客户材料、访问凭证或个人配置。
