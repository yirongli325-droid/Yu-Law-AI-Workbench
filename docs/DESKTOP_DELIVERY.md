# 桌面候选版交付说明

## 交付内容

- 源码与锁定依赖：`package.json`、`package-lock.json`
- 第三方声明：`THIRD_PARTY_NOTICES.md`
- 软件物料信息：`docs/SBOM.json`（CycloneDX JSON）
- 自动验证：`npm run verify:desktop`

## Windows 可重复构建

仓库维护者可以从 GitHub Actions 手动运行 `Build Windows EXE`，在原生 Windows Server 2022 构建机生成单文件 `YuLawWorkbench.exe` 和 `SHA256SUMS.txt`。

`Build macOS App` 会分别在 Apple Silicon 和 Intel 构建机生成对应的 `.dmg`。应用采用临时签名以验证包结构，但没有 Apple Developer ID 公证；首次启动时用户可能需要在“隐私与安全性”中确认打开。

前提：Windows 11 x64、Git、Node.js 22.13.0，以及可联网访问 npm 注册表的构建环境。发布管理员须从交付清单取得受信任仓库 URL 和完整的 40 位 Git 修订号。创建一个不含客户材料的全新临时目录；不要清理或复用日常工作目录。随后在 PowerShell 中执行（替换前两行占位值）：

```powershell
$Repository = "https://受信任仓库.example/yu-law-ai-workbench.git"
$Revision = "交付清单中的40位Git修订号"
git clone --no-checkout $Repository yu-law-ai-workbench
Set-Location yu-law-ai-workbench
git checkout --detach $Revision
if ((git rev-parse HEAD).Trim() -ne $Revision) { throw "检出的修订号不匹配" }
if (git status --porcelain) { throw "构建目录不是干净检出" }
if ((node --version).Trim() -ne "v22.13.0") { throw "需要 Node.js v22.13.0" }
npm ci
node --version
npm --version
npm run verify:desktop
Get-ChildItem dist -File -Recurse | Sort-Object FullName |
  Get-FileHash -Algorithm SHA256 |
  Format-Table Hash, Path -AutoSize
```

`npm ci` 必须严格使用 `package-lock.json`；不得在构建中运行 `npm install` 或更新锁文件。`verify:desktop` 已包含类型检查、vinext/Vite 构建、Lint、现有测试、provider/命令/状态/持久化/UI 相关测试、凭据扫描和交付资料检查。候选构建输出位于 `dist/`；以上 SHA-256 清单用于核对同一次构建的文件，不代表代码签名。交付前保留 Git 修订号、命令退出码、Node/npm 版本、文件哈希和构建日志的脱敏副本。组织如需离线构建，应使用经过审核且与锁文件一致的 npm 镜像。

## 发布核对

1. 在干净检出中执行上述命令且全部退出码为 0。
2. 确认凭据扫描通过，构建日志、数据库和输出中没有认证信息或客户材料。
3. 核对 SBOM 和第三方声明与锁文件同批交付。
4. 在目标 Windows 用户环境分别验证所需官方 CLI 的安装和登录状态。
5. 用非客户测试材料完成确认、执行、取消/失败重试和打开成果流程。

## 已知限制

- 当前桌面程序使用 Python/Tkinter 与 PyInstaller `onefile` 模式，不需要 Electron/Tauri 或安装器；生成的是免安装绿色版 `YuLawWorkbench.exe`。它尚未进行商业代码签名，因此 Windows SmartScreen 仍可能显示未知发布者提示。
- Linux 构建机不能替代 Windows 安装、SmartScreen 和签名验证。发布安装包前必须另建 Windows 打包任务。
- 自动化 provider 旅程使用受控替身，不会消费真实订阅，也不能证明目标电脑已登录；真实登录状态须通过官方 CLI 验证。
- SBOM 是基于锁文件的发布物料快照；依赖变化后须重新生成并复核许可证与漏洞信息。
- AI 输出可能不准确且不构成最终法律意见，必须由律师复核。

## 故障处理与隐私

仅收集最少的脱敏诊断信息：命令名称、版本、退出码、任务状态和非敏感日志摘要。不得要求用户发送凭据或完整客户材料。认证问题应回到官方 CLI 登录流程；构建或依赖问题应在干净检出中用锁文件复现。
