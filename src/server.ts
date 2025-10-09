import express from "express";
import dotenv from "dotenv";
import {
  generateContentRecommendations,
} from "./recommendations";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 5050;

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "cart-uplift-ai", version: "0.1.0" });
});

app.post("/api/ml/content-recommendations", async (req, res) => {
  try {
    const { product_ids, exclude_ids, customer_preferences, privacy_level } = req.body || {};
    const recs = await generateContentRecommendations(
      product_ids || [],
      exclude_ids || [],
      customer_preferences,
      privacy_level || "basic"
    );
    res.json({ recommendations: recs });
  } catch (err) {
    console.error("/content-recommendations error:", err);
    res.status(500).json({ error: "Failed to generate content recommendations" });
  }
});

app.listen(PORT, () => {
  console.log(`CartUpliftAI server listening on http://localhost:${PORT}`);
});
