/**
 * ====================================================================
 * ULTRA-LIGHTWEIGHT TERMUX BOT WEBSOCKET BRIDGE CLIENT (NO NATIVE DEPS)
 * ====================================================================
 * This script is 100% compatible with Termux. It has zero native binary
 * dependencies like sharp, libsignal, or protobuf. It communicates
 * directly with the dashboard server via secure WebSockets.
 *
 * Cara menjalankan di Termux:
 * 1. Install Node.js: `pkg install nodejs`
 * 2. Masuk ke folder project: `cd <folder_project>`
 * 3. Jalankan: `node termux-bridge.js`
 * ====================================================================
 */

import { io } from "socket.io-client";
import readline from "readline";

// Server configuration (default to local dashboard port)
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";

console.clear();
console.log("\x1b[1;32m================================================================");
console.log("       TERMUX LIGHTWEIGHT WEBSOCKET BRIDGE CLIENT (ONLINE)");
console.log("================================================================\x1b[0m");
console.log(`Menghubungkan ke server: \x1b[1;36m${SERVER_URL}\x1b[0m ...`);

const socket = io(SERVER_URL, {
  reconnectionAttempts: 5,
  timeout: 10000
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "\x1b[1;32mtermux-bot> \x1b[0m"
});

socket.on("connect", () => {
  console.log("\x1b[1;32m✓ Sukses terhubung ke Dashboard WebSocket Gateway!\x1b[0m");
  console.log("Silakan masukkan pesan atau command bot di bawah (Contoh: \x1b[1;36m.menu\x1b[0m atau \x1b[1;36m.ping\x1b[0m):");
  console.log("\x1b[90mTekan Ctrl+C untuk keluar dari bridge.\x1b[0m\n");
  rl.prompt();
});

socket.on("connect_error", (err) => {
  console.log(`\x1b[1;31m❌ Gagal terhubung ke server: ${err.message}\x1b[0m`);
  console.log("Pastikan server dashboard Anda sudah dijalankan dengan: \x1b[1;33mnpm run dev\x1b[0m");
  process.exit(1);
});

// Listen to chat messages from the server
socket.on("new-chat-message", (msg) => {
  if (msg.sender === "bot") {
    console.log(`\n\x1b[1;35m[BOT] ${msg.pushName || "Bot"}:\x1b[0m`);
    console.log(`\x1b[32m${msg.text}\x1b[0m`);
    if (msg.mediaType) {
      console.log(`\x1b[33m[Media: ${msg.mediaType}] - Url: ${msg.mediaUrl}\x1b[0m`);
    }
    console.log();
    rl.prompt();
  } else {
    // Show local confirmation for user simulator messages
    console.log(`\n\x1b[1;34m[USER] ${msg.pushName || "User"}:\x1b[0m ${msg.text}`);
    rl.prompt();
  }
});

// Listen to bot state changes
socket.on("bot-state", (state) => {
  console.log(`\n\x1b[1;33m[SISTEM] Status Bot berubah menjadi: ${state.status} (HP: ${state.phoneNumber || "None"})\x1b[0m`);
  rl.prompt();
});

// Handle error events
socket.on("termux-error", (err) => {
  console.log(`\n\x1b[1;31m❌ Error: ${err.message}\x1b[0m`);
  rl.prompt();
});

rl.on("line", (line) => {
  const text = line.trim();
  if (text) {
    // Send simulated message to server
    socket.emit("termux-message", {
      text: text,
      senderName: "Termux User",
      senderPhone: "628999999999"
    });
  } else {
    rl.prompt();
  }
}).on("close", () => {
  console.log("\n\x1b[1;33mBridge terputus. Sampai jumpa!\x1b[0m");
  process.exit(0);
});
