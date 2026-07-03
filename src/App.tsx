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
  Trash2,
  BookOpen,
  Wifi,
  Copy,
  ChevronRight,
  Shield,
  Layers,
  Search,
  ExternalLink,
  Save,
  Download,
  Upload
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

type TabType = "dashboard" | "commands" | "logs" | "tiktok" | "localhost" | "ai_test" | "chat_simulator";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: number;
  pushName?: string;
  mediaType?: "image" | "video" | "contact";
  mediaUrl?: string;
}

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
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  
  // Connection Inputs
  const [phoneNumberInput, setPhoneNumberInput] = useState("");
  const [tiktokUsername, setTiktokUsername] = useState("");
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [tiktokResult, setTiktokResult] = useState<any | null>(null);
  const [tiktokError, setTiktokError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [logsSearch, setLogsSearch] = useState("");

  // In-App AI Playground States
  const [inAppAIQuery, setInAppAIQuery] = useState("");
  const [inAppAIResult, setInAppAIResult] = useState("");
  const [inAppAILoading, setInAppAILoading] = useState(false);

  // Session Backup States
  const [hasBackup, setHasBackup] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJSONText, setImportJSONText] = useState("");

  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSenderName, setChatSenderName] = useState("User Termux");
  const [chatSenderPhone, setChatSenderPhone] = useState("628999999999");
  const [chatLoading, setChatLoading] = useState(false);

  // Show Toast helper
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    // 1. Fetch initial status, stats, logs, and commands
    const fetchInitialData = async () => {
      try {
        const [stateRes, statsRes, logsRes, cmdRes, backupStatusRes, chatRes] = await Promise.all([
          fetch("/api/status").then(r => r.json()),
          fetch("/api/stats").then(r => r.json()),
          fetch("/api/logs").then(r => r.json()),
          fetch("/api/commands").then(r => r.json()),
          fetch("/api/session/backup-status").then(r => r.json()).catch(() => ({ hasBackup: false })),
          fetch("/api/chat-history").then(r => r.json()).catch(() => ({ chat: [] }))
        ]);
        
        setBotState(stateRes);
        setStats(statsRes);
        setLogs(logsRes.logs || []);
        setCommands(cmdRes || []);
        setHasBackup(backupStatusRes.hasBackup || false);
        setChatHistory(chatRes.chat || []);
      } catch (err) {
        console.error("Gagal memuat data awal server:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();

    // 2. Setup real-time Socket.io updates
    const socket = io();

    socket.on("bot-state", (newState: BotState) => {
      setBotState(newState);
      if (newState.status === "CONNECTED") {
        showToast("WhatsApp Berhasil Terhubung!", "success");
      }
    });

    socket.on("new-chat-message", (newMsg: ChatMessage) => {
      setChatHistory(prev => [...prev, newMsg]);
    });

    socket.on("new-log", (newLog: string) => {
      setLogs(prev => [...prev.slice(-199), newLog]);
    });

    socket.on("logs-cleared", () => {
      setLogs([]);
      showToast("Log terminal berhasil dibersihkan.", "success");
    });

    // 3. Periodic resource monitor updates (every 5 seconds)
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

  // Auto scroll logs
  useEffect(() => {
    if (activeTab === "logs" && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  // Copy to clipboard helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    showToast("Teks disalin ke clipboard!", "success");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Connect WhatsApp handler
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumberInput.trim()) {
      showToast("Nomor HP tidak boleh kosong.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumberInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setBotState(data);
        showToast("Pairing code berhasil dibuat!", "success");
      } else {
        showToast(data.error || "Gagal meminta pairing code", "error");
      }
    } catch (err) {
      showToast("Koneksi server gagal.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Disconnect WhatsApp handler
  const handleDisconnect = async () => {
    if (!window.confirm("Apakah Anda yakin ingin memutuskan WhatsApp?")) return;
    try {
      const res = await fetch("/api/disconnect", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast("WhatsApp terputus.", "info");
      } else {
        showToast(data.error || "Gagal memutuskan koneksi", "error");
      }
    } catch (err) {
      showToast("Gagal memutuskan koneksi.", "error");
    }
  };

  // Restart handler
  const handleRestart = async () => {
    if (!window.confirm("Apakah Anda yakin ingin merestart bot WhatsApp?")) return;
    try {
      const res = await fetch("/api/restart", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast("Bot berhasil direstart. Menghubungkan kembali...", "success");
      } else {
        showToast(data.error || "Gagal merestart bot", "error");
      }
    } catch (err) {
      showToast("Gagal merestart bot.", "error");
    }
  };

  // Logout / clear session handler
  const handleLogout = async () => {
    if (!window.confirm("PENTING: Keluar akan menghapus semua session aktif baik lokal maupun backup. Anda harus memasukkan pairing code lagi nanti. Lanjutkan?")) return;
    try {
      const res = await fetch("/api/logout", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast("Berhasil logout. Sesi dihapus.", "success");
        setHasBackup(false);
      } else {
        showToast(data.error || "Gagal logout", "error");
      }
    } catch (err) {
      showToast("Gagal logout.", "error");
    }
  };

  // Clear logs handler
  const handleClearLogs = async () => {
    try {
      await fetch("/api/logs/clear", { method: "POST" });
    } catch (err) {
      showToast("Gagal membersihkan log.", "error");
    }
  };

  // TikTok Lookup handler
  const handleTiktokLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tiktokUsername.trim()) {
      showToast("Username tidak boleh kosong.", "error");
      return;
    }

    setTiktokLoading(true);
    setTiktokResult(null);
    setTiktokError(null);

    // Filter symbol @
    const cleanUsername = tiktokUsername.replace("@", "").trim();

    try {
      const res = await fetch(`/api/tiktok?username=${encodeURIComponent(cleanUsername)}`);
      const data = await res.json();
      if (res.ok) {
        setTiktokResult(data);
        showToast("Data TikTok berhasil diambil!", "success");
      } else {
        setTiktokError(data.error || "Gagal mengambil data TikTok.");
        showToast(data.error || "Gagal mengambil data", "error");
      }
    } catch (err) {
      setTiktokError("Gagal menghubungi server.");
      showToast("Terjadi kesalahan jaringan.", "error");
    } finally {
      setTiktokLoading(false);
    }
  };

  // Session storage handlers
  const handleBackupSession = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch("/api/session/backup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setHasBackup(true);
      } else {
        showToast(data.error || "Gagal mencadangkan sesi", "error");
      }
    } catch (err) {
      showToast("Terjadi kesalahan jaringan.", "error");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreSession = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch("/api/session/restore", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
      } else {
        showToast(data.error || "Gagal memulihkan sesi", "error");
      }
    } catch (err) {
      showToast("Terjadi kesalahan jaringan.", "error");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleExportSession = () => {
    window.open("/api/session/export", "_blank");
    showToast("Mengekspor file backup sesi...", "success");
  };

  const handleImportSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importJSONText.trim()) {
      showToast("Data JSON cadangan tidak boleh kosong.", "error");
      return;
    }
    setBackupLoading(true);
    try {
      const res = await fetch("/api/session/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupJSON: importJSONText })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setImportModalOpen(false);
        setImportJSONText("");
        setHasBackup(true);
      } else {
        showToast(data.error || "Gagal mengimport backup", "error");
      }
    } catch (err) {
      showToast("Gagal mengkoneksikan server.", "error");
    } finally {
      setBackupLoading(false);
    }
  };

  // In-App AI playground handler
  const handleInAppAIQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inAppAIQuery.trim()) return;

    setInAppAILoading(true);
    setInAppAIResult("");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: inAppAIQuery.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setInAppAIResult(data.text || "Model tidak memberikan balasan.");
      } else {
        setInAppAIResult(`⚠️ Gagal: ${data.error || "Terjadi masalah server."}`);
      }
    } catch (err) {
      setInAppAIResult("❌ Gagal terhubung ke AI server. Periksa GEMINI_API_KEY.");
    } finally {
      setInAppAILoading(false);
    }
  };

  // Chat Simulator message sender handler
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    if (botState.status !== "CONNECTED") {
      showToast("Bot harus terhubung (ONLINE) sebelum Anda dapat mengirim pesan simulasi.", "error");
      return;
    }

    const textToSend = chatInput.trim();
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/simulate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSend,
          senderName: chatSenderName.trim() || "User",
          senderPhone: chatSenderPhone.trim() || "628999999999"
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        showToast(errData.error || "Gagal memproses pesan simulasi", "error");
      }
    } catch (err) {
      showToast("Gagal terhubung ke API Simulator.", "error");
    } finally {
      setChatLoading(false);
    }
  };

  // Scroll chat simulator to bottom
  useEffect(() => {
    if (activeTab === "chat_simulator" && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, activeTab]);

  // Helper file drop for Import
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImportJSONText(event.target.result as string);
          showToast("File JSON berhasil dimuat. Klik Import!", "info");
        }
      };
      reader.readAsText(file);
    } else {
      showToast("Hanya menerima file .json saja.", "error");
    }
  };

  // Render loading splash screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#030304] text-emerald-400 font-mono flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <Terminal className="w-12 h-12 text-emerald-500 animate-pulse" />
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
          </span>
        </div>
        <div className="space-y-1.5 text-center">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-emerald-300">Memuat BaileysOS...</p>
          <p className="text-[10px] text-zinc-500">Mengkoneksikan terminal server ke cloud VM</p>
        </div>
      </div>
    );
  }

  // Filter logs safely
  const filteredLogs = logs.filter(log => 
    log.toLowerCase().includes(logsSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#030304] text-zinc-300 font-mono flex flex-col md:flex-row select-none">
      
      {/* Toast Alert pop-up */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg border shadow-lg max-w-sm flex items-center gap-3 animate-slide-in font-mono text-xs ${
          toast.type === "success" 
            ? "bg-[#0a2214] text-emerald-400 border-emerald-500/20" 
            : toast.type === "error" 
              ? "bg-[#2d1010] text-red-400 border-red-500/20" 
              : "bg-[#16161a] text-sky-400 border-sky-500/20"
        }`}>
          {toast.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
          {toast.type === "error" && <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />}
          {toast.type === "info" && <Terminal className="w-4 h-4 shrink-0 text-sky-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* LEFT STATIC SIDEBAR (Hacker Console) */}
      <aside className="w-full md:w-64 bg-[#050507] border-b md:border-b-0 md:border-r border-emerald-500/10 flex flex-col justify-between shrink-0 h-auto md:h-screen">
        
        {/* Brand Terminal Header */}
        <div className="p-6 border-b border-emerald-500/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400">
              <Terminal className="w-5 h-5 drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">BaileysOS</h2>
              <span className="text-[9px] text-emerald-400 font-semibold uppercase tracking-widest block">v1.2.0 (Active)</span>
            </div>
          </div>
        </div>

        {/* Console Nav Lists */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          <span className="text-[9px] font-bold text-zinc-600 block px-4 py-2 uppercase tracking-widest">Main Modules</span>
          
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded text-xs font-bold tracking-wide transition-all ${
              activeTab === "dashboard"
                ? "bg-emerald-500/5 text-emerald-400 border border-emerald-500/15"
                : "text-zinc-500 hover:text-emerald-400/80 hover:bg-zinc-900/30"
            }`}
          >
            <Sliders className="w-4 h-4" />
            Dashboard
          </button>
          
          <button
            onClick={() => setActiveTab("commands")}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded text-xs font-bold tracking-wide transition-all ${
              activeTab === "commands"
                ? "bg-emerald-500/5 text-emerald-400 border border-emerald-500/15"
                : "text-zinc-500 hover:text-emerald-400/80 hover:bg-zinc-900/30"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Daftar Perintah
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded text-xs font-bold tracking-wide transition-all ${
              activeTab === "logs"
                ? "bg-emerald-500/5 text-emerald-400 border border-emerald-500/15"
                : "text-zinc-500 hover:text-emerald-400/80 hover:bg-zinc-900/30"
            }`}
          >
            <Terminal className="w-4 h-4" />
            Log Aktivitas
          </button>

          <span className="text-[9px] font-bold text-zinc-600 block px-4 py-2 uppercase tracking-widest mt-4">Tools & AI</span>

          <button
            onClick={() => setActiveTab("chat_simulator")}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded text-xs font-bold tracking-wide transition-all ${
              activeTab === "chat_simulator"
                ? "bg-emerald-500/5 text-emerald-400 border border-emerald-500/15"
                : "text-zinc-500 hover:text-emerald-400/80 hover:bg-zinc-900/30"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            Chat Simulator
          </button>

          <button
            onClick={() => setActiveTab("ai_test")}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded text-xs font-bold tracking-wide transition-all ${
              activeTab === "ai_test"
                ? "bg-emerald-500/5 text-emerald-400 border border-emerald-500/15"
                : "text-zinc-500 hover:text-emerald-400/80 hover:bg-zinc-900/30"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Playground AI
          </button>

          <button
            onClick={() => setActiveTab("tiktok")}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded text-xs font-bold tracking-wide transition-all ${
              activeTab === "tiktok"
                ? "bg-emerald-500/5 text-emerald-400 border border-emerald-500/15"
                : "text-zinc-500 hover:text-emerald-400/80 hover:bg-zinc-900/30"
            }`}
          >
            <Search className="w-4 h-4" />
            TikTok Lookup
          </button>

          <button
            onClick={() => setActiveTab("localhost")}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded text-xs font-bold tracking-wide transition-all ${
              activeTab === "localhost"
                ? "bg-emerald-500/5 text-emerald-400 border border-emerald-500/15"
                : "text-zinc-500 hover:text-emerald-400/80 hover:bg-zinc-900/30"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Info Localhost
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-emerald-500/10 text-[10px] text-zinc-600 space-y-1.5 bg-zinc-950/20">
          <div className="flex justify-between">
            <span>Terminal Host:</span>
            <span className="text-emerald-500">Cloud Run</span>
          </div>
          <div className="flex justify-between">
            <span>Core Daemon:</span>
            <span className="text-zinc-400">Baileys v7</span>
          </div>
          <div className="pt-2 border-t border-emerald-500/5 flex flex-col gap-1">
            <button 
              onClick={handleLogout}
              className="w-full text-left px-2 py-1 hover:bg-red-950/20 text-[9px] hover:text-red-400 font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5"
            >
              <LogOut className="w-3 h-3" />
              Reset All Sessions
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE FRAME */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Top Header status ribbon */}
        <header className="h-16 bg-[#050507] border-b border-emerald-500/10 flex items-center justify-between px-6 shrink-0 select-none">
          <div className="flex items-center gap-3">
            {/* Mobile Tab bar indicators (hidden on desktop) */}
            <div className="md:hidden flex items-center gap-1.5 overflow-x-auto py-1 text-[10px] font-bold text-zinc-500 uppercase">
              <button 
                onClick={() => setActiveTab("dashboard")}
                className={`px-2 py-1 rounded border ${activeTab === "dashboard" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "border-transparent text-zinc-500"}`}
              >
                Dash
              </button>
              <button 
                onClick={() => setActiveTab("commands")}
                className={`px-2 py-1 rounded border ${activeTab === "commands" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "border-transparent text-zinc-500"}`}
              >
                Cmds
              </button>
              <button 
                onClick={() => setActiveTab("logs")}
                className={`px-2 py-1 rounded border ${activeTab === "logs" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "border-transparent text-zinc-500"}`}
              >
                Logs
              </button>
              <button 
                onClick={() => setActiveTab("ai_test")}
                className={`px-2 py-1 rounded border ${activeTab === "ai_test" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "border-transparent text-zinc-500"}`}
              >
                AI
              </button>
              <button 
                onClick={() => setActiveTab("tiktok")}
                className={`px-2 py-1 rounded border ${activeTab === "tiktok" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "border-transparent text-zinc-500"}`}
              >
                TikTok
              </button>
              <button 
                onClick={() => setActiveTab("chat_simulator")}
                className={`px-2 py-1 rounded border ${activeTab === "chat_simulator" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "border-transparent text-zinc-500"}`}
              >
                Chat Sim
              </button>
            </div>

            <h1 className="text-xs font-bold tracking-widest text-emerald-400 uppercase hidden md:inline drop-shadow-[0_0_5px_rgba(52,211,153,0.2)]">
              {activeTab === "dashboard" && ":: MONITORING_CONSOLE ::"}
              {activeTab === "commands" && ":: DAFTAR_COMMAND_BOT ::"}
              {activeTab === "logs" && ":: DAEMON_STREAM_LOGS ::"}
              {activeTab === "tiktok" && ":: TIKTOK_LOOKUP_UTILITY ::"}
              {activeTab === "localhost" && ":: HOST_EXPLANATION ::"}
              {activeTab === "ai_test" && ":: PLAYGROUND_GEMINI_AI ::"}
              {activeTab === "chat_simulator" && ":: VIRTUAL_CHAT_SIMULATOR ::"}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Status indicators */}
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-950 rounded border border-emerald-500/10 text-[10px] font-bold">
              <span className={`w-2 h-2 rounded-full ${
                botState.status === "CONNECTED" 
                  ? "bg-emerald-400 animate-pulse drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]" 
                  : botState.status === "CONNECTING" 
                    ? "bg-amber-500 animate-ping" 
                    : "bg-red-500"
              }`} />
              <span className="text-zinc-400 tracking-wider font-mono">
                {botState.status === "CONNECTED" && "ONLINE"}
                {botState.status === "CONNECTING" && "DIALING..."}
                {botState.status === "DISCONNECTED" && "OFFLINE"}
              </span>
              {botState.phoneNumber && (
                <span className="text-zinc-600 border-l border-zinc-900 pl-2 ml-1">
                  +{botState.phoneNumber}
                </span>
              )}
            </div>
            
            <span className="text-[10px] text-zinc-600 font-mono hidden sm:flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date().toISOString().split("T")[1].slice(0, 8)} UTC
            </span>
          </div>
        </header>

        {/* Dynamic Inner Workspace Panel */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* 1. VIEW TAB: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              
              {/* Row of stats cards (Termux style grid layout) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Stat block 1 */}
                <div className="bg-[#09090d] border border-emerald-500/10 p-5 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Uptime Server</span>
                    <span className="text-xs font-bold text-emerald-400 mt-1 block font-mono">{stats.uptime}</span>
                  </div>
                  <div className="p-2.5 bg-zinc-950 rounded text-emerald-400 border border-emerald-500/10">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>

                {/* Stat block 2 */}
                <div className="bg-[#09090d] border border-emerald-500/10 p-5 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Total Pesan</span>
                    <span className="text-base font-bold text-emerald-400 mt-1 block font-mono">{stats.totalMessages}</span>
                  </div>
                  <div className="p-2.5 bg-zinc-950 rounded text-emerald-400 border border-emerald-500/10">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                </div>

                {/* Stat block 3 */}
                <div className="bg-[#09090d] border border-emerald-500/10 p-5 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Penyihir / Users</span>
                    <span className="text-base font-bold text-emerald-400 mt-1 block font-mono">{stats.totalUsers}</span>
                  </div>
                  <div className="p-2.5 bg-zinc-950 rounded text-emerald-400 border border-emerald-500/10">
                    <Sliders className="w-4 h-4" />
                  </div>
                </div>

                {/* Stat block 4 */}
                <div className="bg-[#09090d] border border-emerald-500/10 p-5 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Total Commands</span>
                    <span className="text-base font-bold text-emerald-400 mt-1 block font-mono">{stats.totalCommands}</span>
                  </div>
                  <div className="p-2.5 bg-zinc-950 rounded text-emerald-400 border border-emerald-500/10">
                    <Terminal className="w-4 h-4" />
                  </div>
                </div>

              </div>

              {/* Main Grid: left column pairing connector / right column monitoring info */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left panel: Connection / Pairing Code Card (7-col) */}
                <div className="lg:col-span-7 bg-[#09090d] border border-emerald-500/10 rounded-lg overflow-hidden flex flex-col justify-between">
                  <div className="p-6 border-b border-emerald-500/10">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Pairing Code WhatsApp Daemon</h3>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                      Tautkan nomor bot tanpa scan QR code. Sistem menyimpan kredensial ke disk persisten agar tidak terputus setelah container restart.
                    </p>
                  </div>

                  <div className="p-6 space-y-5">
                    {botState.status === "CONNECTED" ? (
                      <div className="p-6 rounded-lg bg-emerald-500/5 border border-emerald-500/10 space-y-3 text-center py-8">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-pulse drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" />
                        <h4 className="text-xs font-bold text-emerald-400 font-mono">DAEMON ACTIVE AND RUNNING</h4>
                        <p className="text-[10px] text-zinc-500 max-w-sm mx-auto leading-relaxed">
                          WhatsApp <span className="text-emerald-400 font-bold font-mono">+{botState.phoneNumber}</span> sukses dipasangkan. Sesi otomatis tersimpan di folder workspace cloud Anda.
                        </p>
                        <div className="pt-3 flex gap-2 justify-center">
                          <button 
                            onClick={handleRestart}
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/10 rounded text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Restart Engine
                          </button>
                          <button 
                            onClick={handleDisconnect}
                            className="px-3 py-1.5 bg-red-950/20 hover:bg-red-900 hover:text-white border border-red-900/40 rounded text-[10px] text-red-400 font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Disconnect
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <form onSubmit={handleConnect} className="space-y-3">
                          <label className="text-[9px] font-bold text-zinc-500 block uppercase tracking-wider">Nomor HP WhatsApp (Contoh: 628123456789)</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={phoneNumberInput}
                              onChange={(e) => setPhoneNumberInput(e.target.value)}
                              placeholder="628xxxxxxxx"
                              className="flex-1 bg-zinc-950 border border-emerald-500/15 rounded px-4 py-2 text-xs font-mono text-emerald-400 outline-none focus:border-emerald-500 transition-all placeholder-zinc-800"
                            />
                            <button 
                              type="submit"
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold rounded flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                            >
                              <Zap className="w-4 h-4 fill-black" />
                              Minta Code
                            </button>
                          </div>
                        </form>

                        {/* Pairing Code Displays */}
                        {botState.pairingCode ? (
                          <div className="p-4 rounded bg-zinc-950 border border-emerald-500/15 text-center space-y-2">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">CODE DIPASANG</span>
                            <div className="flex items-center justify-center gap-3">
                              <span className="text-2xl font-mono font-bold tracking-[0.25em] text-emerald-400 animate-pulse pl-4 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">{botState.pairingCode}</span>
                              <button 
                                onClick={() => copyToClipboard(botState.pairingCode || "")}
                                className="p-1.5 rounded hover:bg-zinc-900 text-zinc-500 hover:text-white transition-all border border-zinc-900"
                                title="Salin kode ke clipboard"
                              >
                                {copiedCode ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                            <div className="text-[10px] text-zinc-500 max-w-md mx-auto leading-relaxed pt-1.5 border-t border-zinc-900">
                              Langkah aktivasi: Buka WhatsApp HP Anda → Perangkat Tertaut → Tautkan Perangkat → Tautkan dengan nomor telepon saja → Masukkan 8 digit kode di atas.
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded border border-emerald-500/5 bg-zinc-950/40 text-[10px] text-zinc-500 leading-relaxed space-y-1.5">
                            <span className="font-bold text-zinc-400 block uppercase tracking-wider">📋 INSTRUKSI PENAUTAN</span>
                            <p>• Masukkan nomor WhatsApp lengkap (dimulai dengan kode negara seperti 62 untuk Indonesia).</p>
                            <p>• Setelah menekan "Minta Code", masukkan 8-karakter kode ke WhatsApp ponsel Anda untuk menautkan perangkat.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-zinc-950/40 border-t border-emerald-500/10 flex justify-between text-[9px] text-zinc-500 px-6 font-mono">
                    <span>Daemon Client JID: {botState.phoneNumber ? `+${botState.phoneNumber}@s.whatsapp.net` : "Belum terdaftar"}</span>
                    <span>Status: {botState.status}</span>
                  </div>
                </div>

                {/* Right panel: Resource Metrics (5-col) */}
                <div className="lg:col-span-5 bg-[#09090d] border border-emerald-500/10 rounded-lg p-6 flex flex-col justify-between space-y-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Sumber Daya Terminal</h3>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                      Metrik kinerja cloud VM yang menjalankan container Express.js dan modul Baileys WhatsApp.
                    </p>
                  </div>

                  {/* CPU Meter */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-500 uppercase tracking-widest font-mono">CPU Load</span>
                      <span className="font-bold font-mono text-emerald-400">{stats.cpuPercent}%</span>
                    </div>
                    <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-900">
                      <div 
                        className="bg-emerald-400 h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${Math.min(100, stats.cpuPercent)}%` }}
                      />
                    </div>
                  </div>

                  {/* RAM Meter */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-500 uppercase tracking-widest font-mono">RAM Memory</span>
                      <span className="font-bold font-mono text-emerald-400 text-xs">{stats.ramUsed} / {stats.totalRam}</span>
                    </div>
                    <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-900">
                      <div 
                        className="bg-emerald-400 h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${Math.min(100, stats.ramPercent)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-600 block text-right font-mono">RAM Utilization: {stats.ramPercent}%</span>
                  </div>

                  {/* OS / Node specifics */}
                  <div className="pt-4 border-t border-emerald-500/10 flex justify-between text-[9px] text-zinc-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-500" />
                      Platform: {stats.platform}
                    </span>
                    <span>Node: {stats.nodeVersion}</span>
                  </div>
                </div>

              </div>

              {/* PERSISTENT STORAGE MODULE CARD */}
              <div className="p-6 bg-[#09090d] border border-emerald-500/10 rounded-lg space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4 border-b border-emerald-500/10 pb-4">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]" />
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Modul Penyimpanan Sesi (Workspace Session Storage)</h3>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Sesi login WhatsApp Anda otomatis diduplikasi ke disk persistent workspace. Jika server cloud mati/restart, sesi akan langsung dimuat ulang otomatis tanpa pairing code ulang!
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 border text-[9px] font-bold uppercase rounded font-mono ${
                    hasBackup 
                      ? "bg-[#0c2214] border-emerald-500/20 text-emerald-400" 
                      : "bg-[#2d1010] border-red-500/20 text-red-400 animate-pulse"
                  }`}>
                    {hasBackup ? "CADANGAN DISK ADA (AMAN)" : "BELUM ADA CADANGAN"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 bg-zinc-950/40 rounded border border-emerald-500/5 space-y-2">
                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">1. Cadangan Lokal Workspace</h4>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      Gunakan tombol ini untuk mencadangkan sesi aktif Anda secara manual ke folder workspace persistent `/config` di server.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <button 
                        onClick={handleBackupSession}
                        disabled={backupLoading}
                        className="px-2.5 py-1.5 bg-[#0c2214] hover:bg-[#12301c] border border-emerald-500/20 text-emerald-400 font-bold rounded text-[10px] transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <Save className="w-3 h-3" />
                        Cadangkan Sesi
                      </button>
                      <button 
                        onClick={handleRestoreSession}
                        disabled={backupLoading || !hasBackup}
                        className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold rounded text-[10px] transition-all cursor-pointer inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Muat Sesi
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950/40 rounded border border-emerald-500/5 space-y-2">
                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">2. Ekspor File Cadangan</h4>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      Download seluruh file enkripsi kredensial WhatsApp Anda sebagai file JSON ke komputer lokal Anda untuk disimpan sebagai backup cadangan mutlak.
                    </p>
                    <button 
                      onClick={handleExportSession}
                      className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold rounded text-[10px] transition-all cursor-pointer inline-flex items-center gap-1 mt-1"
                    >
                      <Download className="w-3 h-3" />
                      Download JSON Backup
                    </button>
                  </div>

                  <div className="p-4 bg-zinc-950/40 rounded border border-emerald-500/5 space-y-2">
                    <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">3. Impor File Cadangan</h4>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      Punya file cadangan sesi yang didownload sebelumnya? Upload kembali file JSON tersebut ke sini untuk langsung login tanpa pairing code baru!
                    </p>
                    <button 
                      onClick={() => setImportModalOpen(true)}
                      className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold rounded text-[10px] transition-all cursor-pointer inline-flex items-center gap-1 mt-1"
                    >
                      <Upload className="w-3 h-3" />
                      Upload JSON Backup
                    </button>
                  </div>
                </div>
              </div>

              {/* Bot Info Alert Box */}
              <div className="p-4 rounded border border-emerald-500/5 bg-emerald-500/5 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1 font-mono">
                  <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">INFORMASI TERMINAL</h4>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Setiap kali Anda menautkan perangkat, Baileys menghasilkan credentials baru. Seluruh proses pairing dipandu dengan reverse proxy port 3000. Untuk detail pemindahan ke komputer pribadi (localhost), silakan baca tab <span className="text-emerald-400 font-bold underline cursor-pointer" onClick={() => setActiveTab("localhost")}>Info Localhost</span>.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* 2. VIEW TAB: COMMANDS LIST */}
          {activeTab === "commands" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-emerald-500/10 pb-4 flex-wrap gap-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Direktori Perintah Aktif (Command Registry)</h3>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Seluruh perintah interaktif bot di dalam `/commands` yang dideteksi secara dinamis saat sistem dinyalakan.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-[#0c2214] border border-emerald-500/15 rounded text-[10px] text-emerald-400 font-bold font-mono">
                  {commands.length} Command Terdaftar
                </span>
              </div>

              {commands.length === 0 ? (
                <div className="text-center py-16 bg-[#09090d] border border-emerald-500/10 rounded text-zinc-500 text-xs">
                  Tidak ada perintah yang didaftarkan di bot saat ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {commands.map((cmd) => (
                    <div key={cmd.name} className="bg-[#09090d] border border-emerald-500/10 p-5 rounded hover:border-emerald-500/25 transition-all flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-mono font-bold text-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.15)]">.{cmd.name}</span>
                          <span className="text-[8px] px-1.5 py-0.5 bg-zinc-950 border border-zinc-900 rounded text-zinc-500 uppercase font-bold tracking-wider">
                            {cmd.category}
                          </span>
                        </div>
                        
                        <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">{cmd.description}</p>
                      </div>

                      <div className="pt-4 border-t border-zinc-900/40 mt-4 text-[10px] font-mono text-zinc-500">
                        <div className="flex justify-between">
                          <span>Usage:</span>
                          <span className="text-emerald-500/70">{cmd.usage}</span>
                        </div>
                        {cmd.aliases.length > 0 && (
                          <div className="flex justify-between mt-1">
                            <span>Aliases:</span>
                            <span className="text-zinc-600 font-bold">{cmd.aliases.map(a => `.${a}`).join(", ")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. VIEW TAB: LOGS ACTIVITY */}
          {activeTab === "logs" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-500/10 pb-4 flex-wrap gap-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Terminal Daemon logs</h3>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Menampilkan log peristiwa, pesan masuk, dan aktivitas bot secara real-time.
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-zinc-600" />
                    <input 
                      type="text"
                      placeholder="Cari kata kunci log..."
                      value={logsSearch}
                      onChange={(e) => setLogsSearch(e.target.value)}
                      className="bg-zinc-950 border border-emerald-500/15 rounded pl-8 pr-3 py-1.5 text-[10px] text-emerald-400 outline-none focus:border-emerald-500 transition-all font-mono placeholder-zinc-800 w-44"
                    />
                  </div>
                  
                  <button 
                    onClick={handleClearLogs}
                    className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 hover:text-white border border-zinc-800 rounded text-[10px] text-zinc-400 font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Bersihkan Log"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Log
                  </button>
                </div>
              </div>

              {/* Logs Display Screen */}
              <div className="bg-black border border-emerald-500/10 rounded-lg p-5 font-mono text-[11px] leading-relaxed overflow-y-auto h-[480px] space-y-1 select-text scrollbar-thin shadow-inner">
                {filteredLogs.length === 0 ? (
                  <div className="text-zinc-600 text-center py-24 uppercase tracking-widest text-[10px]">
                    {logsSearch ? "Tidak ada log yang cocok dengan pencarian." : "Menunggu log aktivitas baru..."}
                  </div>
                ) : (
                  filteredLogs.map((log, index) => {
                    let textClass = "text-zinc-400";
                    if (log.includes("[SUCCESS]")) textClass = "text-emerald-400 font-bold";
                    if (log.includes("[ERROR]")) textClass = "text-red-400 font-bold";
                    if (log.includes("[WARN]")) textClass = "text-amber-500";
                    if (log.includes("[BOT]")) textClass = "text-sky-400";
                    return (
                      <div key={index} className={`whitespace-pre-wrap py-0.5 border-b border-zinc-950 hover:bg-zinc-950/40 px-2 transition-all ${textClass}`}>
                        {log}
                      </div>
                    );
                  })
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* 4. VIEW TAB: TIKTOK PROFILE LOOKUP */}
          {activeTab === "tiktok" && (
            <div className="space-y-6">
              <div className="border-b border-emerald-500/10 pb-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">TikTok Public Profile Lookup</h3>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Uji coba utilitas scraper profil TikTok publik langsung dari web panel sebelum mencobanya di bot WhatsApp via perintah `.tt @username`.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left query input card */}
                <div className="lg:col-span-5 bg-[#09090d] border border-emerald-500/10 rounded-lg p-6 space-y-4">
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest border-b border-zinc-900 pb-2">Scrape Query</h4>
                  
                  <form onSubmit={handleTiktokLookup} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Username TikTok</label>
                      <input 
                        type="text"
                        value={tiktokUsername}
                        onChange={(e) => setTiktokUsername(e.target.value)}
                        placeholder="contoh: @tiktok"
                        className="w-full bg-zinc-950 border border-emerald-500/15 rounded px-4 py-2 text-xs font-mono text-emerald-400 outline-none focus:border-emerald-500 transition-all placeholder-zinc-800"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={tiktokLoading}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-black font-bold text-xs rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {tiktokLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Mencari Profil...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          Ambil Data Profil
                        </>
                      )}
                    </button>
                  </form>

                  <div className="p-4 rounded bg-zinc-950/40 border border-emerald-500/5 text-[9px] text-zinc-500 leading-relaxed space-y-1.5 font-mono">
                    <span className="font-bold text-zinc-400 block uppercase">💡 CATATAN SCRAPING</span>
                    <p>• Bot akan otomatis menghapus simbol "@" jika dimasukkan oleh user.</p>
                    <p>• Data di-scrape secara publik menggunakan rate-limiting aman.</p>
                    <p>• Hasil pencarian disalin langsung ke format pesan WhatsApp bot yang rapi.</p>
                  </div>
                </div>

                {/* Right profile result card */}
                <div className="lg:col-span-7 space-y-4">
                  {tiktokError && (
                    <div className="p-4 rounded bg-red-950/10 border border-red-900/20 text-red-400 text-xs flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <h5 className="font-bold uppercase tracking-wider text-[10px]">Scraping Gagal</h5>
                        <p className="mt-1 text-[10px] text-zinc-400">{tiktokError}</p>
                      </div>
                    </div>
                  )}

                  {tiktokResult ? (
                    <div className="bg-[#09090d] border border-emerald-500/15 rounded-lg overflow-hidden">
                      
                      {/* Avatar header row */}
                      <div className="p-6 bg-zinc-950/50 border-b border-zinc-900 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                        {tiktokResult.avatarUrl ? (
                          <div className="p-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full shrink-0">
                            <img 
                              src={tiktokResult.avatarUrl} 
                              alt="TikTok Profile Avatar"
                              referrerPolicy="no-referrer"
                              className="w-20 h-20 rounded-full object-cover border-2 border-zinc-950 bg-zinc-900"
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-600 shrink-0">No Pic</div>
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                            <h3 className="text-base font-bold text-white">{tiktokResult.name}</h3>
                            {tiktokResult.verified.includes("Ya") && (
                              <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[8px] font-bold uppercase tracking-wider">
                                Verified
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-emerald-400 font-mono">@{tiktokResult.username}</p>
                          <p className="text-[10px] text-zinc-400 max-w-md italic mt-2">"{tiktokResult.bio || "Tidak ada bio."}"</p>
                        </div>
                      </div>

                      {/* Stat Grid counters */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-zinc-900 bg-zinc-950/20 text-center font-mono">
                        <div className="p-4 border-r border-b sm:border-b-0 border-zinc-900">
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">Followers</span>
                          <span className="text-base font-bold text-emerald-400 mt-1 block">{tiktokResult.followers}</span>
                        </div>
                        <div className="p-4 border-r border-b sm:border-b-0 border-zinc-900">
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">Following</span>
                          <span className="text-base font-bold text-emerald-400 mt-1 block">{tiktokResult.following}</span>
                        </div>
                        <div className="p-4 border-r border-zinc-900">
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">Likes</span>
                          <span className="text-base font-bold text-emerald-400 mt-1 block">{tiktokResult.likes}</span>
                        </div>
                        <div className="p-4">
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">Video</span>
                          <span className="text-base font-bold text-emerald-400 mt-1 block">{tiktokResult.videos}</span>
                        </div>
                      </div>

                      {/* Profile detail rows */}
                      <div className="p-6 space-y-3.5 text-xs font-mono">
                        <div className="flex justify-between py-1.5 border-b border-zinc-900/40">
                          <span className="text-zinc-500">Status Akun</span>
                          <span className="font-bold text-zinc-300">{tiktokResult.isPrivate}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-zinc-900/40">
                          <span className="text-zinc-500">Wilayah / Negara</span>
                          <span className="font-bold text-zinc-300 uppercase">{tiktokResult.region}</span>
                        </div>
                        <div className="flex justify-between py-1.5">
                          <span className="text-zinc-500">Scraping Engine</span>
                          <span className="font-bold text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                            ACTIVE CACHED (5m)
                          </span>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="bg-[#09090d] border border-emerald-500/10 rounded-lg p-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-3">
                      <Search className="w-8 h-8 text-zinc-700" />
                      <span>Hasil pencarian profil TikTok akan muncul di panel ini.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 5. VIEW TAB: IN-APP AI PLAYGROUND (NEW FEATURE) */}
          {activeTab === "ai_test" && (
            <div className="space-y-6">
              <div className="border-b border-emerald-500/10 pb-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Playground Gemini 3.5 Flash AI</h3>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Uji coba chatbot AI Anda secara langsung dari web dashboard. Fitur ini menggunakan engine Google GenAI SDK (`@google/genai`) yang sama dengan command `.ai` pada WhatsApp bot Anda.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left interactive chat terminal input */}
                <div className="lg:col-span-5 bg-[#09090d] border border-emerald-500/10 rounded-lg p-6 space-y-4">
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-widest border-b border-zinc-900 pb-2">AI Query Terminal</h4>
                  
                  <form onSubmit={handleInAppAIQuerySubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Tanya Gemini AI</label>
                      <textarea 
                        rows={4}
                        value={inAppAIQuery}
                        onChange={(e) => setInAppAIQuery(e.target.value)}
                        placeholder="contoh: Tuliskan kode python sederhana untuk kalkulator"
                        className="w-full bg-zinc-950 border border-emerald-500/15 rounded px-4 py-2.5 text-xs font-mono text-emerald-400 outline-none focus:border-emerald-500 transition-all placeholder-zinc-850 resize-none leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={inAppAILoading || !inAppAIQuery.trim()}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-[#0c2214] disabled:text-emerald-700 font-bold text-xs rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {inAppAILoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Memikirkan Jawaban...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Kirim Prompt ke AI
                        </>
                      )}
                    </button>
                  </form>

                  <div className="p-4 rounded bg-zinc-950/40 border border-emerald-500/5 text-[9px] text-zinc-500 leading-relaxed space-y-1.5 font-mono">
                    <span className="font-bold text-zinc-400 block uppercase">🤖 SISTEM ASSISTANT</span>
                    <p>• Model: `gemini-3.5-flash`</p>
                    <p>• Kecepatan respon: &lt; 2 detik</p>
                    <p>• Di WhatsApp, command ini dipicu dengan mengetik `.ai &lt;pertanyaan&gt;`.</p>
                  </div>
                </div>

                {/* Right chat response output console */}
                <div className="lg:col-span-7 space-y-4 flex flex-col h-full">
                  <div className="bg-black border border-emerald-500/10 rounded-lg flex-1 min-h-[300px] flex flex-col justify-between overflow-hidden shadow-inner font-mono">
                    
                    <div className="p-4 border-b border-zinc-900 bg-zinc-950/40 flex justify-between items-center text-[9px] text-zinc-500">
                      <span>CONSOLE OUTPUT: GEMINI RESPONDER</span>
                      <span className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${inAppAILoading ? "bg-amber-500 animate-ping" : "bg-emerald-500"}`} />
                        {inAppAILoading ? "EXECUTING..." : "READY"}
                      </span>
                    </div>

                    <div className="p-6 overflow-y-auto max-h-[420px] space-y-4 flex-1 text-xs select-text scrollbar-thin">
                      {inAppAIResult ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                            <span>🤖 GEMINI AI RESPONSE:</span>
                          </div>
                          <div className="p-4 bg-zinc-950 rounded border border-emerald-500/5 text-zinc-300 whitespace-pre-wrap leading-relaxed font-mono">
                            {inAppAIResult}
                          </div>
                        </div>
                      ) : inAppAILoading ? (
                        <div className="text-zinc-600 uppercase tracking-widest text-[9px] text-center py-20 animate-pulse">
                          ⏳ SEDANG MERUMUSKAN JAWABAN SANGAT CERDAS...
                        </div>
                      ) : (
                        <div className="text-zinc-600 text-center py-24 uppercase tracking-widest text-[9px]">
                          Menunggu input prompt dari terminal kiri...
                        </div>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 7. VIEW TAB: CHAT SIMULATOR */}
          {activeTab === "chat_simulator" && (
            <div className="space-y-6">
              <div className="border-b border-emerald-500/10 pb-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Virtual WhatsApp Chat Simulator</h3>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Kirim pesan simulasi ke WhatsApp bot Anda langsung dari sini! Anda dapat menguji seluruh command bot (seperti `.menu`, `.ping`, `.owner`, atau `.tiktok`) tanpa memerlukan scan QR/pairing HP fisik.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left config/shortcut panel (4 columns) */}
                <div className="lg:col-span-4 bg-[#09090d] border border-emerald-500/10 rounded-lg p-6 space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold text-white uppercase tracking-widest border-b border-zinc-900 pb-2 flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      Simulator Settings
                    </h4>
                    
                    <div className="space-y-4 mt-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Sender Name (PushName)</label>
                        <input 
                          type="text"
                          value={chatSenderName}
                          onChange={(e) => setChatSenderName(e.target.value)}
                          placeholder="User Termux"
                          className="w-full bg-zinc-950 border border-emerald-500/15 rounded px-3 py-1.5 text-xs font-mono text-emerald-400 outline-none focus:border-emerald-500 transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Sender Phone JID</label>
                        <input 
                          type="text"
                          value={chatSenderPhone}
                          onChange={(e) => setChatSenderPhone(e.target.value)}
                          placeholder="628999999999"
                          className="w-full bg-zinc-950 border border-emerald-500/15 rounded px-3 py-1.5 text-xs font-mono text-emerald-400 outline-none focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-white uppercase tracking-widest border-b border-zinc-900 pb-2 flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                      Quick Command Shortcuts
                    </h4>
                    <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">Klik perintah di bawah untuk langsung menyalin ke kotak pesan:</p>
                    
                    <div className="grid grid-cols-2 gap-2 mt-3 font-mono">
                      <button 
                        onClick={() => setChatInput(".menu")}
                        className="py-1.5 px-2 bg-zinc-950 hover:bg-[#0c2214] hover:text-emerald-400 border border-emerald-500/10 text-[10px] font-bold text-zinc-400 rounded transition-all text-left truncate cursor-pointer"
                      >
                        ⚡ .menu
                      </button>
                      <button 
                        onClick={() => setChatInput(".ping")}
                        className="py-1.5 px-2 bg-zinc-950 hover:bg-[#0c2214] hover:text-emerald-400 border border-emerald-500/10 text-[10px] font-bold text-zinc-400 rounded transition-all text-left truncate cursor-pointer"
                      >
                        ⚡ .ping
                      </button>
                      <button 
                        onClick={() => setChatInput(".owner")}
                        className="py-1.5 px-2 bg-zinc-950 hover:bg-[#0c2214] hover:text-emerald-400 border border-emerald-500/10 text-[10px] font-bold text-zinc-400 rounded transition-all text-left truncate cursor-pointer"
                      >
                        ⚡ .owner
                      </button>
                      <button 
                        onClick={() => setChatInput(".button")}
                        className="py-1.5 px-2 bg-zinc-950 hover:bg-[#0c2214] hover:text-emerald-400 border border-emerald-500/10 text-[10px] font-bold text-zinc-400 rounded transition-all text-left truncate cursor-pointer"
                      >
                        ⚡ .button
                      </button>
                      <button 
                        onClick={() => setChatInput(".tt fuji_an")}
                        className="py-1.5 px-2 bg-zinc-950 hover:bg-[#0c2214] hover:text-emerald-400 border border-emerald-500/10 text-[10px] font-bold text-zinc-400 rounded transition-all text-left truncate cursor-pointer col-span-2"
                      >
                        ⚡ .tt &lt;username&gt;
                      </button>
                      <button 
                        onClick={() => setChatInput(".tiktok https://www.tiktok.com/@gibran_rakabuming/video/7339798418047978757")}
                        className="py-1.5 px-2 bg-zinc-950 hover:bg-[#0c2214] hover:text-emerald-400 border border-emerald-500/10 text-[10px] font-bold text-zinc-400 rounded transition-all text-left truncate col-span-2 cursor-pointer"
                      >
                        ⚡ .tiktok &lt;url&gt;
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded bg-zinc-950/40 border border-emerald-500/5 text-[9px] text-zinc-500 leading-relaxed space-y-1 font-mono">
                    <span className="font-bold text-zinc-400 block uppercase">💡 CARA PENGGUNAAN</span>
                    <p>• Nyalakan bot terlebih dahulu di Dashboard utama (ONLINE).</p>
                    <p>• Ketik perintah dengan prefix titik (.) seperti <code className="text-emerald-400">.menu</code></p>
                    <p>• Pesan balasan dikirimkan secara otomatis oleh command handler bot yang sesungguhnya!</p>
                  </div>

                  <div className="p-4 rounded bg-emerald-500/5 border border-emerald-500/15 text-[9px] text-emerald-400/90 leading-relaxed space-y-2 font-mono">
                    <span className="font-bold text-white block uppercase flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      🔌 TERMUX BOT BRIDGE
                    </span>
                    <p>Mendukung koneksi Termux eksternal tanpa Baileys/Sharp native yang berat!</p>
                    <ol className="list-decimal pl-3 space-y-1 text-zinc-400">
                      <li>Pastikan Node.js terinstall di Termux (<code className="text-emerald-400">pkg install nodejs</code>).</li>
                      <li>Jalankan bridge script: <code className="text-emerald-300">node termux-bridge.js</code></li>
                      <li>Koneksi akan otomatis tersambung ke port 3000 WebSocket untuk mengontrol dan mengeksekusi bot command!</li>
                    </ol>
                  </div>
                </div>

                {/* Right chat window (8 columns) */}
                <div className="lg:col-span-8 flex flex-col h-[550px] bg-black border border-emerald-500/10 rounded-lg overflow-hidden shadow-2xl">
                  
                  {/* Chat Box Header */}
                  <div className="p-4 border-b border-zinc-900 bg-[#050507] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
                        W
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">WhatsApp Bot Daemon</span>
                        <span className="text-[9px] text-emerald-400 flex items-center gap-1 font-semibold tracking-wider">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                          ONLINE SIMULATOR
                        </span>
                      </div>
                    </div>

                    <span className="text-[9px] font-mono text-zinc-600">
                      JID: {botState.phoneNumber || "62813371337"}@s.whatsapp.net
                    </span>
                  </div>

                  {/* Message scrollable container */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-zinc-950/20 scrollbar-thin flex flex-col">
                    {chatHistory.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-10 text-zinc-600 space-y-2">
                        <MessageSquare className="w-8 h-8 text-zinc-800" />
                        <p className="text-xs uppercase tracking-wider font-bold">Belum ada aktivitas chat simulator</p>
                        <p className="text-[10px] max-w-sm lowercase leading-relaxed">
                          kirim pesan pertama kamu di bawah (contoh: <code className="text-zinc-400 font-bold">.menu</code> atau <code className="text-zinc-400 font-bold">.ping</code>) untuk melihat respon cerdas bot.
                        </p>
                      </div>
                    ) : (
                      chatHistory.map((msg) => (
                        <div 
                          key={msg.id}
                          className={`flex flex-col max-w-[85%] ${
                            msg.sender === "user" ? "self-end items-end" : "self-start items-start"
                          }`}
                        >
                          {/* Sender label */}
                          <span className="text-[8px] text-zinc-500 font-bold mb-1 uppercase tracking-wider px-1">
                            {msg.sender === "user" ? `${msg.pushName} (User)` : "Bot WhatsApp (System)"}
                          </span>

                          {/* Message bubble */}
                          <div className={`p-3 rounded-lg border text-xs whitespace-pre-wrap leading-relaxed select-text font-mono ${
                            msg.sender === "user" 
                              ? "bg-zinc-950 text-emerald-400 border-emerald-500/20 rounded-tr-none shadow-[0_0_8px_rgba(16,185,129,0.02)]" 
                              : "bg-[#09090d] text-zinc-200 border-zinc-900 rounded-tl-none"
                          }`}>
                            {msg.text}

                            {/* Render media content previews */}
                            {msg.mediaType && msg.mediaUrl && (
                              <div className="mt-3 p-2 bg-black/40 rounded border border-zinc-900 space-y-2">
                                <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider">
                                  📁 MEDIA RECEIVED ({msg.mediaType})
                                </span>
                                {msg.mediaType === "image" && (
                                  <img 
                                    src={msg.mediaUrl} 
                                    alt="Simulated Media" 
                                    className="max-h-40 rounded border border-zinc-800 object-cover mx-auto"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                                {msg.mediaType === "video" && (
                                  <div className="text-[10px] font-mono text-amber-500 bg-amber-500/5 p-2 rounded border border-amber-500/10">
                                    🎥 Simulated Video Playback: <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="underline font-bold text-emerald-400 break-all">{msg.mediaUrl}</a>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Time label */}
                          <span className="text-[7px] text-zinc-600 font-mono mt-0.5 px-1">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input form footer */}
                  <form onSubmit={handleSendChatMessage} className="p-4 border-t border-zinc-900 bg-[#050507] flex gap-2 items-center">
                    <input 
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={botState.status !== "CONNECTED" || chatLoading}
                      placeholder={
                        botState.status === "CONNECTED" 
                          ? "Ketik pesan simulasi di sini... (contoh: .menu, .ping)" 
                          : "Silakan hubungkan bot terlebih dahulu di tab Dashboard (OFFLINE)"
                      }
                      className="flex-1 bg-zinc-950 border border-emerald-500/10 rounded px-4 py-2.5 text-xs font-mono text-emerald-400 outline-none focus:border-emerald-500 transition-all placeholder-zinc-800 disabled:opacity-50"
                    />

                    <button
                      type="submit"
                      disabled={!chatInput.trim() || botState.status !== "CONNECTED" || chatLoading}
                      className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-[#0c2214] disabled:text-emerald-800 font-bold text-xs rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {chatLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Kirim
                    </button>
                  </form>

                </div>

              </div>
            </div>
          )}

          {/* 6. VIEW TAB: LOCALHOST INFO */}
          {activeTab === "localhost" && (
            <div className="space-y-6 max-w-4xl mx-auto py-2">
              
              <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-emerald-400 space-y-3 font-mono">
                <h3 className="text-xs font-bold flex items-center gap-2 uppercase tracking-wide border-b border-emerald-500/10 pb-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  Kenapa alamat 'localhost' tidak muncul langsung?
                </h3>
                <p className="text-[10px] leading-relaxed text-zinc-400">
                  Dashboard interaktif dan engine WhatsApp bot Anda saat ini **tidak berjalan di komputer lokal fisik Anda**. 
                  Proyek ini berjalan di server cloud Google Cloud Run virtual. 
                  Dev server berjalan di port internal 3000 di dalam cloud VM tersebut, dan dibungkus proxy web AI Studio.
                </p>
              </div>

              <div className="space-y-6">
                
                {/* Section 1 */}
                <div className="bg-[#09090d] border border-emerald-500/10 rounded-lg p-6 space-y-3.5">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-zinc-900 pb-2">
                    1. Cara Mengakses Web Dashboard Anda Saat Ini
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                    Anda sudah berada di web dashboard cloud Anda yang terhubung secara real-time ke bot. 
                    Setiap interaksi atau penautan pairing code di web ini langsung memengaruhi bot WhatsApp Anda di server. 
                    Anda dapat menggunakan link URL pengembangan aktif di browser Anda:
                  </p>
                  <div className="p-3.5 rounded bg-zinc-950 border border-emerald-500/15 text-xs text-emerald-400 select-all font-mono break-all flex items-center justify-between shadow-inner">
                    <span>{window.location.origin}</span>
                    <button 
                      onClick={() => copyToClipboard(window.location.origin)} 
                      className="text-zinc-500 hover:text-white transition-all ml-4 cursor-pointer"
                      title="Salin Link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Section 2 */}
                <div className="bg-[#09090d] border border-emerald-500/10 rounded-lg p-6 space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-zinc-900 pb-2">
                    2. Cara Menjalankan Di Localhost Komputer Anda Sendiri
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                    Jika Anda ingin mengembangkan bot ini secara offline atau memindahkan eksekusi bot sepenuhnya ke komputer pribadi Anda (localhost):
                  </p>
                  
                  <div className="space-y-4 pl-1">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded bg-zinc-950 border border-emerald-500/10 text-[10px] font-mono font-bold flex items-center justify-center text-emerald-400 shrink-0">1</div>
                      <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                        Unduh salinan penuh proyek ini dengan mengklik menu pengaturan di sudut kanan atas layar AI Studio, lalu pilih **Export to ZIP** atau **Export to GitHub**.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded bg-zinc-950 border border-emerald-500/10 text-[10px] font-mono font-bold flex items-center justify-center text-emerald-400 shrink-0">2</div>
                      <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                        Ekstrak folder ZIP di komputer Anda, lalu buka aplikasi terminal/command prompt lokal Anda dan masuk ke direktori folder tersebut:
                        <code className="block p-2.5 mt-2 rounded bg-black border border-zinc-900 text-yellow-500 font-mono text-[11px] select-all">
                          cd /path/ke/folder-proyek-anda
                        </code>
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded bg-zinc-950 border border-emerald-500/10 text-[10px] font-mono font-bold flex items-center justify-center text-emerald-400 shrink-0">3</div>
                      <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                        Pastikan komputer Anda sudah terinstal Node.js v18+. Jalankan instalasi seluruh modul dependency:
                        <code className="block p-2.5 mt-2 rounded bg-black border border-zinc-900 text-yellow-500 font-mono text-[11px] select-all">
                          npm install
                        </code>
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded bg-zinc-950 border border-emerald-500/10 text-[10px] font-mono font-bold flex items-center justify-center text-emerald-400 shrink-0">4</div>
                      <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                        Nyalakan server pengembangan lokal:
                        <code className="block p-2.5 mt-2 rounded bg-black border border-zinc-900 text-yellow-500 font-mono text-[11px] select-all">
                          npm run dev
                        </code>
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded bg-zinc-950 border border-emerald-500/10 text-[10px] font-mono font-bold flex items-center justify-center text-emerald-400 shrink-0">5</div>
                      <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                        Buka browser PC Anda dan ketik alamat localhost berikut untuk mengelola bot:
                        <code className="block p-2.5 mt-2 rounded bg-black border border-emerald-500/15 text-emerald-400 font-bold font-mono text-[11px] select-all">
                          http://localhost:3000
                        </code>
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>

        {/* TERMUX BOTTOM SHORTCUT BAR / KEYBOARD BAR (THE 'BOTTOM' COMPONENT) */}
        <div className="bg-[#070709] border-t border-emerald-500/15 h-12 flex items-center justify-between px-4 overflow-x-auto select-none gap-3 shrink-0 scrollbar-none z-10 shadow-lg">
          {/* Virtual Terminal Keys */}
          <div className="flex items-center gap-1 shrink-0 font-mono text-[10px] font-bold text-zinc-500">
            <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-900 text-zinc-400 cursor-pointer active:bg-zinc-900 select-none">ESC</span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-900 text-zinc-400 cursor-pointer active:bg-zinc-900 select-none">CTRL</span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-900 text-zinc-400 cursor-pointer active:bg-zinc-900 select-none">ALT</span>
          </div>

          {/* Quick Tab Selectors */}
          <div className="flex items-center gap-1.5 shrink-0 font-mono">
            <button 
              onClick={() => {
                setActiveTab("dashboard");
                setLogsSearch("");
              }}
              className={`px-2 py-1 text-[9px] font-bold rounded border transition-all cursor-pointer ${
                activeTab === "dashboard" 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" 
                  : "bg-zinc-950/60 text-zinc-500 border-zinc-900/60 hover:text-white"
              }`}
            >
              [ DASHBOARD ]
            </button>
            <button 
              onClick={() => setActiveTab("commands")}
              className={`px-2 py-1 text-[9px] font-bold rounded border transition-all cursor-pointer ${
                activeTab === "commands" 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" 
                  : "bg-zinc-950/60 text-zinc-500 border-zinc-900/60 hover:text-white"
              }`}
            >
              [ CMDS ]
            </button>
            <button 
              onClick={() => setActiveTab("logs")}
              className={`px-2 py-1 text-[9px] font-bold rounded border transition-all cursor-pointer ${
                activeTab === "logs" 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" 
                  : "bg-zinc-950/60 text-zinc-500 border-zinc-900/60 hover:text-white"
              }`}
            >
              [ LOGS ]
            </button>
            <button 
              onClick={() => setActiveTab("ai_test")}
              className={`px-2 py-1 text-[9px] font-bold rounded border transition-all cursor-pointer ${
                activeTab === "ai_test" 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" 
                  : "bg-zinc-950/60 text-zinc-500 border-zinc-900/60 hover:text-white"
              }`}
            >
              [ PLAYGROUND-AI ]
            </button>
            <button 
              onClick={() => setActiveTab("tiktok")}
              className={`px-2 py-1 text-[9px] font-bold rounded border transition-all cursor-pointer ${
                activeTab === "tiktok" 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" 
                  : "bg-zinc-950/60 text-zinc-500 border-zinc-900/60 hover:text-white"
              }`}
            >
              [ TIKTOK ]
            </button>
          </div>

          {/* Sesi control action shortkeys */}
          <div className="flex items-center gap-1.5 shrink-0 font-mono">
            <button 
              onClick={handleBackupSession}
              disabled={backupLoading}
              className="px-2 py-1 text-[9px] bg-[#0c2214] hover:bg-[#12301c] border border-emerald-500/20 text-emerald-400 font-bold rounded transition-all cursor-pointer disabled:opacity-45"
              title="Backup Sesi ke Workspace"
            >
              {backupLoading ? "SAVING..." : "SAVE_SES"}
            </button>
            <button 
              onClick={handleExportSession}
              className="px-2 py-1 text-[9px] bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-zinc-400 font-bold rounded transition-all cursor-pointer"
              title="Export Sesi ke Komputer"
            >
              EXP_SES
            </button>
            <button 
              onClick={() => setImportModalOpen(true)}
              className="px-2 py-1 text-[9px] bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-zinc-400 font-bold rounded transition-all cursor-pointer"
              title="Import Sesi"
            >
              IMP_SES
            </button>
          </div>
        </div>

        {/* Footer Credit bar */}
        <footer className="h-10 bg-[#050507] border-t border-emerald-500/5 flex items-center justify-between px-6 text-[9px] text-zinc-700 shrink-0 select-none font-mono">
          <span>© 2026 BaileysOS Terminal Console. All rights reserved.</span>
          <span>Crafted for Termux & Cloud Deployments</span>
        </footer>

      </div>

      {/* IMPORT SESSION BACKUP MODAL (POP-UP) */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-[#09090d] border border-emerald-500/20 rounded-lg max-w-xl w-full overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-emerald-500/10 bg-zinc-950 flex justify-between items-center text-emerald-400 font-bold">
              <span>UPLOAD & IMPORT BACKUP SESSION JSON</span>
              <button 
                onClick={() => {
                  setImportModalOpen(false);
                  setImportJSONText("");
                }}
                className="hover:text-white transition-all text-sm font-bold p-1 cursor-pointer"
              >
                ✖
              </button>
            </div>
            
            <form onSubmit={handleImportSessionSubmit} className="p-6 space-y-4">
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Tempel teks cadangan JSON sesi WhatsApp Anda di bawah ini, atau drag-and-drop file cadangan `.json` langsung ke dalam kotak textarea.
              </p>

              {/* Drag-and-drop File Box */}
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className="w-full h-32 bg-zinc-950 border border-dashed border-emerald-500/20 rounded flex flex-col items-center justify-center text-center p-4 hover:border-emerald-500/40 transition-all cursor-pointer select-none"
              >
                <Upload className="w-6 h-6 text-emerald-500/40 animate-pulse mb-1.5" />
                <span className="text-[10px] text-zinc-400 font-bold">DRAG & DROP FILE .JSON DI SINI</span>
                <span className="text-[9px] text-zinc-600 mt-1">Atau tempelkan kode cadangan di kolom input di bawah</span>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Isi JSON Cadangan</label>
                <textarea 
                  rows={6}
                  value={importJSONText}
                  onChange={(e) => setImportJSONText(e.target.value)}
                  placeholder='{"config.json": "...", ...}'
                  className="w-full bg-zinc-950 border border-emerald-500/15 rounded p-3 text-[10px] font-mono text-emerald-400 outline-none focus:border-emerald-500 transition-all placeholder-zinc-850 resize-none leading-relaxed"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-zinc-900/40">
                <button 
                  type="button"
                  onClick={() => {
                    setImportModalOpen(false);
                    setImportJSONText("");
                  }}
                  className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 rounded font-bold text-[10px] text-zinc-400 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={backupLoading || !importJSONText.trim()}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded text-[10px] transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import & Hubungkan Bot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
