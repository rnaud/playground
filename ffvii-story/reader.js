import {walker} from './walk.js';
import {cardstock} from './material.js';
import {stage,H,sceneCount} from './art.js';
import {chapters} from './story.js';
import {cues} from './film.js';

const $=id=>document.getElementById(id);
const world=$('world'), drawer=$('drawer'), seek=$('seek');
const scenes=[...chapters,{title:'Five hundred years later',place:'The ruins of Midgar',paragraphs:[chapters.at(-1).paragraphs.at(-1)]}];
const timeline=[];
const starts=[];
let duration=0;
cues.forEach((lines,n)=>{
 starts.push(duration);
 lines.forEach((line,beat)=>{
  const length=Math.max(5.8,line.split(/\s+/).length/3.05+1.1);
  timeline.push({n,beat,line,start:duration,length});
  duration+=length;
 });
});
seek.max=duration;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let time=0,playing=!reduced,lastFrame=0,lastCue=-1,activeStage=-1,objects=[],resumeAfterDialog=false;
world.innerHTML=`<defs>${cardstock()}</defs><g id="camera"></g>`;
const camera=$('camera');
let exploring=true, avatar=null;
const walking=walker(world,camera,()=>exploring&&!drawer.open,(sceneCount-1)*H+210);
const hero=walking.hero;
function modeUI(){
 document.body.classList.toggle('exploring',exploring);
 $('mode').textContent=exploring?'Watch film':'Explore';
 world.setAttribute('aria-label',exploring?'Playable paper map. Move Cloud with arrow keys, WASD, or tap the ground.':'An animated pop-up paper map of Final Fantasy VII');
}
function positionHero(n){
 const stage=camera.querySelector(`.stage[data-index="${n}"]`);
 const next=objects.find(o=>o.n===n&&o.z>hero.z&&o.kind!=='cloud');
 const before=next?.node.parentNode??null;
 if(avatar.parentNode!==stage||avatar.nextSibling!==before)stage.insertBefore(avatar,before);
 avatar.setAttribute('transform',`translate(${hero.x} ${hero.z-n*H})`);
 const stride=hero.moving&&!reduced?Math.sin(hero.stride):0;
 avatar.lastElementChild.setAttribute('transform',`translate(0 ${-Math.abs(stride)*2.5}) scale(${hero.facing} 1) rotate(${stride*2})`);
}
const clock=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
const clamp=x=>Math.min(1,Math.max(0,x));
const smooth=x=>x*x*(3-2*x);
const sheets=scenes.map((_,i)=>stage(i));
function makeWorld(n){
 const visible=sheets.map((s,i)=>({...s,i})).filter(s=>Math.abs(n-s.i)<=1);
 // Ground sheets lie behind every standing card, even across a chapter seam.
 camera.innerHTML=visible.map(s=>`<g transform="translate(0 ${s.i*H})">${s.ground}</g>`).join('')
 +visible.map(s=>`<g class="stage" data-index="${s.i}" transform="translate(0 ${s.i*H})">${s.cards}</g>`).join('');
 objects=[...camera.querySelectorAll('[data-kind]')].map(node=>{
  const face=node.querySelector('.hinge'),shadow=face.cloneNode(true);
  shadow.removeAttribute('class');shadow.setAttribute('opacity','.52');
  const cast=shadow.querySelector('use');cast.setAttribute('href',cast.getAttribute('href').replace('#piece-','#shade-'));
  face.before(shadow);
  const row=Number(node.dataset.row),n=Number(node.closest('.stage').dataset.index);
  if(exploring&&node.dataset.kind==='cloud')node.style.display='none';
  return {node,face,shadow,kind:node.dataset.kind,x:Number(node.dataset.x),scale:Number(node.dataset.scale),row,n,z:n*H+row};
 });
 if(exploring){
  avatar=document.createElementNS('http://www.w3.org/2000/svg','g');
  avatar.id='player';
  avatar.innerHTML='<ellipse cx="1" cy="0" rx="11" ry="3.3" fill="#514733" opacity=".31"/><use href="#shade-cloud-0" opacity=".52" transform="matrix(1 .015 -.67 .18 2 1)"/><use href="#piece-cloud-0"/>';
 }
 activeStage=n;
}
function resize(){
 const a=world.clientWidth/world.clientHeight;
 const w=Math.min(1390,Math.max(460,505*a)),h=w/a;
 world.setAttribute('viewBox',[-w/2,-h*.48,w,h].join(' '));
}
function draw(){
 if(exploring){
  const region=Math.max(0,Math.min(sceneCount-1,Math.round(hero.z/H)));
  time=starts[region];
 }
 const index=timeline.findIndex(c=>time<c.start+c.length);
 const ci=index<0?timeline.length-1:index,c=timeline[ci],n=c.n;
 if(activeStage!==n)makeWorld(n);
 if(ci!==lastCue){
  $('location').textContent=String(n+1).padStart(2,'0')+' / '+String(sceneCount).padStart(2,'0')+'  ·  '+scenes[n].place;
  $('title').textContent=scenes[n].title;$('caption').textContent=c.line;lastCue=ci;
 }
 const local=time-starts[n],end=starts[n+1]??duration;
 const travel=n<sceneCount-1?smooth(clamp((time-end+3.7)/3.7)):0;
 const drift=local/(end-starts[n]);
 const distance=exploring?Math.max(-70,Math.min((sceneCount-1)*H+75,hero.z-55)):n*H+(reduced?0:travel*H+Math.sin(drift*Math.PI)*19);
 const lateralLimit=Math.max(0,745-world.viewBox.baseVal.width/2);
 const x=exploring?-Math.max(-lateralLimit,Math.min(lateralLimit,hero.x*.82)):reduced?0:Math.sin(drift*Math.PI*2)*12;
 camera.setAttribute('transform',`translate(${x} ${-distance})`);
 for(const o of objects){
  const ahead=o.n*H+o.row-distance;
  let a=clamp((335-ahead)/156);
  if(exploring)a=smooth(clamp((360-Math.hypot(o.x-hero.x,(o.z-hero.z)*1.38))/155));
  else if(!n&&local<1.65)a=Math.min(a,clamp((local+.56-o.row*.0017)/1.08));
  const angle=reduced?(exploring&&a<.5?Math.PI*.5:0):(1-a)*Math.PI*.5-Math.sin(a*Math.PI*2)*.12;
  const sy=Math.cos(angle)-.56*Math.sin(angle);
  const swing=reduced?0:Math.sin(time*1.35+o.row)*.55;
  let dx=0,dy=0,rot=0,fold=1;
  if(!exploring&&!reduced){
   if(o.kind==='train')dx=155*(1-smooth(clamp(local/6)));
   if(o.kind==='airship'){dx=swing*12;dy=swing*3;}
   if(o.kind==='cloud'||o.kind==='red'||o.kind==='cub'){dx=Math.sin(drift*Math.PI*2)*18;dy=-Math.abs(Math.sin(time*3.6))*1.6;rot=Math.sin(time*3.6)*1.25;}
   if(o.kind==='meteor'){dy=drift*44;dx=-drift*65;}
   if(o.n===5&&o.kind==='sephiroth')dy=-90*(1-smooth(clamp((drift-.59)/.13)));
   if(o.n===5&&o.kind==='aerith')fold=1-smooth(clamp((drift-.77)/.18))*.93;
   if(o.n===10&&o.kind==='sephiroth')fold=1-smooth(clamp((drift-.25)/.21))*.98;
   if(o.n===8&&o.kind==='rocket')dy=-245*smooth(clamp((drift-.42)/.32));
   if(o.n===11&&['red','cub'].includes(o.kind))dx=58*smooth(drift)-32;
   if(o.kind==='pine'||o.kind==='broadleaf'||o.kind==='flower')rot=swing*1.35;
  }
  const reverse=sy<0;
  if(o.reverse!==reverse){o.reverse=reverse;if(reverse)o.face.setAttribute('filter','url(#kraft)');else o.face.removeAttribute('filter');}
  o.face.setAttribute('transform',`translate(${dx} ${dy}) scale(1 ${sy*fold}) rotate(${rot})`);
  o.shadow.setAttribute('transform',`matrix(1 .015 ${-.67*Math.cos(angle)*fold} ${(.18*Math.cos(angle)-.56*Math.sin(angle))*fold} ${dx+2-dy*.60} ${1+dy*.15})`);
 }
 if(exploring)positionHero(n);
 world.style.setProperty('--motion',(exploring||playing)&&!reduced?'running':'paused');
 seek.value=time;$('clock').value=clock(time)+' / '+clock(duration);
 $('play').textContent=time>=duration?'↺':playing?'Ⅱ':'▶';
 $('play').setAttribute('aria-label',time>=duration?'Replay':playing?'Pause':'Play');
}
function frame(now){
 if(exploring&&!document.hidden&&!drawer.open){
  const moving=hero.moving;
  if(walking.step(Math.max(0,Math.min(.05,(now-lastFrame)/1000)),objects)||moving)draw();
 }else if(!exploring&&playing&&!document.hidden){time=Math.min(duration,time+Math.min(.15,lastFrame?(now-lastFrame)/1000:0));if(time===duration)playing=false;draw();}
 lastFrame=now;requestAnimationFrame(frame);
}
function jump(n){time=starts[n];if(exploring)walking.place(-20,n*H+112);draw();}
$('mode').onclick=()=>{
 const n=activeStage;
 exploring=!exploring;
 if(exploring)walking.place(-20,n*H+112);
 else {walking.clear();time=starts[n];}
 playing=!exploring&&!reduced;activeStage=-1;lastCue=-1;
 modeUI();draw();
};
function play(){if(time>=duration){time=0;playing=true;}else playing=!playing;draw();}
function showPanel(type){
 const n=timeline[lastCue].n;
 walking.clear();resumeAfterDialog=playing;playing=false;draw();
 const panel=$('panel');
 if(type==='scenes'){
  panel.innerHTML='<h2>Scenes</h2><ol>'+scenes.map((s,i)=>`<li><button data-scene="${i}">${s.title}</button></li>`).join('')+'</ol>';
 }else{
  panel.innerHTML='<h2>'+scenes[n].title+'</h2>'+scenes[n].paragraphs.map(p=>'<p>'+p+'</p>').join('');
 }
 drawer.showModal();
}
$('open-scenes').onclick=()=>showPanel('scenes');$('story').onclick=()=>showPanel('story');
$('panel').onclick=event=>{const button=event.target.closest('[data-scene]');if(button){jump(Number(button.dataset.scene));drawer.close();}};
drawer.onclose=()=>{playing=resumeAfterDialog;draw();};
seek.oninput=()=>{time=Number(seek.value);draw();};
$('play').onclick=play;
document.addEventListener('keydown',e=>{
 if(exploring||drawer.open||e.target.matches('input,button,a')||e.altKey||e.metaKey||e.ctrlKey)return;
 if(e.code==='Space'){e.preventDefault();play();}
 if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();jump(Math.max(0,Math.min(sceneCount-1,activeStage+(e.key==='ArrowRight'?1:-1))));}
});
function route(){
 const n=Number(/^#chapter-(\d+)$/.exec(location.hash)?.[1]);
 if(n>=1&&n<=sceneCount)jump(n-1);
 if(location.hash==='#contents'&&!drawer.open)showPanel('scenes');
}
window.addEventListener('resize',()=>{resize();draw();});
window.addEventListener('hashchange',route);
modeUI();resize();draw();route();requestAnimationFrame(frame);
