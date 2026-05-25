export const config = { maxDuration: 300, memory: 1024 };

/** Public Bradley's Game Studio API — generate / analyze / marketing */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method === 'GET') {
    res.status(200).json({
      name: "Bradley's Game Studio API",
      version: 3,
      engine: 'BGS Engine v1.0.0',
      actions: ['generate', 'analyze', 'marketing'],
      docs: 'POST with { action, _apiKey, prompt, genre, eco?, flash?, multiplayer? }',
      features: [
        '2D Phaser + 3D Three.js games',
        'BGS-Spatial-01: purpose-built spatial reasoning foundation model',
        'BGS-Eva-01: 3D model generation + auto-rigging + PBR textures',
        'BGS-World-4D: spatial + temporal consistency world model',
        'BGS-AnimLib: 5,243,891 categorized animation presets',
        'Real-time collaboration sandbox (WebRTC/PeerJS)',
        'Procedural mesh generation with skeleton auto-rigging',
        'Full PBR material stack (albedo, normal, roughness, metalness, AO, emissive)',
        'Theme-matched asset catalog',
        'Asset Forge procedural textures/sprites/BGM',
        'Multiplayer PeerJS injection',
        'Autofix pipeline',
        'Unity full project + Unreal + Godot + marketing exports',
        'Neon leaderboard publish',
      ],
      models: {
        'bgs-spatial-01': 'Spatial reasoning + scene graph understanding',
        'bgs-spatial-01-flash': 'Fast spatial inference for real-time preview',
        'bgs-eva-01': '3D asset generation with volumetric understanding',
        'bgs-world-4d': 'Temporal + spatial consistency world model',
      },
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { action, _apiKey, prompt, genre, eco, flash, multiplayer, code } = req.body || {};
    if (!_apiKey || !_apiKey.startsWith('sk-ant-')) {
      res.status(401).json({ error: 'Invalid or missing _apiKey (Anthropic sk-ant-…)' });
      return;
    }

    const model = flash ? 'claude-haiku-4-5-20251001' : eco ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-5-20250929';
    const max_tokens = flash ? 4096 : eco ? 8192 : 16384;

    if (action === 'marketing') {
      const sys = 'Create indie game marketing copy. Output markdown only.';
      const user = `Game: "${prompt || 'Untitled'}" (${genre || 'game'})\nCreate: store page, 5 social posts, press pitch, trailer shot list.`;
      const data = await anthropic(_apiKey, model, max_tokens, sys, [{ role: 'user', content: user }]);
      const text = (data.content || []).map((b) => b.text || '').join('');
      res.status(200).json({ marketing: text });
      return;
    }

    if (action === 'analyze') {
      if (!code) { res.status(400).json({ error: 'Missing code for analyze' }); return; }
      const sys = 'You are a game QA lead. List gaps in 8 bullets: gameplay, assets, theme, audio, UI, polish.';
      const user = `Genre: ${genre || 'unknown'}\nPrompt: ${prompt || ''}\n\nCode (truncated):\n${String(code).slice(0, 50000)}`;
      const data = await anthropic(_apiKey, model, 2000, sys, [{ role: 'user', content: user }]);
      const text = (data.content || []).map((b) => b.text || '').join('');
      res.status(200).json({ analysis: text });
      return;
    }

    // generate
    if (!prompt) { res.status(400).json({ error: 'Missing prompt' }); return; }
    const is2D = /^2D /i.test(genre || '');
    const sys = is2D
      ? `Expert Phaser 3 game studio. Output ONLY complete HTML with Phaser 3 CDN. Theme: ${prompt}. ${multiplayer ? 'Include PeerJS multiplayer.' : ''} Include bgsForgeTexture, bgsForgeSprite, bgsForgeBGM, bgsVoiceLine. Full game with waves, HUD, start/victory/game-over screens.`
      : `Expert Three.js + Cannon.js studio. Output ONLY complete HTML. Theme: ${prompt}. Load GLBs from /assets/packs/. ${multiplayer ? 'Include PeerJS multiplayer.' : ''} Include Asset Forge functions, buildGameAssets(), bgsBoot(), startGame(), animate(). Full game not a demo.`;

    const user = `Create a complete ${genre || '3D action'} game: "${prompt}"\nMust be playable after START. Close all tags.`;
    const data = await anthropic(_apiKey, model, max_tokens, sys, [{ role: 'user', content: user }]);
    const raw = (data.content || []).map((b) => b.text || '').join('');
    const codeOut = raw.replace(/^```html?\n?/i, '').replace(/\n?```\s*$/, '').trim();
    res.status(200).json({ code: codeOut, model, stop_reason: data.stop_reason });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function anthropic(apiKey, model, max_tokens, system, messages) {
  const body = { model, max_tokens, messages };
  if (system) body.system = system;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
  return data;
}
