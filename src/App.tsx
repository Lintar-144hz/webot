import React, { useState, useEffect, useRef } from "react";
import { 
  Terminal, 
  Cpu, 
  Database, 
  Clock, 
  HelpCircle, 
  RefreshCw, 
  LogOut, 
  Zap, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Sliders,
  Sparkles,
  Smartphone,
  Send,
  Trash2
} from "lucide-react";
import { io } from "socket.io-client";

interface BotState {
  status: "CONNECTED" | "CONNECTING" | "DISCONNECTED";
  phoneNumber: string;
  pairingCode: string | null;
}

interface Stats {
  uptime: string;
  uptimeMs: number;
  totalMessages: number;
  totalCommands: number;
  totalUsers: number;
  ramUsed: string;
  totalRam: string;
  ramPercent: number;
  cpuPercent: number;
  platform: string;
  nodeVersion: string;
}

interface CommandInfo {
  name: string;
  aliases: string[];
  category: string;
  description: string;
  usage: string;
}

interface TerminalLine {
  text: string;
  type: "input" | "output" | "error" | "success" | "info" | "system";
}

type TerminalTheme = "green" | "amber" | "monokai" | "cyberpunk";

export default function App() {
  const [botState, setBotState] = useState<BotState>({
    status: "DISCONNECTED",
    phoneNumber: "",
    pairingCode: null
  });
  const [stats, setStats] = useState<Stats>({
    uptime: "0s",
    uptimeMs: 0,
    totalMessages: 0,
    totalCommands: 0,
    totalUsers: 0,
    ramUsed: "0 MB",
    totalRam: "0 GB",
    ramPercent: 0,
    cpuPercent: 0,
    platform: "linux",
    nodeVersion: "v20"
  });
  
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  
  // Termux Specific States
  const [activeTab, setActiveTab] = useState<"bash" | "logs" | "localhost">("bash");
  const [termTheme, setTermTheme] = useState<TerminalTheme>("green");
  const [cmdInput, setCmdInput] = useState("");
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showMetricsPanel, setShowMetricsPanel] = useState(true);
  const [lastTikTokResult, setLastTikTokResult] = useState<any | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show dynamic toast
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Add line helper
  const addTermLine = (text: string, type: TerminalLine["type"] = "output") => {
    setTerminalLines(prev => [...prev, { text, type }]);
  };

  // Initialize Terminal Welcome Banner
  useEffect(() => {
    const timeStr = new Date().toLocaleString("id-ID", { hour12: false });
    
    setTerminalLines([
      { text: "Welcome to Termux (Web-based Console v1.2.0)!", type: "info" },
      { text: "Type 'help' or 'menu' to see all special control commands.", type: "system" },
      { text: `System startup: ${timeStr}`, type: "info" },
      { text: "Subscribed repositories: stable-main (apt), baileys-os (git)", type: "info" },
      { text: "------------------------------------------------------", type: "info" },
      { text: "💡 KETIK 'localhost' UNTUK PENJELASAN LOCALHOST/PORT", type: "system" },
      { text: "------------------------------------------------------", type: "info" }
    ]);
  }, []);

  useEffect(() => {
    // 1. Initial Data Load
    const fetchData = async () => {
      try {
        const [stateRes, statsRes, logsRes, cmdRes] = await Promise.all([
          fetch("/api/status").then(r => r.json()),
          fetch("/api/stats").then(r => r.json()),
          fetch("/api/logs").then(r => r.json()),
          fetch("/api/commands").then(r => r.json())
        ]);
        
        setBotState(stateRes);
        setStats(statsRes);
        setLogs(logsRes.logs || []);
        setCommands(cmdRes || []);
      } catch (err) {
        console.error("Error fetching initial dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // 2. Setup WebSocket Live Connection
    const socket = io();

    socket.on("bot-state", (newState: BotState) => {
      setBotState(newState);
      if (newState.status === "CONNECTED") {
        showToast("WhatsApp Berhasil Terhubung!", "success");
        setTerminalLines(prev => [
          ...prev, 
          { text: `[BOT] WhatsApp successfully CONNECTED to session!`, type: "success" }
        ]);
      } else if (newState.status === "DISCONNECTED") {
        setTerminalLines(prev => [
          ...prev, 
          { text: `[BOT] WhatsApp DISCONNECTED. Use 'connect <phone>' to connect.`, type: "error" }
        ]);
      }
    });

    socket.on("new-log", (newLog: string) => {
      setLogs(prev => [...prev.slice(-199), newLog]);
      
      // Highlight log alerts inside terminal
      if (newLog.includes("[ERROR]")) {
        setTerminalLines(prev => [...prev, { text: `[SYSTEM LOG ERROR] ${newLog}`, type: "error" }]);
      } else if (newLog.includes("[SUCCESS]")) {
        setTerminalLines(prev => [...prev, { text: `[SYSTEM LOG SUCCESS] ${newLog}`, type: "success" }]);
      }
    });

    socket.on("logs-cleared", () => {
      setLogs([]);
      showToast("Terminal log dibersihkan.", "info");
    });

    // 3. Periodic statistics polling
    const statsInterval = setInterval(async () => {
      try {
        const statsRes = await fetch("/api/stats").then(r => r.json());
        setStats(statsRes);
      } catch (e) {}
    }, 5000);

    return () => {
      socket.disconnect();
      clearInterval(statsInterval);
    };
  }, []);

  // Auto scroll terminal to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLines, activeTab]);

  // Auto scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current && activeTab === "logs") {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  // Handle WhatsApp Connection via Pairing Code
  const triggerConnect = async (phone: string) => {
    let formatted = phone.replace(/[^0-9]/g, "");
    if (!formatted.startsWith("62") && formatted.startsWith("0")) {
      formatted = "62" + formatted.slice(1);
    }
    
    addTermLine(`[PROCESS] Mengirim permintaan pairing code untuk +${formatted}...`, "info");
    showToast(`Memproses pairing code untuk +${formatted}...`, "info");
    
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatted })
      }).then(r => r.json());

      if (res.error) {
        addTermLine(`[ERROR] Gagal: ${res.error}`, "error");
        showToast(res.error, "error");
      } else {
        addTermLine(`[SUCCESS] Permintaan berhasil! Gunakan pairing code di bawah ini.`, "success");
        showToast("Minta Pairing Code berhasil!", "success");
      }
    } catch (err) {
      addTermLine(`[ERROR] Gagal melakukan permintaan Pairing Code ke server.`, "error");
      showToast("Gagal melakukan permintaan Pairing Code.", "error");
    }
  };

  // Handle Disconnect
  const triggerDisconnect = async () => {
    addTermLine(`[PROCESS] Memutuskan koneksi WhatsApp...`, "info");
    try {
      const res = await fetch("/api/disconnect", { method: "POST" }).then(r => r.json());
      if (res.error) {
        addTermLine(`[ERROR] Gagal: ${res.error}`, "error");
        showToast(res.error, "error");
      } else {
        addTermLine(`[SUCCESS] Koneksi WhatsApp berhasil diputuskan.`, "success");
        showToast("WhatsApp berhasil diputuskan.", "success");
      }
    } catch (err) {
      addTermLine(`[ERROR] Kegagalan jaringan atau server.`, "error");
      showToast("Gagal memutuskan koneksi WhatsApp.", "error");
    }
  };

  // Handle Logout (Clear Session)
  const triggerLogout = async () => {
    addTermLine(`[PROCESS] Menghapus session WhatsApp...`, "info");
    try {
      const res = await fetch("/api/logout", { method: "POST" }).then(r => r.json());
      if (res.error) {
        addTermLine(`[ERROR] Gagal: ${res.error}`, "error");
        showToast(res.error, "error");
      } else {
        addTermLine(`[SUCCESS] Session berhasil dihapus. Silakan request code baru.`, "success");
        showToast("Berhasil logout dan menghapus session.", "success");
        setBotState({ status: "DISCONNECTED", phoneNumber: "", pairingCode: null });
      }
    } catch (err) {
      addTermLine(`[ERROR] Kegagalan jaringan atau server saat logout.`, "error");
      showToast("Gagal logout.", "error");
    }
  };

  // Handle Restart Bot
  const triggerRestart = async () => {
    addTermLine(`[PROCESS] Meminta server me-restart WhatsApp engine...`, "info");
    try {
      showToast("Sedang merestart bot...", "info");
      const res = await fetch("/api/restart", { method: "POST" }).then(r => r.json());
      if (res.error) {
        addTermLine(`[ERROR] Gagal restart: ${res.error}`, "error");
        showToast(res.error, "error");
      } else {
        addTermLine(`[SUCCESS] Bot berhasil direstart. Menunggu inisialisasi ulang...`, "success");
        showToast("Bot berhasil direstart.", "success");
      }
    } catch (err) {
      addTermLine(`[ERROR] Gagal merestart bot.`, "error");
      showToast("Gagal merestart bot.", "error");
    }
  };

  // Handle Clear Logs
  const triggerClearLogs = async () => {
    try {
      await fetch("/api/logs/clear", { method: "POST" });
    } catch (err) {}
  };

  // Process entered terminal command
  const processCommand = async (inputStr: string) => {
    const cleanInput = inputStr.trim();
    if (!cleanInput) return;

    // Add input line to display
    setTerminalLines(prev => [...prev, { text: `~/baileys-os $ ${cleanInput}`, type: "input" }]);
    
    // Add to history
    const newHistory = [cleanInput, ...cmdHistory.filter(h => h !== cleanInput)].slice(0, 50);
    setCmdHistory(newHistory);
    setHistoryIndex(-1);

    const parts = cleanInput.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case "help":
      case "menu":
        addTermLine("====================================================", "info");
        addTermLine("             DAFTAR PERINTAH TERMUX WEB             ", "success");
        addTermLine("====================================================", "info");
        addTermLine("help, menu      - Menampilkan panduan bantuan ini", "info");
        addTermLine("status          - Status koneksi WhatsApp Bot & nomor terhubung", "info");
        addTermLine("stats           - Tampilkan statistik RAM, CPU, dan Uptime server", "info");
        addTermLine("neofetch        - Info spesifikasi server dibalut ASCII Art", "info");
        addTermLine("commands        - Tampilkan menu perintah Bot WhatsApp", "info");
        addTermLine("connect <no>    - Menghubungkan bot dengan No WhatsApp (contoh: connect 081234567)", "info");
        addTermLine("disconnect      - Putuskan sambungan WhatsApp aktif saat ini", "info");
        addTermLine("logout          - Keluar dan hapus seluruh session tersimpan", "info");
        addTermLine("restart         - Restart ulang client daemon WhatsApp", "info");
        addTermLine("tt <username>   - Cari profil TikTok secara real-time", "success");
        addTermLine("localhost       - Penjelasan tentang localhost & port-forwarding", "success");
        addTermLine("theme <color>   - Ganti warna tema (green, amber, monokai, cyberpunk)", "info");
        addTermLine("clear           - Bersihkan baris terminal ini", "info");
        addTermLine("====================================================", "info");
        break;

      case "localhost":
      case "local":
        addTermLine("┌────────────────────────────────────────────────────────┐", "success");
        addTermLine("│             INFO LOCALHOST & CLOUD CONTAINER           │", "success");
        addTermLine("├────────────────────────────────────────────────────────┤", "info");
        addTermLine("│  ❓ KENAPA TIDAK MUNCUL LOCALHOST?                     │", "info");
        addTermLine("│  Aplikasi ini berjalan di cloud container Google Cloud │", "info");
        addTermLine("│  Run secara remote, bukan di PC lokal fisik Anda.       │", "info");
        addTermLine("│                                                        │", "info");
        addTermLine("│  🔗 AKSES WEB:                                         │", "info");
        addTermLine("│  Aplikasi dapat diakses via link browser aktif Anda:   │", "info");
        addTermLine(`│  ${window.location.origin} │`, "success");
        addTermLine("│                                                        │", "info");
        addTermLine("│  💻 CARA MENJALANKAN DI PC / LOCALHOST SENDIRI:        │", "info");
        addTermLine("│  1. Download file project ZIP (Menu kanan atas)        │", "info");
        addTermLine("│  2. Ekstrak di komputer Anda                           │", "info");
        addTermLine("│  3. Buka terminal local Anda, ketik:                   │", "info");
        addTermLine("│     $ npm install                                      │", "info");
        addTermLine("│     $ npm run dev                                      │", "info");
        addTermLine("│  4. Sekarang web akan muncul di http://localhost:3000  │", "success");
        addTermLine("└────────────────────────────────────────────────────────┘", "success");
        break;

      case "status":
        const st = botState.status;
        const colorMark = st === "CONNECTED" ? "CONNECTED [ONLINE]" : st === "CONNECTING" ? "CONNECTING..." : "DISCONNECTED [OFFLINE]";
        addTermLine("┌──────────────────────────────────────────────┐", "info");
        addTermLine("│               WHATSAPP STATUS                │", "info");
        addTermLine("├──────────────────────────────────────────────┤", "info");
        addTermLine(`│ Status Bot   : ${colorMark}`, st === "CONNECTED" ? "success" : st === "CONNECTING" ? "info" : "error");
        addTermLine(`│ No Terhubung : ${botState.phoneNumber ? "+" + botState.phoneNumber : "Belum ada"}`, "info");
        addTermLine(`│ Pairing Code : ${botState.pairingCode || "Tidak ada aktif"}`, "success");
        addTermLine("└──────────────────────────────────────────────┘", "info");
        if (!botState.phoneNumber && st !== "CONNECTED") {
          addTermLine("💡 Ketik 'connect <nomor_hp>' untuk menghasilkan pairing code baru.", "success");
        }
        break;

      case "stats":
        addTermLine("┌──────────────────────────────────────────────┐", "info");
        addTermLine("│               SYSTEM STATS                   │", "info");
        addTermLine("├──────────────────────────────────────────────┤", "info");
        addTermLine(`│ Server Uptime: ${stats.uptime}`, "info");
        addTermLine(`│ RAM Usage    : ${stats.ramUsed} (${stats.ramPercent}%)`, "info");
        addTermLine(`│ CPU Usage    : ${stats.cpuPercent}%`, "info");
        addTermLine(`│ Total Users  : ${stats.totalUsers}`, "info");
        addTermLine(`│ Total Msg    : ${stats.totalMessages}`, "info");
        addTermLine(`│ Total Cmds   : ${stats.totalCommands}`, "info");
        addTermLine(`│ OS Platform  : ${stats.platform}`, "info");
        addTermLine(`│ Node Version : ${stats.nodeVersion}`, "info");
        addTermLine("└──────────────────────────────────────────────┘", "info");
        break;

      case "neofetch":
        let logoColor: TerminalLine["type"] = "success";
        if (termTheme === "amber") logoColor = "info";
        else if (termTheme === "cyberpunk") logoColor = "error";

        addTermLine("       .---.       tarzz@baileys-terminal", logoColor);
        addTermLine("      /     \\      ----------------------", logoColor);
        addTermLine("      \\_.._./      OS: Termux (Web Container)", logoColor);
        addTermLine("      /  _  \\      Kernel: BaileysOS v1.0.0-stable", logoColor);
        addTermLine(`     (  |_|  )     Uptime: ${stats.uptime}`, logoColor);
        addTermLine("     //  _  \\\\     Shell: bash / node-terminal", logoColor);
        addTermLine(`    //  |_|  \\\\    Memory: ${stats.ramUsed} / ${stats.totalRam}`, logoColor);
        addTermLine(`    \\__________/   WhatsApp Status: ${botState.status}`, logoColor);
        addTermLine(`                   Uptime MS: ${stats.uptimeMs} ms`, logoColor);
        break;

      case "commands":
        addTermLine("=== DAFTAR PERINTAH BOT WHATSAPP ===", "success");
        if (commands.length === 0) {
          addTermLine("Tidak ada perintah WhatsApp yang terdaftar.", "info");
        } else {
          commands.forEach(cmd => {
            addTermLine(`• .${cmd.name} [Category: ${cmd.category}] - ${cmd.description} (Usage: ${cmd.usage})`, "info");
          });
        }
        break;

      case "connect":
        if (args.length === 0) {
          addTermLine("❌ Error: Harap masukkan nomor WhatsApp. Contoh: connect 62812345678", "error");
        } else {
          await triggerConnect(args[0]);
        }
        break;

      case "disconnect":
        await triggerDisconnect();
        break;

      case "logout":
        await triggerLogout();
        break;

      case "restart":
        await triggerRestart();
        break;

      case "clear":
        setTerminalLines([]);
        break;

      case "theme":
        if (args.length === 0) {
          addTermLine("❌ Masukkan pilihan warna: green, amber, monokai, cyberpunk", "error");
        } else {
          const targetTheme = args[0].toLowerCase();
          if (["green", "amber", "monokai", "cyberpunk"].includes(targetTheme)) {
            setTermTheme(targetTheme as TerminalTheme);
            addTermLine(`[SUCCESS] Tema diubah ke: ${targetTheme}`, "success");
          } else {
            addTermLine(`❌ Tema tidak dikenal: ${targetTheme}. Pilih: green, amber, monokai, atau cyberpunk.`, "error");
          }
        }
        break;

      case "tt":
      case "tiktok":
        if (args.length === 0) {
          addTermLine("❌ Masukkan username TikTok. Contoh: tt khaby.lame", "error");
        } else {
          let user = args[0].trim();
          if (user.startsWith("@")) user = user.substring(1);
          
          addTermLine(`⏳ Sedang mencari data TikTok untuk @${user}...`, "info");
          try {
            const profile = await fetch(`/api/tiktok?username=${encodeURIComponent(user)}`).then(async r => {
              if (!r.ok) {
                const errJson = await r.json();
                throw new Error(errJson.error || "Gagal mengambil data.");
              }
              return r.json();
            });

            setLastTikTokResult(profile);
            
            addTermLine("┌──────────────────────────────────────────────┐", "success");
            addTermLine("│          TIKTOK PROFILE INFORMATION          │", "success");
            addTermLine("├──────────────────────────────────────────────┤", "info");
            addTermLine(`│  👤 Nama          : ${profile.name}`, "info");
            addTermLine(`│  🆔 Username      : @${profile.username}`, "info");
            addTermLine(`│  📝 Bio           : ${profile.bio}`, "info");
            addTermLine(`│  👥 Followers     : ${profile.followers}`, "info");
            addTermLine(`│  ➡️ Following     : ${profile.following}`, "info");
            addTermLine(`│  ❤️ Total Likes   : ${profile.likes}`, "info");
            addTermLine(`│  🎬 Total Video   : ${profile.videos}`, "info");
            addTermLine(`│  ✅ Verified      : ${profile.verified}`, "info");
            addTermLine(`│  🔒 Private/Public: ${profile.isPrivate}`, "info");
            addTermLine(`│  🌍 Region        : ${profile.region}`, "info");
            addTermLine("└──────────────────────────────────────────────┘", "success");
            addTermLine(`[SUCCESS] Profil @${profile.username} berhasil dimuat di bawah!`, "success");
          } catch (err: any) {
            addTermLine(`❌ Gagal: ${err.message || "Username tidak ditemukan atau gangguan server."}`, "error");
          }
        }
        break;

      default:
        addTermLine(`bash: command not found: ${cmd}. Ketik 'help' untuk daftar perintah.`, "error");
        break;
    }
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;
    processCommand(cmdInput);
    setCmdInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const nextIndex = historyIndex + 1;
        if (nextIndex < cmdHistory.length) {
          setHistoryIndex(nextIndex);
          setCmdInput(cmdHistory[nextIndex]);
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = historyIndex - 1;
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setCmdInput(cmdHistory[nextIndex]);
      } else {
        setHistoryIndex(-1);
        setCmdInput("");
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Auto-complete commands
      const currentWord = cmdInput.trim().toLowerCase();
      const availableCmds = ["help", "menu", "status", "stats", "neofetch", "connect", "disconnect", "logout", "restart", "clear", "theme", "tt", "localhost"];
      const match = availableCmds.find(c => c.startsWith(currentWord));
      if (match) {
        setCmdInput(match + " ");
      }
    }
  };

  // Keyboard shortcut clicked
  const handleShortcutClick = (shortcut: string) => {
    if (shortcut === "UP") {
      if (cmdHistory.length > 0) {
        const nextIndex = historyIndex + 1;
        if (nextIndex < cmdHistory.length) {
          setHistoryIndex(nextIndex);
          setCmdInput(cmdHistory[nextIndex]);
        }
      }
    } else if (shortcut === "DOWN") {
      const nextIndex = historyIndex - 1;
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setCmdInput(cmdHistory[nextIndex]);
      } else {
        setHistoryIndex(-1);
        setCmdInput("");
      }
    } else if (shortcut === "TAB") {
      const currentWord = cmdInput.trim().toLowerCase();
      const availableCmds = ["help", "menu", "status", "stats", "neofetch", "connect", "disconnect", "logout", "restart", "clear", "theme", "tt", "localhost"];
      const match = availableCmds.find(c => c.startsWith(currentWord));
      if (match) {
        setCmdInput(match + " ");
      }
    } else if (shortcut === "CLEAR") {
      setTerminalLines([]);
    } else if (shortcut === "HELP") {
      processCommand("help");
    } else if (shortcut === "NEOFETCH") {
      processCommand("neofetch");
    } else if (shortcut === "LOCALHOST") {
      processCommand("localhost");
    }
  };

  // Focus terminal input
  const focusTerminal = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Get active theme colors
  const getThemeClasses = () => {
    switch (termTheme) {
      case "amber":
        return {
          bg: "bg-[#0b0702]",
          text: "text-amber-500",
          border: "border-amber-950/70",
          textMuted: "text-amber-700",
          inputBg: "bg-[#181005]",
          accent: "text-amber-400",
          badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          scrollbar: "scrollbar-amber"
        };
      case "monokai":
        return {
          bg: "bg-[#1e1e1e]",
          text: "text-zinc-100",
          border: "border-zinc-800",
          textMuted: "text-zinc-500",
          inputBg: "bg-[#252525]",
          accent: "text-yellow-400",
          badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
          scrollbar: "scrollbar-zinc"
        };
      case "cyberpunk":
        return {
          bg: "bg-[#08010f]",
          text: "text-cyan-400",
          border: "border-fuchsia-950/80",
          textMuted: "text-fuchsia-700/80",
          inputBg: "bg-[#140224]",
          accent: "text-fuchsia-400",
          badge: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30",
          scrollbar: "scrollbar-cyber"
        };
      default: // green
        return {
          bg: "bg-[#020403]",
          text: "text-emerald-400",
          border: "border-emerald-950/70",
          textMuted: "text-emerald-900/80",
          inputBg: "bg-[#060b08]",
          accent: "text-emerald-300",
          badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          scrollbar: "scrollbar-emerald"
        };
    }
  };

  const th = getThemeClasses();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-emerald-400 font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-500/10 border-t-emerald-400 rounded-full animate-spin"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Terminal className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight">TERMUX_DAEMON_BOOTING</h1>
          <p className="text-xs text-emerald-600 animate-pulse">Initializing socket loop & Baileys hooks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full ${th.bg} ${th.text} font-mono overflow-hidden transition-all duration-300`}>
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-xl border text-xs max-w-sm transition-all duration-300 animate-slide-in bg-zinc-950 border-emerald-900/50 text-emerald-300">
          {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === "error" && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
          {toast.type === "info" && <HelpCircle className="w-4 h-4 text-sky-400 shrink-0" />}
          <span className="font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* Device Simulated Status Bar */}
        <div className={`h-8 ${th.bg} border-b ${th.border} flex items-center justify-between px-4 text-[10px] ${th.textMuted} shrink-0 select-none`}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-bold">
              <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
              TERMUX v1.20
            </span>
            <span className="hidden sm:inline">Session: #1 (bash)</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date().toISOString().split("T")[1].slice(0, 8)} UTC
            </span>
            <span className="hidden xs:inline">IP: 127.0.0.1 (cloud)</span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 rounded">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
              CONTAINER_LIVE
            </span>
          </div>
        </div>

        {/* Termux Navigation Tabs Bar */}
        <div className={`h-11 ${th.bg} border-b ${th.border} flex items-center justify-between px-3 shrink-0`}>
          <div className="flex items-center gap-1 h-full">
            <button 
              onClick={() => setActiveTab("bash")}
              className={`h-full px-3 text-xs flex items-center gap-1.5 font-bold border-b-2 transition-all ${activeTab === "bash" ? "border-emerald-500 text-white" : "border-transparent " + th.textMuted}`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-500" />
              [1] termux-bash
            </button>
            <button 
              onClick={() => setActiveTab("logs")}
              className={`h-full px-3 text-xs flex items-center gap-1.5 font-bold border-b-2 transition-all ${activeTab === "logs" ? "border-emerald-500 text-white" : "border-transparent " + th.textMuted}`}
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-500" />
              [2] whatsapp-logs
            </button>
            <button 
              onClick={() => setActiveTab("localhost")}
              className={`h-full px-3 text-xs flex items-center gap-1.5 font-bold border-b-2 transition-all ${activeTab === "localhost" ? "border-emerald-500 text-white" : "border-transparent " + th.textMuted}`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-emerald-500" />
              [3] localhost-explain
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick stats buttons */}
            <button 
              onClick={() => setShowMetricsPanel(!showMetricsPanel)}
              className={`p-1.5 rounded border ${th.border} hover:bg-zinc-900/30 text-xs flex items-center gap-1 ${showMetricsPanel ? "text-emerald-400" : th.textMuted}`}
              title="Toggle metrics dashboard side panel"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Panel</span>
            </button>
            
            {/* Cycle theme button */}
            <button 
              onClick={() => {
                const themes: TerminalTheme[] = ["green", "amber", "monokai", "cyberpunk"];
                const nextIdx = (themes.indexOf(termTheme) + 1) % themes.length;
                setTermTheme(themes[nextIdx]);
                showToast(`Warna terminal diubah ke: ${themes[nextIdx]}`, "info");
              }}
              className={`p-1.5 rounded border ${th.border} text-xs flex items-center gap-1 hover:bg-zinc-900/40 text-white`}
              title="Ubah tema warna"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span className="hidden md:inline">Tema</span>
            </button>
          </div>
        </div>

        {/* Content Workspace Splitter */}
        <div className="flex-1 flex overflow-hidden w-full">
          
          {/* Main Terminal Window */}
          <div 
            onClick={focusTerminal}
            className="flex-1 flex flex-col h-full p-4 overflow-y-auto cursor-text relative"
          >
            {/* 1. SESSION BASH */}
            {activeTab === "bash" && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Scrollable list of lines */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-2 select-text">
                  {terminalLines.map((line, index) => {
                    let textClass = th.text;
                    if (line.type === "error") textClass = "text-red-400 font-semibold";
                    else if (line.type === "success") textClass = "text-emerald-300 font-semibold";
                    else if (line.type === "info") textClass = th.textMuted;
                    else if (line.type === "system") textClass = "text-yellow-400 font-bold";
                    else if (line.type === "input") textClass = "text-sky-400 font-semibold";

                    return (
                      <div key={index} className={`whitespace-pre-wrap leading-relaxed text-xs break-all`}>
                        {line.text}
                      </div>
                    );
                  })}
                  <div ref={terminalEndRef} />
                </div>

                {/* Form prompt at the bottom */}
                <form 
                  onSubmit={handleCommandSubmit}
                  className={`mt-4 pt-3 border-t ${th.border} flex items-center gap-2`}
                >
                  <span className="text-sky-400 font-bold shrink-0 text-xs">~/baileys-os $</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={cmdInput}
                    onChange={(e) => setCmdInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-xs text-white placeholder-emerald-950 font-mono caret-white"
                    placeholder="ketik perintah di sini (contoh: help, stats, tt username)"
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="off"
                  />
                  <button 
                    type="submit"
                    className={`p-1.5 rounded ${th.border} border text-white hover:bg-emerald-950/40`}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* 2. WHATSAPP LOGS VIEW */}
            {activeTab === "logs" && (
              <div className="flex-1 flex flex-col h-full min-h-0">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
                  <span className="text-xs font-bold text-yellow-400">FILE: /var/log/whatsapp-bot.log</span>
                  <button 
                    onClick={triggerClearLogs}
                    className="px-2.5 py-1 bg-red-950/30 hover:bg-red-950/80 border border-red-900/40 text-red-300 rounded text-[10px] font-bold flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus Log
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 p-3 bg-black/40 rounded-lg border border-zinc-900 pr-2 select-text font-mono text-[11px] leading-relaxed">
                  {logs.map((log, index) => {
                    let color = "text-zinc-500";
                    if (log.includes("[ERROR]")) color = "text-red-400 font-semibold";
                    else if (log.includes("[WARN]")) color = "text-amber-400";
                    else if (log.includes("[SUCCESS]")) color = "text-emerald-400";
                    else if (log.includes("[BOT]")) color = "text-emerald-500 font-bold";
                    else if (log.includes("[INFO]")) color = "text-zinc-400";

                    return (
                      <div key={index} className={`${color} whitespace-pre-wrap break-all`}>
                        {log}
                      </div>
                    );
                  })}
                  {logs.length === 0 && (
                    <div className="text-zinc-600 italic text-center py-10">Belum ada aktifitas logs...</div>
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}

            {/* 3. LOCALHOST EXPLANATION */}
            {activeTab === "localhost" && (
              <div className="flex-1 flex flex-col justify-start max-w-2xl mx-auto space-y-5 py-4">
                <div className="p-4 rounded-xl border border-yellow-950/40 bg-yellow-950/10 text-yellow-400 space-y-2">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    ❓ Kenapa 'localhost' tidak muncul / tidak bisa diakses langsung?
                  </h2>
                  <p className="text-xs leading-relaxed text-zinc-300 font-mono">
                    Aplikasi WhatsApp Bot dan dashboard ini sedang berjalan di dalam server cloud container (Google Cloud Run). 
                    Dev server berjalan pada port 3000 di dalam cloud virtual machine tersebut, dan dipasangkan proxy link agar Anda bisa berinteraksi di web.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase border-b border-zinc-800 pb-1">1. Cara Mengakses Web Saat Ini</h3>
                  <p className="text-xs text-zinc-300 leading-normal">
                    Gunakan URL pengembangan di browser Anda saat ini. Ini adalah link web server cloud yang terhubung langsung ke daemon bot Anda:
                  </p>
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-emerald-400 select-all font-mono">
                    {window.location.origin}
                  </div>

                  <h3 className="text-xs font-bold text-white uppercase border-b border-zinc-800 pb-1 mt-6">2. Cara Menjalankannya di Localhost Fisik Anda</h3>
                  <p className="text-xs text-zinc-300 leading-normal">
                    Jika Anda ingin benar-benar menjalankannya di localhost komputer Anda sendiri:
                  </p>
                  <ol className="list-decimal list-inside text-xs text-zinc-400 space-y-2.5 leading-relaxed pl-1">
                    <li>
                      Unduh source code lengkap dengan mengklik tombol ekspor di pojok kanan atas layar AI Studio (**Export to ZIP** atau **Export to GitHub**).
                    </li>
                    <li>
                      Ekstrak folder ZIP tersebut di komputer Anda.
                    </li>
                    <li>
                      Buka aplikasi Terminal / Command Prompt di komputer Anda dan masuk ke direktori folder tersebut:
                      <div className="p-2.5 mt-1.5 rounded bg-black/60 border border-zinc-900 text-yellow-500 font-mono text-xs select-all">
                        cd path/ke/folder-anda
                      </div>
                    </li>
                    <li>
                      Pastikan Node.js sudah terinstal di komputer Anda, lalu jalankan instalasi dependency:
                      <div className="p-2.5 mt-1.5 rounded bg-black/60 border border-zinc-900 text-yellow-500 font-mono text-xs select-all">
                        npm install
                      </div>
                    </li>
                    <li>
                      Nyalakan server development lokal:
                      <div className="p-2.5 mt-1.5 rounded bg-black/60 border border-zinc-900 text-yellow-500 font-mono text-xs select-all">
                        npm run dev
                      </div>
                    </li>
                    <li>
                      Sekarang, Anda dapat membuka browser fisik komputer Anda dan mengakses:
                      <div className="p-2.5 mt-1.5 rounded bg-black/60 border border-zinc-900 text-emerald-400 font-bold font-mono text-xs select-all">
                        http://localhost:3000
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          {/* Right Metrics Panel */}
          {showMetricsPanel && (
            <div className={`w-80 border-l ${th.border} bg-black/30 p-4 flex flex-col gap-5 overflow-y-auto hidden lg:flex shrink-0`}>
              
              {/* WhatsApp Connection Widget */}
              <div className={`p-4 rounded-xl border ${th.border} bg-[#000000]/40 space-y-3`}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">WHATSAPP CONNECTION</span>
                  <span className={`w-2 h-2 rounded-full ${botState.status === "CONNECTED" ? "bg-emerald-400 animate-pulse" : botState.status === "CONNECTING" ? "bg-amber-400 animate-ping" : "bg-red-500"}`} />
                </div>
                
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg bg-zinc-900 border ${th.border}`}>
                    <Smartphone className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white uppercase">{botState.status}</div>
                    <div className="text-[10px] text-zinc-400">
                      {botState.phoneNumber ? `+${botState.phoneNumber}` : "No phone connected"}
                    </div>
                  </div>
                </div>

                {botState.pairingCode && (
                  <div className="p-3 rounded-lg bg-emerald-950/10 border border-emerald-900/40 text-center space-y-1.5">
                    <div className="text-[9px] text-emerald-400/80 font-bold uppercase tracking-wider">PAIRING CODE ACTIVE</div>
                    <div className="text-lg font-bold tracking-[0.25em] text-emerald-300 font-mono animate-pulse">{botState.pairingCode}</div>
                    <div className="text-[9px] text-zinc-500 leading-snug">
                      Masukkan kode ini di HP WhatsApp Anda → Perangkat Tertaut → Tautkan dengan nomor telepon saja.
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button 
                    onClick={triggerRestart}
                    className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[10px] text-white font-bold flex items-center justify-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Restart Daemon
                  </button>
                  <button 
                    onClick={triggerLogout}
                    className="p-1.5 bg-red-950/20 hover:bg-red-900 hover:text-white border border-red-900/30 rounded text-[10px] text-red-400 font-bold flex items-center justify-center gap-1"
                  >
                    <LogOut className="w-3 h-3" />
                    Clear Session
                  </button>
                </div>
              </div>

              {/* Resource Monitors */}
              <div className={`p-4 rounded-xl border ${th.border} bg-[#000000]/40 space-y-4`}>
                <span className="text-[10px] font-bold uppercase text-zinc-500">RESOURCE MONITOR</span>
                
                {/* CPU bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-400 uppercase">CPU Core</span>
                    <span className="font-bold text-emerald-400">{stats.cpuPercent}%</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] leading-none font-bold">
                    <span className="text-zinc-600 font-normal">CPU [</span>
                    <span className="text-emerald-400">
                      {"■".repeat(Math.round(stats.cpuPercent / 10))}
                      {"□".repeat(10 - Math.round(stats.cpuPercent / 10))}
                    </span>
                    <span className="text-zinc-600 font-normal">]</span>
                  </div>
                </div>

                {/* RAM bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-400 uppercase">RAM MEMORY</span>
                    <span className="font-bold text-emerald-400">{stats.ramUsed}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] leading-none font-bold">
                    <span className="text-zinc-600 font-normal">MEM [</span>
                    <span className="text-emerald-400">
                      {"■".repeat(Math.round(stats.ramPercent / 10))}
                      {"□".repeat(10 - Math.round(stats.ramPercent / 10))}
                    </span>
                    <span className="text-zinc-600 font-normal">]</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-900 flex justify-between text-[10px] text-zinc-500">
                  <span>OS: {stats.platform}</span>
                  <span>Node: {stats.nodeVersion}</span>
                </div>
              </div>

              {/* Bot stats widget */}
              <div className={`p-4 rounded-xl border ${th.border} bg-[#000000]/40 space-y-3 text-xs`}>
                <span className="text-[10px] font-bold uppercase text-zinc-500 block">SYSTEM STATS</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-900 text-center">
                    <div className="text-[10px] text-zinc-500">Uptime</div>
                    <div className="font-bold text-white text-xs mt-0.5 truncate">{stats.uptime}</div>
                  </div>
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-900 text-center">
                    <div className="text-[10px] text-zinc-500">Pesan</div>
                    <div className="font-bold text-white text-xs mt-0.5">{stats.totalMessages}</div>
                  </div>
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-900 text-center">
                    <div className="text-[10px] text-zinc-500">Command</div>
                    <div className="font-bold text-white text-xs mt-0.5">{stats.totalCommands}</div>
                  </div>
                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-900 text-center">
                    <div className="text-[10px] text-zinc-500">User</div>
                    <div className="font-bold text-white text-xs mt-0.5">{stats.totalUsers}</div>
                  </div>
                </div>
              </div>

              {/* TikTok Avatar preview */}
              {lastTikTokResult && (
                <div className={`p-4 rounded-xl border ${th.border} bg-[#000000]/40 text-center space-y-3`}>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">TIKTOK AVATAR PREVIEW</span>
                  {lastTikTokResult.avatarUrl ? (
                    <div className="relative inline-block mx-auto rounded-full p-1 bg-gradient-to-tr from-rose-500 to-sky-400">
                      <img 
                        src={lastTikTokResult.avatarUrl} 
                        alt="TikTok Avatar"
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-full object-cover border-2 border-black" 
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-zinc-900 rounded-full mx-auto flex items-center justify-center text-zinc-600 border border-zinc-800 text-xs">No PFP</div>
                  )}
                  <div className="text-xs">
                    <div className="font-bold text-white">{lastTikTokResult.name}</div>
                    <div className="text-[10px] text-emerald-400">@{lastTikTokResult.username}</div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Termux Bottom Keyboard Helper Shortcuts Bar (crucial for retro styling) */}
        <div className={`h-11 ${th.bg} border-t ${th.border} flex items-center gap-1.5 px-3 overflow-x-auto shrink-0 select-none scrollbar-none`}>
          <button 
            onClick={() => handleShortcutClick("HELP")}
            className={`px-3 py-1 bg-zinc-950/80 hover:bg-zinc-900 border ${th.border} rounded text-[10px] font-bold text-white transition-all`}
          >
            HELP
          </button>
          <button 
            onClick={() => handleShortcutClick("NEOFETCH")}
            className={`px-3 py-1 bg-zinc-950/80 hover:bg-zinc-900 border ${th.border} rounded text-[10px] font-bold text-white transition-all`}
          >
            NEOFETCH
          </button>
          <button 
            onClick={() => handleShortcutClick("TAB")}
            className={`px-3 py-1 bg-zinc-950/80 hover:bg-zinc-900 border ${th.border} rounded text-[10px] font-bold text-emerald-400 transition-all`}
            title="Auto-complete command"
          >
            TAB ⇥
          </button>
          <button 
            onClick={() => handleShortcutClick("UP")}
            className={`px-3 py-1 bg-zinc-950/80 hover:bg-zinc-900 border ${th.border} rounded text-[10px] font-bold text-white transition-all`}
            title="History up"
          >
            UP ▲
          </button>
          <button 
            onClick={() => handleShortcutClick("DOWN")}
            className={`px-3 py-1 bg-zinc-950/80 hover:bg-zinc-900 border ${th.border} rounded text-[10px] font-bold text-white transition-all`}
            title="History down"
          >
            DOWN ▼
          </button>
          <button 
            onClick={() => handleShortcutClick("CLEAR")}
            className={`px-3 py-1 bg-zinc-950/80 hover:bg-zinc-900 border ${th.border} rounded text-[10px] font-bold text-red-400 transition-all`}
          >
            CLEAR
          </button>
          <button 
            onClick={() => handleShortcutClick("LOCALHOST")}
            className={`px-3 py-1 bg-yellow-950/20 hover:bg-yellow-900/30 border border-yellow-900/30 rounded text-[10px] font-bold text-yellow-400 transition-all`}
          >
            LOCALHOST?
          </button>
        </div>

      </div>

    </div>
  );
}
