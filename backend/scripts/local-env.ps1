# Dot-source this script to configure only the current PowerShell process.
& {
    $ErrorActionPreference = 'Stop'
    $localDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) '.local'
    $secretNames = @('postgres-dev-password', 'postgres-test-password', 'jwt-secret')
    if (Test-Path -LiteralPath $localDirectory) {
        $directory = Get-Item -LiteralPath $localDirectory -Force
        if (-not $directory.PSIsContainer -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'The local secrets path must be a regular directory.'
        }
    }

    # Validate every existing file before creating any missing secret.
    $values = @{}
    foreach ($name in $secretNames) {
        $path = Join-Path $localDirectory $name
        if (Test-Path -LiteralPath $path) {
            $file = Get-Item -LiteralPath $path -Force
            if ($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                throw "Invalid secret file: $name. Existing files were not overwritten."
            }
            $value = [IO.File]::ReadAllText($path)
            if ($value -cnotmatch '\A[0-9a-f]{64}\z') {
                throw "Invalid secret format: $name. Restore the original file; do not regenerate credentials for an existing database."
            }
            $values[$name] = $value
        }
    }

    [void][IO.Directory]::CreateDirectory($localDirectory)
    foreach ($name in $secretNames) {
        if (-not $values.ContainsKey($name)) {
            $bytes = New-Object byte[] 32
            $random = [Security.Cryptography.RandomNumberGenerator]::Create()
            try { $random.GetBytes($bytes) } finally { $random.Dispose() }
            $value = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
            $path = Join-Path $localDirectory $name
            # CreateNew fails on concurrent creation rather than replacing credentials.
            $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
            try {
                $encoded = [Text.Encoding]::ASCII.GetBytes($value)
                $stream.Write($encoded, 0, $encoded.Length)
            } finally { $stream.Dispose() }
            $values[$name] = $value
        }
    }

    $env:DATABASE_URL = 'postgres://padelmatch:{0}@127.0.0.1:15432/padelmatch?sslmode=disable' -f $values['postgres-dev-password']
    $env:TEST_DATABASE_URL = 'postgres://padelmatch:{0}@127.0.0.1:15433/padelmatch_test?sslmode=disable' -f $values['postgres-test-password']
    $env:JWT_SECRET = $values['jwt-secret']
}
