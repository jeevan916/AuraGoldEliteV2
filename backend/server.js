import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

/* Health check */
app.get("/", (req, res) => {
  res.send("AuraGold Backend is running");
});

/* REQUIRED State Endpoint */
app.get("/api/state", (req, res) => {
  // Logic to fetch from MySQL would go here
  res.json({ ok: true, timestamp: Date.now() });
});

/* Mock Gold Rate */
app.get("/api/gold-rate", (req, res) => {
  res.json({
    k24: 7850,
    k22: 7180,
    k18: 5880,
    timestamp: Date.now()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server listening on", PORT);
});