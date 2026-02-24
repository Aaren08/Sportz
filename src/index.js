import express from "express";
import { matchRouter } from "./routes/matches.js";

const app = express();
const PORT = 8000;

// Use JSON middleware
app.use(express.json());

// Root GET route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Sportz Server!" });
});

// Routes
app.use("/matches", matchRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
