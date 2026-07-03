import express from "express";
import { getBotState, connectWhatsApp, disconnectWhatsApp, clearSession } from "../lib/waClient.js";
import { getStats } from "../utils/stats.js";
import { logBuffer, clearLogs, addLog } from "../utils/logger.js";
import { getUniqueCommands } from "../lib/commands.js";
import { getTiktokProfile } from "../lib/tiktok.js";

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

export default router;
