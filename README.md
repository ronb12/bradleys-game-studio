# Bradley's Game Studio
### AI-Powered 3D Game Generator — Vercel Deployment

## Deploy in 3 minutes (free)

### Option A — Vercel CLI
```bash
npm i -g vercel
vercel
```
Follow the prompts. Done. You get a live URL instantly.

### Option B — Vercel Dashboard (no terminal needed)
1. Go to vercel.com → sign up free with GitHub
2. Click "Add New Project"
3. Drag and drop this entire folder
4. Click Deploy

### Option C — GitHub + Vercel (best for updates)
1. Push this folder to a GitHub repo
2. Go to vercel.com → Import Git Repository
3. Select your repo → Deploy
4. Every git push auto-deploys

## How it works
- `public/index.html` — the full studio UI
- `api/generate.js` — serverless proxy that forwards requests to Anthropic
- Users bring their own API key (stored in their browser localStorage)
- Your server never stores any API keys

## Custom domain (optional)
In Vercel dashboard → your project → Settings → Domains
Add any domain you own for free SSL + custom URL

## Cost
- Vercel hosting: FREE (hobby tier is plenty)
- Anthropic API: paid by each user with their own key
- Your cost to run this: $0
