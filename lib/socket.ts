import { Server } from "socket.io";

let ioInstance: Server | null = null;

export function setSocketIO(io: Server) {
  ioInstance = io;
}

export function getSocketIO(): Server | null {
  return ioInstance;
}
