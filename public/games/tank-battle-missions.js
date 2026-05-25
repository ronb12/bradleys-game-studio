/**
 * Desert Tank Siege — 50-mission campaign generator.
 * Loaded before main game script; defines global MISSIONS.
 */
(function(){
'use strict';

const MAP_CYCLE=['desert','urban','snow','forest'];
const COMMANDERS=['Col. J. Bradley','Gen. M. Hayes','Maj. K. Torres','Capt. R. Ellis','Lt. Col. S. Vega','Brig. Gen. A. Cole'];
const CLASSIFICATIONS=['CONFIDENTIAL','SECRET','TOP SECRET','UNCLASSIFIED//FOUO'];
const THEATERS={
  desert:['Sector 7 — Eastern Dunes','Grid 4 — Salt Flats','Delta Ridge — Expanse','Outpost Kilo — Dune Line','Sector 12 — Red Wadi'],
  urban:['Grid 12 — Industrial Zone','Block 9 — Factory District','Metro Line C — Ruins','Harbor 3 — Dockyards','Grid 18 — Refinery Row'],
  snow:['Polar Front — Ice Corridor','Glacier Pass — North Line','Station Echo — Ice Shelf','White Valley — Forward Base','Frost Line — Sector 9'],
  forest:['Delta 4 — Canopy Sector','Green Belt — Trail 6','River Delta — Mangrove','Sector Fox — Tree Line','Jungle Grid 2 — Ambush Alley']
};
const OP_WORDS=['SAND','IRON','WHITE','GREEN','STEEL','THUNDER','PHANTOM','SHADOW','STORM','LANCE','VIPER','HAMMER','FALCON','WOLF','EAGLE','TITAN','COBRA','RAPTOR','SENTINEL','BASTION'];
const MISSION_THEMES=[
  {name:'Reconnaissance',intel:'Hostile scouts probing our flank. Secure forward positions and deny enemy resupply routes.',orders:['Advance and capture the forward observation post','Destroy the enemy ammunition depot','Hold the area until extraction is confirmed'],threats:'Light scout armor, sporadic mortar fire.'},
  {name:'Urban Breakthrough',intel:'Enemy mechanized units entrenched among ruins. Punch through and seize their command node.',orders:['Breach the western industrial sector','Eliminate the enemy fuel dump','Defend the command antenna until uplink is established'],threats:'Medium tanks in cover, ambush teams, artillery likely.'},
  {name:'Arctic Confrontation',intel:'Hostile heavy column advancing across ice. Use cover and flank when traction allows.',orders:['Capture the ice road checkpoint','Destroy enemy supply sleds','Defend the radar station against all waves'],threats:'Heavy armor in final wave, reduced traction.'},
  {name:'Jungle Ambush',intel:'Dense foliage conceals tank destroyer teams. Clear the corridor before they regroup.',orders:['Secure the jungle trailhead','Demolish the forward command bunker','Defend the medevac landing zone'],threats:'Fast flanking units, hidden TDs.'},
  {name:'Command Assault',intel:'Remaining hostile armor dug in on the ridge. Break their line and destroy headquarters.',orders:['Capture the command ridge overlook','Destroy enemy headquarters','Defend the ridge until victory is declared'],threats:'Boss-class command tank on final wave. Maximum strength.'},
  {name:'Supply Interdiction',intel:'Enemy convoy routes identified. Cut logistics before the main assault begins.',orders:['Intercept the supply corridor','Destroy fuel and ammo caches','Secure the crossroads for friendly resupply'],threats:'Escort tanks and light AT teams.'},
  {name:'Bridgehead',intel:'Critical crossing must be held. Enemy counterattack expected within the hour.',orders:['Establish bridgehead on the near bank','Destroy pontoon equipment','Repel counterattack waves'],threats:'Mixed armor with artillery support.'},
  {name:'Night Raid',intel:'Strike under cover of darkness before dawn. Minimize exposure on open ground.',orders:['Infiltrate the outer perimeter','Destroy communications relay','Withdraw to rally point after objectives'],threats:'Reduced visibility, patrols with searchlights.'},
  {name:'Hill Defense',intel:'High ground dominates the sector. Seize and hold against repeated assaults.',orders:['Capture the hilltop OP','Destroy enemy mortar positions','Defend the summit through all waves'],threats:'Wave assaults from multiple vectors.'},
  {name:'Deep Strike',intel:'Long-range penetration mission behind enemy lines. Speed and precision essential.',orders:['Bypass outer pickets','Destroy command vehicle','Exfiltrate before reinforcements arrive'],threats:'Fast reaction force, limited time window.'}
];
const MODIFIERS=['','','','fog','night','sandstorm','ice'];
const OBJ_TEMPLATES=[
  {type:'capture',labels:['Capture Forward OP','Seize West Gate','Capture Ice Checkpoint','Secure Trailhead','Capture Command Ridge','Hold Crossroads','Secure Bridgehead','Capture Hilltop','Seize Perimeter','Take Rally Point'],holdTime:7,radius:11,score:350},
  {type:'destroy',labels:['Destroy Ammo Depot','Destroy Fuel Dump','Destroy Supply Cache','Demolish Command Bunker','Destroy Enemy HQ','Destroy Comms Relay','Destroy Pontoon Gear','Destroy Mortar Pit','Destroy Command Vehicle','Destroy Radar Array'],radius:6,hp:160,score:450},
  {type:'defend',labels:['Secure Comms Relay','Defend Command Antenna','Defend Radar Station','Defend Medevac LZ','Hold Command Ridge','Defend Crossroads','Hold Bridgehead','Defend Summit','Cover Exfil Route','Defend Rally Point'],radius:14,defendTime:28,score:380}
];
const OBJ_POSITIONS=[
  {ax:-.55,az:-.65},{ax:.6,az:.5},{ax:0,az:-.75},{ax:-.5,az:.4},{ax:.55,az:-.45},
  {ax:.15,az:-.7},{ax:-.45,az:-.5},{ax:.5,az:.55},{ax:-.2,az:.65},{ax:.62,az:.38},
  {ax:-.35,az:.5},{ax:.1,az:.7},{ax:-.58,az:.42},{ax:0,az:-.6},{ax:.48,az:-.55}
];

function seededRand(seed){
  let s=seed>>>0;
  return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
}
function pick(arr,r){return arr[Math.floor(r()*arr.length)];}
function codename(level,r){
  const a=OP_WORDS[(level*3+Math.floor(r()*OP_WORDS.length))%OP_WORDS.length];
  const b=OP_WORDS[(level*7+Math.floor(r()*OP_WORDS.length))%OP_WORDS.length];
  return'OP '+a+' '+b;
}
function buildObjectives(level,r){
  const defs=[];
  for(let i=0;i<3;i++){
    const tpl=OBJ_TEMPLATES[i];
    const pos=OBJ_POSITIONS[(level+i*5+Math.floor(r()*OBJ_POSITIONS.length))%OBJ_POSITIONS.length];
    const jitter=(r()-.5)*.12;
    const d={
      type:tpl.type,
      label:tpl.labels[(level+i+Math.floor(r()*tpl.labels.length))%tpl.labels.length],
      ax:pos.ax+jitter,az:pos.az+jitter,
      radius:tpl.radius+(level>30?1:0),
      score:tpl.score+Math.floor(level/5)*25
    };
    if(tpl.type==='capture')d.holdTime=tpl.holdTime+(level>20?1:0);
    if(tpl.type==='destroy')d.hp=tpl.hp+level*4;
    if(tpl.type==='defend')d.defendTime=tpl.defendTime+Math.floor(level/8)*3;
    defs.push(d);
  }
  return defs;
}

const ORIGINAL_FIVE=[
  {level:1,codename:'OP SAND VIPER',name:'Desert Reconnaissance',map:'desert',waves:3,classification:'SECRET',theater:'Sector 7 — Eastern Dunes',time:'0400 ZULU',commander:'Col. J. Bradley',intel:'Forward observers report light hostile reconnaissance probing our desert flank. Command needs you to secure the forward pass and deny enemy resupply before the main column arrives at dawn.',orders:['Advance and capture the forward observation post','Destroy the enemy ammunition depot','Hold the area until extraction is confirmed'],threats:'Light scout armor, sporadic mortar fire. Expect 3 enemy waves.',debrief:'Outstanding work, Commander. The pass is ours. Prepare for urban combat — intel suggests the enemy is fortifying the industrial district.',objectiveDefs:[{type:'capture',label:'Capture Forward OP',ax:-.55,az:-.65,radius:11,holdTime:7,score:350},{type:'destroy',label:'Destroy Ammo Depot',ax:.6,az:.5,radius:6,hp:160,score:450},{type:'destroy',label:'Secure Comms Relay',ax:0,az:-.75,radius:14,defendTime:25,score:380}]},
  {level:2,codename:'OP IRON GATE',name:'Urban Breakthrough',map:'urban',waves:3,classification:'TOP SECRET',theater:'Grid 12 — Industrial Zone',time:'1430 ZULU',commander:'Gen. M. Hayes',intel:'Enemy mechanized units have entrenched among ruined factories. Your platoon must punch through the western gate and seize the command node controlling their artillery network.',orders:['Breach the western industrial sector','Eliminate the enemy fuel dump','Defend the command antenna until uplink is established'],threats:'Medium tanks in cover, ambush teams. Artillery strikes likely.',debrief:'The industrial zone is secure. Arctic command requests immediate reinforcement — a hostile armored division is crossing the frozen line.',objectiveDefs:[{type:'capture',label:'Seize West Gate',ax:-.5,az:.4,radius:10,holdTime:8,score:400},{type:'destroy',label:'Destroy Fuel Dump',ax:.55,az:-.45,radius:6,hp:200,score:520},{type:'defend',label:'Defend Command Antenna',ax:.15,az:-.7,radius:15,defendTime:32,score:420}]},
  {level:3,codename:'OP WHITE LANCE',name:'Arctic Confrontation',map:'snow',waves:4,classification:'SECRET',theater:'Polar Front — Ice Corridor',time:'0600 ZULU',commander:'Col. J. Bradley',intel:'A hostile heavy column is advancing across the ice shelf. Frozen terrain limits maneuver — use cover and flank when possible. Radar station must remain operational for air support.',orders:['Capture the ice road checkpoint','Destroy enemy supply sleds (ammo cache)','Defend the radar station against all waves'],threats:'Heavy armor in final wave, reduced traction. Four assault waves expected.',debrief:'The polar front holds. Recon satellites show enemy remnants withdrawing into the jungle sector — one final push will end this campaign.',objectiveDefs:[{type:'capture',label:'Capture Ice Checkpoint',ax:-.45,az:-.5,radius:11,holdTime:8,score:420},{type:'destroy',label:'Destroy Supply Cache',ax:.5,az:.55,radius:6,hp:220,score:550},{type:'defend',label:'Defend Radar Station',ax:-.2,az:.65,radius:16,defendTime:35,score:480}]},
  {level:4,codename:'OP GREEN THUNDER',name:'Jungle Ambush',map:'forest',waves:4,classification:'CONFIDENTIAL',theater:'Delta 4 — Canopy Sector',time:'1100 ZULU',commander:'Maj. K. Torres',intel:'Dense foliage conceals enemy tank destroyer teams. Navigate the tree line, clear the ambush corridor, and destroy their forward command bunker before they regroup.',orders:['Secure the jungle trailhead','Demolish the forward command bunker','Defend the medevac landing zone'],threats:'Fast flanking units, hidden TDs. Four waves with increased speed.',debrief:'Jungle sector cleared. High command confirms the enemy HQ is exposed in the open desert — this is the decisive engagement.',objectiveDefs:[{type:'capture',label:'Secure Trailhead',ax:.5,az:-.55,radius:10,holdTime:7,score:400},{type:'destroy',label:'Demolish Command Bunker',ax:-.58,az:.42,radius:7,hp:240,score:580},{type:'defend',label:'Defend Medevac LZ',ax:.1,az:.7,radius:14,defendTime:30,score:450}]},
  {level:5,codename:'OP FINAL STAND',name:'Desert Command Assault',map:'desert',waves:5,classification:'TOP SECRET',theater:'Sector 7 — Command Ridge',time:'1800 ZULU',commander:'Gen. M. Hayes',intel:'This is it, Commander. All remaining hostile armor is dug in on the command ridge. Break their line, destroy the headquarters, and end the siege. Expect their heaviest units and a command tank.',orders:['Capture the command ridge overlook','Destroy enemy headquarters (ammo dump)','Defend the ridge until command declares victory'],threats:'Boss-class command tank on final wave. Maximum enemy strength. Five waves.',debrief:'Victory is ours. The siege is broken and the theater is secure. Dismissed, Commander — with honor.',objectiveDefs:[{type:'capture',label:'Capture Command Ridge',ax:0,az:-.6,radius:12,holdTime:9,score:500},{type:'destroy',label:'Destroy Enemy HQ',ax:.62,az:.38,radius:7,hp:280,score:650},{type:'defend',label:'Hold Command Ridge',ax:-.35,az:.5,radius:18,defendTime:40,score:550}]}
];

function fixOriginalObjectives(){
  ORIGINAL_FIVE[0].objectiveDefs[2]={type:'defend',label:'Secure Comms Relay',ax:0,az:-.75,radius:14,defendTime:25,score:380};
}

function generateMissions(){
  fixOriginalObjectives();
  const missions=ORIGINAL_FIVE.map(m=>({...m,act:1,starsTarget:{time:480,damage:60}}));
  for(let level=6;level<=50;level++){
    const r=seededRand(level*7919);
    const map=MAP_CYCLE[(level-1)%MAP_CYCLE.length];
    const theme=MISSION_THEMES[(level-1)%MISSION_THEMES.length];
    const act=Math.ceil(level/10);
    const waves=Math.min(3+Math.floor((level-1)/8)+Math.floor(act/2),6);
    const modifier=level>=12?pick(MODIFIERS,r):'';
    const hour=String(Math.floor(r()*24)).padStart(2,'0');
    const min=String(Math.floor(r()*60)).padStart(2,'0');
    const quickStrike=level%7===0;
    missions.push({
      level,
      codename:codename(level,r),
      name:theme.name+(act>1?' — Act '+act:''),
      map,
      waves:quickStrike?2:waves,
      classification:pick(CLASSIFICATIONS,r),
      theater:pick(THEATERS[map],r),
      time:hour+min+' ZULU',
      commander:pick(COMMANDERS,r),
      intel:theme.intel+(act>=3?' Hostile resistance intensifying in this theater.':''),
      orders:theme.orders.map((o,i)=>o.replace(/^(Advance|Breach|Capture)/,['Push','Force','Take'][i%3])),
      threats:theme.threats+' Expect '+waves+' waves.'+(modifier?' Environmental hazard: '+modifier.toUpperCase()+'.':''),
      debrief:'Mission '+level+' complete. Sector progress: '+Math.round(level/50*100)+'%. '+(level<50?'Prepare for next deployment.':'Campaign objective achieved — theater secured.'),
      objectiveDefs:buildObjectives(level,r),
      act,
      modifier:modifier||undefined,
      quickStrike:quickStrike||undefined,
      starsTarget:{time:Math.max(180,420-level*4),damage:level>15?30:50},
      survivalBonus:level%10===0
    });
  }
  return missions;
}

window.MISSIONS=generateMissions();
})();
