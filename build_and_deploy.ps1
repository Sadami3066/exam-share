# 1. 构建前端
Write-Host "正在构建前端..."
Set-Location "client"
npm install
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "前端构建失败"
    exit 1
}
Set-Location ".."

# 2. 准备后端目录
Write-Host "正在部署到后端..."
$serverPublicPath = "server\public"
if (!(Test-Path $serverPublicPath)) {
    New-Item -ItemType Directory -Force -Path $serverPublicPath
}

# 3. 清理旧文件 (保留 .gitkeep 等，如果有的话)
Get-ChildItem -Path $serverPublicPath -Recurse | Remove-Item -Force -Recurse

# 4. 复制构建产物
Copy-Item -Path "client\dist\*" -Destination $serverPublicPath -Recurse -Force

Write-Host "部署完成！"
Write-Host "请进入 server 目录运行 'npm start' 启动服务。"
Write-Host "访问 http://localhost:3000 即可看到完整应用。"
