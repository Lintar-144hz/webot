import { Command } from "../lib/commands.js";
import { config } from "../config/config.js";

const ownerCommand: Command = {
  name: "owner",
  aliases: ["creator", "contact"],
  category: "info",
  description: "Menampilkan informasi kontak Owner/Pembuat Bot",
  usage: ".owner",
  execute: async (sock, msg, args, fullText) => {
    const from = msg.key.remoteJid;
    
    const vcard = 'BEGIN:VCARD\n' // vCard format to show as contact card
      + 'VERSION:3.0\n' 
      + `FN:${config.ownerName}\n` 
      + `ORG:${config.botName} Developer;\n` 
      + `TEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:${config.ownerNumber}\n` 
      + 'END:VCARD';

    // First send contact info
    await sock.sendMessage(
      from,
      { 
        contacts: { 
          displayName: config.ownerName, 
          contacts: [{ vcard }] 
        }
      },
      { quoted: msg }
    );

    // Then send some textual message
    const responseText = `👑 *OWNER BOT INFO*

• *Nama:* ${config.ownerName}
• *Nomor:* wa.me/${config.ownerNumber}
• *Deskripsi:* Hubungi kontak di atas jika ingin menanyakan tentang bot, error, request fitur, atau sewa bot.`;

    await sock.sendMessage(from, { text: responseText }, { quoted: msg });
  }
};

export default ownerCommand;
