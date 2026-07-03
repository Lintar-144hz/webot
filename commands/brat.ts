import { Command } from "../lib/commands.js";
import axios from "axios";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Helper function to convert the Brat image buffer to WebP sticker using system Ffmpeg
async function imageToWebp(buffer: Buffer): Promise<Buffer> {
  const tempDir = os.tmpdir();
  const rand = Math.random().toString(36).substring(2, 15);
  const inputPath = path.join(tempDir, `brat-in-${rand}.png`);
  const outputPath = path.join(tempDir, `brat-out-${rand}.webp`);

  await fs.promises.writeFile(inputPath, buffer);

  // Scale image to 512x512 pixels and pad to maintain aspect ratio with transparent background
  const ffmpegCmd = `ffmpeg -i "${inputPath}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=black@0" -y "${outputPath}"`;

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
          return reject(new Error("Gagal membuat file stiker Brat."));
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
      const apiUrl = `https://brat.caliphdev.com/api/brat?text=${encodeURIComponent(textToUse)}`;
      
      const response = await axios.get(apiUrl, {
        responseType: "arraybuffer",
        timeout: 10000 // 10s timeout
      });

      const imageBuffer = Buffer.from(response.data);

      // Convert the image to a high-quality WebP sticker using Ffmpeg
      const stickerBuffer = await imageToWebp(imageBuffer);

      // Send the completed sticker back to WhatsApp
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
          { text: `❌ *Error:* Gagal memproses stiker Brat. Silakan coba beberapa saat lagi.\nDetail: ${error.message || error}` },
          { quoted: msg }
        );
      }
    }
  }
};

export default bratCommand;
