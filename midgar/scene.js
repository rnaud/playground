// Midgar's opening, printed on matte cardstock with quiet fibre and layered ink.
// Palette: teal ground #68807b, steel #526c70, mint #a5d9ac, brick #ab6654,
// cream #ebd8a8; teal shadows #153d47. Lens: 40° pitch, 49 units across,
// .42 focus band; close alley → wide plate → railway. Preserve the Canvas kit.
// Motion: staggered hinges, small steam sway, three signals and one roof-to-platform leap.
// QA: desktop, portrait and short landscape; miss/retry, assisted signals, arrival, replay.
import { createHarness2D } from './harness-2d.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const H = createHarness2D({play:false, ground:'#68807b', shadow:'#153d47',
  kraft:'#b79c72', grade:'saturate(1.12) contrast(1.05)', view:{across:49,closer:1,band:.42}});
const C = {ink:'#253e46', steel:'#526c70', seam:'#93a79a', mint:'#a5d9ac',
  cream:'#ebd8a8', brick:'#ab6654', gold:'#ddb15c', plum:'#675068'};
const rect = (x,y,w,h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function disc(x,y,r,n=12) {
  return Array.from({length:n},(_,i)=>[x+r*Math.cos(i*2*Math.PI/n),y+r*Math.sin(i*2*Math.PI/n)]);
}
function card(x,z,outline,base,layers,opts={}) {
  return H.piece(outline,P=>{
    P.fill(base);
    for (const [color,shape] of layers) P.layer(shape,color);
  },{x,z,...opts,...(reducedMotion.matches ? {bob:0,sway:0} : {})});
}
function sign(P,text,x,y,size,color) {
  P.draw(g=>{g.save();g.translate(x,y);g.scale(1,-1);g.fillStyle=color;
    g.textAlign='center';g.font='bold '+size+'px monospace';g.fillText(text,0,0);g.restore();});
}
H.printGround(({x,W,H:height,X,Z,GQ,line,GX0,GX1,GZ0,GZ1})=>{
  for(let z=GZ0;z<GZ1;z+=3){
    line([[GX0,z],[GX1,z]],.055,'#526966');
    for(let a=GX0+(Math.round(z)%2)*2;a<GX1;a+=5) line([[a,z],[a,z+3]],.045,'#526966');
  }
  // Sector seams, ring roads and the circular plate read together in the wide shot.
  const ring = (rx,rz) => Array.from({length:65},(_,i)=>{
    const angle=i*Math.PI/32;
    return [rx*Math.cos(angle),-13+rz*Math.sin(angle)];
  });
  for(const radius of [10,19,26]){
    line(ring(radius,radius*.59),.82,C.ink);
    line(ring(radius,radius*.59),.34,C.seam);
  }
  for(let i=0;i<8;i++){
    const angle=(i+.5)*Math.PI/4;
    line([[0,-13],[26*Math.cos(angle),-13+15.34*Math.sin(angle)]],.48,C.ink);
  }
  const route=z=>[[GX0,z],[GX1,z]];
  line(route(5),3.7,'#495b59');
  for(let a=GX0;a<GX1;a+=.85) line([[a,3.4],[a+.15,6.6]],.32,'#857565');
  for(const z of [4,6]) {line(route(z),.24,'#263f44');line(route(z-.06),.08,'#d4c6a5');}
  for(let a=GX0;a<GX1;a+=1.4)line([[a,7.25],[a+.85,7.25]],.19,'#d9bd7e');
  x.fillStyle='#3a5b59';x.fillRect(X(-3),Z(-.8),2.2*GQ,GQ);
  for(let i=0;i<8;i++)line([[-2.9+i*.26,-.72],[-2.9+i*.26,.12]],.10,C.mint);
});

function factory(x,z,w,h,seed) {
  const side=w*.28, roof=h*.13;
  const pts=[[0,0],[w-side,0],[w,roof],[w,h],[side,h+roof],[0,h]];
  const layers=[[C.ink,[[w-side,0],[w,roof],[w,h],[w-side,h-roof]]],
    [C.seam,[[0,h],[side,h+roof],[w,h],[w-side,h-roof]]],
    [C.brick,rect(.12,h*.28,w-side-.2,.18)]];
  for(let row=0;row<2;row++) for(let col=0;col<3;col++){
    const a=.22+col*w*.22,b=h*(.42+row*.22);
    layers.push([(row+col+seed)%4?C.cream:C.mint,rect(a,b,w*.12,h*.105)]);
  }
  layers.push([C.seam,rect(w*.78,h*.31,.12,h*.47)]);
  return card(x,z,pts,seed%3?C.steel:'#806858',layers);
}
function reactor(x,z,s,id) {
  const pts=[[-2.6,0],[2.6,0],[2.6,1.2],[1.75,2],[1.4,5.5],[1.7,5.8],[1.7,6.6],
    [-1.7,6.6],[-1.7,5.8],[-1.4,5.5],[-1.75,2],[-2.6,1.2]];
  const scale=pts=>pts.map(([a,b])=>[a*s,b*s]);
  H.piece(scale(pts),P=>{
    P.fill(C.steel);
    for(const [col,shape] of [[C.ink,[[.6,0],[2.6,0],[1.4,5.5],[.5,5.5]]],
      [C.seam,rect(-1.7,5.8,3.4,.6)],[C.ink,rect(-1.5,4,3,.38)],
      [C.mint,rect(-1.3,4.08,2.55,.16)],[C.brick,rect(-2.2,.9,4.4,.5)],
      [C.cream,rect(-1.25,1.8,1.65,1.6)]])P.layer(scale(shape),col);
    sign(P,id,-.44*s,2.12*s,1.05*s,C.ink);
  },{x,z});
  for(let i=0;i<3;i++)card(x+(i-1)*.52*s,z-.1,disc(0,0,(.67+i*.16)*s,9),'#a3c5b4',
    [['#c3d5bb',disc(-.16*s,.22*s,.36*s,8)]],{y:(7+i*.85)*s,bob:.13,sway:.4,float:true});
}
// Concentric industrial districts surrounding the Shinra tower.
for(let row=0;row<3;row++)for(let i=0;i<12;i++){
  const w=2.3+H.rnd()*2.4,h=2.4+H.rnd()*3.9;
  factory(-35+i*6+H.rnd()*2,-22+row*6+H.rnd()*2,w,h,row+i);
}
for(const [x,z,s,id] of [[-17,-12,1.5,'08'],[16,-14,1.55,'02'],[-9,-6,1,'07'],[9,-5,1.3,'01']])reactor(x,z,s,id);
for(let i=0;i<4;i++)factory(-3.6+i*.56,-13-i*.15,8-i*1.3,4+i*2.4,2);
for(const [x,z] of [[-19,-2],[-13,2],[15,0],[21,3],[-16,13],[13,15]])factory(x,z,4.3,4.8,2);

function lamp(x,z) {
  card(x,z,[[-.42,0],[.45,0],[.2,.45],[.18,3.6],[.56,3.95],[.45,4.72],[0,5],[-.48,4.72],[-.6,3.95],[-.16,3.6],[-.18,.45]],C.ink,
    [[C.gold,rect(-.37,4,.72,.55)],[C.cream,rect(-.29,4.12,.27,.39)],[C.seam,rect(-.12,.48,.09,3)]]);
}
for(const x of [-18,-7,5,17])lamp(x,2.3);
for(const x of [-20,8,19])lamp(x,8.4);

const aerith=card(-1,1.25,[[-.77,0],[.8,0],[.45,1.4],[.67,1.9],[.48,2.32],[.42,2.9],
  [.17,3.12],[-.38,3.1],[-.6,2.8],[-.5,2.22],[-.77,1.68],[-.36,1.35]],'#ce918d',
  [['#a95a5c',[[-.7,0],[-.23,1.48],[.04,1.54],[-.13,0]]],
  ['#924c41',rect(-.5,1.54,1,.66)],['#693f34',disc(-.03,2.61,.51)],
  ['#eac09a',disc(.13,2.59,.33)],['#644137',[[.42,2.79],[-.32,2.48],[-.36,2.93],[.08,3.05]]],
  [C.ink,disc(.34,2.63,.045)],['#dd8491',disc(-.47,2.65,.22)],['#875338',rect(.36,1.0,.71,.5)]],{sharp:true});
H.setHero(aerith);
for(let i=0;i<6;i++)card(-.62+(i%3)*.22,1.4,disc(0,0,.16,7),i%2?C.gold:C.cream,
  [[C.brick,disc(0,0,.045,6)]],{y:1.58+Math.floor(i/3)*.15,float:true});
for(let i=0;i<8;i++)card(-2.6+(i%3)*.4,-.15,[[0,.14],[.09,0],[0,-.13],[-.08,0]],C.mint,[],{y:.5+i*.34,float:true,bob:.15});

function carriage(x,engine){
  const w=engine?5.3:6.6;
  const outline=[[0,.32],[.32,.9],[.32,2.6],[.65,3],[w-1,3],[w-.5,2.72],[w,1.75],[w,.55],[w-.5,.35],[w-.65,0],[w-1.4,0],[w-1.6,.35],[1.8,.35],[1.55,0],[.8,0],[.6,.32]];
  const layers=[[C.seam,rect(.45,2.59,w-.95,.22)],[C.brick,rect(.28,.72,w-.38,.32)],
    [C.ink,rect(.45,1.4,w-.8,1.15)]];
  for(let i=0;i<(engine?3:5);i++)layers.push([i%3?C.cream:C.mint,rect(.62+i*1.08,1.58,.77,.72)]);
  if(engine)layers.push([C.gold,disc(w-.43,1.27,.24)]);
  return card(x,5.2,outline,C.steel,layers,{sharp:true});
}
const train=[carriage(-59,false),carriage(-52,false),carriage(-45,true)];
const cloud=card(-55,6.8,[[-.62,0],[-.13,0],[0,.35],[.16,0],[.66,0],[.48,1.12],[.55,1.8],
  [.88,2.05],[.43,2.33],[.57,2.91],[.27,2.8],[.12,3.31],[-.17,2.94],[-.62,3.16],[-.48,2.72],[-.83,2.62],[-.45,2.28],[-.56,1.7]],C.plum,
  [[C.ink,rect(-.7,0,1.4,.42)],[C.cream,disc(.04,2.48,.38)],
   [C.gold,[[-.78,2.64],[-.5,2.81],[-.62,3.16],[-.18,2.94],[.12,3.31],[.29,2.8],[.57,2.91],[.39,2.55],[.1,2.66],[-.23,2.39]]],
   [C.steel,disc(-.34,1.96,.36)],[C.ink,rect(-.46,1.05,.97,.19)]],{sharp:true});
const sword=card(-55,6.75,[[-.5,0],[-.32,.02],[1.39,2.74],[1.43,3.43],[.76,3.14],[-.65,.51]],C.seam,
  [[C.steel,[[-.48,.32],[.91,2.99],[1.43,3.43],[1.39,2.74],[-.32,.02]]]],{sharp:true});
H.start();

const paper = window.__papercraft;
const paperStep = paper.step.bind(paper), paperRestart = paper.restart.bind(paper);
const canvas = document.getElementById('c');
const ui = Object.fromEntries(['chapter','title','story','controls','action','meter','assist','timing-hint']
  .map(id => [id, document.getElementById(id)]));
const band = ui.meter.querySelector('i'), needle = ui.meter.querySelector('b');
const stops = [{left:.28,width:.26,speed:.48}, {left:.59,width:.22,speed:.6}, {left:.4,width:.18,speed:.75}];
let stage, signal, elapsed, position, trainX, destination, landing, last, reveal;
let live = true, resumeGeneration = 0;
function caption(chapter, title, story, action) {
  ui.chapter.textContent = chapter;
  ui.title.textContent = title;
  ui.story.textContent = story;
  ui.action.textContent = action;
  canvas.setAttribute('aria-label', title + '. ' + story);
}
function placeTrain() {
  train.forEach((p,i) => p.x = trainX - (2-i)*7);
}
function placeCloud(leap = 0) {
  cloud.x = trainX + 2.4 - 1.7*leap;
  cloud.z = 5.35 + 2.5*leap;
  cloud.y = 2.7*(1-leap) + Math.sin(Math.PI*leap)*1.4;
  sword.x = cloud.x-.45; sword.z = cloud.z-.05; sword.y = cloud.y;
}
function cancelReveal() {
  reveal?.cancel();
  reveal = null;
}
function frameScene() {
  const aspect = innerWidth/innerHeight;
  // The kit builds for the initial frame. Compensate on rotation without rebuilding prints.
  const zoom = Math.max(1,H.frame.aspect)/Math.max(1,aspect);
  if (stage === 'alley') paper.look(-1,0,2.8*zoom);
  else if (stage === 'plate') paper.look(0,-6,.83*zoom);
  else paper.look(innerHeight <= 520 && innerWidth >= 600 ? -7 : 0,5,1.25*zoom);
}
addEventListener('resize', frameScene);
function reset() {
  cancelReveal();
  stage = 'alley'; signal = 0; elapsed = position = landing = 0;
  trainX = destination = -45; last = undefined;
  placeTrain();
  Object.assign(cloud, {x:-55,y:0,z:6.8});
  Object.assign(sword, {x:-55,y:0,z:6.75});
  ui.controls.hidden = true;
  ui.action.disabled = false;
  frameScene();
  caption('SECTOR 08  /  LOVELESS STREET', 'The flower seller',
    'Mako slips through a grate. Aerith pauses beside it, flowers in hand.', 'Look up over Midgar →');
}
function timingHelp() {
  ui.meter.hidden = ui.assist.checked;
  ui['timing-hint'].textContent = ui.assist.checked
    ? 'No timing needed. Set each signal when you’re ready.'
    : 'Click, tap or press Space when the needle enters the striped band.';
}
ui.assist.addEventListener('change', timingHelp);
function setSignal() {
  const s = stops[signal];
  elapsed = position = 0;
  band.style.left = s.left*100+'%'; band.style.width = s.width*100+'%'; needle.style.left = '0%';
  caption('SECTOR 01  /  SIGNAL '+(signal+1)+' OF 3', 'The last train',
    ['Clear three signals to bring the train into Sector 01.',
     'First switch clear. Guide the engine onto the sector line.',
     'Second switch clear. Catch the last signal to brake at the platform.'][signal], 'Set signal · Space');
}
function act() {
  if (ui.action.disabled) return;
  if (stage === 'alley') {
    stage = 'plate'; frameScene();
    if (!reducedMotion.matches) {
      reveal = canvas.animate([
        {transform:'scale(2.7)',transformOrigin:'50% 65%'},
        {transform:'scale(1)',transformOrigin:'50% 65%'}
      ], {duration:1500,easing:'cubic-bezier(.19,.62,.22,1)'});
    }
    caption('MIDGAR  /  UPPER PLATE', 'City of mako',
      'Eight sectors circle the Shinra tower. Below the plate, a train approaches Reactor 01.', 'Follow the train →');
  } else if (stage === 'plate') {
    cancelReveal();
    stage = 'signals'; ui.controls.hidden = false; trainX = -12; destination = -7;
    placeTrain(); placeCloud();
    frameScene(); setSignal();
  } else if (stage === 'signals') {
    const s = stops[signal];
    if (!ui.assist.checked && (position < s.left || position > s.left+s.width)) {
      ui.story.textContent = 'Signal held at red. Nothing lost — try again on the next pass.';
      return;
    }
    signal++;
    destination = [-7,-3,1,3][signal];
    if (signal < stops.length) setSignal();
    else {
      stage = 'arrival'; ui.controls.hidden = true; ui.action.disabled = true;
      caption('SECTOR 01  /  NORTH PLATFORM', 'Arrival',
        'The brakes catch. A figure with a sword rides the engine into the station.', 'Pulling in…');
    }
  } else if (stage === 'end') {
    reset();
  }
}
ui.action.addEventListener('click', act);
addEventListener('keydown', e => {
  // Leave native Space activation to links, the assist checkbox and other controls.
  const target = document.activeElement;
  if (e.code !== 'Space' || e.altKey || e.ctrlKey || e.metaKey) return;
  if (target !== ui.action && target?.closest('a,button,input,select,textarea,[contenteditable]')) return;
  e.preventDefault();
  if (!e.repeat) act();
});
function update(dt) {
  if (reducedMotion.matches) trainX = destination;
  else trainX += (destination-trainX)*(1-Math.exp(-dt*2.5));
  placeTrain();
  if (stage === 'signals') {
    if (!ui.assist.checked) elapsed += dt;
    position = 1-Math.abs(elapsed*stops[signal].speed%2-1);
    needle.style.left = position*100+'%';
    placeCloud();
  }
  if (stage === 'arrival' || stage === 'end') {
    // Stop at the platform before jumping; the landing must not slide with the train.
    if (Math.abs(destination-trainX) < .05) {
      trainX = destination; placeTrain();
      landing = reducedMotion.matches ? 2.4 : Math.min(2.4,landing+dt);
    }
    const leap = Math.max(0,Math.min(1,(landing-.35)/.7));
    placeCloud(leap);
    if (stage === 'arrival' && landing >= 1.4) {
      stage = 'end'; ui.action.disabled = false;
      caption('REACTOR 01  /  END OF PROLOGUE', 'Cloud Strife',
        'Boots hit the platform. Avalanche is already moving toward the reactor.', 'Replay the opening ↺');
    }
  }
}
function animate(now) {
  if (live && !document.hidden) update(Math.min(.05,Math.max(0,(now-(last??now))/1000)));
  last = now;
  requestAnimationFrame(animate);
}
// Keep scene motion and the supplied paper capture clock together for reproducible reviews.
// These hooks also exercise the same state transitions as the visible controls.
paper.step = (seconds, fps = 60) => {
  live = false; resumeGeneration++; cancelReveal();
  let time = paperStep(0);
  for (let i=0; i<Math.round(seconds*fps); i++) { update(1/fps); time = paperStep(1/fps, fps); }
  return time;
};
paper.restart = () => { paperRestart(); reset(); };
const paperResume = paper.resume.bind(paper);
paper.resume = () => {
  if (live) return;
  live = true; last = undefined;
  const generation = ++resumeGeneration;
  // Let the kit's pending frame observe its paused clock before starting a new loop.
  requestAnimationFrame(() => { if (live && generation === resumeGeneration) paperResume(); });
};
reset(); timingHelp();
if (reducedMotion.matches) { paperStep(3); live = false; paper.resume(); }
requestAnimationFrame(animate);
