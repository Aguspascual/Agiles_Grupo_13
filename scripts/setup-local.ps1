$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot '.env'

if (Test-Path -LiteralPath $envPath) {
    Write-Error 'Ya existe .env; no se modificó.'
    exit 1
}

function New-RandomHex([int] $byteCount) {
    $bytes = New-Object byte[] $byteCount
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
        return [System.BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $rng.Dispose()
    }
}

$postgresPassword = New-RandomHex 32
$jwtSecret = New-RandomHex 32
$content = @(
    'POSTGRES_DB=padelmatch'
    'POSTGRES_USER=padelmatch'
    "POSTGRES_PASSWORD=$postgresPassword"
    "JWT_SECRET=$jwtSecret"
    'FRONTEND_PORT=8081'
    'API_PORT=8000'
    'DB_PORT=5433'
) -join [System.Environment]::NewLine
$content += [System.Environment]::NewLine
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)

try {
    $stream = [System.IO.File]::Open(
        $envPath,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::None
    )
    try {
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush()
    }
    finally {
        $stream.Dispose()
    }
}
catch [System.IO.IOException] {
    Write-Error 'No se pudo crear .env; puede que ya exista. No se sobrescribió ningún archivo.'
    exit 1
}

Write-Output 'Se creó .env con secretos aleatorios. Los valores no se muestran en pantalla.'
