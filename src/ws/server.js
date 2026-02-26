import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map();

function normalizeMatchId(matchId) {
  if (matchId === null || matchId === undefined) {
    throw new TypeError("matchId is required");
  }

  if (typeof matchId === "object") {
    const toStringFn = matchId?.toString;
    if (
      typeof toStringFn !== "function" ||
      toStringFn === Object.prototype.toString
    ) {
      throw new TypeError("matchId must be a string, number, or string-like");
    }
  }

  const normalizedMatchId = String(matchId);
  if (!normalizedMatchId) {
    throw new TypeError("matchId must not be empty");
  }

  return normalizedMatchId;
}

function subscribe(socket, matchId) {
  const normalizedMatchId = normalizeMatchId(matchId);
  if (!matchSubscribers.has(normalizedMatchId)) {
    matchSubscribers.set(normalizedMatchId, new Set());
  }
  matchSubscribers.get(normalizedMatchId).add(socket);
}

function unsubscribe(socket, matchId) {
  const normalizedMatchId = normalizeMatchId(matchId);
  if (matchSubscribers.has(normalizedMatchId)) {
    matchSubscribers.get(normalizedMatchId).delete(socket);
    if (matchSubscribers.get(normalizedMatchId).size === 0) {
      matchSubscribers.delete(normalizedMatchId);
    }
  }
}

function cleanUpSubscriptions(socket) {
  for (const [matchId, subscribers] of matchSubscribers.entries()) {
    if (subscribers.has(socket)) {
      subscribers.delete(socket);
      if (subscribers.size === 0) {
        matchSubscribers.delete(matchId);
      }
    }
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      sendJson(client, payload);
    }
  });
}

function broadcastToMatch(matchId, payload) {
  const normalizedMatchId = normalizeMatchId(matchId);
  if (matchSubscribers.has(normalizedMatchId)) {
    for (const socket of matchSubscribers.get(normalizedMatchId)) {
      sendJson(socket, payload);
    }
  }
}

function handleMessage(socket, message) {
  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch (error) {
    sendJson(socket, { type: "error", message: "Invalid JSON" });
    return;
  }
  if (parsed.type === "subscribe") {
    try {
      const normalizedMatchId = normalizeMatchId(parsed.matchId);
      subscribe(socket, normalizedMatchId);
      sendJson(socket, { type: "subscribed", matchId: normalizedMatchId });
    } catch (error) {
      sendJson(socket, { type: "error", message: "Invalid matchId" });
    }
  } else if (parsed.type === "unsubscribe") {
    try {
      const normalizedMatchId = normalizeMatchId(parsed.matchId);
      unsubscribe(socket, normalizedMatchId);
      sendJson(socket, { type: "unsubscribed", matchId: normalizedMatchId });
    } catch (error) {
      sendJson(socket, { type: "error", message: "Invalid matchId" });
    }
  } else {
    sendJson(socket, { type: "error", message: "Unknown message type" });
  }
}

// This module sets up a WebSocket server and provides a function to broadcast match updates to all connected clients.
export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  }); // 1 MB max payload

  wss.on("connection", async (socket, req) => {
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);
        if (decision.isDenied()) {
          const code = decision.reason.isRateLimit() ? 1013 : 1008; // 1013: Try Again Later, 1008: Policy Violation
          const reason = decision.reason.isRateLimit()
            ? "Rate limit exceeded"
            : "Forbidden";
          socket.close(code, reason);
          return;
        }
      } catch (error) {
        console.error("WS connection error", error);
        socket.close(1011, "Internal Server Error");
      }
    }
    socket.subscriptions = new Set();
    sendJson(socket, { type: "welcome" });
    socket.on("message", (message) => handleMessage(socket, message));
    socket.on("error", (error) => {
      console.error("WebSocket error:", error);
      socket.terminate();
    });
    socket.on("close", () => cleanUpSubscriptions(socket));
  });

  function broadcastMatchUpdate(match) {
    broadcastToAll(wss, { type: "match_update", data: match });
  }

  function broadcastCommentaryUpdate(matchId, commentary) {
    broadcastToMatch(matchId, { type: "commentary_update", data: commentary });
  }
  return { broadcastMatchUpdate, broadcastCommentaryUpdate };
}
