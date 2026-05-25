/**
 * Desert Tank Siege — 30 extended features (loads after tank-battle-features.js).
 */
(function(){
'use strict';
if(typeof MISSIONS==='undefined')return;

/* ═══════════════════════════════════════════════════════════════
   FEATURE LIST (30)
   1 Mission Select   2 Star Ratings    3 Achievements    4 Daily Challenge
   5 Survival Mode    6 Quick Strike    7 Rank Progress   8 Kill Streaks
   9 Overcharge      10 Night Modifier  11 Fog Modifier   12 Sandstorm
  13 Ice Traction    14 Minefields      15 Airstrike       16 Repair Drone
  17 Reinforcements  18 Screenshot      19 Speedrun Timer  20 Trail Breadcrumbs
  21 Loadout Modules 22 Salvage Credits 23 Armory Shop    24 Commander Perks
  25 Weak Point Scan 26 Aim Assist      27 Boost Dash     28 Shell Arc Hint
  29 Radar Pulse     30 Campaign Codex
   ═══════════════════════════════════════════════════════════════ */

let gameMode='campaign';
let survivalWave=0;
let missionDamageTaken=0;
let killStreak=0;
let killStreakTimer=0;
let overchargeCd=0;
let overchargeActive=0;
let airstrikeCd=0;
let scanCd=0;
let scanActive=0;
let radarPulseT=0;
let boostDashCd=0;
let boostDashActive=0;
let droneHealT=0;
let idleTime=0;
let reinforcementTimer=45;
let mines=[];
let trailPoints=[];
let shellArcLine=null;
let sandstormParts=[];
let selectedCommander='bradley';
let selectedModule='balanced';
let credits=parseInt(localStorage.getItem('bgs_tank_credits')||'0',10);
const armoryUpgrades=JSON.parse(localStorage.getItem('bgs_tank_armory')||'{}');
let unlockedMissions=parseInt(localStorage.getItem('bgs_tank_unlocked')||'1',10);
const missionStars=JSON.parse(localStorage.getItem('bgs_tank_stars')||'{}');
const achievements=JSON.parse(localStorage.getItem('bgs_tank_achievements')||'{}');

const RANKS=[
  {name:'Recruit',min:0},{name:'Corporal',min:5},{name:'Sergeant',min:15},
  {name:'Lieutenant',min:30},{name:'Captain',min:50},{name:'Major',min:75},
  {name:'Colonel',min:100},{name:'General',min:130}
];
const COMMANDERS={
  bradley:{name:'Col. Bradley',bonus:'+10% hull HP',hpMult:1.1},
  hayes:{name:'Gen. Hayes',bonus:'+15% score',scoreMult:1.15},
  torres:{name:'Maj. Torres',bonus:'-12% reload',reloadMult:.88},
  ellis:{name:'Capt. Ellis',bonus:'+8% speed',speedMult:1.08}
};
const MODULES={
  balanced:{label:'Balanced',dmg:1,reload:1,hp:1},
  assault:{label:'Assault',dmg:1.2,reload:1.05,hp:.95},
  fortress:{label:'Fortress',dmg:.9,reload:1.1,hp:1.25}
};
const ACHIEVEMENTS=[
  {id:'first_blood',label:'First Blood',desc:'Destroy your first tank',check:()=>kills>=1},
  {id:'combo_5',label:'Combo Artist',desc:'Reach combo ×5',check:()=>bestComboRun>=5},
  {id:'combo_10',label:'Rampage',desc:'Reach combo ×10',check:()=>bestComboRun>=10},
  {id:'no_damage_wave',label:'Iron Hull',desc:'Clear a wave without damage',check:()=>achievements._nodmgWave},
  {id:'rear_kill',label:'Backstabber',desc:'Score a rear penetration kill',check:()=>achievements._rearKill},
  {id:'boss_slayer',label:'Boss Slayer',desc:'Destroy a command tank',check:()=>achievements._bossKill},
  {id:'mission_10',label:'Veteran',desc:'Complete mission 10',check:()=>(missionStars[10]?.stars||0)>0},
  {id:'mission_25',label:'Campaigner',desc:'Complete mission 25',check:()=>(missionStars[25]?.stars||0)>0},
  {id:'mission_50',label:'War Hero',desc:'Complete all 50 missions',check:()=>(missionStars[50]?.stars||0)>0},
  {id:'survival_5',label:'Survivor',desc:'Reach survival wave 5',check:()=>(achievements._survivalBest||0)>=5},
  {id:'survival_10',label:'Last Stand',desc:'Reach survival wave 10',check:()=>(achievements._survivalBest||0)>=10},
  {id:'streak_10',label:'Kill Streak',desc:'10 kills without a gap',check:()=>(achievements._bestStreak||0)>=10},
  {id:'rich',label:'Quartermaster',desc:'Earn 500 salvage credits',check:()=>credits>=500},
  {id:'three_star',label:'Perfectionist',desc:'Earn 3 stars on any mission',check:()=>Object.values(missionStars).some(s=>s.stars>=3)},
  {id:'daily_win',label:'Daily Warrior',desc:'Complete the daily challenge',check:()=>achievements._dailyWin}
];

function saveMeta(){
  localStorage.setItem('bgs_tank_credits',String(credits));
  localStorage.setItem('bgs_tank_armory',JSON.stringify(armoryUpgrades));
  localStorage.setItem('bgs_tank_unlocked',String(unlockedMissions));
  localStorage.setItem('bgs_tank_stars',JSON.stringify(missionStars));
  localStorage.setItem('bgs_tank_achievements',JSON.stringify(achievements));
}
function totalStars(){
  return Object.values(missionStars).reduce((a,s)=>a+(s.stars||0),0);
}
function getRank(){
  const t=totalStars();
  let r=RANKS[0];
  RANKS.forEach(x=>{if(t>=x.min)r=x;});
  return r;
}
function isMissionUnlocked(lv){return lv<=unlockedMissions;}
function unlockMission(lv){if(lv>unlockedMissions){unlockedMissions=lv;saveMeta();}}

function getDailyMission(){
  const d=new Date();
  const seed=d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
  const idx=seed%MISSIONS.length;
  return{...MISSIONS[idx],daily:true,dailySeed:seed,modifier:['fog','night','sandstorm'][seed%3]};
}

function applyCommanderAndModule(){
  const cmd=COMMANDERS[selectedCommander]||COMMANDERS.bradley;
  const mod=MODULES[selectedModule]||MODULES.balanced;
  const tc=TANK_CLASSES[selectedTank]||TANK_CLASSES.medium;
  playerMaxHP=Math.round(tc.hp*(cmd.hpMult||1)*(mod.hp||1)*(armoryUpgrades.armor?1.08:1));
  reloadTime=tc.reload*(cmd.reloadMult||1)*(mod.reload||1)*(armoryUpgrades.reload?0.92:1);
  if(!window.__resumeCampaign)playerHP=playerMaxHP;
  damageMult=(mod.dmg||1)*(armoryUpgrades.damage?1.1:1);
  if(player?.speed){
    player.speed=tc.speed*(cmd.speedMult||1)*(armoryUpgrades.engine?1.06:1);
    player.sprint=tc.sprint*(cmd.speedMult||1)*(armoryUpgrades.engine?1.06:1);
  }
}

function applyMissionModifier(mission){
  if(!renderer||!scene)return;
  const mod=mission?.modifier||'';
  const fog=MAPS[mission?.map||selectedMap]?.fog||0xe8e2d4;
  if(mod==='night'){
    scene.background=new THREE.Color(0x0a1020);
    if(scene.fog)scene.fog.density=(MAPS[mission.map]?.hazeDensity||0.01)+.025;
    renderer.toneMappingExposure=0.65;
  }else if(mod==='fog'){
    if(scene.fog)scene.fog.density=(MAPS[mission.map]?.hazeDensity||0.01)+.035;
    renderer.toneMappingExposure=0.85;
  }else if(mod==='sandstorm'){
    if(scene.fog)scene.fog.density=(MAPS[mission.map]?.hazeDensity||0.01)+.028;
    clearSandstorm();
    for(let i=0;i<40;i++){
      const p=new THREE.Mesh(
        new THREE.PlaneGeometry(2+Math.random()*4,1+Math.random()*2),
        new THREE.MeshBasicMaterial({color:0xc8a868,transparent:true,opacity:.15+Math.random()*.15,depthWrite:false})
      );
      p.position.set((Math.random()-.5)*WORLD,(1+Math.random()*4),(Math.random()-.5)*WORLD);
      scene.add(p);
      sandstormParts.push({mesh:p,life:9999,storm:true});
    }
    const ov=document.getElementById('sandstorm-overlay');
    if(ov)ov.classList.add('active');
  }else{
    clearSandstorm();
    const mapExposure=mission?.map==='desert'?1.38:mission?.map==='snow'?1.18:1.12;
    renderer.toneMappingExposure=mapExposure;
    if(scene.fog)scene.fog.density=MAPS[mission?.map||selectedMap]?.hazeDensity||0.016;
    const ov=document.getElementById('sandstorm-overlay');
    if(ov)ov.classList.remove('active');
  }
  if(mission?.map&&MAPS[mission.map])scene.fog.color.setHex(fog);
}
function clearSandstorm(){
  sandstormParts.forEach(p=>{if(p.mesh)scene.remove(p.mesh);});
  sandstormParts=[];
}

function spawnMines(count){
  clearMines();
  for(let i=0;i<count;i++){
    const x=(Math.random()-.5)*WORLD*.8,z=(Math.random()-.5)*WORLD*.8;
    if(Math.hypot(x,z)<12)continue;
    const m=new THREE.Mesh(
      new THREE.CylinderGeometry(.35,.45,.12,8),
      new THREE.MeshStandardMaterial({color:0x4a4038,metalness:.4})
    );
    m.position.set(x,.06,z);
    const ring=new THREE.Mesh(
      new THREE.RingGeometry(.4,.55,12),
      new THREE.MeshBasicMaterial({color:0xff4444,transparent:true,opacity:.35,side:THREE.DoubleSide})
    );
    ring.rotation.x=-Math.PI/2;ring.position.y=.08;
    const g=new THREE.Group();g.add(m,ring);g.position.set(x,0,z);
    scene.add(g);
    mines.push({mesh:g,armed:true});
  }
}
function clearMines(){
  mines.forEach(m=>{if(m.mesh)scene.remove(m.mesh);});
  mines=[];
}
function updateMines(){
  if(!player?.group||gameState!=='play')return;
  const pp=player.group.position;
  mines.forEach((m,i)=>{
    if(!m.armed||!m.mesh)return;
    if(pp.distanceTo(m.mesh.position)<2.5){
      m.armed=false;
      explode(m.mesh.position,6,35,'enemy');
      scene.remove(m.mesh);
      mines.splice(i,1);
      playerHP-=22;
      missionDamageTaken+=22;
      if(window.__onPlayerDamaged)window.__onPlayerDamaged(22);
      showObjectiveToast('MINE HIT!');
    }
  });
}

function useOvercharge(){
  if(overchargeCd>0||!player?.group||gameState!=='play')return;
  overchargeActive=5;overchargeCd=20;
  damageMult*=(MODULES[selectedModule]?.dmg||1)>1?1.35:1.5;
  showObjectiveToast('OVERCHARGE ACTIVE');
  playTone(660,.15,'sawtooth',.08);
}
function useAirstrike(){
  if(airstrikeCd>0||!player?.group||gameState!=='play')return;
  airstrikeCd=35;
  const wp=window.__waypoint;
  const target=wp?wp.clone():player.group.position.clone().add(new THREE.Vector3(Math.sin(player.hullAng)*30,0,Math.cos(player.hullAng)*30));
  showObjectiveToast('AIRSTRIKE INBOUND');
  const warn=document.getElementById('artillery-warn');
  const sc=worldToScreen(target);
  if(warn){
    warn.style.display='block';
    warn.style.left=(sc.x-50)+'px';warn.style.top=(sc.y-50)+'px';
    warn.style.width=warn.style.height='100px';
  }
  setTimeout(()=>{
    if(warn)warn.style.display='none';
    explode(target,14,55,'player');
    spawnBattleSmoke(target.clone().setY(.3),5,6);
  },2500);
}
function useWeakPointScan(){
  if(scanCd>0||gameState!=='play')return;
  scanActive=4;scanCd=18;
  showObjectiveToast('WEAK POINT SCAN');
  playTone(880,.08,'sine',.06);
}
function useBoostDash(){
  if(boostDashCd>0||!player?.body||gameState!=='play')return;
  boostDashActive=1.2;boostDashCd=8;
  const a=player.hullAng||0;
  player.body.velocity.x+=Math.sin(a)*18;
  player.body.velocity.z+=Math.cos(a)*18;
  playTone(200,.1,'square',.06);
}

function updateExtendedCombat(dt){
  if(gameState!=='play')return;
  if(overchargeCd>0)overchargeCd-=dt;
  if(overchargeActive>0){
    overchargeActive-=dt;
    if(overchargeActive<=0)applyCommanderAndModule();
  }
  if(airstrikeCd>0)airstrikeCd-=dt;
  if(scanCd>0)scanCd-=dt;
  if(scanActive>0)scanActive-=dt;
  if(boostDashCd>0)boostDashCd-=dt;
  if(boostDashActive>0)boostDashActive-=dt;
  if(radarPulseT>0)radarPulseT-=dt;
  else if(gameStarted){radarPulseT=18;window.__radarPulse=true;setTimeout(()=>{window.__radarPulse=false;},1200);}

  if(player?.body){
    const spd=Math.hypot(player.body.velocity.x,player.body.velocity.z);
    if(spd<0.8){idleTime+=dt;droneHealT+=dt;}else{idleTime=0;droneHealT=0;}
    if(droneHealT>2.5&&playerHP<playerMaxHP){
      playerHP=Math.min(playerMaxHP,playerHP+dt*8);
      if(Math.random()<.02)playTone(440,.04,'sine',.03);
    }
    const mission=getCurrentMission();
    if((mission?.modifier==='ice'||mission?.map==='snow')&&boostDashActive<=0){
      player.body.velocity.x*=(1-dt*.08);
      player.body.velocity.z*=(1-dt*.08);
    }
  }

  if(killStreakTimer>0){killStreakTimer-=dt;if(killStreakTimer<=0)killStreak=0;}
  reinforcementTimer-=dt;
  if(reinforcementTimer<=0&&enemies.length>0&&enemies.length<8&&gameMode!=='survival'){
    reinforcementTimer=50+Math.random()*30;
    showObjectiveToast('⚠ REINFORCEMENTS INBOUND');
    const ang=Math.random()*Math.PI*2;
    window.__spawnEnemy?.('fast',Math.cos(ang)*45,Math.sin(ang)*45);
  }

  updateMines();
  updateSandstorm(dt);
  updateShellArc();
  updateTrail(dt);
  updateKillStreakUI();
  updateExtendedHUD(dt);
  checkAchievements();
}

function updateSandstorm(dt){
  sandstormParts.forEach(p=>{
    if(!p.mesh)return;
    p.mesh.position.x+=dt*8;
    if(p.mesh.position.x>WORLD*.6)p.mesh.position.x=-WORLD*.6;
  });
}

function updateTrail(dt){
  if(!player?.group||gameState!=='play')return;
  trailPoints.push({x:player.group.position.x,z:player.group.position.z,t:8});
  trailPoints=trailPoints.filter(p=>{p.t-=dt;return p.t>0;});
  if(trailPoints.length>80)trailPoints.shift();
}

function updateShellArc(){
  if(!shellArcLine||!player?.group||gameState!=='play'||reload>0){
    if(shellArcLine)shellArcLine.visible=false;
    return;
  }
  const aim=player.hullAng+(player.turretAng||0);
  const from=getTankMuzzleWorld(player.group,player.turret,player.barrel,player.muzzle,aim,player.silhouette);
  const pts=[];
  for(let i=0;i<=12;i++){
    const t=i*.18;
    pts.push(new THREE.Vector3(from.x+Math.sin(aim)*t*8,from.y-t*t*2,from.z+Math.cos(aim)*t*8));
  }
  shellArcLine.geometry.setFromPoints(pts);
  shellArcLine.visible=localStorage.getItem('bgs_tank_arc')!=='0';
}

function ensureShellArc(){
  if(shellArcLine||typeof THREE==='undefined')return;
  shellArcLine=new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({color:0xffcc66,dashSize:.8,gapSize:.4,transparent:true,opacity:.55})
  );
  shellArcLine.frustumCulled=false;
  scene.add(shellArcLine);
}

function updateKillStreakUI(){
  const el=document.getElementById('streak-label');
  if(!el)return;
  if(killStreak>=3){
    el.textContent='🔥 STREAK ×'+killStreak;
    el.style.display='block';
  }else el.style.display='none';
}

function updateExtendedHUD(dt){
  const timer=document.getElementById('mission-timer');
  if(timer&&window.__missionTimeStart)timer.textContent=formatTime((Date.now()-window.__missionTimeStart)/1000);
  const rank=document.getElementById('rank-label');
  if(rank)rank.textContent=getRank().name;
  const cred=document.getElementById('credits-label');
  const hc=document.getElementById('hud-credits');
  if(cred)cred.textContent=credits;
  if(hc)hc.textContent=credits;
  const oc=document.getElementById('overcharge-cd');
  if(oc)oc.textContent=overchargeCd>0?Math.ceil(overchargeCd)+'s':'R';
  const as=document.getElementById('airstrike-cd');
  if(as)as.textContent=airstrikeCd>0?Math.ceil(airstrikeCd)+'s':'T';
  const sc=document.getElementById('scan-cd');
  if(sc)sc.textContent=scanCd>0?Math.ceil(scanCd)+'s':'F';
}

function formatTime(s){
  const m=Math.floor(s/60),sec=Math.floor(s%60);
  return m+':'+String(sec).padStart(2,'0');
}

function onExtendedKill(e){
  killStreak++;
  killStreakTimer=8;
  if(killStreak>(achievements._bestStreak||0))achievements._bestStreak=killStreak;
  credits+=8+(killStreak>=5?5:0);
  if(killStreak===5||killStreak===10||killStreak===15){
    score+=killStreak*20;
    showObjectiveToast('STREAK BONUS +'+killStreak*20);
  }
  if(e?.type==='boss')achievements._bossKill=true;
  saveMeta();
}

function calcStars(mission,time,dmg){
  let stars=1;
  if(mission.objectiveDefs&&objectives.filter(o=>o.complete).length>=objectives.length)stars=2;
  const tgt=mission.starsTarget||{time:420,damage:40};
  if(time<=tgt.time&&dmg<=tgt.damage)stars=3;
  return stars;
}

function awardMissionStars(mission){
  const time=(Date.now()-(window.__missionTimeStart||Date.now()))/1000;
  const stars=calcStars(mission,time,missionDamageTaken);
  const prev=missionStars[mission.level]||{};
  const best=Math.max(prev.stars||0,stars);
  missionStars[mission.level]={stars:best,time:prev.time?Math.min(prev.time,time):time,damage:Math.min(prev.damage||999,dmgSafe(missionDamageTaken))};
  unlockMission(mission.level+1);
  saveMeta();
  const el=document.getElementById('lc-stars');
  if(el)el.textContent='★'.repeat(best)+'☆'.repeat(3-best)+' ('+best+'/3 stars)';
  return best;
}
function dmgSafe(v){return v||0;}

function checkAchievements(){
  ACHIEVEMENTS.forEach(a=>{
    if(achievements[a.id])return;
    if(a.check()){
      achievements[a.id]=Date.now();
      showObjectiveToast('🏅 '+a.label);
      credits+=50;
      saveMeta();
      renderAchievements();
    }
  });
}

function renderMissionSelect(){
  const grid=document.getElementById('mission-grid');
  if(!grid)return;
  grid.innerHTML='';
  MISSIONS.forEach(m=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='mission-cell'+(isMissionUnlocked(m.level)?'':' locked');
    const stars=missionStars[m.level]?.stars||0;
    btn.innerHTML='<span class="mc-lv">'+m.level+'</span><span class="mc-name">'+m.codename.replace('OP ','')+'</span><span class="mc-stars">'+'★'.repeat(stars)+'☆'.repeat(3-stars)+'</span>';
    if(isMissionUnlocked(m.level)){
      btn.addEventListener('click',()=>{
        currentLevelIdx=m.level-1;
        document.getElementById('mission-select-screen')?.classList.remove('show');
        startGameFromSelect();
      });
    }
    grid.appendChild(btn);
  });
}

function renderCodex(){
  const list=document.getElementById('codex-list');
  if(!list)return;
  list.innerHTML='';
  MISSIONS.forEach(m=>{
    if(!missionStars[m.level]?.stars)return;
    const li=document.createElement('li');
    li.innerHTML='<strong>'+m.codename+'</strong> — '+m.name+'<br><span style="opacity:.75">'+m.intel.slice(0,120)+'…</span>';
    list.appendChild(li);
  });
}

function renderAchievements(){
  const list=document.getElementById('achievements-list');
  if(!list)return;
  list.innerHTML='';
  ACHIEVEMENTS.forEach(a=>{
    const li=document.createElement('li');
    li.className=achievements[a.id]?'done':'';
    li.textContent=(achievements[a.id]?'✓ ':'')+a.label+' — '+a.desc;
    list.appendChild(li);
  });
}

function renderArmory(){
  const shop=document.getElementById('armory-shop');
  if(!shop)return;
  shop.innerHTML='<p class="armory-credits">Salvage: <strong id="armory-credits">'+credits+'</strong></p>';
  [{id:'damage',label:'+10% damage',cost:200},{id:'armor',label:'+8% hull HP',cost:180},{id:'reload',label:'-8% reload',cost:160},{id:'engine',label:'+6% speed',cost:150}].forEach(item=>{
    const owned=armoryUpgrades[item.id];
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='pick-btn armory-item'+(owned?' sel':'');
    btn.textContent=(owned?'✓ ':'')+item.label+' ('+item.cost+' cr)';
    btn.disabled=owned;
    btn.addEventListener('click',()=>{
      if(credits>=item.cost&&!owned){
        credits-=item.cost;armoryUpgrades[item.id]=true;saveMeta();renderArmory();applyCommanderAndModule();
      }
    });
    shop.appendChild(btn);
  });
}

async function startGameFromSelect(){
  gameMode='campaign';
  window.__fromMissionSelect=true;
  window.__resumeCampaign=false;
  document.getElementById('start-screen').style.display='none';
  await startGame();
}

async function startSurvivalMode(){
  gameMode='survival';
  survivalWave=0;
  window.__fromMissionSelect=false;
  window.__resumeCampaign=false;
  document.getElementById('start-screen').style.display='none';
  document.getElementById('survival-select-screen')?.classList.remove('show');
  await startGame();
}

async function startDailyChallenge(){
  gameMode='daily';
  const dm=getDailyMission();
  currentLevelIdx=MISSIONS.findIndex(m=>m.level===dm.level);
  if(currentLevelIdx<0)currentLevelIdx=0;
  window.__fromMissionSelect=true;
  window.__resumeCampaign=false;
  document.getElementById('start-screen').style.display='none';
  document.getElementById('daily-select-screen')?.classList.remove('show');
  await startGame();
}

async function startQuickStrike(){
  const qs=MISSIONS.filter(m=>m.quickStrike);
  const pick=qs[Math.floor(Math.random()*qs.length)]||MISSIONS[6];
  gameMode='quickstrike';
  currentLevelIdx=pick.level-1;
  window.__fromMissionSelect=true;
  window.__resumeCampaign=false;
  document.getElementById('start-screen').style.display='none';
  document.getElementById('quickstrike-screen')?.classList.remove('show');
  await startGame();
}

async function takeScreenshot(){
  try{
    safeRender?.();
    const url=renderer.domElement.toDataURL('image/png');
    if(navigator.share&&navigator.canShare?.({files:[new File([],'x.png')]})){
      const blob=await(await fetch(url)).blob();
      const file=new File([blob],'desert-tank-siege.png',{type:'image/png'});
      await navigator.share({title:'Desert Tank Siege',files:[file]});
    }else{
      const a=document.createElement('a');
      a.href=url;a.download='desert-tank-siege.png';a.click();
      showObjectiveToast('Screenshot saved');
    }
  }catch(e){showObjectiveToast('Screenshot failed');}
}

function applyAimAssist(){
  if(!prefersTouchControls()||!player?.group||gameState!=='play')return;
  const assist=parseFloat(localStorage.getItem('bgs_tank_aim')||'0.35');
  if(assist<=0||!enemies.length)return;
  let best=null,bd=999;
  enemies.forEach(e=>{
    if(!e.group)return;
    const d=player.group.position.distanceTo(e.group.position);
    if(d<bd&&d<55){bd=d;best=e;}
  });
  if(!best)return;
  const dx=best.group.position.x-player.group.position.x;
  const dz=best.group.position.z-player.group.position.z;
  const tx=(Math.atan2(dx,dz)/Math.PI);
  const ty=0;
  mouse.x+=(tx-mouse.x)*assist*.08;
  mouse.y+=(ty-mouse.y)*assist*.08;
}

/* ── Patches ── */
const _getCurrentMission=getCurrentMission;
getCurrentMission=function(){
  const m=_getCurrentMission();
  if(gameMode==='survival')return{...m,waves:9999,name:'Survival — '+m.name};
  if(gameMode==='daily'){
    const dm=getDailyMission();
    return{...m,...dm,level:m.level};
  }
  return m;
};

const _engage=engageMission;
engageMission=async function(){
  missionDamageTaken=0;
  killStreak=0;
  trailPoints=[];
  reinforcementTimer=40+Math.random()*20;
  clearMines();
  const mission=getCurrentMission();
  if(mission.level>=8||mission.modifier)spawnMines(mission.modifier==='night'?8:5);
  applyMissionModifier(mission);
  applyCommanderAndModule();
  ensureShellArc();
  await _engage();
  if(gameMode==='survival')showObjectiveToast('SURVIVAL — Wave 1');
};

const _spawnWave=spawnWave;
spawnWave=async function(n){
  if(gameMode==='survival'){
  survivalWave=n;
  achievements._survivalBest=Math.max(achievements._survivalBest||0,n);
  }
  return _spawnWave(n);
};

const _completeLevel=completeCurrentLevel;
completeCurrentLevel=function(){
  if(gameMode==='survival')return;
  const mission=MISSIONS[currentLevelIdx]||_getCurrentMission();
  const cmd=COMMANDERS[selectedCommander]||COMMANDERS.bradley;
  if(cmd.scoreMult)score=Math.round(score*cmd.scoreMult);
  awardMissionStars(mission);
  if(gameMode==='daily'){achievements._dailyWin=true;credits+=100;saveMeta();}
  gameMode='campaign';
  _completeLevel();
};

const _showUpgrade=showUpgradePick;
showUpgradePick=function(){
  if(gameMode==='survival'){
    document.querySelector('#upgrade-pick > div').textContent='Survival wave '+wave+' complete — choose upgrade';
  }
  _showUpgrade();
};

const _showLC=showLevelComplete;
showLevelComplete=function(mission){
  _showLC(mission);
  const stars=missionStars[mission.level]?.stars||1;
  const el=document.getElementById('lc-stars');
  if(el)el.textContent='★'.repeat(stars)+'☆'.repeat(3-stars);
};

const _onKill=window.onEnemyKilled;
window.onEnemyKilled=function(){
  if(_onKill)_onKill();
  onExtendedKill();
};

const _prevDamaged=window.__onPlayerDamaged;
window.__onPlayerDamaged=function(amt){
  missionDamageTaken+=amt;
  killStreak=0;
  if(_prevDamaged)_prevDamaged(amt);
};

window.__onPlayerHitEnemy=function(e,dmg,dot){
  if(typeof window.playHitFeedback==='function')window.playHitFeedback(dot);
  if(dot<-.4)achievements._rearKill=true;
};

const _drawMinimap=drawMinimap;
drawMinimap=function(){
  _drawMinimap();
  const c=document.getElementById('minimap');
  if(!c)return;
  const x=c.getContext('2d');const w=c.width;const scale=w/WORLD;const px=v=>w/2+v*scale;
  trailPoints.forEach(p=>{
    x.fillStyle='rgba(0,255,204,.25)';
    x.fillRect(px(p.x)-1,px(p.z)-1,2,2);
  });
  if(window.__radarPulse){
    enemies.forEach(e=>{
      x.strokeStyle='#ff0';x.lineWidth=2;
      x.beginPath();x.arc(px(e.group.position.x),px(e.group.position.z),6,0,6.28);x.stroke();
    });
  }
  if(scanActive>0){
    enemies.forEach(e=>{
      x.fillStyle='#f8f';
      x.beginPath();x.arc(px(e.group.position.x),px(e.group.position.z),4,0,6.28);x.fill();
    });
  }
};

const _updateEnemies=updateEnemies;
updateEnemies=function(dt){
  _updateEnemies(dt);
  if(scanActive>0&&enemies.length){
    enemies.forEach(e=>{
      if(e.group&&!e._scanMarker){
        const m=new THREE.Mesh(new THREE.RingGeometry(1.2,1.5,12),new THREE.MeshBasicMaterial({color:0xff4488,transparent:true,opacity:.6,side:THREE.DoubleSide}));
        m.rotation.x=-Math.PI/2;m.position.y=.2;
        e.group.add(m);e._scanMarker=m;
      }
    });
  }else{
    enemies.forEach(e=>{
      if(e._scanMarker&&e.group){e.group.remove(e._scanMarker);e._scanMarker=null;}
    });
  }
};

let _extLastT=0;
const _animate=animate;
animate=function(){
  const now=performance.now();
  const dt=_extLastT?Math.min((now-_extLastT)/1000,.05):.016;
  _extLastT=now;
  if(gameState==='play'){
    try{
      updateExtendedCombat(dt);
      applyAimAssist();
    }catch(e){console.warn('ExtCombat:',e.message);}
  }
  _animate();
};

const _checkWaveClear=checkWaveClear;
checkWaveClear=function(){
  if(typeof window.__getWaveDamage==='function'&&window.__getWaveDamage()===0&&enemies.length===0){
    achievements._nodmgWave=true;
  }
  _checkWaveClear();
};

const _startGame=startGame;
startGame=async function(){
  applyCommanderAndModule();
  await _startGame();
  window.__fromMissionSelect=false;
  const lm=document.getElementById('level-max');
  if(lm)lm.textContent=MISSIONS.length;
  const ln=document.getElementById('level-num');
  if(ln)ln.textContent=String(getCurrentMission().level);
};

const _populateBriefing=populateBriefing;
populateBriefing=function(mission){
  _populateBriefing(mission);
  const modEl=document.getElementById('brief-modifier');
  if(modEl){
    modEl.textContent=mission.modifier?'ENV MODIFIER: '+mission.modifier.toUpperCase():'';
    modEl.style.display=mission.modifier?'block':'none';
  }
  if(gameMode==='daily'){
    const t=document.getElementById('brief-title');
    if(t)t.textContent='DAILY CHALLENGE — '+mission.name;
  }
};

function initExtendedUI(){
  document.getElementById('menu-mission-select')?.addEventListener('click',()=>{
    renderMissionSelect();
    document.getElementById('mission-select-screen')?.classList.add('show');
  });
  document.getElementById('menu-codex')?.addEventListener('click',()=>{
    renderCodex();
    document.getElementById('codex-screen')?.classList.add('show');
  });
  document.getElementById('menu-armory')?.addEventListener('click',()=>{
    renderArmory();
    document.getElementById('armory-screen')?.classList.add('show');
  });
  document.getElementById('menu-achievements')?.addEventListener('click',()=>{
    renderAchievements();
    document.getElementById('achievements-screen')?.classList.add('show');
  });
  document.getElementById('menu-survival')?.addEventListener('click',()=>{
    document.getElementById('survival-select-screen')?.classList.add('show');
  });
  document.getElementById('menu-daily')?.addEventListener('click',()=>{
    const dm=getDailyMission();
    const el=document.getElementById('daily-info');
    if(el)el.textContent=dm.codename+' · '+dm.name+' · Modifier: '+(dm.modifier||'none').toUpperCase();
    document.getElementById('daily-select-screen')?.classList.add('show');
  });
  document.getElementById('menu-quickstrike')?.addEventListener('click',()=>{
    document.getElementById('quickstrike-screen')?.classList.add('show');
  });
  document.getElementById('menu-screenshot')?.addEventListener('click',takeScreenshot);
  document.querySelectorAll('.overlay-close').forEach(b=>{
    b.addEventListener('click',()=>b.closest('.overlay-screen')?.classList.remove('show'));
  });
  document.getElementById('survival-start-btn')?.addEventListener('click',startSurvivalMode);
  document.getElementById('daily-start-btn')?.addEventListener('click',startDailyChallenge);
  document.getElementById('quickstrike-start-btn')?.addEventListener('click',startQuickStrike);
  document.querySelectorAll('#commander-pick .pick-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('#commander-pick .pick-btn').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');selectedCommander=b.dataset.commander;
    });
  });
  document.querySelectorAll('#module-pick .pick-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('#module-pick .pick-btn').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');selectedModule=b.dataset.module;
    });
  });
  document.getElementById('aim-assist-range')?.addEventListener('input',e=>{
    localStorage.setItem('bgs_tank_aim',e.target.value);
  });
  document.getElementById('ability-overcharge')?.addEventListener('click',useOvercharge);
  document.getElementById('ability-airstrike')?.addEventListener('click',useAirstrike);
  document.getElementById('ability-scan')?.addEventListener('click',useWeakPointScan);
  document.getElementById('start-btn')?.addEventListener('click',()=>{gameMode='campaign';window.__fromMissionSelect=false;},{capture:true});
  const rd=document.getElementById('rank-display');
  if(rd)rd.textContent=getRank().name;
  renderAchievements();
}

window.addEventListener('keydown',e=>{
  if(!isGamePlaying())return;
  if(e.code==='KeyR'&&!e.repeat){e.preventDefault();useOvercharge();}
  if(e.code==='KeyT'&&!e.repeat){e.preventDefault();useAirstrike();}
  if(e.code==='KeyF'&&!e.repeat){e.preventDefault();useWeakPointScan();}
  if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!e.repeat){useBoostDash();}
},{capture:true});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initExtendedUI);
else initExtendedUI();

window.TankExtended={
  getRank,totalStars,credits:()=>credits,getDailyMission,
  renderMissionSelect,gameMode:()=>gameMode
};

})();
