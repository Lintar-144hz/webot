import { Command } from "../lib/commands.js";
import { getTiktokProfile } from "../lib/tiktok.js";

const ttCommand: Command = {
  name: "tt",
  aliases: ["ttprofile", "tiktokprofile"],
  category: "utility",
  description: "Mengambil informasi profil TikTok publik berdasarkan username",
  usage: ".tt <@username> atau .tt <username>",
  execute: async (sock, msg, args, fullText) => {
    const from = msg.key.remoteJid;

    // Join all args to get the complete input (in case of spaces, though usernames shouldn't have them)
    let username = args.join(" ").trim();

    // Validation: Username cannot be empty
    if (!username) {
      await sock.sendMessage(
        from,
        { text: "❌ Username TikTok tidak boleh kosong. Contoh penggunaan:\n`.tt @username` atau `.tt username`" },
        { quoted: msg }
      );
      return;
    }

    // Remove '@' symbol automatically if present
    if (username.startsWith("@")) {
      username = username.substring(1).trim();
    }

    // Again check if username is empty after removing @
    if (!username) {
      await sock.sendMessage(
        from,
        { text: "❌ Username TikTok tidak boleh kosong." },
        { quoted: msg }
      );
      return;
    }

    // Send a searching/loading indicator
    await sock.sendMessage(from, { text: `⏳ Sedang mengambil data profil untuk @${username}...` }, { quoted: msg });

    try {
      const profile = await getTiktokProfile(username);

      const responseText = `👤 *Nama:* ${profile.name}
🆔 *Username:* @${profile.username}
📝 *Bio:* ${profile.bio}
👥 *Followers:* ${profile.followers}
➡️ *Following:* ${profile.following}
❤️ *Total Likes:* ${profile.likes}
🎬 *Total Video:* ${profile.videos}
✅ *Verified:* ${profile.verified}
🔒 *Private/Public:* ${profile.isPrivate}
🌍 *Region:* ${profile.region}`;

      // Send the formatted profile details text
      await sock.sendMessage(from, { text: responseText }, { quoted: msg });

      // After that, send the profile picture (if available)
      if (profile.avatarUrl) {
        try {
          await sock.sendMessage(
            from,
            { 
              image: { url: profile.avatarUrl }, 
              caption: `🖼️ Foto profil TikTok @${profile.username}` 
            },
            { quoted: msg }
          );
        } catch (imgError) {
          // If image sending fails (e.g. invalid URL or format), log silently but don't fail the command
          console.error("Gagal mengirim foto profil:", imgError);
        }
      }

    } catch (error: any) {
      // Map error messages correctly to requested validation replies
      let replyMessage = "Terjadi kesalahan saat mengambil data.";
      
      if (error.message === "Username TikTok tidak boleh kosong.") {
        replyMessage = "Username TikTok tidak boleh kosong.";
      } else if (error.message.includes("hanya boleh berisi huruf, angka")) {
        replyMessage = error.message;
      } else if (error.message === "Username TikTok tidak ditemukan.") {
        replyMessage = "Username TikTok tidak ditemukan.";
      } else if (error.message === "Terjadi kesalahan saat mengambil data.") {
        replyMessage = "Terjadi kesalahan saat mengambil data.";
      } else {
        replyMessage = error.message || "Terjadi kesalahan saat mengambil data.";
      }

      await sock.sendMessage(
        from,
        { text: `❌ ${replyMessage}` },
        { quoted: msg }
      );
    }
  }
};

export default ttCommand;
