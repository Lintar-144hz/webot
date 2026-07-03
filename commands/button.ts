import { Command } from "../lib/commands.js";
import { config } from "../config/config.js";

const buttonCommand: Command = {
  name: "button",
  aliases: ["buttons", "tombol", "interactive"],
  category: "utility",
  description: "Menampilkan menu interaktif menggunakan tombol WhatsApp",
  usage: ".button",
  execute: async (sock, msg, args, fullText) => {
    const from = msg.key.remoteJid;

    const welcomeText = `👋 Halo! Selamat datang di Menu Pintasan Interaktif.

Silakan pilih tindakan cepat Anda menggunakan tombol di bawah ini atau ketik perintahnya secara manual.`;

    // Define the interactive buttons for Baileys
    const buttons = [
      {
        buttonId: "action_menu",
        buttonText: { displayText: "📱 Tampilkan Menu" },
        type: 1
      },
      {
        buttonId: "action_owner",
        buttonText: { displayText: "👑 Hubungi Owner" },
        type: 1
      },
      {
        buttonId: "action_ai",
        buttonText: { displayText: "🤖 Tanya Gemini AI" },
        type: 1
      }
    ];

    const buttonMessage = {
      text: welcomeText,
      footer: `Prefix Bot Anda: ${config.defaultPrefix}`,
      buttons: buttons,
      headerType: 1
    };

    try {
      // Send the button message via Baileys
      await sock.sendMessage(from, buttonMessage, { quoted: msg });
    } catch (err: any) {
      // Fallback if buttons fail on newer WhatsApp business APIs / MD versions
      const fallbackText = `👋 *Menu Pintasan Pintar* 👋

Silakan ketik atau klik perintah di bawah ini untuk mengakses fitur cepat:

1️⃣ *Tampilkan Menu utama*
👉 Ketik \`${config.defaultPrefix}menu\`

2️⃣ *Hubungi Owner / Developer*
👉 Ketik \`${config.defaultPrefix}owner\`

3️⃣ *Tanya Gemini AI Pintar*
👉 Ketik \`${config.defaultPrefix}ai\`

💡 _Gunakan menu numerik di atas jika tombol interaktif tidak muncul di aplikasi WhatsApp Anda._`;

      await sock.sendMessage(from, { text: fallbackText }, { quoted: msg });
    }
  }
};

export default buttonCommand;
