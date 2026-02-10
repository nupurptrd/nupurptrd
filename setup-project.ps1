# Create directories
$dirs = @(
    'src/common/filters',
    'src/common/decorators',
    'src/common/logger',
    'src/prisma',
    'src/auth/strategies',
    'src/books/services',
    'src/books/dto',
    'src/series/services',
    'src/series/dto',
    'src/episodes/services',
    'src/episodes/dto',
    'src/workspaces',
    'src/health',
    'prisma'
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Write-Host "✅ Created: $dir"
}

Write-Host "`n✅ All directories created!"