# Build Docker image with environment variables from .env.local
# Usage: .\docker-build.ps1

if (-not (Test-Path .env.local)) {
    Write-Error "Error: .env.local file not found"
    Write-Host "Please create .env.local file with required environment variables"
    exit 1
}

# Read .env.local and convert to --build-arg format
$buildArgs = @()
Get-Content .env.local | ForEach-Object {
    $line = $_.Trim()
    # Skip comments and empty lines
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split '=', 2
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim().Trim('"').Trim("'")
            $buildArgs += "--build-arg"
            $buildArgs += "$key=$value"
        }
    }
}

# Build the image
Write-Host "Building Docker image with environment variables..." -ForegroundColor Green
$cmd = "docker build $($buildArgs -join ' ') -t app-chat-fe ."
Invoke-Expression $cmd

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Build complete! Run the container with:" -ForegroundColor Green
    Write-Host "docker run -p 8080:8080 --env-file .env.local app-chat-fe" -ForegroundColor Yellow
} else {
    Write-Error "Build failed with exit code $LASTEXITCODE"
}
