import fs from "fs";
import path from "path";
import { addLog } from "../utils/logger.js";

export interface Command {
  name: string;
  aliases?: string[];
  category: string;
  description: string;
  usage: string;
  execute: (sock: any, msg: any, args: string[], fullText: string) => Promise<void> | void;
}

export const commandsRegistry = new Map<string, Command>();

/**
 * Dynamically load all commands from the commands/ directory
 */
export async function loadCommands() {
  commandsRegistry.clear();
  const commandsDir = path.join(process.cwd(), "commands");

  if (!fs.existsSync(commandsDir)) {
    fs.mkdirSync(commandsDir, { recursive: true });
    addLog("Created commands/ directory", "INFO");
    return;
  }

  try {
    const files = fs.readdirSync(commandsDir).filter(file => file.endsWith(".ts") || file.endsWith(".js"));
    
    for (const file of files) {
      const filePath = path.join(commandsDir, file);
      // Generate a file:// URL for ES dynamic import to work on Windows and Linux
      const fileUrl = `file://${filePath}`;
      
      try {
        const module = await import(fileUrl);
        const command: Command = module.default || module;
        
        if (command && command.name && typeof command.execute === "function") {
          commandsRegistry.set(command.name.toLowerCase(), command);
          
          if (command.aliases) {
            for (const alias of command.aliases) {
              commandsRegistry.set(alias.toLowerCase(), command);
            }
          }
          addLog(`Loaded command: ${command.name}`, "SUCCESS");
        } else {
          addLog(`Failed to load command in ${file}: Missing name or execute method`, "WARN");
        }
      } catch (err: any) {
        addLog(`Error importing command ${file}: ${err.message}`, "ERROR");
      }
    }
    
    addLog(`Total commands registered: ${commandsRegistry.size}`, "INFO");
  } catch (err: any) {
    addLog(`Failed to scan commands directory: ${err.message}`, "ERROR");
  }
}

/**
 * Get all unique commands (filtering out aliases)
 */
export function getUniqueCommands(): Command[] {
  const unique = new Set<Command>();
  for (const cmd of commandsRegistry.values()) {
    unique.add(cmd);
  }
  return Array.from(unique);
}
