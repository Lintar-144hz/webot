import { Command } from "../lib/commands.js";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Helper function to convert image/video to WebP sticker using standard system Ffmpeg
async function convertToStickerWebp(buffer: Buffer, mediaType: "image" | "video"): Promise<Buffer> {
  const tempDir = os.tmpdir();
  const rand = Math.random().toString(36).substring(2, 15);
  const inputExt = mediaType === "video" ? ".mp4" : ".png";
  const inputPath = path.join(tempDir, `sticker-in-${rand}${inputExt}`);
  const outputPath = path.join(tempDir, `sticker-out-${rand}.webp`);

  await fs.promises.writeFile(inputPath, buffer);

  let ffmpegCmd = "";
  if (mediaType === "video") {
    // scale to max 512x512, reduce frame rate to 15fps, crop/pad to square, and output animated WebP
    ffmpegCmd = `ffmpeg -i "${inputPath}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(512-iw)/2:(512-ih)/2:color=black@0" -loop 0 -an -vsync 0 -y "${outputPath}"`;
  } else {
    // scale to max 512x512, pad to square, and output static WebP
    ffmpegCmd = `ffmpeg -i "${inputPath}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=black@0" -y "${outputPath}"`;
  }

  return new Promise((resolve, reject) => {
    exec(ffmpegCmd, async (err, stdout, stderr) => {
      // Clean up input file safely
      try {
        if (fs.existsSync(inputPath)) {
          await fs.promises.unlink(inputPath);
        }
      } catch (e) {}

      if (err) {
        const errMsg = stderr || err.message;
        if (errMsg.toLowerCase().includes("not found") || errMsg.toLowerCase().includes("command not found") || err.code === 127) {
          return reject(new Error("FFMPEG_NOT_FOUND"));
        }
        return reject(new Error(`Ffmpeg failed: ${errMsg}`));
      }

      try {
        if (!fs.existsSync(outputPath)) {
          return reject(new Error("Gagal membuat file stiker WebP."));
        }
        const webpBuffer = await fs.promises.readFile(outputPath);
        
        // Clean up output file safely
        try {
          if (fs.existsSync(outputPath)) {
            await fs.promises.unlink(outputPath);
          }
        } catch (e) {}

        resolve(webpBuffer);
      } catch (readErr) {
        reject(readErr);
      }
    });
  });
}

const stickerCommand: Command = {
  name: "sticker",
  aliases: ["s", "stiker"],
  category: "utility",
  description: "Mengubah gambar atau video pendek menjadi stiker WhatsApp",
  usage: ".sticker (kirim gambar/video dengan caption .sticker atau reply gambar/video)",
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

      // Convert media to sticker WebP format using Ffmpeg
      const stickerBuffer = await convertToStickerWebp(buffer, mediaType);

      // Send the sticker back to WhatsApp
      await sock.sendMessage(
        from,
        { sticker: stickerBuffer },
        { quoted: msg }
      );

    } catch (error: any) {
      if (error.message === "FFMPEG_NOT_FOUND") {
        await sock.sendMessage(
          from,
          { text: "❌ *Ffmpeg tidak ditemukan!*\n\nSilakan install `ffmpeg` terlebih dahulu di Termux Anda dengan mengetik:\n👉 `pkg install ffmpeg`" },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(
          from,
          { text: `❌ *Error:* Gagal memproses stiker. Detail: ${error.message || error}` },
          { quoted: msg }
        );
      }
    }
  }
};

export default stickerCommand;
