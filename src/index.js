import express from "express";
import http from "http";
import { matchRouter } from "./routes/matches.js";
import { attachWebSocketServer } from "./ws/server.js";

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

// Routes
app.use("/matches", matchRouter);
const { broadcastMatchUpdate } = attachWebSocketServer(server);
app.locals.broadcastMatchUpdate = broadcastMatchUpdate; // Make it available in routes

// Start shared HTTP + WebSocket server
server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

  console.log(`Server is running at ${baseUrl}`);
  console.log(
    `WebSocket endpoint available on ${baseUrl.replace("http", "ws")}/ws`,
  );
});
