import express from "express";
import { getBotState, connectWhatsApp, disconnectWhatsApp, clearSession } from "../lib/waClient.js";
import { getStats } from "../utils/stats.js";
import { logBuffer, clearLogs, addLog } from "../utils/logger.js";
import { getUniqueCommands } from "../lib/commands.js";
import { getTiktokProfile } from "../lib/tiktok.js";
import {
  saveSessionToWorkspace,
  restoreSessionFromWorkspace,
  hasSessionBackup,
  getSessionBackupPayload,
  importSessionBackup
} from "../utils/sessionStorage.js";
import { GoogleGenAI } from "@google/genai";

const router = express.Router();

// GET status of bot
router.get("/status", (req, res) => {
  res.json(getBotState());
});

// POST connect with phone (triggers pairing code)
router.post("/connect", async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Nomor telepon harus diisi." });
  }
  
  try {
    addLog(`Dashboard triggered connect with phone: ${phone}`, "INFO");
    const state = await connectWhatsApp(phone);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal menghubungkan WhatsApp." });
  }
});

// POST disconnect
router.post("/disconnect", async (req, res) => {
  try {
    await disconnectWhatsApp();
    res.json({ success: true, message: "WhatsApp terputus." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal memutuskan WhatsApp." });
  }
});

// POST logout / clear session
router.post("/logout", (req, res) => {
  try {
    clearSession();
    res.json({ success: true, message: "Berhasil logout dan menghapus session." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal logout." });
  }
});

// GET stats
router.get("/stats", (req, res) => {
  res.json(getStats());
});

// GET commands list
router.get("/commands", (req, res) => {
  const uniqueCmds = getUniqueCommands().map(c => ({
    name: c.name,
    aliases: c.aliases || [],
    category: c.category,
    description: c.description,
    usage: c.usage
  }));
  res.json(uniqueCmds);
});

// GET logs
router.get("/logs", (req, res) => {
  res.json({ logs: logBuffer });
});

// POST clear logs
router.post("/logs/clear", (req, res) => {
  clearLogs();
  res.json({ success: true, message: "Log berhasil dibersihkan." });
});

// GET TikTok user profile
router.get("/tiktok", async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: "Username tidak boleh kosong." });
  }

  try {
    const profile = await getTiktokProfile(username as string);
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Terjadi kesalahan saat mengambil data." });
  }
});

// POST restart bot
router.post("/restart", async (req, res) => {
  try {
    addLog("Restarting WhatsApp Bot...", "INFO");
    const currentState = getBotState();
    
    // Simple reconnect
    await connectWhatsApp(currentState.phoneNumber || "");
    res.json({ success: true, message: "Bot berhasil direstart." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal merestart bot." });
  }
});

// GET session backup status
router.get("/session/backup-status", (req, res) => {
  res.json({ hasBackup: hasSessionBackup() });
});

// POST save session to workspace backup
router.post("/session/backup", (req, res) => {
  const success = saveSessionToWorkspace();
  if (success) {
    res.json({ success: true, message: "Sesi berhasil dicadangkan ke workspace." });
  } else {
    res.status(500).json({ error: "Gagal mencadangkan sesi. Pastikan bot sudah terhubung." });
  }
});

// POST restore session from workspace backup
router.post("/session/restore", async (req, res) => {
  const success = restoreSessionFromWorkspace();
  if (success) {
    try {
      // Reconnect bot using restored files
      await connectWhatsApp();
      res.json({ success: true, message: "Sesi berhasil dipulihkan dan bot sedang menghubungkan kembali." });
    } catch (err: any) {
      res.status(500).json({ error: `Sesi dipulihkan tetapi gagal menghubungkan bot: ${err.message}` });
    }
  } else {
    res.status(404).json({ error: "Tidak ada cadangan sesi yang ditemukan." });
  }
});

// GET export session backup file
router.get("/session/export", (req, res) => {
  const payload = getSessionBackupPayload();
  if (payload) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=whatsapp_session_backup.json");
    res.send(payload);
  } else {
    res.status(404).json({ error: "Cadangan sesi tidak ditemukan atau gagal dibuat." });
  }
});

// POST import session backup file
router.post("/session/import", async (req, res) => {
  const { backupJSON } = req.body;
  if (!backupJSON) {
    return res.status(400).json({ error: "Payload data cadangan tidak boleh kosong." });
  }
  
  const success = importSessionBackup(backupJSON);
  if (success) {
    try {
      await connectWhatsApp();
      res.json({ success: true, message: "Data cadangan berhasil diimport dan bot sedang menghubungkan kembali." });
    } catch (err: any) {
      res.status(500).json({ error: `Cadangan berhasil diimport tetapi gagal menghubungkan bot: ${err.message}` });
    }
  } else {
    res.status(400).json({ error: "Gagal mengimport data cadangan. Format JSON tidak sesuai atau creds.json tidak ditemukan." });
  }
});

let apiAiClient: GoogleGenAI | null = null;
function getApiAIClient() {
  if (!apiAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined.");
    }
    apiAiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return apiAiClient;
}

// POST ask in-app AI
router.post("/ai", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt tidak boleh kosong." });
  }
  try {
    const ai = getApiAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are the smart assistant in the WhatsApp Bot Dashboard. Keep your response concise, clear, and in Indonesian.",
      }
    });
    res.json({ text: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal menghubungi Gemini AI." });
  }
});

export default router;
