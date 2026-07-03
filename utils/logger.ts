import { getSocketIO } from "../lib/socket.js";

export const logBuffer: string[] = [];
const MAX_LOGS = 200;

export function addLog(message: string, level: "INFO" | "WARN" | "ERROR" | "SUCCESS" | "BOT" = "INFO") {
  const timestamp = new Date().toLocaleTimeString("id-ID", { hour12: false });
  const logLine = `[${timestamp}] [${level}] ${message}`;
  
  // Print to system console
  if (level === "ERROR") {
    console.error(logLine);
  } else if (level === "WARN") {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }

  // Push to buffer
  logBuffer.push(logLine);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }

  // Broadcast to Web Dashboard via Socket.IO
  const io = getSocketIO();
  if (io) {
    io.emit("new-log", logLine);
  }
}

export function clearLogs() {
  logBuffer.length = 0;
  const io = getSocketIO();
  if (io) {
    io.emit("logs-cleared");
  }
}
