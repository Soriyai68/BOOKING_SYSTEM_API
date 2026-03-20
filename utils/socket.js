const { Server } = require("socket.io");
const logger = require("./logger");

let io;

const init = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // Adjust this in production to your frontend URL
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info(`New client connected: ${socket.id}`);

    // Allow client to join a specific room (e.g., customer:ID)
    socket.on("join-room", (room) => {
      socket.join(room);
      logger.info(`Client ${socket.id} joined room: ${room}`);
    });

    socket.on("disconnect", () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

/**
 * Emit an event to all connected clients
 * @param {string} event - Event name
 * @param {any} data - Data to emit
 */
const emitEvent = (event, data) => {
  if (io) {
    io.emit(event, data);
    logger.info(`Socket Event Emitted (Global): ${event}`);
  }
};

/**
 * Emit an event to a specific room
 * @param {string} room - Room name
 * @param {string} event - Event name
 * @param {any} data - Data to emit
 */
const emitToRoom = (room, event, data) => {
  if (io) {
    io.to(room).emit(event, data);
    logger.info(`Socket Event Emitted to room ${room}: ${event}`);
  }
};

module.exports = {
  init,
  getIO,
  emitEvent,
  emitToRoom,
};
