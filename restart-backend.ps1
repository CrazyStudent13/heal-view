# 重启后端服务脚本
Write-Host "正在查找并停止旧的后端进程..." -ForegroundColor Yellow

# 查找运行 app.js 的 node 进程
$process = Get-WmiObject Win32_Process | Where-Object {
    $_.CommandLine -like "*src/app.js*"
}

if ($process) {
    Write-Host "找到进程 ID: $($process.ProcessId)" -ForegroundColor Green
    try {
        Stop-Process -Id $process.ProcessId -Force
        Write-Host "已停止旧进程" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } catch {
        Write-Host "无法自动停止进程，请手动在终端按 Ctrl+C 停止" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "未找到运行中的后端进程" -ForegroundColor Yellow
}

Write-Host "`n启动新的后端服务..." -ForegroundColor Cyan
Set-Location backend
npm start
