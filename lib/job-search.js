// Shared core logic for job search via the Adzuna API — used by both the
// Netlify adapter (netlify/functions/job-search.js) and the Vercel adapter
// (api/job-search.js).
//
// Requires ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables.
// Get free keys at https://developer.adzuna.com/
//
// No npm dependencies — uses fetch() built into modern Node runtimes.

const SUPPORTED_COUNTRIES = ["in", "us", "gb", "ca", "au", "de", "sg", "fr", "nl", "za"];

// payload: parsed JSON body. env: process.env (or equivalent) for the platform.
// Returns { statusCode, body }.
async function handleJobSearch(payload, env) {
  const appId = env.ADZUNA_APP_ID;
  const appKey = env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    return {
      statusCode: 500,
      body: {
        error:
          "Job search isn't configured yet. Add ADZUNA_APP_ID and ADZUNA_APP_KEY in your host's " +
          "environment variable settings (free keys at developer.adzuna.com), then redeploy.",
      },
    };
  }

  const role = ((payload && payload.role) || "").trim();
  const location = ((payload && payload.location) || "").trim();
  let country = ((payload && payload.country) || "in").trim().toLowerCase();
  if (!SUPPORTED_COUNTRIES.includes(country)) country = "in";

  if (!role) {
    return { statusCode: 400, body: { error: "A role/title to search for is required." } };
  }

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    what: role,
    "content-type": "application/json",
  });
  if (location) params.set("where", location);

  const apiUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;

  let response;
  try {
    response = await fetch(apiUrl);
  } catch (err) {
    return { statusCode: 502, body: { error: `Could not reach the job search API: ${err.message}` } };
  }

  if (!response.ok) {
    const text = await response.text();
    return { statusCode: response.status, body: { error: `Job search API error ${response.status}: ${text.slice(0, 300)}` } };
  }

  const data = await response.json();
  const jobs = (data.results || []).map((r) => ({
    title: r.title ? stripTags(r.title) : "Untitled role",
    company: r.company && r.company.display_name ? r.company.display_name : "Unknown company",
    location: r.location && r.location.display_name ? r.location.display_name : "",
    description: r.description ? stripTags(r.description) : "",
    url: r.redirect_url || "",
    created: r.created || null,
  }));

  return { statusCode: 200, body: { jobs, count: data.count || jobs.length } };
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").trim();
}

module.exports = { handleJobSearch };
