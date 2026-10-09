param([Parameter(Mandatory)][string]$LockPath)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
public static class CodexFileUsers {
    [StructLayout(LayoutKind.Sequential)]
    struct Overlapped { public UIntPtr Internal, InternalHigh; public uint Offset, OffsetHigh; public IntPtr Event; }
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool LockFileEx(Microsoft.Win32.SafeHandles.SafeFileHandle file, uint flags, uint reserved, uint low, uint high, ref Overlapped overlapped);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool UnlockFileEx(Microsoft.Win32.SafeHandles.SafeFileHandle file, uint reserved, uint low, uint high, ref Overlapped overlapped);
    public static bool IsLocked(string path) {
        using (var file = File.Open(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete)) {
            var overlapped = new Overlapped();
            if (LockFileEx(file.SafeFileHandle, 3, 0, uint.MaxValue, uint.MaxValue, ref overlapped)) {
                if (!UnlockFileEx(file.SafeFileHandle, 0, uint.MaxValue, uint.MaxValue, ref overlapped)) Check(Marshal.GetLastWin32Error());
                return false;
            }
            int error = Marshal.GetLastWin32Error();
            if (error == 33) return true;
            Check(error);
            return false;
        }
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct UniqueProcess { public uint pid; public System.Runtime.InteropServices.ComTypes.FILETIME start; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct ProcessInfo {
        public UniqueProcess process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string appName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string serviceName;
        public uint appType;
        public uint status;
        public uint sessionId;
        [MarshalAs(UnmanagedType.Bool)] public bool restartable;
    }
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmStartSession(out uint session, uint flags, string key);
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmRegisterResources(uint session, uint files, string[] names, uint apps, IntPtr processes, uint services, IntPtr serviceNames);
    [DllImport("rstrtmgr.dll")]
    static extern int RmGetList(uint session, out uint needed, ref uint count, [In, Out] ProcessInfo[] infos, out uint reasons);
    [DllImport("rstrtmgr.dll")]
    static extern int RmEndSession(uint session);
    static void Check(int result) { if (result != 0) throw new System.ComponentModel.Win32Exception(result); }
    public static ProcessInfo[] Read(string path) {
        uint session;
        Check(RmStartSession(out session, 0, Guid.NewGuid().ToString("N")));
        try {
            Check(RmRegisterResources(session, 1, new string[] { path }, 0, IntPtr.Zero, 0, IntPtr.Zero));
            uint count = 0, needed, reasons;
            ProcessInfo[] infos = new ProcessInfo[0];
            int result;
            do {
                result = RmGetList(session, out needed, ref count, infos, out reasons);
                if (result == 234) { count = needed; infos = new ProcessInfo[count]; }
            } while (result == 234);
            Check(result);
            Array.Resize(ref infos, (int)count);
            return infos;
        } finally { Check(RmEndSession(session)); }
    }
}
'@
$targetOwners = @()
if ([CodexFileUsers]::IsLocked($LockPath)) { $targetOwners = @([CodexFileUsers]::Read($LockPath)) }
$results = foreach ($owner in $targetOwners) {
    $ownerPid = $owner.process.pid
    $ownedPaths = @(Get-ChildItem -LiteralPath (Split-Path -LiteralPath $LockPath) -File -Filter '*.lock' |
        Where-Object Name -ne '.coordination.lock' | ForEach-Object {
            if ([CodexFileUsers]::IsLocked($_.FullName) -and @([CodexFileUsers]::Read($_.FullName) | Where-Object { $_.process.pid -eq $ownerPid }).Count -gt 0) { $_.FullName }
        })
    $ticks = ([long]$owner.process.start.dwHighDateTime -shl 32) -bor ([long]$owner.process.start.dwLowDateTime -band 0xffffffffL)
    [pscustomobject]@{ pid = $ownerPid; startedAt = [DateTime]::FromFileTimeUtc($ticks).ToString('O'); paths = $ownedPaths }
}
ConvertTo-Json -InputObject @($results) -Compress -Depth 4
