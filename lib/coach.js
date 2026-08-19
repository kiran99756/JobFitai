// Shared core logic for the AI Career Coach endpoint — used by both the
// Netlify adapter (netlify/functions/coach.js) and the Vercel adapter
// (api/coach.js), so the two platforms run identical behavior.
//
// No npm dependencies — uses the fetch() built into modern Node runtimes.

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT =
  "You are a concise, practical career coach helping someone tailor their " +
  "resume and prep for a specific job. Be direct and specific to the resume " +
  "and job description given — avoid generic advice. Keep the response under " +
  "300 words, using short paragraphs or bullet points.";

// payload: parsed JSON body. env: process.env (or equivalent) for the platform.
// Returns { statusCode, body } where body is a plain JS object (adapters stringify it).
async function handleCoach(payload, env) {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: {
        error:
          "No GROQ_API_KEY set on the server. Add it in your host's environment " +
          "variable settings, then redeploy.",
      },
    };
  }

  const {
    resumeText = "",
    jobDescription = "",
    score = 0,
    matched = [],
    missing = [],
  } = payload || {};

  if (!String(resumeText).trim() || !String(jobDescription).trim()) {
    return { statusCode: 400, body: { error: "Resume text and job description are required." } };
  }

  const userPrompt = `
Resume:
${String(resumeText).slice(0, 4000)}

Job description:
${String(jobDescription).slice(0, 2000)}

ATS match score: ${score}%
Matched skills: ${matched.length ? matched.join(", ") : "none"}
Missing skills: ${missing.length ? missing.join(", ") : "none"}

Give this candidate specific, actionable coaching for landing this role:
what to emphasize, what to fix, and how to talk about the missing skills
if asked in an interview.
`.trim();

  const body = {
    model: env.GROQ_MODEL || DEFAULT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.6,
    max_tokens: 500,
  };

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { statusCode: 502, body: { error: `Could not reach Groq API: ${err.message}` } };
  }

  if (response.status === 401) {
    return { statusCode: 401, body: { error: "Groq API rejected the key (401). Check GROQ_API_KEY." } };
  }
  if (response.status === 429) {
    return { statusCode: 429, body: { error: "Groq API rate limit hit (429). Try again in a moment." } };
  }
  if (!response.ok) {
    const text = await response.text();
    return { statusCode: response.status, body: { error: `Groq API error ${response.status}: ${text.slice(0, 300)}` } };
  }

  const data = await response.json();
  const advice = data?.choices?.[0]?.message?.content?.trim();

  if (!advice) {
    return { statusCode: 502, body: { error: "Unexpected response format from Groq API." } };
  }

  return { statusCode: 200, body: { advice } };
}

module.exports = { handleCoach };
