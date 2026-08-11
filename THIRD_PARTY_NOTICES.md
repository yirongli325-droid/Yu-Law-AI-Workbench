# 第三方软件声明

Yu Law 本地 AI 工作台包含开源第三方软件。直接运行时依赖与开发/构建依赖的精确名称和版本以同批交付的 `package-lock.json` 为准，软件物料快照见 `docs/SBOM.json`。

直接依赖许可证清单（版本与许可证字段取自本批 `package-lock.json`）：

| 包 | 许可证 |
| --- | --- |
| drizzle-orm | Apache-2.0 |
| next, react, react-dom | MIT |
| @cloudflare/vite-plugin, @tailwindcss/postcss | MIT |
| @types/node, @types/react, @types/react-dom | MIT |
| @vitejs/plugin-react, @vitejs/plugin-rsc | MIT |
| drizzle-kit, eslint, eslint-config-next | MIT |
| react-server-dom-webpack, tailwindcss | MIT |
| typescript | Apache-2.0 |
| vinext, vite | MIT |
| wrangler | MIT OR Apache-2.0 |

各软件版权归其权利人所有，并按其各自许可证提供。本声明不改变、不替代各包中随附的完整许可证文本。

发布管理员必须在每次依赖更新后使用锁文件重新核对 SBOM 和依赖树，检查每个包随附的许可证与 NOTICE 文件，并在再分发物中保留许可证要求的文本。对未知、缺失或不兼容的许可证应停止发布并进行人工法律复核。

官方 Codex CLI 与 Claude Code CLI 是用户独立安装、登录并受其各自条款约束的外部程序，不随本仓库再分发。
