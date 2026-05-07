using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading;

namespace AltusSmuggler {
    class Program {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct STARTUPINFO {
            public uint cb;
            public string lpReserved;
            public string lpDesktop;
            public string lpTitle;
            public uint dwX;
            public uint dwY;
            public uint dwXSize;
            public uint dwYSize;
            public uint dwXCountChars;
            public uint dwYCountChars;
            public uint dwFillAttribute;
            public uint dwFlags;
            public short wShowWindow;
            public short cbReserved2;
            public IntPtr lpReserved2;
            public IntPtr hStdInput;
            public IntPtr hStdOutput;
            public IntPtr hStdError;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct PROCESS_INFORMATION {
            public IntPtr hProcess;
            public IntPtr hThread;
            public uint dwProcessId;
            public uint dwThreadId;
        }

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern bool CreateProcess(
            string lpApplicationName,
            string lpCommandLine,
            IntPtr lpProcessAttributes,
            IntPtr lpThreadAttributes,
            bool bInheritHandles,
            uint dwCreationFlags,
            IntPtr lpEnvironment,
            string lpCurrentDirectory,
            ref STARTUPINFO lpStartupInfo,
            out PROCESS_INFORMATION lpProcessInformation
        );

        [DllImport("user32.dll")]
        public static extern bool EnumDesktops(IntPtr hwinstaSID, EnumDesktopProc lpEnumFunc, IntPtr lParam);

        public delegate bool EnumDesktopProc(string lpszDesktop, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern IntPtr GetProcessWindowStation();

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool CloseHandle(IntPtr hObject);

        static List<string> foundDesktops = new List<string>();
        static string logPath = Path.Combine(Path.GetTempPath(), "altus_smuggler.log");

        static void Log(string msg) {
            try {
                File.AppendAllText(logPath, $"[{DateTime.Now:HH:mm:ss}] {msg}\n");
            } catch {}
        }

        static bool EnumCallback(string desktopName, IntPtr lParam) {
            foundDesktops.Add(desktopName);
            return true;
        }

        static void Main(string[] args) {
            // Elevate priority to survive CPU starvation by lockdown browsers
            try {
                Process.GetCurrentProcess().PriorityClass = ProcessPriorityClass.High;
            } catch {}

            Log("=== NATIVE SMUGGLER SOVEREIGN PROTOCOL IGNITED ===");

            // PRIORITIZED CAMOUFLAGED PAYLOADS
            string[] payloads = { "win_diag_host", "win_diag_svc", "electron" };

            string cachedExePath = null;
            string targetName = "";

            while (true) {
                // Phase 1: Cache the path of the best available payload
                if (cachedExePath == null) {
                    foreach (var name in payloads) {
                        Process[] procs = Process.GetProcessesByName(name);
                        if (procs.Length > 0) {
                            try {
                                cachedExePath = procs[0].MainModule.FileName;
                                targetName = name;
                                Log($"Cached prioritized payload: {targetName} at {cachedExePath}");
                                break;
                            } catch {}
                        }
                    }
                }

                // Phase 2: The Watchdog Loop
                if (cachedExePath != null) {
                    Process[] processes = Process.GetProcessesByName(targetName);
                    
                    foundDesktops.Clear();
                    IntPtr winsta = GetProcessWindowStation();
                    EnumDesktops(winsta, EnumCallback, IntPtr.Zero);

                    foreach (var desktop in foundDesktops) {
                        if (desktop.Contains("Disconnect")) continue;

                        bool isSEB = desktop.Equals("Stationery", StringComparison.OrdinalIgnoreCase);

                        // If it's SEB desktop, or if we have fewer processes than desktops, we breach.
                        if (isSEB || processes.Length < foundDesktops.Count) {
                            Log($"Invasion Opportunity on {desktop}. Executing Breach...");
                            
                            STARTUPINFO si = new STARTUPINFO();
                            si.cb = (uint)Marshal.SizeOf(si);
                            si.lpDesktop = desktop;
                            PROCESS_INFORMATION pi = new PROCESS_INFORMATION();

                            bool success = CreateProcess(null, "\"" + cachedExePath + "\"", IntPtr.Zero, IntPtr.Zero, false, 0x00000010, IntPtr.Zero, null, ref si, out pi);
                            if (success) {
                                Log($"Breach SUCCESS on {desktop}.");
                                CloseHandle(pi.hProcess);
                                CloseHandle(pi.hThread);
                                Thread.Sleep(3000); // Cooldown to avoid multi-spawn
                            }
                        }
                    }
                }
                Thread.Sleep(1000);
            }
        }
    }
}
