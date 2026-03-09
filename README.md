# 🤖 AI Pain Point Intelligence Agent

Automatically scrapes Reddit, Hacker News, and GitHub every day and uses Claude to identify the **top 10 AI workflow pain points** across industries.

Results are saved as JSON files in the `results/` folder and committed back to this repo automatically.

---

## 📁 What's in this repo

```
ai-painpoint-agent/
├── agent.js                        ← The main script (the "brain")
├── package.json                    ← Project info
├── .gitignore                      ← Files Git should ignore
├── .github/
│   └── workflows/
│       └── daily-agent.yml         ← The schedule (runs at 8am UTC daily)
└── results/
    ├── latest.json                 ← Most recent run
    └── 2025-03-09.json             ← Archived daily results
```

---

## 🚀 Setup Guide (Step by Step)

### Step 1 — Create a GitHub account
If you don't have one, go to **https://github.com** and sign up. It's free.

---

### Step 2 — Create a new repository

1. Click the **+** icon in the top-right corner of GitHub
2. Click **"New repository"**
3. Name it: `ai-painpoint-agent`
4. Leave it **Private** (so your API keys stay safe)
5. Click **"Create repository"**

---

### Step 3 — Upload these files

You'll see a page that says "Quick setup". Do this:

1. Click **"uploading an existing file"** (the link in the middle of the page)
2. Drag and drop ALL the files from this folder into the upload area:
   - `agent.js`
   - `package.json`
   - `.gitignore`
   - The `.github/workflows/daily-agent.yml` file
     *(To upload this, you need to create the folder structure manually — see note below)*
3. Scroll down and click **"Commit changes"**

> **Note on the `.github/workflows/` folder:** GitHub's drag-and-drop uploader doesn't handle nested folders well.
> The easiest fix: after uploading the other files, click **"Add file" → "Create new file"**, 
> type `.github/workflows/daily-agent.yml` as the filename (GitHub creates the folders automatically),
> then paste in the contents of the `daily-agent.yml` file.

---

### Step 4 — Add your Anthropic API key (required)

This is the key the agent uses to call Claude for analysis.

1. Go to **https://console.anthropic.com** → API Keys → Create a key
2. Copy the key (it starts with `sk-ant-...`)
3. Back in your GitHub repo, click **Settings** (top menu)
4. In the left sidebar, click **"Secrets and variables" → "Actions"**
5. Click **"New repository secret"**
6. Name: `ANTHROPIC_API_KEY`
7. Value: paste your key
8. Click **"Add secret"**

---

### Step 5 — Run it manually to test

1. In your repo, click the **"Actions"** tab
2. Click **"Daily AI Pain Point Agent"** in the left sidebar
3. Click **"Run workflow"** → **"Run workflow"** (the green button)
4. Wait ~1 minute, then click on the running job to see the logs
5. When it finishes, go back to your repo's main page — you'll see a new `results/latest.json` file!

---

### Step 6 — It runs automatically from now on! ✅

Every day at **8:00 AM UTC** (midnight Pacific, 3am Eastern), the agent will:
1. Scrape Reddit, Hacker News, and GitHub for AI frustration posts
2. Send them to Claude for analysis
3. Save the top 10 pain points to `results/latest.json`
4. Commit the file back to your repo

You can check your results any time at:
`https://github.com/YOUR-USERNAME/ai-painpoint-agent/blob/main/results/latest.json`

---

## 📊 Reading the Results

Open `results/latest.json`. It looks like this:

```json
{
  "date": "2025-03-09",
  "total_posts_analyzed": 47,
  "dominant_theme": "Production reliability is the #1 AI pain point in 2025",
  "summary": "...",
  "painpoints": [
    {
      "rank": 1,
      "title": "Context window loss breaks long workflows",
      "industry": "Engineering",
      "severity": 9,
      "frequency": "High",
      "tools_affected": ["GPT-4", "Claude"],
      "description": "...",
      "sample_quotes": ["..."],
      "source_platforms": ["Reddit", "Hacker News"]
    },
    ...
  ]
}
```

---

## 💡 Optional Improvements

### Add Reddit API keys (gets more posts, less rate limiting)
1. Go to **https://www.reddit.com/prefs/apps**
2. Click "Create app" → choose "script"
3. Add two secrets to GitHub:
   - `REDDIT_CLIENT_ID` → your app's client ID
   - `REDDIT_CLIENT_SECRET` → your app's secret

### Change the schedule
Edit `.github/workflows/daily-agent.yml` and change:
```yaml
- cron: "0 8 * * *"   # 8:00 AM UTC daily
```
To any time you want. Use https://crontab.guru to make custom schedules.

### Add more platforms
Edit `agent.js` and add a new scraper function (e.g. for Dev.to or Stack Overflow),
then call it inside the `main()` function.

---

## ❓ Troubleshooting

**The action failed** — Click on the failed run in the Actions tab to see the error log.
The most common cause is a missing or wrong API key.

**No results file** — Make sure the action completed successfully (green checkmark).

**Rate limit errors** — The agent is polite about API calls but Reddit sometimes blocks scrapers.
Adding Reddit API keys (Step above) fixes this.

---

## 📬 Questions?

Feel free to open an Issue in the GitHub repo if something isn't working.
