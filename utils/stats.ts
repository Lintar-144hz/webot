import os from "os";

export const botStats = {
  startTime: Date.now(),
  totalMessages: 0,
  totalCommands: 0,
  uniqueUsers: new Set<string>(),
};

export function incrementMessages() {
  botStats.totalMessages += 1;
}

export function incrementCommands() {
  botStats.totalCommands += 1;
}

export function registerUser(jid: string) {
  if (jid) {
    botStats.uniqueUsers.add(jid);
  }
}

export function getStats() {
  const uptimeMs = Date.now() - botStats.startTime;
  
  // Calculate uptime string (e.g. 1d 5h 20m 15s)
  const seconds = Math.floor((uptimeMs / 1000) % 60);
  const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);
  const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
  
  let uptimeStr = "";
  if (days > 0) uptimeStr += `${days}d `;
  if (hours > 0 || days > 0) uptimeStr += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) uptimeStr += `${minutes}m `;
  uptimeStr += `${seconds}s`;

  // Memory Usage
  const memoryUsage = process.memoryUsage();
  const ramUsed = (memoryUsage.rss / 1024 / 1024).toFixed(1); // RSS in MB
  const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1); // Total RAM in GB

  // Simple CPU usage calculation
  // (In container environment, os.loadavg is available)
  const cpuLoad = os.loadavg()[0] || 0.0;
  const cpuCores = os.cpus().length || 1;
  const cpuPercent = Math.min(Math.round((cpuLoad / cpuCores) * 100), 100);

  return {
    uptime: uptimeStr,
    uptimeMs,
    totalMessages: botStats.totalMessages,
    totalCommands: botStats.totalCommands,
    totalUsers: botStats.uniqueUsers.size,
    ramUsed: `${ramUsed} MB`,
    totalRam: `${totalRam} GB`,
    ramPercent: Math.min(Math.round((memoryUsage.rss / os.totalmem()) * 100), 100),
    cpuPercent,
    platform: os.platform(),
    nodeVersion: process.version,
  };
}
