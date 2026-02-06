import { createServer } from "http";
import app from "./app.js";
import { setupWebSocket } from "./ws/collaborationRoom.js";

const PORT = process.env.PORT || 3001;

const server = createServer(app.callback());

// Setup WebSocket for real-time collaboration
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready for collaboration`);
});
