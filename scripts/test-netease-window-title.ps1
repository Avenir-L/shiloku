$source=Join-Path $PSScriptRoot 'sync-status.ps1'
$tokens=$null;$errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($source,[ref]$tokens,[ref]$errors)
$fn=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Parse-NeteaseWindowTitle'},$true)
Invoke-Expression $fn.Extent.Text
$config=[pscustomobject]@{windowTitleSuffixes=@('网易云音乐');neteaseIdleWindowTitles=@('网易云音乐')}
foreach($title in @('桌面歌词','桌面歌词 - 网易云音乐','网易云音乐 - 桌面歌词')){if($null -ne (Parse-NeteaseWindowTitle $title)){throw "Auxiliary window treated as a song: $title"}}
$song=Parse-NeteaseWindowTitle 'more than words - 羊文学'
if($song.Title -ne 'more than words' -or $song.Artist -ne '羊文学'){throw 'Valid song parsing regressed'}
if((Parse-NeteaseWindowTitle '桌面歌词之歌 - 测试歌手').Title -ne '桌面歌词之歌'){throw 'Song title incorrectly excluded'}
Write-Output 'Auxiliary window filtering and real song parsing passed.'
