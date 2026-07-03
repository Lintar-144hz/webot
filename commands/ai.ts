import { GoogleGenAI } from "@google/genai";
import { Command } from "../lib/commands.js";
import { config } from "../config/config.js";

let aiClient: GoogleGenAI | null = null;

/**
 * Lazy initialization of Google GenAI client to avoid crashes if API Key is missing on startup.
 */
function getAIClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please set it in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const aiCommand: Command = {
  name: "ai",
  aliases: ["ask", "gemini", "tanya"],
  category: "utility",
  description: "Tanya apa saja kepada Gemini AI",
  usage: ".ai <pertanyaan Anda>",
  execute: async (sock, msg, args, fullText) => {
    const from = msg.key.remoteJid;
    
    if (args.length === 0) {
      await sock.sendMessage(
        from, 
        { text: "❌ Silakan masukkan pertanyaan Anda setelah command.\n\n*Contoh:* `.ai jelaskan tentang relativitas einstein`" }, 
        { quoted: msg }
      );
      return;
    }

    const query = args.join(" ");
    
    try {
      // Send a typing indicator or a temporary wait message
      await sock.sendMessage(from, { text: "⏳ Sedang memikirkan jawaban..." }, { quoted: msg });
      
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: query,
        config: {
          systemInstruction: "You are a helpful, smart, and friendly WhatsApp AI Assistant. Keep your answers clear, useful, and formatted nicely in Indonesian language.",
        }
      });
      
      const replyText = response.text;
      
      if (!replyText) {
        throw new Error("Model did not return any text response.");
      }
      
      // Send the beautiful formatted answer
      await sock.sendMessage(
        from, 
        { 
          text: `🤖 *Gemini AI*\n\n${replyText}\n\n💡 _Dibuat menggunakan Google Gemini 3.5 Flash_` 
        }, 
        { quoted: msg }
      );
    } catch (err: any) {
      let errorMessage = "Terjadi kesalahan saat menghubungi server AI.";
      if (err.message && err.message.includes("GEMINI_API_KEY")) {
        errorMessage = "⚠️ Gagal mengakses AI: GEMINI_API_KEY belum dikonfigurasi di server.";
      }
      
      await sock.sendMessage(
        from, 
        { text: `❌ *Error AI:*\n${errorMessage}` }, 
        { quoted: msg }
      );
    }
  },
};

export default aiCommand;
