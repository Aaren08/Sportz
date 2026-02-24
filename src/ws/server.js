import { WebSocket, WebSocketServer } from "ws";

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      sendJson(client, payload);
    }
  });
}

// This module sets up a WebSocket server and provides a function to broadcast match updates to all connected clients.
export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  }); // 1 MB max payload
  wss.on("connection", (socket) => {
    sendJson(socket, { type: "welcome" });
    socket.on("error", console.error);
  });

  function broadcastMatchUpdate(match) {
    broadcast(wss, { type: "match_update", data: match });
  }
  return { broadcastMatchUpdate };
}
