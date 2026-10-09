# Changelog

## Unreleased

- 手机接管电脑会话时，仅在原进程仍在运行时确认；切换进度等待实际控制状态更新。
- 会话支持“还给电脑”，在 Windows 终端中继续原有对话。
- 修复 Codex 接续时的历史重复与原生历史正文缺失，终端显示消息发送者。

## Release 0.1.2 - 2026-10-04

<!-- happier-release-note-projections:v1
{
  "expo": {
    "message": "Happiest 的第一个版本：可以与正式版 Happier 装在同一台电脑上，互不影响，从自己的发布渠道安装和更新；同时修复了快捷回复误触、消息停在“投递中”和在 Windows 上继续会话的问题。"
  }
}
-->

Happiest 是基于 Happier 的独立版本。第一个版本可以与正式版 Happier 装在同一台电脑上，命令、数据和后台服务各自独立。Happiest 不提供公共服务器，安装后连接你自己搭建的服务器。

- 命令是 `happiest`，数据放在 `~/.happiest`，后台服务、本地服务器和安装脚本都使用 Happiest 自己的名称，不会覆盖 `happier`。
- 从 `ErikaAlk/happiest` 的 GitHub 发布安装和更新，下载的文件按 Happiest 自己的签名公钥校验。
- 桌面应用改名为 Happiest，提供 Windows x64 与 Linux x64 版本。
- 版本号与 Happier 分开编号。
- 快捷回复选中一项后，同组的其他选项立即失效，滚动或连续点击不会再发出相反的选择。
- 修复 Windows 上后台服务约每分钟卡顿数秒的问题。
- 应答超时或断线后，排队的消息会重新核对并送达，不再一直停在“投递中”。
- 手机发起的 Windows 会话可以在 Windows Terminal 中继续；控制台模式和 Windows Terminal 模式打开的窗口都能看到历史对话。
- 中文 Windows 上不用管理员权限也能安装按需启动的后台服务（`happiest service install --no-autostart`）；登录时自动启动仍需要在管理员权限下安装。
