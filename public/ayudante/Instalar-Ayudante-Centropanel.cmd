@echo off
echo.
echo  Ayudante de Centropanel - instalacion
echo  ---------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -Command "$m='#PS-'+'INICIO'; $t=[IO.File]::ReadAllText('%~f0'); Invoke-Expression $t.Substring($t.IndexOf($m)+$m.Length)"
echo.
pause
exit /b
#PS-INICIO
$ErrorActionPreference = 'Stop'
$carpeta = Join-Path $env:LOCALAPPDATA 'CentropanelAyudante'
New-Item -ItemType Directory -Force $carpeta | Out-Null

# Si ya habia una version corriendo, se detiene antes de reemplazarla.
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -like '*CentropanelAyudante*Ayudante.ps1*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

$script = @'
# Ayudante Centropanel: deja correos en la bandeja de salida de Outlook (con entrega
# programada, desde la cuenta de la persona) y abre el chat de WhatsApp con el mensaje y
# los archivos listos.
#
# Seguridad: escucha solo en este computador (127.0.0.1); solo atiende a las direcciones
# exactas del sistema de Centropanel; y exige la clave de emparejamiento que se genero al
# instalarlo. Sin esa clave no hace nada: ninguna otra pagina web puede darle ordenes.
param([string]$Clave = '')
$ErrorActionPreference = 'Stop'
$Version = '3'
$Puerto = 47931
$Carpeta = Join-Path $env:LOCALAPPDATA 'CentropanelAyudante'
$Origenes = @(
  'https://sist-gest-centropanel.vercel.app',
  'https://sist-gest-centropanel-git-sandbox-centropanel.vercel.app',
  'http://localhost:3000'
)

$mutex = New-Object System.Threading.Mutex($false, 'Local\CentropanelAyudante')
if (-not $mutex.WaitOne(0)) { exit }

# La clave viene por parametro (pruebas) o del archivo que dejo el instalador.
if (-not $Clave) {
  $archivoClave = Join-Path $Carpeta 'clave.txt'
  if (-not (Test-Path $archivoClave)) { exit }
  $Clave = (Get-Content $archivoClave -Raw).Trim()
}
if ($Clave.Length -lt 16) { exit }

Add-Type -AssemblyName System.Web.Extensions
$json = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$json.MaxJsonLength = [int]::MaxValue

$carpetaWa = Join-Path $env:TEMP 'CentropanelWhatsApp'
if (Test-Path $carpetaWa) {
  Get-ChildItem $carpetaWa -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

function Responder($ctx, [int]$codigo, $cuerpo) {
  $r = $ctx.Response
  $origen = $ctx.Request.Headers['Origin']
  if ($origen -and ($Origenes -contains $origen)) {
    $r.Headers['Access-Control-Allow-Origin'] = $origen
    $r.Headers['Vary'] = 'Origin'
    $r.Headers['Access-Control-Allow-Private-Network'] = 'true'
    $r.Headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    $r.Headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Clave'
    $r.Headers['Access-Control-Max-Age'] = '600'
  }
  $r.StatusCode = $codigo
  if ($null -ne $cuerpo) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($json.Serialize($cuerpo))
    $r.ContentType = 'application/json; charset=utf-8'
    $r.ContentLength64 = $bytes.Length
    $r.OutputStream.Write($bytes, 0, $bytes.Length)
  }
  $r.Close()
}

function Nombre-Seguro([string]$n) {
  $n = ($n -replace '[\\/:*?"<>|]', '_').Trim()
  if (-not $n) { $n = 'archivo' }
  return $n
}

function Guardar-Adjuntos($adjuntos, [string]$carpeta) {
  $rutas = @()
  if (-not $adjuntos) { return $rutas }
  New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
  foreach ($a in $adjuntos) {
    $ruta = Join-Path $carpeta (Nombre-Seguro $a['nombre'])
    [IO.File]::WriteAllBytes($ruta, [Convert]::FromBase64String([string]$a['base64']))
    $rutas += $ruta
  }
  return $rutas
}

function Outlook-Disponible { return [bool](Get-ItemProperty 'Registry::HKEY_CLASSES_ROOT\Outlook.Application' -ErrorAction SilentlyContinue) }
function Whatsapp-Disponible { return [bool](Get-ItemProperty 'Registry::HKEY_CLASSES_ROOT\whatsapp' -ErrorAction SilentlyContinue) }

# Las cuentas de correo que tiene Outlook, para elegir desde cual sale el mensaje.
function Outlook-Cuentas {
  $ol = New-Object -ComObject Outlook.Application
  $lista = @()
  foreach ($c in $ol.Session.Accounts) { $lista += [string]$c.SmtpAddress }
  return $lista
}

# Correo nuevo en Outlook, desde la cuenta `desde`: con fecha queda en la bandeja de salida
# esperando la hora; sin fecha se abre para revisarlo.
function Outlook-Correo($d) {
  $desde = ([string]$d['desde']).Trim()
  $carpeta = Join-Path $env:TEMP ('CentropanelOutlook_' + [guid]::NewGuid().ToString('N'))
  try {
    $ol = New-Object -ComObject Outlook.Application
    $cuenta = $null
    foreach ($c in $ol.Session.Accounts) { if ([string]$c.SmtpAddress -ieq $desde) { $cuenta = $c } }
    if (-not $cuenta) {
      return @{ ok = $false; motivo = "Outlook no tiene la cuenta $desde. Agreguela en Outlook (Archivo > Agregar cuenta) para enviar desde ahi." }
    }
    $rutas = Guardar-Adjuntos $d['adjuntos'] $carpeta
    $m = $ol.CreateItem(0)
    $m.SendUsingAccount = $cuenta
    $m.To = [string]$d['para']
    $m.Subject = [string]$d['asunto']
    $m.Body = [string]$d['cuerpo']
    foreach ($ruta in $rutas) { $m.Attachments.Add($ruta) | Out-Null }
    $enviarEn = [string]$d['enviar_en']
    if ($enviarEn) {
      $cuando = [datetime]::Parse($enviarEn, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind).ToLocalTime()
      if ($cuando -le (Get-Date)) { $cuando = (Get-Date).AddMinutes(1) }
      $m.DeferredDeliveryTime = $cuando
      $m.Send()
      return @{ ok = $true; estado = 'bandeja_de_salida'; enviar_en = $cuando.ToString('s'); desde = $desde }
    }
    $m.Display()
    return @{ ok = $true; estado = 'abierto'; desde = $desde }
  } finally {
    if (Test-Path $carpeta) { Remove-Item $carpeta -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

# Saca de la bandeja de salida el correo programado (mismo asunto y destinatario).
function Outlook-Cancelar($d) {
  $ol = New-Object -ComObject Outlook.Application
  $salida = $ol.Session.GetDefaultFolder(4)
  $quitados = 0
  for ($i = $salida.Items.Count; $i -ge 1; $i--) {
    $it = $salida.Items.Item($i)
    if ($it.Subject -eq [string]$d['asunto'] -and ($it.To -like ('*' + [string]$d['para'] + '*'))) { $it.Delete(); $quitados++ }
  }
  return @{ ok = $true; quitados = $quitados }
}

# Abre el chat del contacto con el mensaje escrito; los archivos quedan en el portapapeles
# para pegarlos con Ctrl+V.
function Whatsapp-Abrir($d) {
  $tel = ([string]$d['telefono']) -replace '\D', ''
  if (-not $tel) { return @{ ok = $false; motivo = 'Falta el telefono.' } }
  $rutas = Guardar-Adjuntos $d['adjuntos'] (Join-Path $carpetaWa ([guid]::NewGuid().ToString('N')))
  if ($rutas.Count -gt 0) { Set-Clipboard -Path $rutas }
  $texto = [Uri]::EscapeDataString([string]$d['texto'])
  if ($d['solo_preparar']) { return @{ ok = $true; archivos = $rutas.Count; via = 'preparado' } }
  if (Whatsapp-Disponible) {
    Start-Process ("whatsapp://send?phone=$tel&text=$texto")
    # Con archivos, se espera a que el chat este abierto y se pegan solos: queda la vista
    # previa con los adjuntos, lista para revisar y enviar.
    $pegado = $false
    if ($rutas.Count -gt 0) {
      try {
        Start-Sleep -Milliseconds 3500
        $sh = New-Object -ComObject WScript.Shell
        if ($sh.AppActivate('WhatsApp')) {
          Start-Sleep -Milliseconds 500
          $sh.SendKeys('^v')
          $pegado = $true
        }
      } catch { }
    }
    return @{ ok = $true; archivos = $rutas.Count; via = 'escritorio'; pegado = $pegado }
  }
  Start-Process ("https://wa.me/$tel?text=$texto")
  return @{ ok = $true; archivos = $rutas.Count; via = 'web' }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Puerto/")
$listener.Start()

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $origen = $ctx.Request.Headers['Origin']
    $ruta = $ctx.Request.Url.AbsolutePath
    $metodo = $ctx.Request.HttpMethod
    if ($metodo -eq 'OPTIONS') { Responder $ctx 204 $null; continue }
    # Direccion exacta del sistema: cualquier otra pagina queda fuera.
    if (-not $origen -or ($Origenes -notcontains $origen)) { Responder $ctx 403 @{ ok = $false; motivo = 'Origen no permitido.' }; continue }

    $pareado = ($ctx.Request.Headers['X-Clave'] -ceq $Clave)
    if ($metodo -eq 'GET' -and $ruta -eq '/estado') {
      if (-not $pareado) { Responder $ctx 200 @{ ok = $true; version = $Version; pareado = $false }; continue }
      Responder $ctx 200 @{ ok = $true; version = $Version; pareado = $true; outlook = (Outlook-Disponible); whatsapp = (Whatsapp-Disponible); cuentas = @(Outlook-Cuentas) }
      continue
    }
    # Todo lo demas exige la clave de emparejamiento.
    if (-not $pareado) { Responder $ctx 401 @{ ok = $false; motivo = 'Falta emparejar este computador con el sistema.' }; continue }
    if ($metodo -eq 'POST') {
      $lector = New-Object IO.StreamReader($ctx.Request.InputStream, [Text.Encoding]::UTF8)
      $d = $json.DeserializeObject($lector.ReadToEnd())
      switch ($ruta) {
        '/outlook/correo'   { Responder $ctx 200 (Outlook-Correo $d); break }
        '/outlook/cancelar' { Responder $ctx 200 (Outlook-Cancelar $d); break }
        '/whatsapp/abrir'   { Responder $ctx 200 (Whatsapp-Abrir $d); break }
        default             { Responder $ctx 404 @{ ok = $false; motivo = 'No existe.' } }
      }
      continue
    }
    Responder $ctx 404 @{ ok = $false; motivo = 'No existe.' }
  } catch {
    try { Responder $ctx 500 @{ ok = $false; motivo = $_.Exception.Message } } catch { }
  }
}
'@
Set-Content -Path (Join-Path $carpeta 'Ayudante.ps1') -Value $script -Encoding UTF8

# La clave de emparejamiento: se conserva si ya existia, para no tener que volver a pegarla.
$archivoClave = Join-Path $carpeta 'clave.txt'
if (-not (Test-Path $archivoClave)) {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $nueva = ([BitConverter]::ToString($bytes) -replace '-', '').ToLower()
  Set-Content -Path $archivoClave -Value $nueva -NoNewline
}
$clave = (Get-Content $archivoClave -Raw).Trim()

# Arranca solo al iniciar sesion en Windows (acceso directo en la carpeta Inicio, sin permisos de administrador).
$ws = New-Object -ComObject WScript.Shell
$acceso = $ws.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'Ayudante Centropanel.lnk'))
$acceso.TargetPath = 'powershell.exe'
$acceso.Arguments = "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$carpeta\Ayudante.ps1`""
$acceso.WindowStyle = 7
$acceso.Save()

Start-Process powershell.exe -ArgumentList '-NoProfile','-STA','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',"$carpeta\Ayudante.ps1" -WindowStyle Hidden
Set-Clipboard -Value $clave

Write-Host ''
Write-Host ' Listo. El ayudante quedo instalado y funcionando.' -ForegroundColor Green
Write-Host ''
Write-Host ' Clave de emparejamiento (ya esta copiada al portapapeles):'
Write-Host "   $clave" -ForegroundColor Yellow
Write-Host ''
Write-Host ' Ahora abra el sistema de Centropanel, vaya a la pagina "Ayudante de Outlook y WhatsApp"'
Write-Host ' y pegue esa clave una sola vez.'
