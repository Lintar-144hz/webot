import { Command, getUniqueCommands } from "../lib/commands.js";
import { config } from "../config/config.js";

const menuCommand: Command = {
  name: "menu",
  aliases: ["help", "h", "m"],
  category: "info",
  description: "Menampilkan daftar seluruh command bot WhatsApp",
  usage: ".menu",
  execute: async (sock, msg, args, fullText) => {
    const from = msg.key.remoteJid;
    const uniqueCmds = getUniqueCommands();
    
    // Group commands by category
    const categories: { [key: string]: Command[] } = {};
    for (const cmd of uniqueCmds) {
      const cat = cmd.category || "other";
      if (!categories[cat]) {
        categories[cat] = [];
      }
      categories[cat].push(cmd);
    }

    let menuText = `📱 *${config.botName}* 📱
Halo! Saya adalah Bot WhatsApp serbaguna yang cepat dan modern.

*Prefix:* ${config.prefixes.join(" atau ")}

`;

    // Map Category name to beautiful titles with emojis
    const categoryIcons: { [key: string]: string } = {
      download: "📥 DOWNLOADER",
      info: "ℹ️ INFO & HELP",
      utility: "⚡ UTILITY",
      owner: "👑 OWNER ONLY",
      other: "🧩 LAIN-LAIN"
    };

    for (const [category, cmds] of Object.entries(categories)) {
      const title = categoryIcons[category] || `📂 ${category.toUpperCase()}`;
      menuText += `*${title}*\n`;
      for (const cmd of cmds) {
        menuText += ` ├ • *${config.defaultPrefix}${cmd.name}* \n`;
        menuText += ` │   _${cmd.description}_\n`;
      }
      menuText += ` └ •\n\n`;
    }

    menuText += `💡 _Ketik \`${config.defaultPrefix}<nama-command>\` untuk menggunakan bot._
👑 _Owner Bot: Tarzz (Hubungi lewat .owner)_`;

    await sock.sendMessage(from, { text: menuText }, { quoted: msg });
  }
};

export default menuCommand;
