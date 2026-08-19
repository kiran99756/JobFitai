// Vercel serverless adapter — thin wrapper around the shared core logic in
// lib/coach.js, so behavior is identical to the Netlify adapter
// (netlify/functions/coach.js). Lives at /api/coach on Vercel.
const { handleCoach } = require("../lib/coach");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  let payload = req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = {};
    }
  }

  const result = await handleCoach(payload || {}, process.env);
  res.status(result.statusCode).json(result.body);
};
