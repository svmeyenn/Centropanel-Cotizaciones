@echo off
echo.
echo  Ayudante de Centropanel - desinstalacion
echo  ----------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -Command "$m='#PS-'+'INICIO'; $t=[IO.File]::ReadAllText('%~f0'); Invoke-Expression $t.Substring($t.IndexOf($m)+$m.Length)"
echo.
pause
exit /b
#PS-INICIO
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -like '*CentropanelAyudante*Ayudante.ps1*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Remove-Item (Join-Path ([Environment]::GetFolderPath('Startup')) 'Ayudante Centropanel.lnk') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:LOCALAPPDATA 'CentropanelAyudante') -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:TEMP 'CentropanelWhatsApp') -Recurse -Force -ErrorAction SilentlyContinue
Write-Host ' Listo. El ayudante se desinstalo.' -ForegroundColor Green
