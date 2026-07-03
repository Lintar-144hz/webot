import { addLog } from "../utils/logger.js";

// Static imports of commands
import aiCommand from "../commands/ai.js";
import bratCommand from "../commands/brat.js";
import buttonCommand from "../commands/button.js";
import menuCommand from "../commands/menu.js";
import ownerCommand from "../commands/owner.js";
import pingCommand from "../commands/ping.js";
import stickerCommand from "../commands/sticker.js";
import tiktokCommand from "../commands/tiktok.js";
import ttCommand from "../commands/tt.js";

export interface Command {
  name: string;
  aliases?: string[];
  category: string;
  description: string;
  usage: string;
  execute: (sock: any, msg: any, args: string[], fullText: string) => Promise<void> | void;
}

export const commandsRegistry = new Map<string, Command>();

const commandsList = [
  aiCommand,
  bratCommand,
  buttonCommand,
  menuCommand,
  ownerCommand,
  pingCommand,
  stickerCommand,
  tiktokCommand,
  ttCommand
];

/**
 * Register all statically imported commands
 */
export async function loadCommands() {
  commandsRegistry.clear();
  
  for (const command of commandsList) {
    if (command && command.name && typeof command.execute === "function") {
      commandsRegistry.set(command.name.toLowerCase(), command);
      
      if (command.aliases) {
        for (const alias of command.aliases) {
          commandsRegistry.set(alias.toLowerCase(), command);
        }
      }
      addLog(`Loaded command: ${command.name}`, "SUCCESS");
    } else {
      addLog(`Failed to load command: Missing name or execute method`, "WARN");
    }
  }
  
  addLog(`Total commands registered: ${commandsRegistry.size}`, "INFO");
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
