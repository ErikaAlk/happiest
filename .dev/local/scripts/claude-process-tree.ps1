$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine
$byId = @{}
foreach ($p in $all) { $byId[[int]$p.ProcessId] = $p }
foreach ($p in $all | Where-Object { $_.Name -match 'claude' -or $_.CommandLine -match 'claude-code|claude\.exe|cli\.js' }) {
  $chain = @()
  $cur = $p
  for ($i = 0; $i -lt 4 -and $cur; $i++) {
    $cmd = if ($cur.CommandLine) { $cur.CommandLine.Substring(0, [Math]::Min(90, $cur.CommandLine.Length)) } else { '' }
    $chain += "$($cur.ProcessId) $($cur.Name) [$cmd]"
    $cur = $byId[[int]$cur.ParentProcessId]
  }
  Write-Output ($chain -join "  <-  ")
}
