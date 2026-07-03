import path from "path";
import fs from "fs";
import { addLog } from "../utils/logger.js";
import { getSocketIO } from "./socket.js";
import { commandsRegistry, loadCommands } from "./commands.js";
import { incrementMessages, incrementCommands, registerUser } from "../utils/stats.js";
import { config } from "../config/config.js";

export type ConnectionStatus = "CONNECTED" | "CONNECTING" | "DISCONNECTED";

export interface BotState {
  status: ConnectionStatus;
  phoneNumber: string;
  pairingCode: string | null;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: number;
  pushName?: string;
  mediaType?: "image" | "video" | "contact";
  mediaUrl?: string;
}

const botState: BotState = {
  status: "DISCONNECTED",
  phoneNumber: "",
  pairingCode: null
};

// Global chat history for Simulator
const chatHistory: ChatMessage[] = [];

// Simulated Mock Socket compatible with commands
const sock: any = {
  user: { id: "62813371337:1@s.whatsapp.net" },
  sendMessage: async (jid: string, content: any, options?: any) => {
    const text = content.text || content.caption || "";
    let mediaType: "image" | "video" | "contact" | undefined = undefined;
    let mediaUrl: string | undefined = undefined;

    if (content.image) {
      mediaType = "image";
      mediaUrl = content.image.url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe";
    } else if (content.video) {
      mediaType = "video";
      mediaUrl = content.video.url || "https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-32112-large.mp4";
    } else if (content.contacts) {
      mediaType = "contact";
    }

    addLog(`[SENT] Bot dikirim pesan ke ${jid}: ${text || `[Media: ${mediaType}]`}`, "BOT");
    
    // Add to chat history and broadcast
    addChatMessage("bot", text, mediaType, mediaUrl);
    incrementMessages();

    return { key: { id: "BOT-MSG-" + Math.random().toString(36).substring(7).toUpperCase() } };
  }
};

export function getBotState() {
  return { ...botState };
}

export function getSock() {
  return sock;
}

export function getChatHistory() {
  return [...chatHistory];
}

/**
 * Add a message to chat history and broadcast it
 */
export function addChatMessage(
  sender: "user" | "bot",
  text: string,
  mediaType?: "image" | "video" | "contact",
  mediaUrl?: string,
  pushName?: string
) {
  const msg: ChatMessage = {
    id: "MSG-" + Math.random().toString(36).substring(7).toUpperCase(),
    sender,
    text,
    timestamp: Date.now(),
    pushName: pushName || (sender === "bot" ? config.botName : "User"),
    mediaType,
    mediaUrl
  };

  chatHistory.push(msg);

  // Keep history size small (max 100 messages)
  if (chatHistory.length > 100) {
    chatHistory.shift();
  }

  // Broadcast through socket.io
  const io = getSocketIO();
  if (io) {
    io.emit("new-chat-message", msg);
  }
}

/**
 * Clean session files on logout
 */
export function clearSession() {
  botState.status = "DISCONNECTED";
  botState.phoneNumber = "";
  botState.pairingCode = null;
  
  try {
    const sessionDir = path.join(process.cwd(), "session");
    const configPath = path.join(sessionDir, "config.json");
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch (err: any) {
    addLog(`Error clearing session file: ${err.message}`, "WARN");
  }

  addLog("WhatsApp virtual session cleared.", "INFO");
  broadcastState();
}

/**
 * Broadcast current bot state to all web clients
 */
function broadcastState() {
  const io = getSocketIO();
  if (io) {
    io.emit("bot-state", botState);
  }
}

let connectionTimeout: NodeJS.Timeout | null = null;

/**
 * Initialize and connect Simulated WhatsApp
 */
export async function connectWhatsApp(requestedPhone: string = "") {
  if (connectionTimeout) {
    clearTimeout(connectionTimeout);
    connectionTimeout = null;
  }

  let phoneNum = requestedPhone;
  if (!phoneNum) {
    const sessionDir = path.join(process.cwd(), "session");
    const configPath = path.join(sessionDir, "config.json");
    if (fs.existsSync(configPath)) {
      try {
        const stored = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        phoneNum = stored.phoneNumber || "62813371337";
      } catch (err) {
        phoneNum = "62813371337";
      }
    } else {
      phoneNum = "62813371337";
    }
  }

  botState.status = "CONNECTING";
  botState.phoneNumber = phoneNum;
  broadcastState();

  addLog("Initializing WhatsApp Terminal Simulator Socket...", "INFO");
  addLog("Connecting to Virtual WhatsApp Gateway...", "INFO");

  // Load commands
  await loadCommands();

  // Simulate generating pairing code
  setTimeout(() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += "-";
      code += chars.charAt(Math.floor(Date.now() * Math.random() * chars.length) % chars.length);
    }
    
    botState.pairingCode = code;
    broadcastState();
    addLog(`Pairing Code generated successfully: ${code}`, "SUCCESS");
    addLog("Waiting for link confirmation from WhatsApp App...", "INFO");

    // Automatically transition to CONNECTED after 7 seconds to simulate user entering code
    connectionTimeout = setTimeout(() => {
      botState.status = "CONNECTED";
      botState.pairingCode = null;

      // Save state to config.json
      try {
        const sessionDir = path.join(process.cwd(), "session");
        if (!fs.existsSync(sessionDir)) {
          fs.mkdirSync(sessionDir, { recursive: true });
        }
        fs.writeFileSync(
          path.join(sessionDir, "config.json"),
          JSON.stringify({ phoneNumber: phoneNum, status: "CONNECTED", timestamp: Date.now() }, null, 2),
          "utf-8"
        );
      } catch (err: any) {
        addLog(`Failed to save config.json: ${err.message}`, "WARN");
      }

      broadcastState();
      
      addLog(`Pairing code entered on target device (Virtual Android Phone)`, "INFO");
      addLog(`Authenticating virtual session keys...`, "INFO");
      addLog(`WhatsApp successfully connected as: ${phoneNum}`, "SUCCESS");
      
      // Add welcome chat message
      addChatMessage(
        "bot",
        `👋 *Halo! Sesi Bot WhatsApp Anda sekarang aktif di Simulator Termux!* \n\nKetik \`${config.defaultPrefix}menu\` di bawah ini untuk melihat seluruh perintah interaktif yang tersedia.`
      );
    }, 7000);

  }, 1500);

  return botState;
}

/**
 * Shut down the active socket connection
 */
export async function disconnectWhatsApp() {
  if (connectionTimeout) {
    clearTimeout(connectionTimeout);
    connectionTimeout = null;
  }
  addLog("Disconnecting WhatsApp virtual socket...", "INFO");
  clearSession();
}

/**
 * Simulate receiving an incoming message and processing commands
 */
export async function simulateIncomingMessage(text: string, senderName: string = "User", senderPhone: string = "628999999999") {
  if (botState.status !== "CONNECTED") {
    throw new Error("Bot belum terhubung! Silakan isi nomor HP Anda dan hubungkan bot terlebih dahulu.");
  }

  const from = `${senderPhone}@s.whatsapp.net`;

  // 1. Add user message to virtual history
  addChatMessage("user", text, undefined, undefined, senderName);
  incrementMessages();
  registerUser(from);

  addLog(`[VIRTUAL] Incoming message from ${senderName} (${senderPhone}): "${text}"`, "INFO");

  // 2. Process commands
  let isCommand = false;
  let prefixUsed = "";
  for (const prefix of config.prefixes) {
    if (text.startsWith(prefix)) {
      isCommand = true;
      prefixUsed = prefix;
      break;
    }
  }

  if (isCommand) {
    const cleanText = text.slice(prefixUsed.length).trim();
    const args = cleanText.split(/\s+/);
    const commandName = args.shift()?.toLowerCase() || "";

    const command = commandsRegistry.get(commandName);
    if (command) {
      incrementCommands();
      addLog(`Executing command [${commandName}] from ${senderName}`, "BOT");

      try {
        // Construct standard Baileys msg envelope for compatibility
        const mockMsg = {
          key: {
            remoteJid: from,
            fromMe: false,
            id: "TRMX" + Math.random().toString(36).substring(7).toUpperCase()
          },
          message: {
            conversation: text
          },
          pushName: senderName,
          messageTimestamp: Math.floor(Date.now() / 1000)
        };

        // Run the real command file
        await command.execute(sock, mockMsg, args, cleanText);
      } catch (cmdErr: any) {
        addLog(`Error executing [${commandName}]: ${cmdErr.message}`, "ERROR");
        await sock.sendMessage(from, { text: `❌ *Error:* ${cmdErr.message || "Gagal mengeksekusi command."}` });
      }
    } else {
      addLog(`Command [${commandName}] tidak ditemukan.`, "WARN");
      await sock.sendMessage(from, { 
        text: `❌ *Error:* Command \`${config.defaultPrefix}${commandName}\` tidak ditemukan. Ketik \`${config.defaultPrefix}menu\` untuk melihat semua perintah.` 
      });
    }
  }
}
