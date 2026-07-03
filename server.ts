import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

import apiRouter from "./routes/api.js";
import { setSocketIO } from "./lib/socket.js";
import { connectWhatsApp } from "./lib/waClient.js";
import { addLog } from "./utils/logger.js";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Setup Socket.IO
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Save Socket.IO instance to reference store
  setSocketIO(io);

  const PORT = 3000;

  // Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve API Router
  app.use("/api", apiRouter);

  // Serve Frontend depending on environment
  if (process.env.NODE_ENV !== "production") {
    addLog("Mounting Vite middleware in development mode...", "INFO");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    addLog("Serving compiled static files in production mode...", "INFO");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Socket connection handler
  io.on("connection", (socket) => {
    addLog(`Dashboard client connected: ${socket.id}`, "INFO");
    
    socket.on("disconnect", () => {
      addLog(`Dashboard client disconnected: ${socket.id}`, "INFO");
    });
  });

  // Start Server
  server.listen(PORT, "0.0.0.0", async () => {
    addLog(`Server is running on http://localhost:${PORT}`, "SUCCESS");

    // Auto-connect WhatsApp if session exists
    const sessionDir = path.join(process.cwd(), "session");
    if (fs.existsSync(path.join(sessionDir, "creds.json"))) {
      addLog("Existing session found. Auto-reconnecting to WhatsApp...", "INFO");
      try {
        await connectWhatsApp();
      } catch (err: any) {
        addLog(`Auto-reconnect failed: ${err.message}`, "ERROR");
      }
    } else {
      addLog("No active session. Waiting for connection request from Dashboard.", "INFO");
    }
  });
}

startServer().catch((err) => {
  console.error("Fatal: failed to start Express + Baileys server", err);
});
