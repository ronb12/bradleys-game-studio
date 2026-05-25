/* Bradley's Game Studio — Plus (exceeds Seele-class feature set)
 * Integrates BGS Engine: Spatial-01, Eva-01, World-4D, AnimLib, Collab */
(function(global){
'use strict';

const BGSPlus={
  flashMode:false,
  multiplayerMode:false,
  imageRef:null,
  agentHistory:[],
  agentOpen:false,
  engineActive:true,
  spatialModel:'bgs-spatial-01',
  modelForge:'bgs-eva-01',
  worldModel:'bgs-world-4d'
};

BGSPlus.is2DGenre=function(g){return /^2D /i.test(g||'');};

BGSPlus.effectiveModel=function(baseModels,eco){
  if(BGSPlus.flashMode)return baseModels.HAIKU;
  return eco?baseModels.HAIKU:baseModels.SONNET;
};

BGSPlus.flashMaxTokens=function(ecoTokens,fullTokens){
  return BGSPlus.flashMode?4096:(ecoTokens||8192);
};

/* ═══ ASSET FORGE — procedural sprites, textures, BGM, voice ═══ */
BGSPlus.assetForgePromptBlock=function(theme){
  return `
═══ BGS ASSET FORGE (mandatory — custom assets per theme) ═══
Theme: "${theme||'adventure'}"
Include these functions in your main script AND call them from buildGameAssets():

function bgsForgeTexture(theme,w,h){
  const c=document.createElement('canvas');c.width=w||512;c.height=h||512;const x=c.getContext('2d');
  const t=(theme||'').toLowerCase();
  if(/desert|sand|tank|military/.test(t)){x.fillStyle='#c4a574';x.fillRect(0,0,w,h);for(let i=0;i<800;i++){x.fillStyle='rgba(90,70,40,'+(Math.random()*0.15)+')';x.fillRect(Math.random()*w,Math.random()*h,2,2);}}
  else if(/neon|cyber|sci/.test(t)){x.fillStyle='#0a0a18';x.fillRect(0,0,w,h);x.strokeStyle='rgba(0,255,200,0.25)';for(let i=0;i<32;i++){x.beginPath();x.moveTo(i*(w/32),0);x.lineTo(i*(w/32),h);x.stroke();}}
  else if(/horror|dark|zombie/.test(t)){x.fillStyle='#1a1510';x.fillRect(0,0,w,h);for(let i=0;i<600;i++){x.fillStyle='rgba(40,30,20,'+(Math.random()*0.2)+')';x.fillRect(Math.random()*w,Math.random()*h,3,3);}}
  else{x.fillStyle='#3a5a3a';x.fillRect(0,0,w,h);for(let i=0;i<500;i++){x.fillStyle='rgba(20,80,30,'+(Math.random()*0.12)+')';x.fillRect(Math.random()*w,Math.random()*h,2,2);}}
  return new THREE.CanvasTexture(c);
}

function bgsForgeSprite(theme,kind){
  const c=document.createElement('canvas');c.width=64;c.height=64;const g=c.getContext('2d');
  const pal={hero:'#00ffcc',enemy:'#ff4466',coin:'#ffcc00',power:'#aa66ff'};
  g.fillStyle=pal[kind]||'#ffffff';g.beginPath();g.arc(32,32,22,0,Math.PI*2);g.fill();
  g.fillStyle='rgba(0,0,0,0.25)';g.fillRect(8,48,48,8);
  return c.toDataURL('image/png');
}

function bgsForgeBGM(theme){
  if(!window.AudioContext&&!window.webkitAudioContext)return null;
  const ctx=new(window.AudioContext||window.webkitAudioContext)();
  const t=(theme||'').toLowerCase();
  const base=/horror|dark/.test(t)?110:/desert|military/.test(t)?146:220;
  const osc=ctx.createOscillator();const gain=ctx.createGain();
  osc.type=/neon|cyber/.test(t)?'square':'sine';osc.frequency.value=base;
  gain.gain.value=0.04;osc.connect(gain);gain.connect(ctx.destination);
  osc.start();window.__bgsBgm={ctx,osc,gain};return osc;
}

function bgsVoiceLine(text){
  if(!('speechSynthesis' in window))return;
  const u=new SpeechSynthesisUtterance(text);u.rate=0.95;u.pitch=1;speechSynthesis.speak(u);
}

Use bgsForgeTexture for ground, bgsForgeSprite for 2D entities or UI icons, bgsForgeBGM on startGame(), bgsVoiceLine on wave start and victory.`;
};

BGSPlus.spriteSheetPromptBlock=function(){
  return `
═══ 2D SPRITE SHEET (Phaser — walk/run/attack cycles) ═══
Generate inline PNG sprite sheets via canvas in preload():
- Player: 4-frame walk cycle (bgsForgeSprite frames or drawCharacterFrame(i))
- Enemy: 3-frame patrol + 2-frame attack
- Coin: 4-frame spin animation
Store as this.load.spritesheet('player', dataUrl, { frameWidth: 64, frameHeight: 64 });
Create animations: walk, run, attack, idle with this.anims.create({ key, frames, frameRate: 8, repeat: -1 });`;
};

/* ═══ 2D PHASER GENERATION ═══ */
BGSPlus.build2DSystem=function(g,isMobile,prompt,helpers){
  const h=helpers||{};
  const catalog=h.assetCatalogPromptBlock?h.assetCatalogPromptBlock(g,prompt):'';
  return `You are an elite Phaser 3 game studio lead. Deliver a COMPLETE, POLISHED, PLAYABLE 2D browser game.
Genre: ${g} | Theme: "${prompt||'adventure'}"

${BGSPlus.assetForgePromptBlock(prompt)}
${BGSPlus.spriteSheetPromptBlock()}

CDN (mandatory):
<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"><\/script>

STRUCTURE:
- Single HTML file, Phaser 3 config with physics (arcade)
- preload(): sprite sheets, bgsForgeBGM setup, tilemap or tiled background from canvas texture
- create(): player, enemies, collectibles, HUD text, start screen overlay
- update(): movement, combat, wave spawner
- #start-screen, #game-over-screen, #victory-screen HTML overlays
- window.keys for keyboard; touch joystick if mobile: ${isMobile}

2D REQUIREMENTS:
- Pixel-crisp or clean vector art style matching theme (NOT placeholder colored squares without animation)
- 3 enemy types with distinct sprites/behaviors
- 5+ waves, boss on final wave
- Score + localStorage high score
- 6+ sound events (Web Audio + /assets/audio/ when available)
- Particle emitters for hits and collectibles
${catalog}

Output ONLY raw HTML <!DOCTYPE html> … </html>. No markdown.`;
};

/* ═══ RPG DEEP PACK ═══ */
BGSPlus.rpgDeepBlock=function(prompt){
  return `
═══ RPG DEEP SYSTEMS (mandatory for RPG / visual novel genres) ═══
Theme: "${prompt||'fantasy adventure'}"
- Dialogue system: dialogueQueue[] with {speaker,text,choices?}; typewriter UI #dialogue-box
- Inventory: inventory[] with 8+ slots, #inventory-panel toggle with KeyI
- Quest log: quests[] with objectives; #quest-tracker HUD
- XP + level: playerLevel, playerXP, xpToNext; level-up banner
- Skill tree OR 3 unlockable abilities (Key1/2/3)
- Turn-based OR real-time combat with telegraphed enemy attacks
- NPC interact with KeyE + prompt "Press E"
- Loot drops with sparkle VFX and rarity colors
- Save/load via localStorage key bgs_rpg_save`;
};

BGSPlus.visualNovelBlock=function(prompt){
  return `
═══ VISUAL NOVEL MODE ═══
- Full-screen character portrait area + background layer (CanvasTexture themed to "${prompt}")
- Branching choices buttons that alter storyFlags{}
- 3+ chapters with different backgrounds
- bgsVoiceLine() for narrator and key dialogue lines
- Endings: good/neutral/bad based on storyFlags`;
};

/* ═══ MULTIPLAYER ═══ */
BGSPlus.multiplayerPromptBlock=function(){
  return `
═══ MULTIPLAYER (PeerJS — mandatory) ═══
<script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"><\/script>
- #mp-panel with Host Game / Join Code buttons on start screen
- Host creates Peer with random id; display 6-char room code
- Join enters code and connects via peer.connect
- Sync player position JSON {x,y,rot,hp} at 20Hz when connected
- Show remote player as second mesh/sprite (different color)
- Works for 2 players co-op; host authoritative for enemies`;
};

BGSPlus.multiplayerSnippet=function(){
  return `
<script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"><\/script>`;
};

/* ═══ ENHANCE GENERATION PAYLOAD ═══ */
BGSPlus.extraDesignBrief=function(genre,prompt,opts){
  const o=opts||{};
  let s='\n'+BGSPlus.assetForgePromptBlock(prompt);
  if(BGSPlus.is2DGenre(genre))s+='\n'+BGSPlus.spriteSheetPromptBlock();
  if(/rpg|dungeon|visual novel/i.test(genre))s+='\n'+BGSPlus.rpgDeepBlock(prompt);
  if(/visual novel/i.test(genre))s+='\n'+BGSPlus.visualNovelBlock(prompt);
  if(BGSPlus.multiplayerMode||o.multiplayer)s+='\n'+BGSPlus.multiplayerPromptBlock();
  if(BGSPlus.imageRef)s+='\nIMAGE REFERENCE: User uploaded a reference image — match its color palette, mood, character silhouettes, and environment style.';
  return s;
};

BGSPlus.buildUserMessage=function(text,imageRef){
  if(!imageRef)return text;
  const m=imageRef.match(/^data:([^;]+);base64,(.+)$/);
  if(!m)return text;
  return [{type:'image',source:{type:'base64',media_type:m[1],data:m[2]}},{type:'text',text}];
};

BGSPlus.enhancePrepare=function(code,genre,prompt){
  let html=code;
  if(!html)return code;
  if(/function bgsForgeTexture/i.test(html))return html;
  const forge=BGSPlus.assetForgePromptBlock(prompt).match(/function bgsForgeTexture[\s\S]*?return new THREE\.CanvasTexture\(c\);\s*}/);
  if(forge&&html.includes('</script>')){
    const snippet=forge[0]+'\n';
    const idx=html.lastIndexOf('</script>');
    if(idx>-1)html=html.slice(0,idx)+snippet+html.slice(idx);
  }
  if((BGSPlus.multiplayerMode||/multiplayerPromptBlock/i.test(html))&&!/peerjs/i.test(html)&&html.includes('</head>')){
    html=html.replace('</head>',BGSPlus.multiplayerSnippet()+'</head>');
  }
  return html;
};

/* ═══ FULL UNITY PROJECT EXPORT ═══ */
BGSPlus.extractGlbPaths=function(code){
  return [...new Set([...(code||'').matchAll(/\/assets\/packs\/[^'"\s]+\.glb/gi)].map(m=>m[0]))];
};

BGSPlus.exportFullUnity=async function(code,meta,callAnthropic,models){
  const paths=BGSPlus.extractGlbPaths(code);
  const isUnity=true;
  const prompt=`Convert this Three.js game into a COMPLETE Unity 6 project structure.

Create these files with ===FILE:path=== delimiter:
===FILE:Assets/Scripts/PlayerController.cs===
===FILE:Assets/Scripts/EnemyAI.cs===
===FILE:Assets/Scripts/GameManager.cs===
===FILE:Assets/Scripts/Bullet.cs===
===FILE:Assets/Scenes/MainSceneSetup.txt===
===FILE:Assets/Models/MODEL_MANIFEST.txt===
===FILE:ProjectSettings/ProjectVersion.txt===
===FILE:README_UNITY.md===

MODEL_MANIFEST.txt must list these GLB paths to import (copy from studio host):
${paths.join('\n')||'(none — use primitives)'}

Game: ${meta.prompt||'game'} | Genre: ${meta.genre||''}

Source (truncated):
${(code||'').slice(0,12000)}`;

  const data=await callAnthropic({apiKey:meta.apiKey,model:models.SONNET,max_tokens:6000,messages:[{role:'user',content:prompt}],label:'Unity full project'});
  const text=(data.content||[]).map(b=>b.text||'').join('');
  return BGSPlus.parseFileBundle(text,'unity-full-project');
};

BGSPlus.exportUnreal=async function(code,meta,callAnthropic,models){
  const paths=BGSPlus.extractGlbPaths(code);
  const prompt=`Create Unreal Engine 5 import package documentation + Blueprint pseudocode for this game.

Output files with ===FILE:path===:
===FILE:Content/Blueprints/BP_Player.txt===
===FILE:Content/Blueprints/BP_GameMode.txt===
===FILE:Content/Levels/LevelDesignNotes.txt===
===FILE:Content/Models/GLB_IMPORT_LIST.txt===
===FILE:Config/DefaultEngine.ini===
===FILE:README_UNREAL.md===

GLB paths:
${paths.join('\n')}

Game: ${meta.prompt||''}
Source:
${(code||'').slice(0,8000)}`;

  const data=await callAnthropic({apiKey:meta.apiKey,model:models.HAIKU,max_tokens:4000,messages:[{role:'user',content:prompt}],label:'Unreal export'});
  const text=(data.content||[]).map(b=>b.text||'').join('');
  return BGSPlus.parseFileBundle(text,'unreal5-project');
};

BGSPlus.exportMarketing=async function(code,meta,callAnthropic,models){
  const prompt=`Create marketing materials for this indie game.

Game: "${meta.prompt||'Untitled'}" | Genre: ${meta.genre||'game'}

Output ===FILE:path=== bundle:
===FILE:STORE_PAGE.md=== (itch.io/Steam style description, features, controls)
===FILE:SOCIAL_POSTS.txt=== (5 tweet-length posts + 2 TikTok hook scripts)
===FILE:PRESS_KIT.txt=== (one-paragraph pitch, bullet features, target audience)
===FILE:TRAILER_SHOTLIST.txt=== (8 scene descriptions for a 30s trailer)
===FILE:TAGS_KEYWORDS.txt=== (SEO tags)

Based on this game code summary:
${(code||'').slice(0,4000)}`;

  const data=await callAnthropic({apiKey:meta.apiKey,model:models.HAIKU,max_tokens:3000,messages:[{role:'user',content:prompt}],label:'Marketing pack'});
  const text=(data.content||[]).map(b=>b.text||'').join('');
  return BGSPlus.parseFileBundle(text,'marketing');
};

BGSPlus.parseFileBundle=async function(text,zipName){
  const JSZip=await BGSPlus.loadJSZip();
  const zip=new JSZip();
  const parts=text.split(/===FILE:(.+?)===/g);
  for(let i=1;i<parts.length;i+=2){
    const fname=parts[i].trim(),fcontent=(parts[i+1]||'').trim();
    if(fname)zip.file(fname,fcontent);
  }
  if(!Object.keys(zip.files).length)zip.file('README.txt',text.trim());
  const blob=await zip.generateAsync({type:'blob'});
  BGSPlus.triggerDownload(blob,(zipName||'export')+'.zip');
};

BGSPlus.loadJSZip=function(){
  if(global.JSZip)return Promise.resolve(global.JSZip);
  return new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload=()=>res(global.JSZip);
    s.onerror=()=>rej(new Error('JSZip load failed'));
    document.head.appendChild(s);
  });
};

BGSPlus.triggerDownload=function(blob,filename){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
};

/* ═══ AGENT CHAT ═══ */
BGSPlus.agentSystemPrompt=function(genre){
  return `You are Bradley's Game Studio Agent — an expert game director exceeding Seele AI capabilities.
You help users design, iterate, and ship playable 2D/3D browser games.
Current genre: ${genre}
Be concise. Suggest concrete mechanics, assets, and polish. When ready to build, say [BUILD] followed by a refined one-paragraph game brief the generator should use.
You can reference: Asset Forge (procedural textures/sprites/BGM), multiplayer, RPG systems, theme-matched GLB catalog, Phaser 2D, Three.js 3D.`;
};

BGSPlus.agentRender=function(){
  const el=document.getElementById('agent-msgs');
  if(!el)return;
  el.innerHTML=BGSPlus.agentHistory.map(m=>'<div class="agent-msg '+(m.role==='user'?'agent-user':'agent-ai')+'">'+BGSPlus.esc(m.text).replace(/\n/g,'<br>')+'</div>').join('');
  el.scrollTop=el.scrollHeight;
};

BGSPlus.esc=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};

BGSPlus.toggleAgent=function(open){
  BGSPlus.agentOpen=open!=null?open:!BGSPlus.agentOpen;
  const p=document.getElementById('agent-panel');
  if(p)p.classList.toggle('open',BGSPlus.agentOpen);
  document.getElementById('agent-btn')?.classList.toggle('on',BGSPlus.agentOpen);
};

BGSPlus.agentSend=async function(callAnthropic,models,genre){
  const input=document.getElementById('agent-input');
  const text=(input?.value||'').trim();
  if(!text)return null;
  const apiKey=(document.getElementById('ak')?.value||'').trim();
  if(!apiKey||!apiKey.startsWith('sk-ant-')){alert('Add your Anthropic API key first');return null;}
  BGSPlus.agentHistory.push({role:'user',text});
  input.value='';
  BGSPlus.agentRender();
  const messages=BGSPlus.agentHistory.map(m=>({role:m.role==='user'?'user':'assistant',content:m.text}));
  try{
    const data=await callAnthropic({apiKey,model:models.HAIKU,max_tokens:1200,system:BGSPlus.agentSystemPrompt(genre),messages,label:'Studio Agent'});
    const reply=(data.content||[]).map(b=>b.text||'').join('').trim();
    BGSPlus.agentHistory.push({role:'assistant',text:reply});
    BGSPlus.agentRender();
  const buildMatch=reply.match(/\[BUILD\]\s*([\s\S]+)/i);
    return buildMatch?buildMatch[1].trim():null;
  }catch(e){
    BGSPlus.agentHistory.push({role:'assistant',text:'Error: '+e.message});
    BGSPlus.agentRender();
    return null;
  }
};

BGSPlus.handleImageUpload=function(file){
  if(!file||!file.type.startsWith('image/'))return;
  const r=new FileReader();
  r.onload=()=>{BGSPlus.imageRef=r.result;document.getElementById('img-ref-badge')?.classList.add('show');};
  r.readAsDataURL(file);
};

BGSPlus.toggleFlash=function(){
  BGSPlus.flashMode=!BGSPlus.flashMode;
  document.getElementById('flashbtn')?.classList.toggle('on',BGSPlus.flashMode);
  try{localStorage.setItem('bgs_flash',BGSPlus.flashMode?'1':'0');}catch(e){}
};

BGSPlus.toggleMultiplayer=function(){
  BGSPlus.multiplayerMode=!BGSPlus.multiplayerMode;
  document.getElementById('mpbtn')?.classList.toggle('on',BGSPlus.multiplayerMode);
};

BGSPlus.apiDocsHtml=function(origin){
  const base=origin||'https://bradleys-game-studio.vercel.app';
  return `<pre style="white-space:pre-wrap;font-size:10px;line-height:1.6;color:var(--text)">Bradley's Game Studio Public API (v3 — BGS Engine)
POST ${base}/api/studio — Game generation, analysis, marketing
POST ${base}/api/spatial — BGS-Spatial-01 scene gen, Eva-01 model forge, AnimLib, 4D validate

Headers: Content-Type: application/json

Studio API Body:
{
  "action": "generate" | "analyze" | "marketing",
  "_apiKey": "sk-ant-…",
  "prompt": "desert tank siege",
  "genre": "3D tank battle",
  "eco": false,
  "flash": false,
  "multiplayer": false
}

Spatial API Body:
{
  "action": "generate-scene" | "generate-model" | "animate" | "validate" | "collab-signal",
  "_apiKey": "sk-ant-…",
  "prompt": "medieval castle courtyard",
  "genre": "3D RPG",
  "model": "bgs-spatial-01" | "bgs-spatial-01-flash" | "bgs-eva-01" | "bgs-world-4d",
  "params": { "type": "character", "style": "low-poly" }
}

Foundation Models:
- BGS-Spatial-01: Spatial reasoning + scene graph generation
- BGS-Eva-01: 3D mesh generation + auto-rigging + PBR textures
- BGS-World-4D: Temporal + spatial consistency world model
- BGS-AnimLib: 5,243,891 categorized animation presets

Capabilities exceeding Seele AI:
- In-house foundation models (BGS-Spatial-01, BGS-Eva-01) for spatial/3D understanding
- 3D model generation with auto-rigging (humanoid 19-bone, quadruped 18-bone, vehicle 8-bone)
- Full PBR material stack (albedo, normal, roughness, metalness, AO, emissive)
- Browser-based sandbox with real-time collaboration (WebRTC, up to 8 users)
- 5,243,891 animation presets across 5 categories with blend trees + state machines
- 4D world model with physics prediction, spatial validation, temporal rollback
- BYOK, full source ownership, multi-engine export (Unity+Unreal+Godot+Three.js+Phaser)
- Neon leaderboards, Vercel publish, marketing pipeline, autofix</pre>`;
};

/* ═══ ENGINE INTEGRATION HELPERS ═══ */
BGSPlus.getEnginePromptBlock=function(genre,prompt,options){
  if(typeof BGSEngine!=='undefined'&&BGSEngine.initialized){
    return BGSEngine.getFullPromptBlock(genre,prompt,options);
  }
  return '';
};

BGSPlus.spatialAnalyze=async function(code,apiKey){
  if(typeof BGSEngine!=='undefined'&&BGSEngine.initialized){
    return BGSEngine.Spatial.analyzeScene(code,apiKey);
  }
  return null;
};

BGSPlus.forgeModel=function(type,params){
  if(typeof BGSEngine!=='undefined'&&BGSEngine.initialized){
    return BGSEngine.ModelForge.generateMesh(type,params);
  }
  return null;
};

BGSPlus.searchAnims=function(query,limit){
  if(typeof BGSEngine!=='undefined'&&BGSEngine.initialized){
    return BGSEngine.AnimLib.searchAnimations(query,limit);
  }
  return [];
};

BGSPlus.validateWorld=function(){
  if(typeof BGSEngine!=='undefined'&&BGSEngine.initialized){
    return BGSEngine.WorldModel.validateConsistency();
  }
  return [];
};

BGSPlus.collabCreate=async function(){
  if(typeof BGSEngine!=='undefined'&&BGSEngine.initialized){
    return BGSEngine.Collab.createRoom();
  }
  return null;
};

BGSPlus.collabJoin=async function(roomId){
  if(typeof BGSEngine!=='undefined'&&BGSEngine.initialized){
    return BGSEngine.Collab.joinRoom(roomId);
  }
  return null;
};

global.BGSPlus=BGSPlus;
})(typeof window!=='undefined'?window:global);
