param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8096
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')

# 读取最新的用户工具路径，包括通过 WinGet 安装的 Watchman。
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$env:APP_ENV = 'internaldev'
$env:NODE_OPTIONS = '--dns-result-order=ipv4first'
$env:EXPO_PACKAGER_PROXY_URL = "http://127.0.0.1:$Port"

Write-Host "启动 Happiest 开发服务：$env:EXPO_PACKAGER_PROXY_URL"
& yarn.cmd start --port $Port --dev-client --host localhost --max-workers 2
exit $LASTEXITCODE
