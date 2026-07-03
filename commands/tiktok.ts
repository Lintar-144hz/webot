import { Command } from "../lib/commands.js";
import { getTiktokInfo } from "../utils/tiktok.js";

const tiktokCommand: Command = {
  name: "tiktok",
  aliases: ["tiktokdl", "ttdl"],
  category: "download",
  description: "Mendownload video TikTok tanpa watermark melalui URL",
  usage: ".tiktok <url_video_tiktok>",
  execute: async (sock, msg, args, fullText) => {
    const from = msg.key.remoteJid;
    
    if (args.length === 0) {
      await sock.sendMessage(
        from, 
        { text: "❌ Silakan masukkan URL video TikTok. Contoh: \n`.tiktok https://vt.tiktok.com/ZS2xxxxx/`" }, 
        { quoted: msg }
      );
      return;
    }

    const url = args[0];
    
    // Send a searching/loading indicator text
    await sock.sendMessage(from, { text: "⏳ Sedang memproses URL TikTok..." }, { quoted: msg });

    try {
      const videoInfo = await getTiktokInfo(url);
      
      const captionText = `📥 *TIKTOK DOWNLOADER*

📝 *Judul:* ${videoInfo.title}
👤 *Pembuat:* ${videoInfo.author} (@${videoInfo.username})
⏱️ *Durasi:* ${videoInfo.duration} detik
👁️ *Views:* ${videoInfo.views.toLocaleString()} | ❤️ *Likes:* ${videoInfo.likes.toLocaleString()}
💬 *Komentar:* ${videoInfo.comments.toLocaleString()} | 🔄 *Shares:* ${videoInfo.shares.toLocaleString()}

🚀 _Mengirimkan video tanpa watermark..._`;

      if (videoInfo.downloadUrl) {
        // Send the video directly with caption
        await sock.sendMessage(
          from, 
          { 
            video: { url: videoInfo.downloadUrl }, 
            caption: captionText 
          }, 
          { quoted: msg }
        );
      } else {
        // Fallback: Send thumbnail and raw link
        await sock.sendMessage(
          from,
          {
            image: { url: videoInfo.thumbnail },
            caption: `${captionText}\n\n⚠️ _Gagal mendownload file video secara otomatis, silakan download manual di tautan ini:_ \n${videoInfo.downloadUrl}`
          },
          { quoted: msg }
        );
      }

    } catch (error: any) {
      await sock.sendMessage(
        from, 
        { text: `❌ *Error:* ${error.message || "Gagal memproses video TikTok. Pastikan video bersifat publik dan tautan benar."}` }, 
        { quoted: msg }
      );
    }
  }
};

export default tiktokCommand;
