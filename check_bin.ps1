$shell = New-Object -ComObject Shell.Application
$recycleBin = $shell.Namespace(10)
foreach ($item in $recycleBin.Items()) {
    Write-Host "Item: $($item.Name) from $($item.Path)"
}
