# ============================================================
# Genera el par de llaves VAPID (curva P-256) para Web Push.
# No necesita Node ni nada instalado: usa .NET de Windows.
#
#   powershell -ExecutionPolicy Bypass -File portal\supabase\vapid-keys.ps1
#
# - La PÚBLICA va en portal/js/config.js → VAPID_PUBLIC_KEY
#   y en el secreto VAPID_PUBLIC_KEY de la Edge Function.
# - La PRIVADA va SOLO en el secreto VAPID_PRIVATE_KEY de Supabase.
#   Nunca en el repo, nunca en el navegador, nunca en un chat.
#
# Genera llaves nuevas cada vez: córrelo UNA sola vez. Si cambias
# las llaves, todos los dispositivos tienen que volver a activar
# las notificaciones (el portal lo hace solo al entrar).
# ============================================================
$ErrorActionPreference = "Stop"

function ConvertTo-Base64Url([byte[]] $bytes) {
  [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$curva = [System.Security.Cryptography.ECCurve]::CreateFromFriendlyName("nistP256")
$ec = [System.Security.Cryptography.ECDsa]::Create($curva)
$p = $ec.ExportParameters($true)

# llave pública sin comprimir: 0x04 || X || Y  (65 bytes)
$publica = [byte[]](@(4) + $p.Q.X + $p.Q.Y)
$privada = $p.D

if ($publica.Length -ne 65 -or $privada.Length -ne 32) {
  throw "Llaves con tamaño inesperado ($($publica.Length)/$($privada.Length)). Vuelve a intentar."
}

Write-Host ""
Write-Host "VAPID_PUBLIC_KEY  = $(ConvertTo-Base64Url $publica)"
Write-Host "VAPID_PRIVATE_KEY = $(ConvertTo-Base64Url $privada)"
Write-Host ""
Write-Host "Guarda la privada directo en Supabase y cierra esta ventana." -ForegroundColor Yellow
$ec.Dispose()
