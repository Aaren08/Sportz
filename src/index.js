import AgentAPI from "apminsight";
AgentAPI.config();
import express from "express";
import http from "http";
import { matchRouter } from "./routes/matches.js";
import { attachWebSocketServer } from "./ws/server.js";
import { securityMiddleware } from "./arcjet.js";
import { commentaryRouter } from "./routes/commentary.js";

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
const server = http.createServer(app);

// Use JSON middleware
app.use(express.json());

// Root GET route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Sportz Server!" });
});

// Apply security middleware globally
app.use(securityMiddleware);

// Routes
app.use("/matches", matchRouter);
app.use("/matches/:id/commentary", commentaryRouter);

const { broadcastMatchUpdate, broadcastCommentaryUpdate } =
  attachWebSocketServer(server);
app.locals.broadcastMatchUpdate = broadcastMatchUpdate; // Make it available in routes
app.locals.broadcastCommentaryUpdate = broadcastCommentaryUpdate; // Make it available in routes

// Start shared HTTP + WebSocket server
server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

  console.log(`Server is running at ${baseUrl}`);
  console.log(
    `WebSocket endpoint available on ${baseUrl.replace("http", "ws")}/ws`,
  );
});
