export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const { vercelToken, htmlCode, gameName, gameId } = req.body;
    if (!vercelToken) { res.status(401).json({ error: 'Missing Vercel token' }); return; }
    if (!htmlCode) { res.status(400).json({ error: 'Missing game code' }); return; }

    const slug = (gameName || 'bgs-game')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
      + '-' + Math.random().toString(36).slice(2, 6);

    // Inject leaderboard script into the game HTML
    const lbScript = `
<script>
(function(){
  const GAME_ID = '${gameId || slug}';
  const API = '/api/scores';
  async function postScore(name, score) {
    try { await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({gameId:GAME_ID,name,score}) }); } catch(e){}
  }
  async function getScores() {
    try { const r=await fetch(API+'?gameId='+GAME_ID); return await r.json(); } catch(e){return[];}
  }
  window.BGS = { postScore, getScores, gameId: GAME_ID };
})();
</script>`;

    const injectedHtml = htmlCode.replace('</head>', lbScript + '</head>');

    // Deploy to Vercel via API
    const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: slug,
        files: [
          { file: 'index.html', data: injectedHtml },
          { file: 'api/scores.js', data: `
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.status(204).end();return;}
  const DB_URL = process.env.DATABASE_URL;
  if(!DB_URL){res.status(200).json([]);return;}
  try {
    const{neon}=await import('@neondatabase/serverless');
    const sql=neon(DB_URL);
    if(req.method==='POST'){
      const{gameId,name,score}=req.body;
      await sql\`CREATE TABLE IF NOT EXISTS scores(id SERIAL PRIMARY KEY,game_id TEXT,name TEXT,score INT,created_at TIMESTAMPTZ DEFAULT NOW())\`;
      await sql\`INSERT INTO scores(game_id,name,score) VALUES(\${gameId},\${name},\${score})\`;
      res.status(200).json({ok:true});
    } else {
      const{gameId}=req.query;
      await sql\`CREATE TABLE IF NOT EXISTS scores(id SERIAL PRIMARY KEY,game_id TEXT,name TEXT,score INT,created_at TIMESTAMPTZ DEFAULT NOW())\`;
      const rows=await sql\`SELECT name,score,created_at FROM scores WHERE game_id=\${gameId} ORDER BY score DESC LIMIT 10\`;
      res.status(200).json(rows);
    }
  } catch(e){res.status(200).json([]);}
}` }
        ],
        projectSettings: { framework: null },
        target: 'production'
      })
    });

    const deployData = await deployRes.json();
    if (!deployRes.ok) {
      res.status(deployRes.status).json({ error: deployData.error?.message || 'Deploy failed' }); return;
    }

    const url = `https://${deployData.url}`;
    res.status(200).json({ url, deploymentId: deployData.id, slug });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
