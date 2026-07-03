import { Command } from "../lib/commands.js";
import { getStats } from "../utils/stats.js";

const pingCommand: Command = {
  name: "ping",
  aliases: ["speed", "p"],
  category: "utility",
  description: "Melihat kecepatan respon bot dan spesifikasi sistem",
  usage: ".ping",
  execute: async (sock, msg, args, fullText) => {
    const from = msg.key.remoteJid;
    
    // Calculate response speed
    const timestamp = msg.messageTimestamp;
    const now = Math.floor(Date.now() / 1000);
    const speed = Math.max(0, now - (timestamp || now));
    
    // Get server specs/stats
    const stats = getStats();
    
    const responseText = `⚡ *PONG!*
    
• *Speed:* ${speed === 0 ? "< 1" : speed} detik (latency)
• *Runtime:* ${stats.uptime}
• *RAM Usage:* ${stats.ramUsed} / ${stats.totalRam} (${stats.ramPercent}%)
• *CPU Load:* ${stats.cpuPercent}%
• *Platform:* ${stats.platform}
• *Node Version:* ${stats.nodeVersion}`;

    await sock.sendMessage(from, { text: responseText }, { quoted: msg });
  }
};

export default pingCommand;
