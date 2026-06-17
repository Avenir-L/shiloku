' 开机自启：最小化运行状态同步（无弹窗打扰）
Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
batPath = scriptDir & "\start-status-sync.bat"
WshShell.Run """" & batPath & """ auto", 7, False
