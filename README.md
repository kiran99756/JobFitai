# JobFit AI — web version

Resume vs. job description match scanner. Originally a Python/CustomTkinter
desktop app; rebuilt here as a static site (single `index.html`, no build
step) plus a few small serverless functions — **not tied to one host**. The
same code deploys to Netlify or Vercel unchanged.

## What runs where

- **Scoring, matching, suggestions, resume builder, PDF export** run
  entirely in the browser: PDF text extraction (pdf.js), ATS scoring,
  skill matching, resume suggestions, interview questions, the resume
  builder, and PDF export (jsPDF). Nothing is uploaded to a server for
  these.
- **AI Career Coach** — calls `/api/coach`, which forwards the request to
  Groq's API. Keeps `GROQ_API_KEY` server-side.
- **"Fetch from URL"** (paste a job posting link) — calls `/api/fetch-jd`,
  which fetches the page server-side (avoids browser CORS) and extracts
  plain text. Best-effort — works well on plain job pages and most
  company career sites; sites that block bots or require login (LinkedIn,
  some Indeed pages) will fail with a message telling you to paste the
  description manually.
- **"Find jobs to apply to" + market skill trends** — calls
  `/api/job-search`, which queries the Adzuna job search API by
  role/location and returns real openings. Each listing is scored
  client-side against your uploaded resume, sorted highest-fit first, and
  the same set of listings is scanned for how often each skill appears
  across postings for that role — shown as an in-demand-skills panel,
  flagging which ones your resume doesn't have yet.

`/api/*` is the same URL path on both platforms — see **How the dual
deploy works** below for how that's wired up.

## Deploy on Netlify

**Option A — drag and drop (fastest)**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag this whole folder onto the page. No build command needed —
   `index.html` is served directly, `netlify/functions` is picked up
   automatically, and `netlify.toml` forwards `/api/*` to those functions.

**Option B — connect a Git repo**
1. Push this folder to a GitHub/GitLab/Bitbucket repo.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Build command: leave blank. Publish directory: `.` (already set in
   `netlify.toml`).
4. Deploy.

## Deploy on Vercel

1. Push this folder to a GitHub/GitLab/Bitbucket repo (Vercel deploys from
   Git — there's no drag-and-drop for functions).
2. In Vercel: **Add New → Project**, import the repo.
3. Framework preset: "Other". Build command / output directory: leave as
   detected (`vercel.json` already sets these to skip a build step).
4. Deploy. Files under `api/` are auto-detected as serverless functions at
   `/api/<name>` — no extra config needed.

### Enable the AI Career Coach (optional)

1. Get a free API key at <https://console.groq.com/keys>.
2. Add an environment variable in your host's dashboard:
   - **Netlify:** Site configuration → Environment variables
   - **Vercel:** Project → Settings → Environment Variables
   - Key: `GROQ_API_KEY`, Value: your key
3. Redeploy (env var changes need a new deploy to take effect).

Without it, everything else (score, skills, suggestions, interview
questions, resume builder, PDF export) still works fully — only "Get
coaching" shows a message that the key is missing.

### Enable job search + skill trends (optional)

1. Get free API credentials at <https://developer.adzuna.com/>.
2. Add two environment variables the same way as above:
   - `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`
3. Redeploy.

Without these, everything else still works — "Search jobs" explains the
keys are missing. "Fetch from URL" doesn't need either of these keys, only
the site itself deployed.

## How the dual deploy works

The frontend always calls `/api/coach`, `/api/fetch-jd`, `/api/job-search`
— Vercel's native convention. The actual request-handling logic lives once,
in `lib/`, and each platform gets a thin adapter that calls it:

- `api/*.js` — Vercel serverless functions (`(req, res) => …`), auto-routed
  to `/api/<name>` with zero config.
- `netlify/functions/*.js` — Netlify Functions (`exports.handler`).
  `netlify.toml` adds redirects so `/api/<name>` forwards to
  `/.netlify/functions/<name>`, matching the same path Vercel uses.

So `index.html` doesn't need to know which host it's on, and fixing a bug
or changing behavior only means editing the one file in `lib/`.

## Local preview

No build tools required for the static parts — open `index.html` directly,
or serve the folder with any static server. To test the serverless
functions locally, use either CLI:

```
netlify dev     # or
vercel dev
```

Both read secrets from a local `.env` file — see `.env.example`.

## Structure

```
index.html                 - the whole app (UI, scoring, resume builder, PDF export, job ranking)
lib/coach.js                - AI Career Coach: core request logic (calls Groq)
lib/fetch-jd.js             - fetch-JD-from-URL: core request logic
lib/job-search.js           - job search: core request logic (calls Adzuna)
api/coach.js                 } Vercel adapters — thin wrappers around lib/*,
api/fetch-jd.js               } auto-routed to /api/<name>
api/job-search.js             }
netlify/functions/coach.js       } Netlify adapters — same lib/*, exports.handler
netlify/functions/fetch-jd.js    } style
netlify/functions/job-search.js  }
netlify.toml                - Netlify publish/functions config + /api/* redirects
vercel.json                 - Vercel config (no build step)
package.json                - no dependencies; just pins Node >=18 for both hosts
.env.example                 - local dev only, for `netlify dev` / `vercel dev`
```
