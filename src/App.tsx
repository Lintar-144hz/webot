import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Terminal, 
  Zap, 
  Phone, 
  Play, 
  Square, 
  RefreshCw, 
  LogOut, 
  Cpu, 
  Database, 
  ShieldAlert, 
  Clock, 
  Code,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Download,
  BookOpen,
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
  const [phoneInput, setPhoneInput] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Show dynamic toast
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

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
      }
    });

    socket.on("new-log", (newLog: string) => {
      setLogs(prev => [...prev.slice(-199), newLog]);
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

  // Auto scroll terminal log to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Handle WhatsApp Connection via Pairing Code
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput) {
      showToast("Silakan masukkan nomor WhatsApp Anda.", "error");
      return;
    }
    
    // Simple verification
    let formatted = phoneInput.replace(/[^0-9]/g, "");
    if (!formatted.startsWith("62") && formatted.startsWith("0")) {
      formatted = "62" + formatted.slice(1);
    }
    
    showToast(`Memproses pairing code untuk ${formatted}...`, "info");
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatted })
      }).then(r => r.json());

      if (res.error) {
        showToast(res.error, "error");
      } else {
        showToast("Minta Pairing Code berhasil!", "success");
      }
    } catch (err) {
      showToast("Gagal melakukan permintaan Pairing Code.", "error");
    }
  };

  // Handle Disconnect
  const handleDisconnect = async () => {
    if (!confirm("Apakah Anda yakin ingin memutuskan koneksi WhatsApp?")) return;
    try {
      const res = await fetch("/api/disconnect", { method: "POST" }).then(r => r.json());
      if (res.error) {
        showToast(res.error, "error");
      } else {
        showToast("WhatsApp berhasil diputuskan.", "success");
      }
    } catch (err) {
      showToast("Gagal memutuskan koneksi WhatsApp.", "error");
    }
  };

  // Handle Logout (Clear Session)
  const handleLogout = async () => {
    if (!confirm("Apakah Anda yakin ingin logout? Ini akan menghapus seluruh data session dan Anda harus memasukkan Pairing Code kembali.")) return;
    try {
      const res = await fetch("/api/logout", { method: "POST" }).then(r => r.json());
      if (res.error) {
        showToast(res.error, "error");
      } else {
        showToast("Berhasil logout dan menghapus session.", "success");
        setBotState({ status: "DISCONNECTED", phoneNumber: "", pairingCode: null });
      }
    } catch (err) {
      showToast("Gagal logout.", "error");
    }
  };

  // Handle Restart Bot
  const handleRestart = async () => {
    try {
      showToast("Sedang merestart bot...", "info");
      const res = await fetch("/api/restart", { method: "POST" }).then(r => r.json());
      if (res.error) {
        showToast(res.error, "error");
      } else {
        showToast("Bot berhasil direstart.", "success");
      }
    } catch (err) {
      showToast("Gagal merestart bot.", "error");
    }
  };

  // Handle Clear Logs
  const handleClearLogs = async () => {
    try {
      await fetch("/api/logs/clear", { method: "POST" });
    } catch (err) {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <MessageSquare className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">TarzzBot Dashboard</h1>
          <p className="text-sm text-gray-400 animate-pulse">Menghubungkan ke server backend...</p>
        </div>
      </div>
    );
  }

  // Get status badge styling
  const getStatusBadge = () => {
    switch (botState.status) {
      case "CONNECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Connected
          </span>
        );
      case "CONNECTING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            Connecting
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-100 font-sans overflow-hidden">
      
      {/* Sidebar aside */}
      <aside className="w-64 border-r border-zinc-800/50 flex flex-col bg-[#0c0c0e] shrink-0 hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <MessageSquare className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold tracking-tight text-xl text-white">
            Baileys<span className="text-emerald-500">OS</span>
          </span>
        </div>
        
        <nav className="flex-1 px-4 py-2 space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold px-2 mb-2">Control Panel</div>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-zinc-800/50 rounded-lg text-emerald-400 font-medium text-xs transition-all">
            <Zap className="w-4 h-4 text-emerald-400" />
            Dashboard
          </a>
          <a href="#commands" className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/30 rounded-lg text-zinc-400 font-medium text-xs transition-all">
            <Code className="w-4 h-4 text-zinc-500" />
            Commands List
          </a>
        </nav>
        
        <div className="p-4 mt-auto border-t border-zinc-800/50">
          <div className="bg-zinc-900/50 rounded-xl p-3 flex items-center gap-3 border border-zinc-800/30">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 text-xs font-bold font-mono">
              TZ
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Tarzz Owner</div>
              <div className="text-[10px] text-zinc-500">v1.0.0-stable</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#09090b] overflow-y-auto">
        
        {/* Header */}
        <header className="h-16 border-b border-zinc-800/50 flex items-center justify-between px-6 sm:px-8 bg-[#09090b] shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold md:hidden text-white flex items-center gap-1.5 mr-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                BaileysOS
              </span>
            </div>
            {/* Live connection badge */}
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/20 rounded-full">
              <div className={`w-2 h-2 rounded-full ${botState.status === "CONNECTED" ? "bg-emerald-500 animate-pulse" : botState.status === "CONNECTING" ? "bg-amber-500 animate-ping" : "bg-red-500"}`} />
              <span className="text-[11px] font-medium text-emerald-400 font-mono capitalize">
                System: {botState.status.toLowerCase()}
              </span>
            </div>
            
            {botState.phoneNumber && (
              <>
                <div className="h-4 w-px bg-zinc-800 hidden sm:block"></div>
                <span className="text-xs text-zinc-400 hidden sm:inline">
                  Session: <span className="text-zinc-100 font-mono">+{botState.phoneNumber}</span>
                </span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={handleRestart}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Restart Bot</span>
            </button>
            {botState.status === "CONNECTED" && (
              <button 
                onClick={handleDisconnect}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg transition-all"
              >
                Logout
              </button>
            )}
          </div>
        </header>

        {/* Content View */}
        <div className="flex-1 p-6 sm:p-8 space-y-6 flex flex-col min-h-0">
          
          {/* Toast Notification */}
          {toast && (
            <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm max-w-sm transition-all duration-300 animate-bounce bg-zinc-900 border-zinc-800 text-zinc-100">
              {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
              {toast.type === "error" && <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
              {toast.type === "info" && <HelpCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
              <span className="font-medium">{toast.message}</span>
            </div>
          )}

          {/* Statistics Section */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-900/40 border border-zinc-800/50 p-4 rounded-2xl">
              <div className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Uptime</div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-white font-mono">{stats.uptime}</div>
            </div>
            
            <div className="bg-zinc-900/40 border border-zinc-800/50 p-4 rounded-2xl">
              <div className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Total Messages</div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-white font-mono">
                {stats.totalMessages.toLocaleString()}
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800/50 p-4 rounded-2xl">
              <div className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Total Users</div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-white font-mono">
                {stats.totalUsers.toLocaleString()}
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800/50 p-4 rounded-2xl">
              <div className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Commands Executed</div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-white font-mono">
                {stats.totalCommands} <span className="text-emerald-400 text-xs ml-1">total</span>
              </div>
            </div>
          </section>

          {/* Quick Connection & Performance Metrics */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-shrink-0">
            
            {/* Left Box: Quick Connection */}
            <div className="lg:col-span-8 bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-4 flex-1 w-full">
                <div>
                  <h3 className="text-base font-semibold text-white">Quick Connection</h3>
                  <p className="text-xs text-zinc-500">Ready to connect via WhatsApp Pairing Code</p>
                </div>
                
                {botState.status === "CONNECTED" ? (
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 font-mono">
                      <CheckCircle2 className="w-4 h-4" />
                      Active: +{botState.phoneNumber}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDisconnect}
                        className="py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <Square className="w-3.5 h-3.5" />
                        Disconnect
                      </button>
                      <button
                        onClick={handleLogout}
                        className="py-2 px-4 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white font-semibold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 border border-red-500/20"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Logout
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <form onSubmit={handleConnect} className="flex flex-col sm:flex-row gap-3">
                      <input 
                        type="text" 
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="628123456789" 
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700 placeholder-zinc-600 font-mono"
                        disabled={botState.status === "CONNECTING"}
                      />
                      <button
                        type="submit"
                        disabled={botState.status === "CONNECTING"}
                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-black font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Generate Code
                      </button>
                    </form>
                    
                    {botState.pairingCode && (
                      <div className="flex flex-col gap-2 p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl max-w-md">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Your Pairing Code:</div>
                        <div className="bg-zinc-950 border border-zinc-700 px-4 py-2.5 rounded-lg font-mono text-lg font-bold tracking-[0.25em] text-emerald-400 shadow-inner inline-block w-fit animate-pulse">
                          {botState.pairingCode}
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-normal">
                          Masukkan kode ini di HP WhatsApp Anda melalui menu <strong>Perangkat Tertaut {"→"} Tautkan Perangkat {"→"} Tautkan dengan nomor telepon saja</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="w-32 h-32 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl flex flex-col items-center justify-center gap-2 shrink-0">
                <div className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50 text-zinc-400">
                  <Phone className="w-6 h-6" />
                </div>
                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Pairing Mode</span>
              </div>
            </div>

            {/* Right Box: Resource Metrics */}
            <div className="lg:col-span-4 space-y-4 bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-2xl justify-center flex flex-col">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-zinc-400 font-medium">CPU USAGE</span>
                  <span className="text-xs text-emerald-400 font-bold font-mono">{stats.cpuPercent}%</span>
                </div>
                <div className="w-full bg-zinc-800/50 h-1.5 rounded-full overflow-hidden border border-zinc-800/30">
                  <div 
                    className="bg-emerald-500 h-full rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-500" 
                    style={{ width: `${stats.cpuPercent}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-zinc-400 font-medium">RAM USAGE</span>
                  <span className="text-xs text-emerald-400 font-bold font-mono">{stats.ramUsed}</span>
                </div>
                <div className="w-full bg-zinc-800/50 h-1.5 rounded-full overflow-hidden border border-zinc-800/30">
                  <div 
                    className="bg-emerald-500 h-full rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-500" 
                    style={{ width: `${stats.ramPercent}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-zinc-500 font-mono flex justify-between items-center border-t border-zinc-800/40">
                <span>Platform: {stats.platform}</span>
                <span>Node: {stats.nodeVersion}</span>
              </div>
            </div>
          </section>

          {/* Bottom Grid: Commands Directory and Terminal Logs */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
            
            {/* Left Panel: Commands Directory */}
            <div id="commands" className="lg:col-span-5 bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-2xl flex flex-col max-h-[400px] lg:max-h-[500px]">
              <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2 pb-2 border-b border-zinc-800/50 shrink-0">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Commands Directory ({commands.length})
              </h3>
              
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
                {commands.map((cmd) => (
                  <div key={cmd.name} className="p-3 bg-zinc-950/40 hover:bg-zinc-950/80 rounded-xl border border-zinc-800/50 transition-all">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-emerald-400 font-mono">.{cmd.name}</span>
                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-emerald-300 border border-zinc-800/60">
                        {cmd.category}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">{cmd.description}</p>
                    <div className="mt-1.5 text-[9px] font-mono text-zinc-500 flex justify-between">
                      <span>Usage: {cmd.usage}</span>
                      {cmd.aliases.length > 0 && <span>Aliases: {cmd.aliases.join(", ")}</span>}
                    </div>
                  </div>
                ))}
                {commands.length === 0 && (
                  <p className="text-center text-zinc-500 py-6 font-mono">No commands loaded.</p>
                )}
              </div>
            </div>

            {/* Right Panel: Terminal Activity Log */}
            <div className="lg:col-span-7 bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-2xl flex flex-col max-h-[400px] lg:max-h-[500px]">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800/50 shrink-0">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  Realtime Activity Log
                </h3>
                <button 
                  onClick={handleClearLogs}
                  className="text-[10px] text-zinc-500 hover:text-white uppercase font-bold tracking-wider transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Console
                </button>
              </div>
              
              <div className="flex-1 bg-[#050508] border border-zinc-800 rounded-xl p-4 font-mono text-[11px] leading-relaxed overflow-y-auto flex flex-col space-y-1.5">
                {logs.map((log, index) => {
                  let colorClass = "text-zinc-500";
                  if (log.includes("[ERROR]")) colorClass = "text-red-400 font-medium";
                  else if (log.includes("[WARN]")) colorClass = "text-amber-400";
                  else if (log.includes("[SUCCESS]")) colorClass = "text-emerald-400";
                  else if (log.includes("[BOT]")) colorClass = "text-emerald-500 font-medium";
                  else if (log.includes("[INFO]")) colorClass = "text-zinc-400";

                  return (
                    <div key={index} className={`${colorClass} whitespace-pre-wrap leading-relaxed`}>
                      {log}
                    </div>
                  );
                })}
                {logs.length === 0 && (
                  <div className="text-zinc-500 italic text-center py-8">Waiting for activities...</div>
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <footer className="mt-auto border-t border-zinc-800/50 py-4 text-center text-[10px] text-zinc-600 bg-[#09090b]">
          <p>© 2026 BaileysOS. Crafted professionally with Baileys & Node.js.</p>
        </footer>
      </main>

    </div>
  );
}
