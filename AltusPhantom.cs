using System;
using System.Drawing;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.IO;
using System.Diagnostics;
using System.Linq;
using System.Windows.Automation;

namespace AltusPhantom {
    public class PhantomHUD : Form {
        [DllImport("user32.dll")]
        public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
        [DllImport("user32.dll")]
        public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        [DllImport("user32.dll")]
        public static extern bool SetWindowDisplayAffinity(IntPtr hWnd, uint dwAffinity);
        [DllImport("user32.dll")]
        public static extern bool SetProcessDPIAware();

        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_LAYERED = 0x80000;
        private const int WS_EX_TRANSPARENT = 0x20;
        private const int WS_EX_TOPMOST = 0x8;
        private const int WS_EX_NOACTIVATE = 0x08000000;
        private const uint WDA_EXCLUDEFROMCAPTURE = 0x00000011;

        private string currentAnswer = "OMNI-EXTRACTION ACTIVE. STANDBY FOR INTEL...";
        private bool isThinking = false;
        private List<string> geminiKeys = new List<string>();
        private int currentKeyIndex = 0;
        private string lastExtractedText = "";
        private byte[] lastImageHash = null;

        public PhantomHUD() {
            SetProcessDPIAware(); 

            this.FormBorderStyle = FormBorderStyle.None;
            this.BackColor = Color.Black;
            this.TransparencyKey = Color.Black;
            this.TopMost = true;
            this.ShowInTaskbar = false;
            this.Size = new Size(500, 300);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Text = Guid.NewGuid().ToString(); 

            LoadKeys();
            ApplyStealth();

            var healer = new Timer();
            healer.Interval = 2000;
            healer.Tick += (s, e) => ApplyStealth();
            healer.Start();
            
            var timer = new Timer();
            timer.Interval = 10000; 
            timer.Tick += async (s, e) => { if (!isThinking) await RunHybridSolve(); };
            timer.Start();
        }

        private void LoadKeys() {
            try {
                if (File.Exists("key.txt")) {
                    string raw = File.ReadAllText("key.txt");
                    geminiKeys = raw.Split(new[] { ',', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                                    .Select(k => k.Trim())
                                    .Where(k => !string.IsNullOrEmpty(k))
                                    .ToList();
                }
            } catch {}
        }

        private void ApplyStealth() {
            try {
                int initialStyle = GetWindowLong(this.Handle, GWL_EXSTYLE);
                SetWindowLong(this.Handle, GWL_EXSTYLE, initialStyle | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOPMOST | WS_EX_NOACTIVATE);
                SetWindowDisplayAffinity(this.Handle, WDA_EXCLUDEFROMCAPTURE);
            } catch {}
        }

        protected override void OnPaint(PaintEventArgs e) {
            e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            using (var brush = new SolidBrush(Color.FromArgb(175, 12, 14, 22))) {
                FillRoundedRectangle(e.Graphics, brush, 0, 0, this.Width, this.Height, 20);
            }
            Color glowColor = isThinking ? Color.Cyan : Color.FromArgb(140, 0, 242, 255);
            e.Graphics.DrawString("● SOVEREIGN_EXTRACTOR", new Font("Consolas", 7, FontStyle.Bold), new SolidBrush(glowColor), 15, 10);
            var rect = new RectangleF(15, 30, this.Width - 30, this.Height - 45);
            e.Graphics.DrawString(currentAnswer, new Font("Segoe UI Semibold", 10, FontStyle.Regular), Brushes.White, rect);
        }

        private async Task RunHybridSolve() {
            string extractedText = ExtractTextFromUI();
            
            if (!string.IsNullOrEmpty(extractedText)) {
                if (extractedText == lastExtractedText) return; 
                
                isThinking = true;
                this.Invalidate();
                lastExtractedText = extractedText;
                await CallGemini("SOLVE THIS EXAM QUESTION (UIA): " + extractedText, null);
                isThinking = false;
                this.Invalidate();
            } else {
                isThinking = true;
                this.Invalidate();
                await SolveWithVision();
                isThinking = false;
                this.Invalidate();
            }
        }

        private string ExtractTextFromUI() {
            try {
                StringBuilder sb = new StringBuilder();
                var targets = Process.GetProcesses().Where(p => 
                    p.ProcessName.Contains("MSB") || p.ProcessName.Contains("SafeExam") || 
                    p.ProcessName.Contains("chrome") || p.ProcessName.Contains("msedge")
                );

                foreach (var proc in targets) {
                    if (proc.MainWindowHandle == IntPtr.Zero) continue;
                    AutomationElement root = AutomationElement.FromHandle(proc.MainWindowHandle);
                    AutomationElementCollection children = root.FindAll(TreeScope.Descendants, Condition.TrueCondition);
                    foreach (AutomationElement child in children) {
                        try {
                            string name = child.Current.Name;
                            if (!string.IsNullOrEmpty(name) && name.Length > 45) sb.Append(name + " ");
                        } catch {}
                    }
                }
                return sb.ToString().Trim();
            } catch { return null; }
        }

        private async Task SolveWithVision() {
            try {
                Bitmap screenshot = new Bitmap(Screen.PrimaryScreen.Bounds.Width, Screen.PrimaryScreen.Bounds.Height);
                try {
                    using (Graphics g = Graphics.FromImage(screenshot)) {
                        g.CopyFromScreen(0, 0, 0, 0, screenshot.Size);
                    }
                } catch { return; }

                byte[] imageBytes;
                using (var ms = new MemoryStream()) {
                    screenshot.Save(ms, System.Drawing.Imaging.ImageFormat.Jpeg);
                    imageBytes = ms.ToArray();
                }

                byte[] currentHash = System.Security.Cryptography.MD5.Create().ComputeHash(imageBytes);
                if (lastImageHash != null && Enumerable.SequenceEqual(currentHash, lastImageHash)) return;
                lastImageHash = currentHash;

                string base64Image = Convert.ToBase64String(imageBytes);
                await CallGemini("Solve the exam question in this image concisely.", base64Image);
            } catch {}
        }

        private async Task CallGemini(string prompt, string base64Image) {
            if (geminiKeys.Count == 0) { UpdateHUD("ERROR: NO KEYS"); return; }
            
            string currentKey = geminiKeys[currentKeyIndex];

            try {
                using (var client = new HttpClient()) {
                    string escapedPrompt = prompt.Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "");
                    string json = base64Image != null 
                        ? "{\"contents\":[{\"parts\":[{\"text\":\"" + escapedPrompt + "\"},{\"inline_data\":{\"mime_type\":\"image/jpeg\",\"data\":\"" + base64Image + "\"}}]}]}"
                        : "{\"contents\":[{\"parts\":[{\"text\":\"" + escapedPrompt + "\"}]}]}";
                    
                    var content = new StringContent(json, Encoding.UTF8, "application/json");
                    var response = await client.PostAsync("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + currentKey, content);
                    
                    if (response.IsSuccessStatusCode) {
                        string resBody = await response.Content.ReadAsStringAsync();
                        int start = resBody.IndexOf("\"text\": \"") + 9;
                        int end = resBody.IndexOf("\"", start);
                        if (start > 8 && end > start) {
                            currentAnswer = resBody.Substring(start, end - start).Replace("\\n", "\n").Replace("\\\"", "\"");
                        }
                    } else if ((int)response.StatusCode == 429) {
                        // RATE LIMIT HIT: Cycle to next key
                        currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.Count;
                        UpdateHUD("RATE LIMIT: CYCLING KEYS...");
                    }
                }
            } catch {}
            this.Invalidate();
        }

        private void UpdateHUD(string msg) { currentAnswer = msg; this.Invalidate(); }

        private void FillRoundedRectangle(Graphics g, Brush brush, float x, float y, float width, float height, float radius) {
            System.Drawing.Drawing2D.GraphicsPath path = new System.Drawing.Drawing2D.GraphicsPath();
            path.AddArc(x, y, radius, radius, 180, 90);
            path.AddArc(x + width - radius, y, radius, radius, 270, 90);
            path.AddArc(x + width - radius, y + height - radius, radius, radius, 0, 90);
            path.AddArc(x, y + height - radius, radius, radius, 90, 90);
            path.CloseAllFigures();
            g.FillPath(brush, path);
        }

        [STAThread] public static void Main() { Application.EnableVisualStyles(); Application.Run(new PhantomHUD()); }
    }
}
