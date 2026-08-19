// Netlify Function adapter — thin wrapper around the shared core logic in
// lib/job-search.js, so behavior is identical to the Vercel adapter (api/job-search.js).
const { handleJobSearch } = require("../../lib/job-search");

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const result = await handleJobSearch(payload, process.env);
  return { statusCode: result.statusCode, headers: CORS_HEADERS, body: JSON.stringify(result.body) };
};
