// server.js  (ESM)
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/entries", (req, res) => {
  console.log("SYNC ENTRY:", req.body);
  res.json({ ok: true });
});

app.post("/api/push/register", (req, res) => {
  console.log("PUSH TOKEN:", req.body);
  res.json({ ok: true });
});

const PORT = 4000;
app.listen(PORT, () => console.log(`API dev en http://localhost:${PORT}`));
