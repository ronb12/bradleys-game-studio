'use strict';
(function(){

/* ═══════════════════════════════════════════
   1. RADIO CHATTER
   ═══════════════════════════════════════════ */
const CHATTER={
  kill:['Good hit! Target destroyed.','Confirmed kill — moving on.','Scratch one hostile.','Target neutralized.','That\'s a kill, nice shot!'],
  enemySpot:['Contact! Enemy armor ahead.','Hostiles moving, 2 o\'clock!','Eyes on enemy tanks, engage!','Multiple tangos inbound!'],
  damage:['We\'re hit! Return fire!','Taking fire! Brace!','Impact! Armor holding.','That one was close!'],
  wave:['New wave incoming! Stand ready.','Here they come again!','More contacts — stay sharp.','Wave approaching, weapons free.'],
  ally:['Friendlies advancing on the left.','Allied APC providing support.','Our infantry is engaging.','Friendly forces pushing forward.'],
  objective:['Objective in sight.','Press the attack!','Keep the pressure on!','We\'re making progress.'],
  killstreak:['Outstanding gunnery!','You\'re on fire, keep it up!','They can\'t stop us!','Dominating the battlefield!']
};
let chatterEl=null,chatterTimer=0,chatterQueue=[];
function initChatterUI(){
  if(chatterEl)return;
  chatterEl=document.createElement('div');
  chatterEl.id='radio-chatter';
  Object.assign(chatterEl.style,{
    position:'fixed',bottom:'80px',left:'16px',
    color:'#b8ffb8',fontSize:'11px',fontFamily:'monospace',
    background:'rgba(0,20,0,.65)',padding:'6px 12px',borderRadius:'4px',
    border:'1px solid rgba(0,255,100,.2)',maxWidth:'320px',
    opacity:'0',transition:'opacity .4s',pointerEvents:'none',zIndex:'80',
    textShadow:'0 0 4px rgba(0,255,80,.4)'
  });
  document.body.appendChild(chatterEl);
}
function showChatter(cat){
  initChatterUI();
  const msgs=CHATTER[cat];
  if(!msgs)return;
  const msg=msgs[Math.floor(Math.random()*msgs.length)];
  chatterEl.textContent='📻 '+msg;
  chatterEl.style.opacity='1';
  clearTimeout(chatterEl._t);
  chatterEl._t=setTimeout(()=>{chatterEl.style.opacity='0';},3500);
}
const _origShowKill=window.showKillBanner;
if(_origShowKill)window.showKillBanner=function(type){
  _origShowKill(type);
  if(kills%3===0&&kills>4)showChatter('killstreak');
  else showChatter('kill');
  if(type==='boss'&&enemies.length>0){
    const last=enemies[enemies.length-1];
    if(last?.group)triggerKillCam(last.group.position);
  }else if(Math.random()<.2){
    const pos=player?.group?.position?.clone();
    if(pos)triggerKillCam(pos.clone().add(new THREE.Vector3((Math.random()-.5)*10,0,(Math.random()-.5)*10)));
  }
};
const _origShowWave=window.showWaveBanner;
if(_origShowWave)window.showWaveBanner=function(t){
  _origShowWave(t);
  setTimeout(()=>showChatter('wave'),800);
  setTimeout(()=>showChatter('ally'),4000);
};

/* ═══════════════════════════════════════════
   2. CAMERA SHAKE VARIETIES
   ═══════════════════════════════════════════ */
const _origAddShake=window.addScreenShake;
if(_origAddShake){
  window.addScreenShake=function(intensity,type){
    if(!camera?._base)return _origAddShake(intensity);
    _origAddShake(intensity);
    if(type==='artillery'){
      camera.position.y+=(Math.random()-.5)*intensity*2;
      camera.rotation.z+=(Math.random()-.5)*intensity*.05;
    }else if(type==='nearMiss'){
      camera.rotation.z+=(Math.random()-.5)*intensity*.08;
    }
  };
}

/* ═══════════════════════════════════════════
   3. IMPACT SOUNDS
   ═══════════════════════════════════════════ */
function playMetalHit(){playTone(220,.08,'sawtooth',.06);playTone(440,.04,'square',.03);}
function playDirtHit(){playTone(80,.1,'triangle',.08);playTone(120,.06,'sine',.04);}
function playConcreteHit(){playTone(300,.06,'sawtooth',.05);playTone(150,.08,'triangle',.04);}

/* ═══════════════════════════════════════════
   4. DYNAMIC WEATHER
   ═══════════════════════════════════════════ */
let weatherState='clear',rainDrops=[],lightningTimer=0;
const weatherGroup=new THREE.Group();
function initWeather(){
  if(!scene)return;
  scene.add(weatherGroup);
  const mission=typeof getCurrentMission==='function'?getCurrentMission():null;
  const mod=mission?.modifier||'';
  if(mod==='fog'||mod==='sandstorm')weatherState='storm';
  else if(Math.random()<.35)weatherState='rain';
  else weatherState='clear';
}
function spawnRaindrops(){
  if(rainDrops.length>300)return;
  const mat=new THREE.MeshBasicMaterial({color:0xaaccee,transparent:true,opacity:.4});
  for(let i=0;i<20;i++){
    const drop=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.3,3),mat);
    const px=(Math.random()-.5)*60,pz=(Math.random()-.5)*60;
    drop.position.set((player?.group?.position?.x||0)+px,8+Math.random()*6,(player?.group?.position?.z||0)+pz);
    weatherGroup.add(drop);
    rainDrops.push({mesh:drop,vel:-15-Math.random()*8});
  }
}
function updateWeather(dt){
  if(weatherState==='rain'){
    spawnRaindrops();
    for(let i=rainDrops.length-1;i>=0;i--){
      const r=rainDrops[i];
      r.mesh.position.y+=r.vel*dt;
      if(r.mesh.position.y<0){
        r.mesh.position.y=8+Math.random()*4;
        r.mesh.position.x=(player?.group?.position?.x||0)+(Math.random()-.5)*60;
        r.mesh.position.z=(player?.group?.position?.z||0)+(Math.random()-.5)*60;
      }
    }
    lightningTimer-=dt;
    if(lightningTimer<=0){
      lightningTimer=8+Math.random()*15;
      if(scene){
        const flash=new THREE.PointLight(0xffffff,3,200);
        flash.position.set((Math.random()-.5)*80,30,(Math.random()-.5)*80);
        scene.add(flash);
        playTone(40,.3,'sawtooth',.15);
        setTimeout(()=>{scene.remove(flash);},150);
        setTimeout(()=>{
          const flash2=new THREE.PointLight(0xeeeeff,1.5,150);
          flash2.position.copy(flash.position);
          scene.add(flash2);
          setTimeout(()=>scene.remove(flash2),80);
        },200);
      }
    }
  }
}
function clearWeather(){
  rainDrops.forEach(r=>weatherGroup.remove(r.mesh));
  rainDrops=[];
  weatherState='clear';
}

/* ═══════════════════════════════════════════
   5. DAY/NIGHT CYCLE
   ═══════════════════════════════════════════ */
let dayTime=0.3,daySpeed=0;
function initDayNight(){
  const mission=typeof getCurrentMission==='function'?getCurrentMission():null;
  const mod=mission?.modifier||'';
  if(mod==='night'){dayTime=0.85;daySpeed=0;}
  else{dayTime=0.2;daySpeed=.012;}
}
function updateDayNight(dt){
  if(daySpeed<=0)return;
  dayTime+=daySpeed*dt;
  if(dayTime>1)dayTime=0;
  const sunI=dayTime<.5?1.2+Math.sin(dayTime*Math.PI)*.6:.6+Math.cos((dayTime-.5)*Math.PI)*.5;
  if(sunLight)sunLight.intensity=Math.max(.3,sunI);
  if(window.__ambLight)window.__ambLight.intensity=Math.max(.15,sunI*.4);
  if(renderer?.toneMappingExposure!==undefined){
    renderer.toneMappingExposure=.6+sunI*.5;
  }
}

/* ═══════════════════════════════════════════
   6. EXPLOSION UPGRADES
   ═══════════════════════════════════════════ */
const _origExplode=window.explode;
if(_origExplode)window.explode=function(pos,count,dmg,owner){
  _origExplode(pos,count,dmg,owner);
  if(count>=5){
    const ring=new THREE.Mesh(
      new THREE.RingGeometry(.5,2.5,16),
      new THREE.MeshBasicMaterial({color:0xffaa44,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false})
    );
    ring.position.copy(pos);ring.position.y+=.3;ring.rotation.x=-Math.PI/2;
    scene.add(ring);
    const start=performance.now();
    const animRing=()=>{
      const t=(performance.now()-start)/400;
      if(t>1){scene.remove(ring);return;}
      ring.scale.setScalar(1+t*6);
      ring.material.opacity=.7*(1-t);
      requestAnimationFrame(animRing);
    };
    requestAnimationFrame(animRing);
    for(let i=0;i<4;i++){
      const chunk=new THREE.Mesh(
        new THREE.BoxGeometry(.15+Math.random()*.2,.1,.15+Math.random()*.2),
        new THREE.MeshStandardMaterial({color:0x3a3428,roughness:.9})
      );
      chunk.position.copy(pos);
      scene.add(chunk);
      const vel=new THREE.Vector3((Math.random()-.5)*8,4+Math.random()*6,(Math.random()-.5)*8);
      const spin=new THREE.Vector3(Math.random()*10,Math.random()*10,Math.random()*10);
      let life=1.5;
      const animChunk=()=>{
        const cdt=.016;
        life-=cdt;
        if(life<=0){scene.remove(chunk);return;}
        vel.y-=15*cdt;
        chunk.position.addScaledVector(vel,cdt);
        chunk.rotation.x+=spin.x*cdt;chunk.rotation.z+=spin.z*cdt;
        if(chunk.position.y<.05){chunk.position.y=.05;vel.y=0;vel.x*=.8;vel.z*=.8;}
        requestAnimationFrame(animChunk);
      };
      requestAnimationFrame(animChunk);
    }
    if(count>=8){
      setTimeout(()=>{
        if(_origExplode)_origExplode(pos.clone().add(new THREE.Vector3((Math.random()-.5)*2,.5,(Math.random()-.5)*2)),3,0,'fx');
        playTone(60,.2,'sawtooth',.12);
      },400+Math.random()*600);
    }
  }
};

/* ═══════════════════════════════════════════
   7. HELICOPTER SUPPORT
   ═══════════════════════════════════════════ */
let heliActive=false,heliGroup=null,heliTimer=0,heliCooldown=0;
function buildHeli(){
  const g=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:0x4a5a3a,roughness:.8});
  const body=new THREE.Mesh(new THREE.BoxGeometry(.8,.5,2.2),bodyMat);
  g.add(body);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,1.8),bodyMat);
  tail.position.set(0,.1,1.8);g.add(tail);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(.6,.3,.05),bodyMat);
  fin.position.set(0,.2,2.6);g.add(fin);
  const cockpit=new THREE.Mesh(new THREE.SphereGeometry(.35,8,6),
    new THREE.MeshStandardMaterial({color:0x2a4a5a,roughness:.3,metalness:.4}));
  cockpit.position.set(0,0,-.8);cockpit.scale.set(1,.7,1.2);g.add(cockpit);
  const rotor=new THREE.Mesh(new THREE.BoxGeometry(4,.02,.12),
    new THREE.MeshStandardMaterial({color:0x3a3a3a,roughness:.7,metalness:.3}));
  rotor.position.y=.35;g.add(rotor);
  g._rotor=rotor;
  const skidMat=new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:.8,metalness:.3});
  for(let s of[-1,1]){
    const skid=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,1.4),skidMat);
    skid.position.set(s*.4,-.3,-.1);g.add(skid);
    const strut=new THREE.Mesh(new THREE.BoxGeometry(.04,.25,.04),skidMat);
    strut.position.set(s*.4,-.15,-.3);g.add(strut);
  }
  g.scale.setScalar(2);
  return g;
}
function callHelicopter(){
  if(heliActive||heliCooldown>0||!scene||!player?.group)return;
  heliActive=true;heliTimer=12;
  heliGroup=buildHeli();
  heliGroup.position.set(player.group.position.x+40,18,player.group.position.z+40);
  scene.add(heliGroup);
  showChatter('ally');
  showObjectiveToast?.('Helicopter inbound!');
}
function updateHelicopter(dt){
  if(heliCooldown>0)heliCooldown-=dt;
  if(!heliActive||!heliGroup)return;
  heliTimer-=dt;
  if(heliGroup._rotor)heliGroup._rotor.rotation.y+=dt*25;
  const tx=player.group?.position?.x||0,tz=player.group?.position?.z||0;
  const orbitAng=performance.now()*.001;
  const ox=tx+Math.cos(orbitAng)*25,oz=tz+Math.sin(orbitAng)*25;
  heliGroup.position.x+=(ox-heliGroup.position.x)*dt*1.5;
  heliGroup.position.z+=(oz-heliGroup.position.z)*dt*1.5;
  heliGroup.position.y+=(16-heliGroup.position.y)*dt;
  heliGroup.rotation.y=orbitAng+Math.PI;
  heliGroup.rotation.z=Math.sin(orbitAng*2)*.08;
  if(Math.random()<dt*2&&enemies.length>0){
    const tgt=enemies[Math.floor(Math.random()*enemies.length)];
    if(tgt?.group){
      const dir=tgt.group.position.clone().sub(heliGroup.position);
      dir.normalize();
      const bullet=new THREE.Mesh(new THREE.SphereGeometry(.06),new THREE.MeshBasicMaterial({color:0xffee44}));
      bullet.position.copy(heliGroup.position);
      scene.add(bullet);
      const vel=dir.multiplyScalar(50);
      let life=1.5;
      const anim=()=>{
        life-=.016;
        if(life<=0){scene.remove(bullet);return;}
        bullet.position.addScaledVector(vel,.016);
        for(let ei=enemies.length-1;ei>=0;ei--){
          const e=enemies[ei];
          if(e.group&&bullet.position.distanceTo(e.group.position)<2.5){
            e.hp-=12;
            if(e.hp<=0){
              kills++;score+=100;
              if(typeof showKillBanner==='function')showKillBanner(e.type);
              const epos=e.group.position.clone();
              scene.remove(e.group);world.removeBody(e.body);
              enemies.splice(ei,1);
              if(typeof explode==='function')explode(epos,5,0,'fx');
              if(typeof addScreenShake==='function')addScreenShake(.2);
              if(window.onEnemyKilled)window.onEnemyKilled();
            }
            scene.remove(bullet);life=0;return;
          }
        }
        requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
      playTone(600,.03,'square',.02);
    }
  }
  if(heliTimer<=0){
    heliActive=false;heliCooldown=45;
    scene.remove(heliGroup);heliGroup=null;
    showObjectiveToast?.('Helicopter RTB');
  }
}
window.addEventListener('keydown',e=>{
  if(e.code==='KeyH'&&gameState==='play'&&!heliActive&&heliCooldown<=0)callHelicopter();
});

/* ═══════════════════════════════════════════
   8. PLAYER-CONTROLLED ARTILLERY
   ═══════════════════════════════════════════ */
let artilleryStrikeCd=0;
function callArtilleryStrike(worldX,worldZ){
  if(artilleryStrikeCd>0)return;
  artilleryStrikeCd=30;
  showObjectiveToast?.('Artillery strike inbound!');
  showChatter('objective');
  let volley=0;
  const iv=setInterval(()=>{
    if(volley>=6){clearInterval(iv);return;}
    const sx=worldX+(Math.random()-.5)*10,sz=worldZ+(Math.random()-.5)*10;
    const pos=new THREE.Vector3(sx,0,sz);
    if(typeof explode==='function')explode(pos,8,45,'player');
    if(typeof spawnBattleSmoke==='function')spawnBattleSmoke(pos,1.5,2);
    if(typeof spawnImpactCrater==='function')spawnImpactCrater(pos,true);
    if(typeof addScreenShake==='function')addScreenShake(.35,'artillery');
    playTone(50,.3,'sawtooth',.2);
    playDirtHit();
    volley++;
  },350);
}
function updateArtilleryStrike(dt){
  if(artilleryStrikeCd>0)artilleryStrikeCd-=dt;
}

/* ═══════════════════════════════════════════
   9. DESTRUCTIBLE BUILDINGS
   ═══════════════════════════════════════════ */
let destructBuildings=[];
function registerDestructBuilding(mesh,x,z,hp){
  destructBuildings.push({mesh,x,z,hp,maxHp:hp||80,destroyed:false});
}
function updateDestructBuildings(){
  destructBuildings.forEach(b=>{
    if(b.destroyed)return;
    shells?.forEach(s=>{
      if(s.owner==='player'&&s.mesh.position.distanceTo(new THREE.Vector3(b.x,1,b.z))<4){
        b.hp-=s.dmg||30;
        playConcreteHit();
        if(b.hp<=0&&!b.destroyed){
          b.destroyed=true;
          if(b.mesh){
            b.mesh.scale.y*=.3;
            b.mesh.position.y*=.3;
            if(typeof spawnBattleSmoke==='function')spawnBattleSmoke(new THREE.Vector3(b.x,1,b.z),2,3);
            if(typeof explode==='function')explode(new THREE.Vector3(b.x,.5,b.z),4,0,'fx');
            playTone(60,.25,'sawtooth',.15);
          }
        }
      }
    });
  });
}

/* ═══════════════════════════════════════════
   10. SUPPLY DROPS
   ═══════════════════════════════════════════ */
let supplyDropTimer=40,supplyDrops=[];
function spawnSupplyDrop(){
  if(!scene||!player?.group)return;
  const px=player.group.position.x+(Math.random()-.5)*20;
  const pz=player.group.position.z+(Math.random()-.5)*20;
  const crate=new THREE.Group();
  const box=new THREE.Mesh(new THREE.BoxGeometry(.8,.6,.8),
    new THREE.MeshStandardMaterial({color:0x5a7a3a,roughness:.85}));
  crate.add(box);
  const cross=new THREE.Mesh(new THREE.BoxGeometry(.5,.02,.12),
    new THREE.MeshStandardMaterial({color:0xcc2222,roughness:.9}));
  cross.position.y=.31;crate.add(cross);
  const cross2=cross.clone();cross2.rotation.y=Math.PI/2;crate.add(cross2);
  const chute=new THREE.Mesh(new THREE.ConeGeometry(1.5,1.2,8,1,true),
    new THREE.MeshBasicMaterial({color:0xeeeeee,transparent:true,opacity:.6,side:THREE.DoubleSide}));
  chute.position.y=1.5;chute.rotation.x=Math.PI;crate.add(chute);
  crate.position.set(px,20,pz);
  scene.add(crate);
  supplyDrops.push({mesh:crate,chute,falling:true,life:25,type:Math.random()>.5?'health':'ammo'});
  showChatter('ally');
  showObjectiveToast?.('Supply drop incoming!');
}
function updateSupplyDrops(dt){
  supplyDropTimer-=dt;
  if(supplyDropTimer<=0&&gameState==='play'){
    supplyDropTimer=35+Math.random()*20;
    spawnSupplyDrop();
  }
  for(let i=supplyDrops.length-1;i>=0;i--){
    const s=supplyDrops[i];
    if(s.falling){
      s.mesh.position.y-=3*dt;
      s.mesh.rotation.y+=dt*.5;
      if(s.mesh.position.y<=.4){
        s.mesh.position.y=.4;
        s.falling=false;
        if(s.chute){s.mesh.remove(s.chute);s.chute=null;}
      }
    }
    s.life-=dt;
    if(s.life<=0){scene.remove(s.mesh);supplyDrops.splice(i,1);continue;}
    if(!s.falling&&player?.group&&player.group.position.distanceTo(s.mesh.position)<3){
      if(s.type==='health'){
        playerHP=Math.min(playerMaxHP,playerHP+40);
        showObjectiveToast?.('Health restored +40');
      }else{
        reload=0;
        showObjectiveToast?.('Ammo resupplied!');
      }
      playTone(500,.1,'sine',.08);playTone(700,.08,'sine',.05);
      scene.remove(s.mesh);supplyDrops.splice(i,1);
    }
  }
}

/* ═══════════════════════════════════════════
   11. LANDMINES
   ═══════════════════════════════════════════ */
let mines=[];
function spawnMinefield(){
  mines.forEach(m=>{if(m.mesh)scene.remove(m.mesh);});
  mines=[];
  const count=6+Math.floor(Math.random()*6);
  for(let i=0;i<count;i++){
    const x=(Math.random()-.5)*WORLD*1.2,z=(Math.random()-.5)*WORLD*1.2;
    if(Math.hypot(x,z)<12)continue;
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.25,.3,.08,8),
      new THREE.MeshStandardMaterial({color:0x5a5a48,roughness:.9}));
    mesh.position.set(x,.03,z);mesh.rotation.x=-Math.PI/2;
    const indicator=new THREE.Mesh(new THREE.CircleGeometry(.15,6),
      new THREE.MeshBasicMaterial({color:0xaa3322,transparent:true,opacity:.3}));
    indicator.rotation.x=-Math.PI/2;indicator.position.set(x,.04,z);
    scene.add(mesh);scene.add(indicator);
    mines.push({mesh,indicator,x,z,active:true});
  }
}
function updateMines(){
  mines.forEach(m=>{
    if(!m.active)return;
    const checkHit=(px,pz,isPlayer)=>{
      const dx=px-m.x,dz=pz-m.z;
      if(dx*dx+dz*dz<4){
        m.active=false;
        if(m.mesh)scene.remove(m.mesh);
        if(m.indicator)scene.remove(m.indicator);
        if(typeof explode==='function')explode(new THREE.Vector3(m.x,.2,m.z),6,35,isPlayer?'enemy':'player');
        if(typeof spawnImpactCrater==='function')spawnImpactCrater(new THREE.Vector3(m.x,0,m.z),true);
        if(typeof addScreenShake==='function')addScreenShake(isPlayer?.5:.2);
        playTone(50,.3,'sawtooth',.2);
        if(isPlayer){playerHP-=30;showChatter('damage');}
      }
    };
    if(player?.group)checkHit(player.group.position.x,player.group.position.z,true);
    enemies.forEach(e=>{
      if(e.group)checkHit(e.group.position.x,e.group.position.z,false);
    });
  });
}

/* ═══════════════════════════════════════════
   12. TANK CUSTOMIZATION
   ═══════════════════════════════════════════ */
const TANK_MODS={
  barrel:{
    standard:{name:'Standard Barrel',reload:1,damage:1},
    rapid:{name:'Rapid Loader',reload:.75,damage:.85},
    heavy:{name:'Heavy Cannon',reload:1.3,damage:1.35}
  },
  armor:{
    standard:{name:'Standard Armor',hpMult:1,speedMult:1},
    reactive:{name:'Reactive Plates',hpMult:1.25,speedMult:.92},
    composite:{name:'Composite Armor',hpMult:1.15,speedMult:.96}
  },
  engine:{
    standard:{name:'Standard Engine',speedMult:1,accelMult:1},
    turbo:{name:'Turbocharged',speedMult:1.2,accelMult:1.15},
    diesel:{name:'Heavy Diesel',speedMult:.9,accelMult:1.3}
  }
};
let equippedMods={barrel:'standard',armor:'standard',engine:'standard'};
function loadMods(){
  try{
    const saved=JSON.parse(localStorage.getItem('bgs_tank_mods')||'{}');
    if(saved.barrel)equippedMods.barrel=saved.barrel;
    if(saved.armor)equippedMods.armor=saved.armor;
    if(saved.engine)equippedMods.engine=saved.engine;
  }catch(e){}
}
function saveMods(){localStorage.setItem('bgs_tank_mods',JSON.stringify(equippedMods));}
function applyMods(){
  const b=TANK_MODS.barrel[equippedMods.barrel]||TANK_MODS.barrel.standard;
  const a=TANK_MODS.armor[equippedMods.armor]||TANK_MODS.armor.standard;
  const e=TANK_MODS.engine[equippedMods.engine]||TANK_MODS.engine.standard;
  const tc=TANK_CLASSES[selectedTank]||TANK_CLASSES.medium;
  reloadTime=tc.reload*b.reload;
  damageMult=b.damage;
  playerMaxHP=Math.round(tc.hp*a.hpMult);
  if(player)player.speed=Math.round(tc.speed*a.speedMult*e.speedMult);
  if(player)player.sprint=Math.round((tc.sprint||tc.speed+3)*a.speedMult*e.speedMult);
}
loadMods();

/* ═══════════════════════════════════════════
   13. CREW SYSTEM
   ═══════════════════════════════════════════ */
const CREW_NAMES=['Sgt. Miller','Cpl. Rodriguez','Pvt. Chen','Spc. Okafor','Pfc. Novak','Sgt. Hayes','Cpl. Petrov','Pvt. Tanaka'];
const CREW_ROLES=['Commander','Gunner','Loader','Driver'];
const CREW_SKILLS={
  Commander:{spotRange:1.2,desc:'+20% spot range'},
  Gunner:{accuracy:1.15,desc:'+15% accuracy'},
  Loader:{reloadMult:.85,desc:'-15% reload time'},
  Driver:{speedMult:1.1,desc:'+10% speed'}
};
let crew=[];
function initCrew(){
  crew=[];
  const names=[...CREW_NAMES].sort(()=>Math.random()-.5);
  for(let i=0;i<4;i++){
    crew.push({name:names[i],role:CREW_ROLES[i],xp:0,level:1});
  }
  applyCrewBonuses();
}
function applyCrewBonuses(){
  crew.forEach(c=>{
    const skill=CREW_SKILLS[c.role];
    if(!skill)return;
    if(c.role==='Loader')reloadTime*=skill.reloadMult;
    if(c.role==='Driver'&&player){
      player.speed=Math.round((player.speed||11)*skill.speedMult);
      player.sprint=Math.round((player.sprint||14)*skill.speedMult);
    }
  });
}
function addCrewXP(amount){
  crew.forEach(c=>{
    c.xp+=amount;
    if(c.xp>=c.level*50){c.level++;c.xp=0;}
  });
}

/* ═══════════════════════════════════════════
   14. KILL CAM
   ═══════════════════════════════════════════ */
let killCamActive=false,killCamData=null;
function triggerKillCam(enemyPos,shellDir){
  if(killCamActive||!camera||Math.random()>.25)return;
  killCamActive=true;
  killCamData={pos:enemyPos.clone(),dir:shellDir?.clone(),timer:1.5,origPos:camera.position.clone()};
  const overlay=document.createElement('div');
  overlay.id='killcam-overlay';
  Object.assign(overlay.style,{
    position:'fixed',top:'0',left:'0',width:'100%',height:'100%',
    border:'3px solid rgba(255,40,20,.6)',pointerEvents:'none',zIndex:'90',
    background:'rgba(0,0,0,.15)',transition:'opacity .3s'
  });
  const label=document.createElement('div');
  Object.assign(label.style,{
    position:'absolute',top:'12px',right:'16px',color:'#ff4422',
    fontSize:'14px',fontFamily:'monospace',fontWeight:'bold',textShadow:'0 0 6px rgba(255,0,0,.5)'
  });
  label.textContent='◉ KILL CAM';
  overlay.appendChild(label);
  document.body.appendChild(overlay);
}
function updateKillCam(dt){
  if(!killCamActive||!killCamData)return;
  killCamData.timer-=dt*.6;
  const kd=killCamData;
  if(camera){
    const lookPos=kd.pos.clone();
    lookPos.y+=1;
    const camPos=kd.pos.clone().add(new THREE.Vector3(
      Math.sin(performance.now()*.001)*6,3+kd.timer*2,Math.cos(performance.now()*.001)*6
    ));
    camera.position.lerp(camPos,.08);
    camera.lookAt(lookPos);
  }
  if(kd.timer<=0){
    killCamActive=false;
    if(camera&&kd.origPos)camera.position.copy(kd.origPos);
    const el=document.getElementById('killcam-overlay');
    if(el)el.remove();
    killCamData=null;
  }
}

/* ═══════════════════════════════════════════
   15. DYNAMIC COMBAT MUSIC
   ═══════════════════════════════════════════ */
let musicCtx=null,musicGain=null,musicOscs=[],combatIntensity=0;
function initCombatMusic(){
  try{
    musicCtx=new (window.AudioContext||window.webkitAudioContext)();
    musicGain=musicCtx.createGain();
    musicGain.gain.value=0;
    musicGain.connect(musicCtx.destination);
  }catch(e){}
}
function updateCombatMusic(dt){
  if(!musicCtx||musicCtx.state==='suspended')return;
  const nearEnemies=enemies.filter(e=>e.group&&player?.group&&e.group.position.distanceTo(player.group.position)<40).length;
  const targetIntensity=Math.min(1,nearEnemies*.2+(combo>2?.2:0));
  combatIntensity+=(targetIntensity-combatIntensity)*dt*2;
  if(musicGain)musicGain.gain.value=combatIntensity*.06;
  if(combatIntensity>.1&&musicOscs.length===0){
    const notes=[55,82.5,110,73.4];
    notes.forEach(f=>{
      const osc=musicCtx.createOscillator();
      osc.type='sine';osc.frequency.value=f;
      osc.connect(musicGain);osc.start();
      musicOscs.push(osc);
    });
  }
  if(combatIntensity<.05&&musicOscs.length>0){
    musicOscs.forEach(o=>{try{o.stop();}catch(e){}});
    musicOscs=[];
  }
  musicOscs.forEach((o,i)=>{
    const base=[55,82.5,110,73.4][i]||55;
    o.frequency.value=base*(1+combatIntensity*.12+Math.sin(performance.now()*.0003+i)*.02);
  });
}

/* ═══════════════════════════════════════════
   16. LEADERBOARD
   ═══════════════════════════════════════════ */
function getLeaderboard(){
  try{return JSON.parse(localStorage.getItem('bgs_leaderboard')||'[]');}catch(e){return[];}
}
function saveToLeaderboard(name,s,k,lvl){
  const lb=getLeaderboard();
  lb.push({name,score:s,kills:k,level:lvl,date:new Date().toLocaleDateString()});
  lb.sort((a,b)=>b.score-a.score);
  localStorage.setItem('bgs_leaderboard',JSON.stringify(lb.slice(0,20)));
}
function showLeaderboard(){
  const lb=getLeaderboard();
  let html='<h2 style="color:#0fc;margin:0 0 12px">🏆 LEADERBOARD</h2>';
  html+='<div style="font-size:10px;color:#8ab;max-height:220px;overflow-y:auto">';
  if(lb.length===0)html+='<p>No entries yet. Complete missions to earn a spot!</p>';
  lb.forEach((e,i)=>{
    html+=`<div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,.08)">
      <span style="color:${i<3?'#fc4':'#8ab'}">#${i+1}</span>
      <span style="color:#cde;margin-left:8px">${e.name||'Commander'}</span>
      <span style="float:right;color:#0fc">${e.score} pts</span>
      <span style="float:right;color:#8ab;margin-right:10px">${e.kills} kills</span>
    </div>`;
  });
  html+='</div>';
  return html;
}
const _origComplete=window.completeCurrentLevel;
if(_origComplete)window.completeCurrentLevel=function(){
  _origComplete();
  saveToLeaderboard('Commander',score,kills,currentLevelIdx+1);
  addCrewXP(20+kills*2);
};
const _origGameOver=window.showGameOver;
if(_origGameOver)window.showGameOver=function(){
  _origGameOver();
  saveToLeaderboard('Commander',score,kills,currentLevelIdx+1);
};

/* ═══════════════════════════════════════════
   HOOK INTO GAME LOOP
   ═══════════════════════════════════════════ */
const _advAnimate=animate;
animate=function(){
  const dt=.016;
  if(gameState==='play'){
    updateWeather(dt);
    updateDayNight(dt);
    updateHelicopter(dt);
    updateArtilleryStrike(dt);
    updateDestructBuildings();
    updateSupplyDrops(dt);
    updateMines();
    updateKillCam(dt);
    updateCombatMusic(dt);
  }
  _advAnimate();
};

const _advStartGame=startGame;
startGame=async function(){
  await _advStartGame();
  initWeather();
  initDayNight();
  initCrew();
  applyMods();
  applyCrewBonuses();
  spawnMinefield();
  supplyDropTimer=30+Math.random()*15;
  initCombatMusic();
};

const _advSpawnWave=spawnWave;
spawnWave=async function(n){
  await _advSpawnWave(n);
  spawnMinefield();
  setTimeout(()=>showChatter('enemySpot'),1500);
};

const _advOnDamage=window.__onPlayerDamaged;
window.__onPlayerDamaged=function(dmg){
  if(_advOnDamage)_advOnDamage(dmg);
  if(Math.random()<.5)showChatter('damage');
  playMetalHit();
};

window.callHelicopter=callHelicopter;
window.callArtilleryStrike=callArtilleryStrike;
window.showLeaderboard=showLeaderboard;
window.TANK_MODS=TANK_MODS;
window.equippedMods=equippedMods;
window.applyMods=applyMods;

const hKey=document.createElement('div');
Object.assign(hKey.style,{
  position:'fixed',bottom:'4px',left:'16px',color:'rgba(120,180,160,.5)',
  fontSize:'9px',fontFamily:'monospace',pointerEvents:'none',zIndex:'70'
});
hKey.textContent='H=Helicopter · G=ArtilleryStrike';
document.body.appendChild(hKey);

window.addEventListener('keydown',e=>{
  if(e.code==='KeyG'&&gameState==='play'&&artilleryStrikeCd<=0){
    if(player?.group){
      const fwd=player.turretAng||player.hullAng||0;
      const tx=player.group.position.x+Math.sin(fwd)*25;
      const tz=player.group.position.z+Math.cos(fwd)*25;
      callArtilleryStrike(tx,tz);
    }
  }
});

/* ═══════════════════════════════════════════
   UI WIRING — Mod pickers, Leaderboard, Crew
   ═══════════════════════════════════════════ */
function makeOverlay(id,title,bodyHTML){
  let screen=document.getElementById(id);
  if(!screen){
    screen=document.createElement('div');screen.id=id;screen.className='overlay-screen';
    Object.assign(screen.style,{
      position:'fixed',top:0,left:0,width:'100%',height:'100%',
      background:'rgba(0,0,0,.85)',display:'none',alignItems:'center',justifyContent:'center',zIndex:'200'
    });
    const inner=document.createElement('div');
    Object.assign(inner.style,{
      background:'rgba(10,30,20,.95)',border:'1px solid rgba(0,255,180,.15)',
      borderRadius:'12px',padding:'20px 24px',minWidth:'300px',maxWidth:'500px',
      maxHeight:'80vh',overflowY:'auto',color:'#cde',fontFamily:'monospace',fontSize:'12px'
    });
    inner.innerHTML=`<button class="overlay-close" style="float:right;background:none;border:none;color:#8ab;cursor:pointer;font-size:16px">&times;</button>${bodyHTML}`;
    screen.appendChild(inner);
    document.body.appendChild(screen);
    screen.querySelector('.overlay-close').addEventListener('click',()=>screen.style.display='none');
    screen.addEventListener('click',e=>{if(e.target===screen)screen.style.display='none';});
  }else{
    const inner=screen.querySelector('div');
    if(inner)inner.innerHTML=`<button class="overlay-close" style="float:right;background:none;border:none;color:#8ab;cursor:pointer;font-size:16px">&times;</button>${bodyHTML}`;
    screen.querySelector('.overlay-close')?.addEventListener('click',()=>screen.style.display='none');
  }
  screen.style.display='flex';
}
document.getElementById('menu-leaderboard')?.addEventListener('click',()=>{
  const html=showLeaderboard();
  makeOverlay('leaderboard-screen','Leaderboard',html);
});
document.getElementById('menu-crew')?.addEventListener('click',()=>{
  if(crew.length===0)initCrew();
  let html='<h2 style="color:#0fc;margin:0 0 12px">👥 TANK CREW</h2>';
  crew.forEach(c=>{
    const skill=CREW_SKILLS[c.role];
    html+=`<div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)">
      <span style="color:#fc4">${c.name}</span>
      <span style="color:#8ab;margin-left:8px">${c.role} (Lv.${c.level})</span>
      <span style="float:right;color:#0fc;font-size:10px">${skill?.desc||''}</span>
      <div style="background:rgba(0,60,40,.3);height:3px;margin-top:4px;border-radius:2px">
        <div style="background:#0fc;height:100%;width:${Math.min(100,c.xp/(c.level*50)*100)}%;border-radius:2px"></div>
      </div>
    </div>`;
  });
  makeOverlay('crew-screen','Crew',html);
});
['barrel','armor','engine'].forEach(category=>{
  document.querySelectorAll(`#${category}-pick .pick-btn`).forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll(`#${category}-pick .pick-btn`).forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');
      equippedMods[category]=b.dataset.mod;
      saveMods();
    });
  });
});
document.getElementById('heli-btn')?.addEventListener('click',callHelicopter);
document.getElementById('arty-btn')?.addEventListener('click',()=>{
  if(gameState==='play'&&player?.group){
    const fwd=player.turretAng||player.hullAng||0;
    const tx=player.group.position.x+Math.sin(fwd)*25;
    const tz=player.group.position.z+Math.cos(fwd)*25;
    callArtilleryStrike(tx,tz);
  }
});

/* ═══════════════════════════════════════════
   HUD COOLDOWN DISPLAY
   ═══════════════════════════════════════════ */
setInterval(()=>{
  const hBtn=document.getElementById('heli-btn');
  if(hBtn){
    if(heliActive)hBtn.textContent='H: Active';
    else if(heliCooldown>0)hBtn.textContent='H: '+Math.ceil(heliCooldown)+'s';
    else hBtn.textContent='H: Heli ✓';
  }
  const aBtn=document.getElementById('arty-btn');
  if(aBtn){
    if(artilleryStrikeCd>0)aBtn.textContent='G: '+Math.ceil(artilleryStrikeCd)+'s';
    else aBtn.textContent='G: Arty ✓';
  }
},500);

})();
