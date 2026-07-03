import { Command } from "../lib/commands.js";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { Sticker, StickerTypes } from "wa-sticker-formatter";

const stickerCommand: Command = {
  name: "sticker",
  aliases: ["s", "stiker"],
  category: "utility",
  description: "Mengubah gambar atau video pendek menjadi stiker WhatsApp",
  usage: ".sticker [Pack Name | Author Name] (kirim gambar/video dengan caption .sticker atau reply gambar/video)",
  execute: async (sock, msg, args, fullText) => {
    const from = msg.key.remoteJid;
    const message = msg.message;

    if (!message) return;

    // Determine the source of media: either direct message or quoted message
    let mediaMessage: any = null;
    let mediaType: "image" | "video" | "" = "";

    if (message.imageMessage) {
      mediaMessage = message.imageMessage;
      mediaType = "image";
    } else if (message.videoMessage) {
      mediaMessage = message.videoMessage;
      mediaType = "video";
    } else {
      const quoted = message.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted) {
        if (quoted.imageMessage) {
          mediaMessage = quoted.imageMessage;
          mediaType = "image";
        } else if (quoted.videoMessage) {
          mediaMessage = quoted.videoMessage;
          mediaType = "video";
        }
      }
    }

    if (!mediaMessage || !mediaType) {
      await sock.sendMessage(
        from,
        { text: "❌ *Gagal:* Kirim gambar/video pendek dengan caption `.sticker` atau reply gambar/video yang sudah dikirim dengan ketik `.sticker`." },
        { quoted: msg }
      );
      return;
    }

    // Parse custom pack and author names from arguments
    let packName = "Brat Bot Sticker";
    let authorName = "Tarzz Bot";

    if (args.length > 0) {
      const parts = args.join(" ").split("|");
      if (parts[0]) packName = parts[0].trim();
      if (parts[1]) authorName = parts[1].trim();
    }

    await sock.sendMessage(from, { text: "⏳ Sedang memproses stiker..." }, { quoted: msg });

    try {
      // Download the media content from WhatsApp servers
      const stream = await downloadContentFromMessage(mediaMessage, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      // Check video duration if it's a video
      if (mediaType === "video" && mediaMessage.seconds > 10) {
        await sock.sendMessage(
          from,
          { text: "⚠️ *Peringatan:* Video terlalu panjang. Maksimal durasi video untuk stiker adalah 10 detik." },
          { quoted: msg }
        );
        return;
      }

      // Format the sticker using wa-sticker-formatter
      const sticker = new Sticker(buffer, {
        pack: packName,
        author: authorName,
        type: StickerTypes.FULL,
        quality: 70
      });

      const stickerBuffer = await sticker.toBuffer();

      // Send the sticker back to WhatsApp
      await sock.sendMessage(
        from,
        { sticker: stickerBuffer },
        { quoted: msg }
      );

    } catch (error: any) {
      await sock.sendMessage(
        from,
        { text: `❌ *Error:* Gagal memproses stiker. Detail: ${error.message || error}` },
        { quoted: msg }
      );
    }
  }
};

export default stickerCommand;
