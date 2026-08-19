// Shared core logic for "fetch a job description from a URL" — used by
// both the Netlify adapter (netlify/functions/fetch-jd.js) and the Vercel
// adapter (api/fetch-jd.js).
//
// No npm dependencies — uses fetch() built into modern Node runtimes and a
// hand-rolled tag stripper (good enough for job description bodies, not a
// general-purpose readability engine).

// payload: parsed JSON body. Returns { statusCode, body }.
async function handleFetchJd(payload) {
  const rawUrl = ((payload && payload.url) || "").trim();
  let url;
  try {
    url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("bad protocol");
  } catch {
    return { statusCode: 400, body: { error: "That doesn't look like a valid URL." } };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    const msg = err.name === "AbortError" ? "The site took too long to respond." : err.message;
    return { statusCode: 502, body: { error: `Could not reach that page: ${msg}` } };
  }
  clearTimeout(timeout);

  if (!response.ok) {
    return {
      statusCode: 502,
      body: {
        error: `The site returned an error (${response.status}). Some job boards (like LinkedIn) block automated fetching — paste the description manually instead.`,
      },
    };
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    return { statusCode: 415, body: { error: "That URL isn't an HTML page." } };
  }

  const html = await response.text();
  const title = extractTitle(html);
  const text = htmlToText(html);

  if (!text || text.length < 40) {
    return {
      statusCode: 422,
      body: {
        error: "Couldn't find readable text on that page — it may render its content with JavaScript. Paste the description manually instead.",
      },
    };
  }

  return { statusCode: 200, body: { title, text: text.slice(0, 8000) } };
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).trim().slice(0, 200) : null;
}

function htmlToText(html) {
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|section|article|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  out = decodeEntities(out);

  out = out
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return out;
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

module.exports = { handleFetchJd };
