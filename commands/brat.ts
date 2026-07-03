import { Command } from "../lib/commands.js";
import axios from "axios";
import { Sticker, StickerTypes } from "wa-sticker-formatter";

const bratCommand: Command = {
  name: "brat",
  aliases: ["brats", "bratsticker"],
  category: "utility",
  description: "Membuat stiker bergaya album Brat (text hijau/hitam khas Charli XCX)",
  usage: ".brat <teks_stiker> atau reply teks dengan .brat",
  execute: async (sock, msg, args, fullText) => {
    const from = msg.key.remoteJid;
    const message = msg.message;

    if (!message) return;

    let textToUse = args.join(" ").trim();

    // If no text is specified, check if there's a quoted message with text
    if (!textToUse) {
      const quoted = message.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted) {
        textToUse = quoted.conversation || 
                    quoted.extendedTextMessage?.text || 
                    quoted.imageMessage?.caption || 
                    quoted.videoMessage?.caption || "";
        textToUse = textToUse.trim();
      }
    }

    if (!textToUse) {
      await sock.sendMessage(
        from,
        { text: "❌ *Gagal:* Silakan masukkan teks untuk stiker Brat. Contoh: `.brat halo dek` atau reply teks seseorang dengan ketik `.brat`." },
        { quoted: msg }
      );
      return;
    }

    await sock.sendMessage(from, { text: "⏳ Sedang memproses stiker Brat..." }, { quoted: msg });

    try {
      // Fetch the Brat green cover text image from the caliphdev public API
      // It returns a standard PNG/JPEG image styled like the Brat album cover
      const apiUrl = `https://brat.caliphdev.com/api/brat?text=${encodeURIComponent(textToUse)}`;
      
      const response = await axios.get(apiUrl, {
        responseType: "arraybuffer",
        timeout: 10000 // 10s timeout
      });

      const imageBuffer = Buffer.from(response.data);

      // Convert the image to a high-quality WebP sticker using wa-sticker-formatter
      const sticker = new Sticker(imageBuffer, {
        pack: "Brat Sticker",
        author: "Tarzz Bot",
        type: StickerTypes.FULL,
        quality: 85
      });

      const stickerBuffer = await sticker.toBuffer();

      // Send the completed sticker back to WhatsApp
      await sock.sendMessage(
        from,
        { sticker: stickerBuffer },
        { quoted: msg }
      );

    } catch (error: any) {
      await sock.sendMessage(
        from,
        { text: `❌ *Error:* Gagal memproses stiker Brat. Silakan coba beberapa saat lagi.\nDetail: ${error.message || error}` },
        { quoted: msg }
      );
    }
  }
};

export default bratCommand;
