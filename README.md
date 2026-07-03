# 📱 TarzzBot - Modern WhatsApp Bot & Dashboard

TarzzBot adalah bot WhatsApp modern modular dengan UI Dashboard admin berbasis web yang responsif, modern (dark mode), didukung oleh **Node.js, Express.js, Baileys, Socket.IO, dan Tailwind CSS**. Bot ini dirancang agar sangat mudah dijalankan secara lokal di Termux Android maupun dideploy di VPS Linux (Ubuntu, Debian, dll).

---

## 🌟 Fitur Utama

- **Dashboard Web Modern**: Visualisasi status, konsumsi resource server (RAM, CPU), dan total data masuk secara real-time.
- **Pairing Code Login**: Hubungkan WhatsApp Anda secara langsung dari dashboard web hanya dengan kode pairing angka, tanpa perlu scan kode QR.
- **Live Terminal Console**: Log aktivitas bot ditampilkan secara real-time pada dashboard menggunakan Socket.IO.
- **Sistem Command Modular**: Command secara otomatis terdeteksi dari folder `/commands/` tanpa perlu me-restart server atau mendaftarkannya secara manual di file utama.
- **Video Downloader TikTok**: Command `.tiktok <url>` mendownload dan mengirimkan video TikTok tanpa watermark langsung ke ruang obrolan WhatsApp beserta detail metadata.
- **Auto Reconnect & Session Saver**: Sesi login disimpan secara aman di folder `/session/`. Bot otomatis terhubung kembali ketika server berjalan, tanpa perlu pairing ulang.

---

## 📂 Struktur Project

```text
├── config/             # Pengaturan global bot (Nama bot, prefix, kontak owner)
├── commands/           # File command modular (.ping, .menu, .owner, .tiktok)
├── lib/                # Library inti integrasi Baileys & WebSockets
├── routes/             # Router API endpoints Express
├── utils/              # Helper utilitas (Logger, stats tracker, TikTok parser)
├── session/            # Penyimpan file credential & sesi WhatsApp (Auto-generated)
├── public/             # File statis publik
└── src/                # Frontend React SPA (Vite + Tailwind CSS)
```

---

## 🚀 Panduan Instalasi & Penggunaan

### 1. Instalasi di Termux (Android)

Buka aplikasi Termux Anda, pastikan koneksi internet stabil, lalu jalankan perintah berikut secara berurutan:

```bash
# Update & upgrade repositori Termux
pkg update && pkg upgrade -y

# Install git, nodejs, dan build tools essential jika diperlukan
pkg install git nodejs -y

# Clone repositori bot (ganti URL jika dideploy lewat repo sendiri)
git clone <URL_REPOSITORI>
cd whatsapp-bot-dashboard

# Install dependensi
npm install

# Jalankan dalam mode development
npm run dev
```

### 2. Instalasi di Ubuntu / VPS Linux

Hubungkan ke VPS Anda melalui SSH, lalu ikuti langkah instalasi berikut:

```bash
# Update sistem dan install Node.js (direkomendasikan Node 18 ke atas)
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verifikasi instalasi Node.js & npm
node -v
npm -v

# Clone repositori & masuk ke direktori
git clone <URL_REPOSITORI>
cd whatsapp-bot-dashboard

# Install dependensi
npm install

# Build asset produksi
npm run build

# Jalankan aplikasi secara background menggunakan PM2
sudo npm install -g pm2
pm2 start dist/server.cjs --name "tarzzbot"

# Untuk memantau log bot via PM2
pm2 logs tarzzbot
```

---

## 🛠️ Cara Menambah Command Baru

Sistem command bot menggunakan struktur modular. Anda cukup membuat file baru berformat `.ts` atau `.js` di dalam direktori `commands/`. Bot akan langsung mendeteksinya pada startup berikutnya.

### Template Command Baru (`commands/halo.ts`)

```typescript
import { Command } from "../lib/commands.js";

const haloCommand: Command = {
  name: "halo",                  // Nama pemanggil command utama (misal: .halo)
  aliases: ["hello", "hi"],      // Alias pemanggil alternatif (misal: .hello)
  category: "utility",           // Kategori command (untuk tampilan di .menu)
  description: "Menyapa pengguna WhatsApp",
  usage: ".halo",
  execute: async (sock, msg, args, fullText) => {
    const from = msg.key.remoteJid;
    const senderName = msg.pushName || "Kawan";
    
    await sock.sendMessage(from, { text: `Halo ${senderName}! Selamat datang di TarzzBot.` }, { quoted: msg });
  }
};

export default haloCommand;
```

---

## 💾 Cara Backup Sesi WhatsApp

Seluruh informasi koneksi, autentikasi sesi, dan token tersimpan di dalam folder **`session/`**.
- **Untuk Backup**: Salin atau arsipkan seluruh isi direktori `session/` ke tempat yang aman.
- **Untuk Restore**: Ekstrak atau salin kembali folder `session/` tersebut ke direktori utama bot Anda sebelum menjalankan `npm start`. Bot akan langsung mendeteksi sesi lama dan login secara otomatis tanpa perlu pairing ulang.

---

## 🔑 Pengaturan Bot (`config/config.ts`)

Anda dapat menyesuaikan nama bot, nama owner, nomor WhatsApp owner, dan prefix pemanggilan perintah di file `/config/config.ts`:

```typescript
export const config = {
  ownerNumber: "628123456789", // Ubah ke nomor WhatsApp Anda tanpa "+" atau spasi
  ownerName: "Tarzz",
  botName: "TarzzBot",
  prefixes: [".", "!"],         // Karakter prefix perintah yang diizinkan
  defaultPrefix: ".",
  port: 3000,
  tiktokApiUrl: "https://tikwm.com/api/"
};
```

---

*Dibuat dengan dedikasi penuh untuk performa tinggi, modularitas, dan kestabilan.* 🚀
