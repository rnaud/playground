// Horizontal map units are wider on screen than the foreshortened ground axis.
const moves={arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0],arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1]};
const footprints={shinra:53,reactor:46,house:25,chapel:55,temple:59,rocket:18,canyon:32,peak:55,ice:53,crystal:10,broadleaf:5,pine:4};
export function walker(world,camera,enabled,limit){
 const held=new Set();
 let target=null,pointer=null;
 const hero={x:-20,z:112,facing:1,stride:0,moving:false};
 function clear(){held.clear();target=null;pointer=null;hero.moving=false;}
 function point(e){
  const matrix=camera.getScreenCTM();
  if(matrix){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());target=[p.x,p.y];}
 }
 world.addEventListener('pointerdown',e=>{
  if(!enabled()||e.button!==0)return;
  pointer=e.pointerId;world.setPointerCapture(pointer);point(e);
 });
 world.addEventListener('pointermove',e=>{if(pointer===e.pointerId&&enabled())point(e);});
 world.addEventListener('pointerup',e=>{if(e.pointerId===pointer)pointer=null;});
 world.addEventListener('pointercancel',clear);
 document.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(!enabled()||!moves[k]||e.metaKey||e.altKey||e.ctrlKey||e.target.matches('input,textarea,select'))return;
  e.preventDefault();target=null;held.add(k);
 });
 document.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));
 window.addEventListener('blur',clear);
 document.addEventListener('visibilitychange',clear);
 function step(dt,objects){
  let dx=0,dz=0;
  for(const k of held){dx+=moves[k][0];dz+=moves[k][1];}
  if(target){dx=target[0]-hero.x;dz=(target[1]-hero.z)/.76;}
  const length=Math.hypot(dx,dz);
  if(length<.8){target=null;hero.moving=false;return false;}
  const dist=Math.min(dt*205,target?length:Infinity);
  const beforeX=hero.x,beforeZ=hero.z;
  const free=(x,z)=>objects.every(o=>{
   const radius=footprints[o.kind]*o.scale;
   if(!radius)return true;
   const depth=radius*.30+4;
   const measure=(px,pz)=>((px-o.x)/radius)**2+((pz-o.z)/depth)**2;
   const next=measure(x,z);
   return next>=1||next>measure(hero.x,hero.z);
  });
  const x=Math.max(-505,Math.min(505,hero.x+dx/length*dist));
  if(free(x,hero.z))hero.x=x;
  const z=Math.max(-210,Math.min(limit,hero.z+dz/length*dist*.76));
  if(free(hero.x,z))hero.z=z;
  const walked=Math.hypot(hero.x-beforeX,(hero.z-beforeZ)/.76);
  hero.moving=walked>.01;
  if(!hero.moving)target=null;
  if(Math.abs(hero.x-beforeX)>.02)hero.facing=Math.sign(hero.x-beforeX);
  hero.stride+=walked*.10;
  return hero.moving;
 }
 return {hero,clear,step,place(x,z){clear();hero.x=x;hero.z=z;}};
}
