import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay
} from "@whiskeysockets/baileys";
import path from "path";
import fs from "fs";
import pino from "pino";
import { addLog } from "../utils/logger.js";
import { getSocketIO } from "./socket.js";
import { commandsRegistry, loadCommands } from "./commands.js";
import { incrementMessages, incrementCommands, registerUser } from "../utils/stats.js";
import { config } from "../config/config.js";
import { 
  saveSessionToWorkspace, 
  restoreSessionFromWorkspace 
} from "../utils/sessionStorage.js";

export type ConnectionStatus = "CONNECTED" | "CONNECTING" | "DISCONNECTED";

export interface BotState {
  status: ConnectionStatus;
  phoneNumber: string;
  pairingCode: string | null;
}

const botState: BotState = {
  status: "DISCONNECTED",
  phoneNumber: "",
  pairingCode: null
};

let sock: any = null;
let isReconnecting = false;

export function getBotState() {
  return { ...botState };
}

export function getSock() {
  return sock;
}

/**
 * Clean session files on logout
 */
export function clearSession() {
  const sessionDir = path.join(process.cwd(), "session");
  if (fs.existsSync(sessionDir)) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      addLog("WhatsApp session files deleted", "INFO");
    } catch (err: any) {
      addLog(`Failed to delete session files: ${err.message}`, "WARN");
    }
  }
  
  const backupFile = path.join(process.cwd(), "config", "session_backup.json");
  if (fs.existsSync(backupFile)) {
    try {
      fs.unlinkSync(backupFile);
      addLog("WhatsApp session workspace backup deleted", "INFO");
    } catch (err: any) {
      addLog(`Failed to delete session backup: ${err.message}`, "WARN");
    }
  }

  botState.status = "DISCONNECTED";
  botState.phoneNumber = "";
  botState.pairingCode = null;
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

/**
 * Initialize and connect WhatsApp socket
 */
export async function connectWhatsApp(requestedPhone: string = "") {
  if (sock) {
    try {
      sock.ev.removeAllListeners("connection.update");
      sock.ev.removeAllListeners("creds.update");
      sock.ev.removeAllListeners("messages.upsert");
    } catch (e) {}
  }

  botState.status = "CONNECTING";
  broadcastState();
  addLog("Initializing WhatsApp Baileys socket...", "INFO");

  // Load commands
  await loadCommands();

  const sessionDir = path.join(process.cwd(), "session");
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Restore persistent workspace session if available
  restoreSessionFromWorkspace();

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  // Create Baileys configuration
  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // We use Pairing Code, so don't clutter terminal with QR
    logger: pino({ level: "silent" }) as any, // Silent default pino logger of Baileys to prevent console spam
  });

  // Handle creds update with automatic backup saving
  sock.ev.on("creds.update", async () => {
    await saveCreds();
    saveSessionToWorkspace();
  });

  // Handle connection updates
  sock.ev.on("connection.update", async (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      addLog("Baileys generated a QR code (waiting for Pairing Code instead)", "INFO");
    }

    if (connection === "connecting") {
      botState.status = "CONNECTING";
      broadcastState();
      addLog("Connecting to WhatsApp servers...", "INFO");
    }

    if (connection === "open") {
      const userJid = sock.user?.id;
      // Format number nicely
      const cleanNum = userJid ? userJid.split(":")[0] : "";
      
      botState.status = "CONNECTED";
      botState.phoneNumber = cleanNum;
      botState.pairingCode = null;
      isReconnecting = false;
      broadcastState();
      addLog(`WhatsApp successfully connected as: ${cleanNum}`, "SUCCESS");
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode || lastDisconnect?.error?.code;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      addLog(`Connection closed. StatusCode: ${statusCode}, Reason: ${shouldReconnect ? 'Reconnecting...' : 'Logged Out'}`, "WARN");

      if (shouldReconnect) {
        botState.status = "CONNECTING";
        broadcastState();
        if (!isReconnecting) {
          isReconnecting = true;
          // Exponential backoff or simple timeout before reconnect
          await delay(5000);
          connectWhatsApp(requestedPhone);
        }
      } else {
        clearSession();
        addLog("Logged out from WhatsApp. Session cleared.", "WARN");
      }
    }
  });

  // Handle messages (command processor)
  sock.ev.on("messages.upsert", async (m: any) => {
    if (m.type !== "notify") return;

    for (const msg of m.messages) {
      if (!msg.message) continue;

      const from = msg.key.remoteJid;
      if (!from) continue;

      // Extract message text
      const text = msg.message.conversation || 
                   msg.message.extendedTextMessage?.text || 
                   msg.message.imageMessage?.caption || 
                   msg.message.videoMessage?.caption || "";

      if (!text) continue;

      // Register stats
      incrementMessages();
      registerUser(from);

      // Check if it's a command
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
          addLog(`Executing command [${commandName}] from ${msg.pushName || from}`, "BOT");
          
          try {
            await command.execute(sock, msg, args, cleanText);
          } catch (cmdErr: any) {
            addLog(`Error executing [${commandName}]: ${cmdErr.message}`, "ERROR");
            try {
              await sock.sendMessage(from, { text: `❌ *Error:* ${cmdErr.message || "Gagal mengeksekusi command."}` }, { quoted: msg });
            } catch (sendErr) {}
          }
        }
      }
    }
  });

  // If we are not registered and a phone number was supplied, request a pairing code!
  if (!state.creds.registered && requestedPhone) {
    try {
      // Delay slightly to let socket initialize
      await delay(3000);
      const cleanPhone = requestedPhone.replace(/[^0-9]/g, "");
      addLog(`Requesting Pairing Code for: ${cleanPhone}...`, "INFO");
      const code = await sock.requestPairingCode(cleanPhone);
      botState.pairingCode = code;
      broadcastState();
      addLog(`Pairing Code generated successfully: ${code}`, "SUCCESS");
    } catch (err: any) {
      addLog(`Failed to request pairing code: ${err.message}`, "ERROR");
      botState.pairingCode = null;
      botState.status = "DISCONNECTED";
      broadcastState();
    }
  }

  return botState;
}

/**
 * Shut down the active socket connection
 */
export async function disconnectWhatsApp() {
  addLog("Disconnecting WhatsApp socket...", "INFO");
  if (sock) {
    try {
      await sock.logout();
    } catch (err) {}
    try {
      sock.end(undefined);
    } catch (err) {}
    sock = null;
  }
  clearSession();
}
