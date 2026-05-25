/**
 * Tank Battle — extended features (loaded after main game script; shares global scope).
 */
(function(){
'use strict';

if(typeof MISSIONS==='undefined')return;

/* ── State ── */
let difficulty='veteran';
let paused=false;
let abilityCd=0;
const ABILITY_CD=24;
let smokeTimer=0;
let waypoint=null;
let pickups=[];
let bonusObj=null;
let waveDamage=0;
let waveKillDeadline=0;
let waveKillsTimer=0;
let missionTimeStart=0;
window.__missionTimeStart=0;
let audioVol={master:.85,sfx:1,engine:.55};
let perf='medium';
let usedBackup=false;
const DIFF={recruit:{hp:.78,spd:.88,art:1.35,w:0},veteran:{hp:1,spd:1,art:1,w:0},elite:{hp:1.32,spd:1.14,art:.68,w:1}};
const MISSION_INTEL={desert:'🏜️',urban:'🏙️',snow:'❄️',forest:'🌲'};
const BONUS_TYPES=[
  {id:'speed',label:'Eliminate 2 tanks in 25s',time:25,need:2,score:200},
  {id:'nodmg',label:'Clear wave without damage',score:350},
  {id:'capture',label:'Capture any objective this wave',score:250}
];

function diffM(){return DIFF[difficulty]||DIFF.veteran;}
function saveCampaign(){
  try{
    localStorage.setItem('bgs_tank_save',JSON.stringify({
      level:currentLevelIdx,score,selectedTank,selectedCamo,difficulty,
      playerHP,playerMaxHP,damageMult,ts:Date.now()
    }));
  }catch(e){}
}
function loadCampaign(){
  try{
    const raw=localStorage.getItem('bgs_tank_save');
    if(!raw)return null;
    return JSON.parse(raw);
  }catch(e){return null;}
}
function saveMissionRecord(mission,extra){
  const key='bgs_tank_mission_'+mission.level;
  const prev=JSON.parse(localStorage.getItem(key)||'{}');
  const rec={
    bestScore:Math.max(prev.bestScore||0,score),
    bestTime:prev.bestTime?Math.min(prev.bestTime,extra.time):extra.time,
    kills:Math.max(prev.kills||0,kills)
  };
  localStorage.setItem(key,JSON.stringify(rec));
}
function applyPerf(){
  if(!renderer||!sunLight)return;
  const low=perf==='low',mid=perf==='medium';
  renderer.shadowMap.enabled=!low;
  sunLight.castShadow=!low;
  if(sunLight.shadow)sunLight.shadow.mapSize.set(low?512:mid?1024:2048);
  window.__maxParticles=low?35:mid?60:100;
}
function scaledGain(g){return g*(audioVol.master||1)*(audioVol.sfx||1);}

/* ── Audio hooks ── */
const _noiseBurst=noiseBurst;
noiseBurst=function(dur,opts){
  _noiseBurst(dur,{...opts,gain:(opts?.gain||.2)*scaledGain(1)});
};
function playHitFeedback(dot){
  if(dot>.55)noiseBurst(.05,{freq:2400,decay:.008,gain:.07});
  else if(dot<-.55){
    noiseBurst(.1,{freq:140,decay:.05,gain:.18});
    playTone(180,.08,'square',.1);
  }else if(dot<-.4){
    noiseBurst(.07,{freq:380,decay:.03,gain:.12});
    playTone(260,.06,'sawtooth',.08);
  }else playImpact();
}

/* ── Pause ── */
function togglePause(){
  if(!gameStarted||gameState==='over'||gameState==='win'||gameState==='briefing'||gameState==='levelcomplete')return;
  paused=!paused;
  const el=document.getElementById('pause-menu');
  if(!el)return;
  if(paused){
    gameState='paused';
    el.classList.add('show');
    engineLoop(false);
  }else{
    el.classList.remove('show');
    gameState='play';
    engineLoop(true);
  }
}
function restartMission(){
  paused=false;
  document.getElementById('pause-menu')?.classList.remove('show');
  wave=1;playerHP=playerMaxHP;
  const tc=TANK_CLASSES[selectedTank]||TANK_CLASSES.medium;
  playerMaxHP=tc.hp*(diffM().hp>1?1:1);
  engageMission();
}

/* ── Tutorial ── */
function showTutorialIfNeeded(){
  if(localStorage.getItem('bgs_tank_tutorial'))return;
  document.getElementById('tutorial-overlay')?.classList.add('show');
}
function dismissTutorial(){
  localStorage.setItem('bgs_tank_tutorial','1');
  document.getElementById('tutorial-overlay')?.classList.remove('show');
}

/* ── Preload bar ── */
function setLoadProgress(p,msg){
  const bar=document.getElementById('load-progress-fill');
  const lab=document.getElementById('load-progress-label');
  const wrap=document.getElementById('load-progress');
  if(bar)bar.style.width=Math.min(100,Math.max(0,p))+'%';
  if(lab)lab.textContent=msg||('Loading '+Math.round(p)+'%');
  if(wrap)wrap.style.display=p>=100?'none':'block';
}

/* ── Pickups ── */
function clearPickups(){
  pickups.forEach(p=>{if(p.mesh)scene.remove(p.mesh);});
  pickups=[];
}
function spawnPickups(){
  clearPickups();
  const types=['repair','ammo','boost'];
  for(let i=0;i<5;i++){
    const t=types[i%3];
    const x=(Math.random()-.5)*WORLD*.85,z=(Math.random()-.5)*WORLD*.85;
    if(Math.hypot(x,z)<16)continue;
    const col=t==='repair'?0x44ff88:t==='ammo'?0xffcc44:0x88aaff;
    const m=new THREE.Mesh(
      new THREE.BoxGeometry(.7,.5,.7),
      new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.35})
    );
    m.position.set(x,.35,z);
    const ring=new THREE.Mesh(
      new THREE.RingGeometry(.5,.65,16),
      new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.4,side:THREE.DoubleSide})
    );
    ring.rotation.x=-Math.PI/2;ring.position.y=.05;
    const g=new THREE.Group();g.add(ring,m);g.position.set(x,0,z);
    scene.add(g);
    pickups.push({mesh:g,type:t,life:90});
  }
}
function updatePickups(dt){
  if(!player?.group)return;
  const pp=player.group.position;
  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i];p.life-=dt;
    if(p.mesh)p.mesh.rotation.y+=dt;
    if(p.life<=0){scene.remove(p.mesh);pickups.splice(i,1);continue;}
    if(pp.distanceTo(p.mesh.position)<2.2){
      if(p.type==='repair'){playerHP=Math.min(playerMaxHP,playerHP+45);playTone(520,.1,'sine',.08);}
      if(p.type==='ammo'){reload=0;playTone(720,.08,'sine',.06);}
      if(p.type==='boost'){spawnInvuln=4;playTone(880,.1,'triangle',.06);}
      scene.remove(p.mesh);pickups.splice(i,1);
      score+=25;
    }
  }
}

/* ── Smoke ability ── */
function useSmokeAbility(){
  if(abilityCd>0||!player?.group||gameState!=='play')return;
  abilityCd=ABILITY_CD;smokeTimer=5;
  const pos=player.group.position.clone();
  for(let i=0;i<12;i++){
    const p=new THREE.Mesh(
      new THREE.SphereGeometry(.8+Math.random()*.6),
      new THREE.MeshBasicMaterial({color:0x888888,transparent:true,opacity:.45})
    );
    p.position.set(pos.x+(Math.random()-.5)*6,.5,pos.z+(Math.random()-.5)*6);
    scene.add(p);
    particles.push({mesh:p,vel:new THREE.Vector3((Math.random()-.5)*2,.2,(Math.random()-.5)*2),life:4+Math.random()*2,dust:true});
  }
  playTone(110,.2,'sawtooth',.06);
  showObjectiveToast('SMOKE DEPLOYED');
}
function updateAbility(dt){
  if(abilityCd>0)abilityCd-=dt;
  if(smokeTimer>0)smokeTimer-=dt;
  const btn=document.getElementById('ability-btn');
  const cd=document.getElementById('ability-cd');
  if(btn)btn.disabled=abilityCd>0;
  if(cd)cd.textContent=abilityCd>0?Math.ceil(abilityCd)+'s':'READY';
}

/* ── Bonus objectives ── */
function rollBonusObjective(){
  bonusObj={...BONUS_TYPES[Math.floor(Math.random()*BONUS_TYPES.length)],progress:0,done:false};
  if(bonusObj.id==='speed'){waveKillDeadline=25;waveKillsTimer=0;}
  if(bonusObj.id==='nodmg')waveDamage=0;
}
function updateBonusObjective(dt){
  if(!bonusObj||bonusObj.done||gameState!=='play')return;
  if(bonusObj.id==='speed'){
    waveKillDeadline-=dt;
    if(waveKillDeadline<=0){bonusObj.failed=true;return;}
    if(waveKillsTimer>=bonusObj.need){completeBonus();}
  }
  if(bonusObj.id==='nodmg'&&enemies.length===0&&waveDamage===0)completeBonus();
  if(bonusObj.id==='capture'&&objectives.some(o=>o.complete))completeBonus();
}
function completeBonus(){
  if(!bonusObj||bonusObj.done)return;
  bonusObj.done=true;
  score+=bonusObj.score||200;
  showObjectiveToast('BONUS: '+bonusObj.label);
}
function onEnemyKilled(){
  if(bonusObj?.id==='speed')waveKillsTimer++;
}

/* ── Waypoint / compass ── */
function setWaypoint(wx,wz){
  waypoint=new THREE.Vector3(wx,0,wz);
  window.__waypoint=waypoint;
  showObjectiveToast('WAYPOINT SET');
}
function updateCompass(){
  const el=document.getElementById('compass-arrow');
  if(!el||!waypoint||!player?.group){if(el)el.style.display='none';return;}
  const pp=player.group.position;
  const ang=Math.atan2(waypoint.x-pp.x,waypoint.z-pp.z)-player.hullAng;
  const dist=Math.hypot(waypoint.x-pp.x,waypoint.z-pp.z);
  el.style.display='block';
  el.style.transform='rotate('+ang+'rad)';
  el.title=Math.round(dist)+'m to waypoint';
}

/* ── Prop damage visuals ── */
function tintProp(p){
  if(!p.mesh||!p.destruct)return;
  const r=1-(p.hp/p.maxHp);
  p.mesh.traverse(c=>{
    if(c.isMesh&&c.material&&c.material.color)c.material.color.setRGB(1,1-r*.6,1-r*.6);
  });
}

/* ── Gamepad ── */
function pollGamepad(){
  const pads=navigator.getGamepads?.();
  if(!pads)return;
  const gp=pads[0]||pads[1];
  if(!gp)return;
  const ax=gp.axes[0]||0,ay=-(gp.axes[1]||0);
  const rx=gp.axes[2]||0,ry=-(gp.axes[3]||0);
  if(Math.abs(ay)>.2)keys['KeyW']=ay>0,keys['KeyS']=ay<0;
  if(Math.abs(ax)>.2)keys['KeyA']=ax<0,keys['KeyD']=ax>0;
  if(Math.abs(rx)>.15||Math.abs(ry)>.15){
    mouse.x=Math.max(-1,Math.min(1,rx));
    mouse.y=Math.max(-1,Math.min(1,ry));
  }
  if(gp.buttons[7]?.pressed||gp.buttons[0]?.pressed)keys['Space']=true;
  else if(!document.getElementById('touch-fire')?.classList.contains('pressed'))keys['Space']=false;
  if(gp.buttons[4]?.pressed&&!gp.buttons[4]._tapped){gp.buttons[4]._tapped=true;shellType=shellType==='AP'?'HE':'AP';updateHUD();}
  if(!gp.buttons[4]?.pressed)gp.buttons[4]._tapped=false;
  if(gp.buttons[1]?.pressed&&!gp.buttons[1]._tapped){gp.buttons[1]._tapped=true;useSmokeAbility();}
  if(!gp.buttons[1]?.pressed)gp.buttons[1]._tapped=false;
  if(gp.buttons[9]?.pressed&&!gp.buttons[9]._tapped){gp.buttons[9]._tapped=true;togglePause();}
}

/* ── Share ── */
function shareResults(text){
  const msg=text||('Desert Tank Siege — Score '+score+' · Campaign progress '+(currentLevelIdx+1)+'/'+MISSIONS.length);
  if(navigator.share){navigator.share({title:'Desert Tank Siege',text:msg}).catch(()=>{});}
  else{navigator.clipboard?.writeText(msg);showObjectiveToast('Copied to clipboard');}
}

/* ── Wrap core functions ── */
const _populateBriefing=populateBriefing;
populateBriefing=function(mission){
  _populateBriefing(mission);
  const intel=document.getElementById('brief-intel-icon');
  if(intel)intel.textContent=MISSION_INTEL[mission.map]||'🎖️';
};

const _spawnWave=spawnWave;
spawnWave=async function(n){
  rollBonusObjective();
  waveDamage=0;
  const mission=getCurrentMission();
  if(n>=mission.waves){
    showWaveBanner('⚠ COMMAND TANK INBOUND');
    playTone(80,.4,'sawtooth',.15);
    document.getElementById('boss-warn')?.classList.add('show');
    await new Promise(r=>setTimeout(r,2800));
    document.getElementById('boss-warn')?.classList.remove('show');
  }
  return _spawnWave(n);
};

const origBuild=buildGameAssets;
buildGameAssets=async function(){
  setLoadProgress(5,'Preparing theater…');
  const propUrls=ASSETS.props[selectedMap]||ASSETS.props.desert;
  const tankKeys=['abrams','scout','crusader','behemoth','panzer','command','opfor-light'];
  const total=2+propUrls.length+tankKeys.length;
  let done=0;
  const tick=(m)=>{done++;setLoadProgress(5+(done/total)*90,m||'Loading assets…');};
  const _loadGLB=loadGLB;
  loadGLB=async(url,opts)=>{
    try{const r=await _loadGLB(url,opts);tick(url.split('/').pop());return r;}
    catch(e){tick('fallback');return null;}
  };
  const _loadTank=loadTankGLB;
  loadTankGLB=async(role)=>{
    const r=await _loadTank(role);
    tick(role);if(!r)usedBackup=true;return r;
  };
  try{await origBuild();}
  finally{loadGLB=_loadGLB;loadTankGLB=_loadTank;}
  setLoadProgress(100,'Ready');
  spawnPickups();
  if(usedBackup){
    const n=document.getElementById('backup-notice');
    if(n){n.style.display='block';setTimeout(()=>{n.style.display='none';},4000);}
  }
  const origSpawnEnemy=window.__spawnEnemy;
  window.__spawnEnemy=async(type,x,z)=>{
    const d=diffM();
    const e=await origSpawnEnemy(type,x,z);
    if(e){
      e.hp=Math.round(e.hp*d.hp);e.maxHp=e.hp;
      e.speed*=d.spd;
    }
    return e;
  };
};

const _engage=engageMission;
engageMission=async function(){
  missionTimeStart=Date.now();
  window.__missionTimeStart=missionTimeStart;
  abilityCd=0;waypoint=null;window.__waypoint=null;paused=false;
  await _engage();
  showTutorialIfNeeded();
  saveCampaign();
};

const _showLC=showLevelComplete;
showLevelComplete=function(mission){
  _showLC(mission);
  try{
    const rec=JSON.parse(localStorage.getItem('bgs_tank_mission_'+mission.level)||'{}');
    if(rec.bestScore){
      const el=document.getElementById('lc-stats');
      if(el)el.textContent+=' · Mission best: '+rec.bestScore;
    }
  }catch(e){}
};

const _completeLevel=completeCurrentLevel;
completeCurrentLevel=function(){
  const mission=getCurrentMission();
  saveMissionRecord(mission,{time:(Date.now()-missionTimeStart)/1000});
  saveCampaign();
  _completeLevel();
};

const _campaignVictory=campaignVictory;
campaignVictory=function(){
  saveCampaign();
  _campaignVictory();
  const share=document.getElementById('share-victory-btn');
  if(share)share.style.display='inline-block';
};

const _explode=explode;
explode=function(pos,radius,dmg,owner){
  if(owner==='player'&&shellType==='HE'&&player?.group&&pos.distanceTo(player.group.position)<radius*.85){
    playerHP-=Math.min(8,dmg*.15);
  }
  _explode(pos,radius,dmg,owner);
};

const _drawMinimap=drawMinimap;
drawMinimap=function(){
  _drawMinimap();
  const c=document.getElementById('minimap');
  if(!c||!waypoint||!player?.group)return;
  const x=c.getContext('2d');const w=c.width;
  const scale=w/WORLD;
  const px=(v)=>w/2+v*scale;
  x.fillStyle='#ff0';
  x.beginPath();x.arc(px(waypoint.x),px(waypoint.z),4,0,6.28);x.fill();
};

const _updateHUD=updateHUD;
updateHUD=function(){
  _updateHUD();
  updateCompass();
  updateAbility(0);
  const bel=document.getElementById('bonus-label');
  if(bel&&bonusObj&&!bonusObj.done)bel.textContent='★ '+bonusObj.label+(bonusObj.id==='speed'?' ('+Math.ceil(waveKillDeadline)+'s)':'');
  else if(bel)bel.textContent='';
  const pen=document.getElementById('pen-indicator');
  if(pen)pen.style.display=lastPenHint?'block':'none';
};

const _startGame=startGame;
startGame=async function(){
  const save=loadCampaign();
  const rb=document.getElementById('resume-campaign-btn');
  if(rb&&save&&save.level>=1){
    rb.style.display='inline-block';
    rb.textContent='▶ RESUME — Mission '+save.level+' ('+save.score+' pts)';
  }
  await _startGame();
};

/* ── Hit feedback in shell loop — patch via global hook ── */
window.playHitFeedback=playHitFeedback;
window.onEnemyKilled=onEnemyKilled;
window.__onPlayerHitEnemy=function(e,dmg,dot){
  playHitFeedback(dot);
};

window.__onPlayerDamaged=function(amt){waveDamage+=amt;};
window.__getWaveDamage=()=>waveDamage;

const _animateCore=animate;
animate=function(){
  if(paused&&gameState==='paused'){
    requestAnimationFrame(animate);
    if(typeof safeRender==='function')safeRender();
    else if(renderer&&scene&&camera&&window.canRenderFrame?.())renderer.render(scene,camera);
    return;
  }
  if(gameStarted&&(gameState==='play'||gameState==='upgrade')){
    pollGamepad();
    if(smokeTimer>0&&enemies.length)enemies.forEach(e=>{if(e.reload>0)e.reload+=.016;});
  }
  _animateCore();
};

window.updatePickups=updatePickups;
window.updateBonusObjective=updateBonusObjective;
window.updateAbility=updateAbility;
window.saveCampaign=saveCampaign;
window.tintProp=tintProp;
window.pollGamepad=pollGamepad;

const _updateParticles=updateParticles;
updateParticles=function(dt){
  _updateParticles(dt);
  const maxP=window.__maxParticles||100;
  while(particles.length>maxP){
    const p=particles.shift();
    if(p.mesh)scene.remove(p.mesh);
  }
};

const _updateArtillery=updateArtillery;
updateArtillery=function(dt){
  if(spawnInvuln>0)return;
  artilleryTimer-=dt/(diffM().art||1);
  const warn=document.getElementById('artillery-warn');
  if(artilleryTimer<=0){
    artilleryTimer=(16+Math.random()*8)*(diffM().art||1);
    let tries=0;
    do{
      artilleryPos.set((Math.random()-.5)*WORLD*.75,0,(Math.random()-.5)*WORLD*.75);
      tries++;
    }while(tries<8&&player.group&&player.group.position.distanceTo(artilleryPos)<18);
    const sc=worldToScreen(artilleryPos);
    warn.style.display='block';
    warn.style.left=(sc.x-40)+'px';
    warn.style.top=(sc.y-40)+'px';
    warn.style.width=warn.style.height='80px';
    setTimeout(()=>{
      warn.style.display='none';
      if(player.group&&player.group.position.distanceTo(artilleryPos)<10){
        playerHP-=12;screenShake(.5);playExplosion();
        if(window.__onPlayerDamaged)window.__onPlayerDamaged(12);
      }
      spawnBattleSmoke(artilleryPos.clone().setY(.3),4,5);
      explode(artilleryPos,10,30,'enemy');
    },2200);
  }
};

/* ── UI bindings ── */
function initFeatureUI(){
  document.querySelectorAll('#diff-pick .pick-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('#diff-pick .pick-btn').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');difficulty=b.dataset.diff;
    });
  });
  document.getElementById('resume-campaign-btn')?.addEventListener('click',async()=>{
    const save=loadCampaign();
    if(!save)return;
    window.__resumeCampaign=true;
    currentLevelIdx=Math.min(MISSIONS.length-1,Math.max(0,(save.level||1)-1));
    selectedTank=save.selectedTank||selectedTank;
    selectedCamo=save.selectedCamo||selectedCamo;
    difficulty=save.difficulty||difficulty;
    score=save.score||0;
    damageMult=save.damageMult||1;
    document.querySelectorAll('#diff-pick .pick-btn').forEach(b=>{
      b.classList.toggle('sel',b.dataset.diff===difficulty);
    });
    document.querySelectorAll('#tank-pick .pick-btn').forEach(b=>{
      b.classList.toggle('sel',b.dataset.tank===selectedTank);
    });
    document.querySelectorAll('#camo-pick .pick-btn').forEach(b=>{
      b.classList.toggle('sel',b.dataset.camo===selectedCamo);
    });
    await startGame();
    playerHP=Math.min(save.playerHP||playerMaxHP,playerMaxHP);
  });
  document.getElementById('pause-resume')?.addEventListener('click',togglePause);
  document.getElementById('pause-restart')?.addEventListener('click',restartMission);
  document.getElementById('pause-quit')?.addEventListener('click',()=>location.reload());
  document.getElementById('tutorial-dismiss')?.addEventListener('click',dismissTutorial);
  document.getElementById('ability-btn')?.addEventListener('click',useSmokeAbility);
  document.getElementById('share-victory-btn')?.addEventListener('click',()=>{
    shareResults('I completed the Desert Tank Siege campaign! Score: '+score);
  });
  ['audio-master','audio-sfx','audio-engine'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',e=>{
      const k=id.replace('audio-','');
      audioVol[k]=parseFloat(e.target.value);
      if(engineNodes?.master)engineNodes.master.gain.value=audioVol.master;
    });
  });
  document.querySelectorAll('#perf-pick .pick-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('#perf-pick .pick-btn').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');perf=b.dataset.perf;applyPerf();
    });
  });
  const mmc=document.getElementById('minimap');
  if(mmc){
    mmc.style.pointerEvents='auto';
    mmc.classList.add('hud-interactive');
    mmc.addEventListener('click',e=>{
      if(!player?.group)return;
      const r=mmc.getBoundingClientRect();
      const u=(e.clientX-r.left)/r.width-.5;
      const v=(e.clientY-r.top)/r.height-.5;
      setWaypoint(u*WORLD*2,v*WORLD*2);
    });
  }
  document.getElementById('touch-ability')?.addEventListener('click',useSmokeAbility);
  applyPerf();
}
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'){e.preventDefault();togglePause();}
  if(e.code==='KeyE'&&!e.repeat&&isGamePlaying()){e.preventDefault();useSmokeAbility();}
},{capture:true});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initFeatureUI);
else initFeatureUI();

window.TankFeatures={saveCampaign,loadCampaign,togglePause,useSmokeAbility,setWaypoint,difficulty:()=>difficulty};

})();
