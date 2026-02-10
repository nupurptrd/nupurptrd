# Test Gemini connection
$uri = "http://localhost:3000/api/health/gemini"

try {
    $response = Invoke-WebRequest -Uri $uri -Method GET
    Write-Host "✅ Gemini API Status:" -ForegroundColor Green
    Write-Host $response.Content
} catch {
    Write-Host "❌ Connection Failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}