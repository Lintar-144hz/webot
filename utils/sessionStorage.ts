import fs from "fs";
import path from "path";
import { addLog } from "./logger.js";

const BACKUP_PATH = path.join(process.cwd(), "config", "session_backup.json");
const SESSION_DIR = path.join(process.cwd(), "session");

/**
 * Backup all files in the session directory into a single JSON file on the persistent workspace storage
 */
export function saveSessionToWorkspace(): boolean {
  if (!fs.existsSync(SESSION_DIR)) {
    addLog("Backup failed: session directory does not exist", "WARN");
    return false;
  }
  
  try {
    const backup: Record<string, string> = {};
    const files = fs.readdirSync(SESSION_DIR);
    
    let fileCount = 0;
    for (const file of files) {
      const filePath = path.join(SESSION_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile() && file.endsWith(".json")) {
        const content = fs.readFileSync(filePath, "utf-8");
        backup[file] = content;
        fileCount++;
      }
    }
    
    if (fileCount === 0) {
      addLog("Backup skipped: No session files found to backup.", "INFO");
      return false;
    }
    
    // Ensure config dir exists
    const configDir = path.dirname(BACKUP_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2), "utf-8");
    addLog(`Successfully backed up ${fileCount} session files to workspace storage.`, "SUCCESS");
    return true;
  } catch (err: any) {
    addLog(`Failed to backup session files: ${err.message}`, "WARN");
    return false;
  }
}

/**
 * Restore session files from the persistent workspace backup JSON file
 */
export function restoreSessionFromWorkspace(): boolean {
  if (!fs.existsSync(BACKUP_PATH)) {
    addLog("No session backup found in workspace storage.", "INFO");
    return false;
  }
  
  try {
    const backupContent = fs.readFileSync(BACKUP_PATH, "utf-8");
    const backup: Record<string, string> = JSON.parse(backupContent);
    
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    
    let fileCount = 0;
    for (const [file, content] of Object.entries(backup)) {
      const filePath = path.join(SESSION_DIR, file);
      fs.writeFileSync(filePath, content, "utf-8");
      fileCount++;
    }
    
    addLog(`Successfully restored ${fileCount} session files from workspace backup.`, "SUCCESS");
    return true;
  } catch (err: any) {
    addLog(`Failed to restore session files: ${err.message}`, "WARN");
    return false;
  }
}

/**
 * Check if a persistent session backup exists
 */
export function hasSessionBackup(): boolean {
  return fs.existsSync(BACKUP_PATH);
}

/**
 * Get the session backup payload for manual download
 */
export function getSessionBackupPayload(): string | null {
  if (!fs.existsSync(BACKUP_PATH)) {
    // If no backup exists, try creating one right now
    const backedUp = saveSessionToWorkspace();
    if (!backedUp) return null;
  }
  
  try {
    return fs.readFileSync(BACKUP_PATH, "utf-8");
  } catch (err) {
    return null;
  }
}

/**
 * Import a manually uploaded session backup JSON
 */
export function importSessionBackup(backupJSON: string): boolean {
  try {
    // Validate JSON structure
    const backup = JSON.parse(backupJSON);
    if (typeof backup !== "object" || backup === null) {
      throw new Error("Invalid backup format: Must be a JSON object");
    }
    
    // Ensure config.json exists in the backup to be valid
    if (!backup["config.json"]) {
      throw new Error("Invalid session backup: Missing config.json");
    }
    
    // Ensure config dir exists and write backup file
    const configDir = path.dirname(BACKUP_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2), "utf-8");
    
    // Now restore it to /session
    return restoreSessionFromWorkspace();
  } catch (err: any) {
    addLog(`Failed to import uploaded session backup: ${err.message}`, "ERROR");
    return false;
  }
}
