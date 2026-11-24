// World coordinates are printed-page coordinates projected at a shallow overhead angle.
// Every silhouette has a darker cut side, an offset cast shadow, and a printed face.
const ink='#253e41', steel='#688782', mint='#9dd5ac', bone='#e6d4a1', red='#ad5c40', gold='#dfac55';
export const H=620;
const p=(d,c)=>`<path d="${d}" fill="${c}"/>`;
const l=(d,c,w=2)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const e=(x,y,rx,ry,c)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}"/>`;
const r=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const g=(x,y,s,v)=>`<g transform="translate(${x} ${y}) scale(${s})">${v}</g>`;
const rep=(n,fn)=>Array.from({length:n},(_,i)=>fn(i)).join('');
const id=(x,y)=>Math.abs(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;
const label=(x,y,size,t,c)=>`<text x="${x}" y="${y}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${size}" fill="${c}">${t}</text>`;
function windows(x,y,n,rows,step=11){return rep(n*rows,i=>r(x+i%n*step,y+Math.floor(i/n)*12,5,6,i%4===1?gold:bone));}
function block(w,h,c=steel){
 return p(`M${-w/2} 0v-${h}l${w*.74} -8 ${w*.26} 9v${h}l-${w*.25} 6z`,ink)
 +p(`M${-w/2} -2v-${h-2}l${w*.75} 4v${h+3}z`,c)
 +p(`M${-w/2} -${h}l${w*.71} -8 ${w*.29} 8 -${w*.24} 5z`,'#b2b299')
 +rep(Math.floor(h/19),i=>l(`M${-w/2+1} ${-i*19-5}l${w*.70} 3m4 0l${w*.21} -5`,'#737462',1.3))
 +rep(Math.max(1,Math.floor(w/20)),i=>r(-w/2+3+i*16,-h+4,2,h-5,'#506254'))
 +l(`M${-w/2+1} -${h-1}l${w*.73} 4v${h-5}`,'#d3c39e',1.3)
 +windows(-w/2+5,-h+12,Math.max(1,Math.floor(w*.67/11)),Math.max(1,Math.floor((h-13)/12)));
}
function reactor(n){
 return p('M-64 0l2-21 15-12 11-79 -5-6 1-21 16-10 51 3 13 13 -3 21 -7 5 8 72 16 13 7 22 -29 9 -65-1z',ink)
 +p('M-56-8l8-24 13-13 9-69 38 3 9 78 11 23 -21 8z','#729890')
 +p('M-40-129l16-13 47 2 12 11 -15 9 -45 1z','#cad3b4')
 +e(-1,-130,27,6,darkGreen)+e(-1,-131,18,3,'#9dccaa')
 +p('M-39-121l57 3 17-8 -1 13 -18 9 -52-5z',rust)
 +p('M-28-94l46 2 3 10 -50-3z',ink)+p('M-26-91l40 2 1 4 -42-2z',mint)
 +p('M-31-39l45 4 2 13 -50-4z','#405f5b')+label(-3,-55,18,String(n).padStart(2,'0'),bone)
 +rep(7,i=>e(-32+i*7,-115,1.4,1.5,bone)+e(-29+i*7,-85,1,1,bone))
 +p('M-38-37l3-6 58 6 5 6 -8 5 -56-5z','#82664a')
 +rep(5,i=>p(`M${-33+i*10} -38l4 0 3 7 -4 0z`,gold))
 +l('M-40-15l6-30 5-32m45 48 -4-42',ink,5)+l('M-41-16l6-30 5-31m45 48 -4-42','#cab896',1.8)
 +rep(4,i=>`<g class="vapor" style="--delay:-${i*.77+n*.15}s">${e(-5+i*4,-148-i*8,7+i*2,4+i,'#c9d3b5')}</g>`)
 +rep(4,i=>l(`M${-47+i*8} -12l5-18`,'#b8c2a2',2))+p('M19-107l7-3 9 72 -9 3z','#54716a');
}
const darkGreen='#345a52',rust='#a85e43';
function shinra(){return block(136,54)+g(0,-49,1,block(99,75,'#53716f'))+g(-2,-119,1,block(69,49))+g(-2,-164,1,block(44,22,'#8c8f76'))+p('M-4-188v-29l4-11 3 40z',ink)+label(-12,-85,14,'神羅',bone);}
function house(c=red){return block(66,40,'#c4ab7c')+p('M-41-38l22-33 42-3 22 32 -22 5 -42-3z',ink)+p('M-40-41l23-30 38-2 -17 29z',c)+p('M3-44l18-29 23 30 -20 4z','#815f4a')+rep(15,i=>{const row=Math.floor(i/5),x=-16+i%5*6.8-row*5,y=-68+row*8;return l(`M${x} ${y}q-2 9 4 7 3-1 4-8`,'#6b4231',2.8)+l(`M${x} ${y-1}q-2 9 4 7 3-1 4-8`,'#e3b984',1.3);})+r(-5,-23,12,24,'#554e3c');}
function chapel(){
 const glass=(x,y,s)=>g(x,y,s,p('M-7 0v-16q1-7 7-12 6 5 7 12V0z','#514b42')+p('M-5-2v-12q0-6 5-10 5 5 5 10v12z','#dab666')+l('M0-23v22m-4-12h9','#836750',1.4));
 return p('M-75-1v-64l38-44 70-3 38 43v70l-36 12z','#7b6b50')
 +p('M-73-3v-58l100 6v59z','#dcc097')
 +p('M29-58l23-23 17 15v65l-40 9z','#af926e')
 +p('M-83-63l46-50 77-4 35 48 -44 13z','#4c4b40')
 +p('M-80-68l44-45 72-3 -48 50z','#627e74')
 +rep(36,i=>{const row=Math.floor(i/9);return l(`M${-37+i%9*8-row*8} ${-108+row*9}q-3 10 5 6`,'#aabe99',1.2);})
 +p('M-8-68l43-47 35 45 -39 10z','#9d7858')+l('M-8-66l44-47 33 43','#e3c699',2.2)
 +glass(-59,-12,1)+glass(-40,-12,1)+glass(49,-8,.9)
 +p('M-21 2v-109l20-16 22 14v114l-17 6z','#c8ab83')
 +p('M5 9v-121l15 3v114z','#9a8065')
 +p('M-22-98l-3-7 24-4 26 0 -4 9 -18 5z','#897259')
 +glass(-7,-55,.82)+p('M-15 3v-23q1-12 13-20 12 11 12 20V4z','#624c3d')
 +l('M-11 2v-20q2-9 9-14 8 8 8 14v21','#ab916c',2)
 +p('M-27-108l24-58 29 57 -20 6z','#436659')+p('M-3-165l29 56 -20 6z','#355343')
 +rep(4,i=>l(`M${-8-i*4} ${-145+i*10}q8 4 15 1`,'#a7aa81',1.4))
 +l('M-3-166v-16m-6 5h12',bone,3);
}
function pine(seed){
 const h=53+seed%19, a=['#4a7361','#4c665c','#657a5a'][seed%3];
 let v=r(-3,-17,7,19,'#725d44');
 for(let i=0;i<3;i++){let y=-i*h*.24,w=(23-i*4);
 v+=p(`M${-w} ${y-7}l${w*.34} -10 -4 1 ${w*.84} -${h*.53} ${w*.65} ${h*.42} -3 0 9 15 -${w} 6z`,a)
 +p(`M1 ${y-h*.69}l${w*.66} ${h*.47} -4 0 10 15 -${w} 5z`,'#314f49')
 +l(`M${-w*.65} ${y-12}l6-5m-1-5 4-4`,'#a6ae80',2);}
 return v;
}
function broadleaf(seed){
 const colors=[['#37583b','#628145','#b3ab62'],['#904728','#b96837','#dfab62'],['#875054','#af7272','#e1aba1']][seed%3];
 return p('M-9 2l5-37-13-20 6-3 14 16 10-22 4 5-10 29 3 32z','#704931')
 +p('M-29-37q-16-9-9-24-8-14 6-22 4-15 18-12 11-15 22-5 14-7 19 8 14 4 12 18 7 12-4 21-5 13-16 12-12 6-22-1-10 6-26 5z',colors[0])
 +p('M-33-60q-7-16 7-22 5-12 14-10 9-12 19-6l-6 20 -9 15 -2 14 -15 3z',colors[1])
 +rep(19,i=>{const x=Math.cos(i*2.4)*Math.sqrt(i)*7,y=-70+Math.sin(i*2.4)*Math.sqrt(i)*5;return p(`M${x} ${y}q-1-8 8-10 3 8-8 10z`,colors[i%3]);})
 +p('M0-32l-5-31 7-37 8 8 6 19-2 24-10 17z',colors[1])+l('M1-33l-3-29 5-34',colors[2],1.5)
 +l('M-4-1l3-27m-1-13-11-12','#c59868',1.6);
}
function gantry(){return p('M-48 1v-48l7-4 5 2v47zM32-2v-44l7-3 4 3v45z',ink)
 +p('M-53-44v-14l94-5 8 4v15l-91 5z','#754a37')+p('M-53-59l96-6 9 4 -94 7z','#c1986b')
 +rep(7,i=>l(`M${-47+i*13} -45l10-11`,'#c38959',3))+l('M-47-43v42m81-44v41',bone,1.6);}
function crate(){return p('M-18 0v-23l26-4 12 6v22l-12 4z','#775333')+p('M-17-22l24 3v21l-24-4z','#c0985e')+p('M-18-23l25-5 12 6 -13 4z','#d6b582')+l('M-14-18l18 16m-18-1 17-14','#7c5939',3);}
function rock(n){return p('M-22 0l5-19 15-12 17 7 10 18 -10 9z','#555c55')+p('M-20-1l5-17 14-10 8 5 -6 19z',n%2?'#a99f85':'#8c9484')+p('M0-4l8-19 8 4 8 15 -11 4z','#747b6d');}
function mountain(c,ice=false){return p('M-102 1l16-27 22-11 30-49 17-14 14-26 18 14 29 46 26 19 35 43 -46 12 -86-2z','#4c5959')+p('M-99-1l34-36 31-48 17-15 15-25 -10 49 -16 24 -5 27 -32 16z',c)+p('M-1-124l16 14 30 48 28 19 30 38 -44 10 -25-36 -14-19 -4-25z',ice?'#91aeb4':'#796f61')+p('M-48-62l15-24 16-15 15-24 19 19 13 20 -19-9 -10 10 -9-4 -15 20 2-14z',ice?'#e9ead3':'#b7a484')+l('M-83-16l28-18 17-25m57-23 11 24 17 16',ice?'#bcd1ce':'#b3a284',3);}
function towerCanyon(){return p('M-57 0l10-18 5-64 -4-9 5-16 52-8 32 12 -3 13 -7 5 5 63 12 18 -35 10z','#975e49')+p('M-42-99l51-12 31 10 -15 9 -47 4z','#e2ad73')+rep(4,i=>p(`M-41 ${-73+i*17}l62-6 11-3 1 5 -13 4 -62 6z`,i%2?'#cd9063':'#754f42'))+g(0,-107,.65,house());}
function crystal(c=mint){return p('M-18 0l-8-53 16-42 22 26 7 52 -14 20z','#4e8380')+p('M-10-94l8 33 -3 62 -12-8 -7-45z',c)+p('M-9-92l20 24 6 49 -17 20 5-59z','#84b9ab')+l('M-20-52l9-28',bone,2);}
function temple(){return rep(5,i=>g(0,-i*22,1,block(170-i*27,24,i%2?'#839780':'#a1a384')))+p('M-12-85v-25q12-17 23 0v25z',darkGreen)+p('M-32 5l19-87h16l22 88z','#c9c39b')+rep(8,i=>l(`M${-28+i*2} ${-i*10}h${47-i*4}`,'#7b816e',2));}
function shell(){return p('M-64 0q-5-48 29-70 -12-51 39-84 2 37 23 49 45 20 39 66 -6 33-38 44z','#a1b4a8')+p('M-57-5q-3-37 32-61 -8-50 25-75 -10 31 5 53 -25 33-28 83z','#e4d7b4')+rep(5,i=>l(`M${-48+20*i} -5q-11 -40 ${-3-i*3} -65`,'#738e86',3))+p('M-13 1q-4-40 14-50 21 15 16 50z',darkGreen);}
function rocket(){return p('M-21 0l1-94q2-44 21-67 21 27 23 63v64l19 31 -22-8 -7 15 -20 1 -9-14 -22 10z','#4d625e')+p('M-16-15l1-80q2-44 16-59l9 48 -4 94z',bone)+p('M-15-105q6-32 16-49l8 48z',red)+e(-4,-81,7,10,ink)+e(-5,-83,4,6,'#97beb4')+r(-16,-41,23,8,red)+l('M-46 3v-100m-14 99v-96m1 4 13 14-13 18 13 18-13 18 13 18',steel,4);}
function cannon(){return block(97,33)+p('M-41-34l19-20 35 1 117-54 9 13 -108 62 -32 15z',ink)+p('M-22-52l36 4 115-56 4 5 -114 62 -38 5z',steel)+l('M33-50l86-44',bone,3);}
function locomotive(){return block(120,25,'#435b57')+g(-33,-24,.75,block(49,43))+p('M-12-25v-19q0-8 11-9l49 1 7 7v18z','#667a6b')+r(26,-71,12,23,ink)+r(23,-74,18,5,steel)+rep(4,i=>e(-46+i*27,1,9,8,ink)+e(-46+i*27,0,5,4,'#ab9f7c'))+rep(3,i=>p(`M${-4+i*19} -51l4-1 3 26 -5 1z`,'#b39360'))+l('M-49-5l73 3 15-4','#c6b89b',3)+e(52,-38,5,6,gold);}
function airship(){return p('M-90-40q28-33 120-27l44 15 19-13 -5 27 -30 20 -49 8 -52-6z','#3b5556')+p('M-85-40q35-26 116-21l34 12 -31 16 -81 7z','#abc2ac')+p('M-60-36l99-13 -33 13 -46 8z',steel)+g(0,-14,.6,block(67,21))+p('M-49-28l-31 23 58-19 26-5z',bone);}
const outfits={cloud:['#524e76','#e5b853'],tifa:['#e6ddbe','#483831'],barret:['#776942','#513f34'],aerith:['#c67c7c','#79533b'],sephiroth:['#334249','#d5d6bf'],red:['#bd6b3b','#993e31'],zack:['#444d62','#343d43'],cub:['#cd9361','#a3553a']};
function puppet(who){
 if(who==='red'||who==='cub')return p('M-17-7l-8-8 -10-4 -3-8 7 0 4 6 18 6 16-9 10 2 3-7 5 5 5 11 -8 5 -4 11 -5 0 1-9 -14 1 -4 9 -6 0z',outfits[who][0])+e(21,-15,2,2,ink)+p('M-38-26l-1-10 6 4 2-4 3 11z',gold);
 let [coat,hair]=outfits[who], skin=who==='barret'?'#ab7960':'#d9aa81';
 return (who==='cloud'||who==='zack'?p('M-8-11l-22-39 1-17 15 11 16 39z','#687779')+p('M-9-16l-18-35 0-12 10 10 15 34z','#c8c8ac')+l('M-26-55l18 34','#e0d9ad',1.6)+e(-9,-22,1.7,1.8,'#68977f'):'')
 +r(-11,-11,8,12,ink)+r(3,-11,8,12,ink)+p('M-13-29l7-5 14 1 7 10 -6 4 4 11 -24-1 2-12 -9 6 -3-6z',coat)
 +p('M-12-29l6-4 3 5 -5 6 -5-1z','#8f9990')+p('M-10-14l20 1 1 4 -22-1z','#795d45')+r(-2,-14,5,4,bone)
 +p('M-12-3l8 1 -1 4 -10-1zM3-3l9-1 4 4 -13 2z','#554739')
 +e(0,-41,13,14,hair)+e(2,-39,9,10,skin)+p(who==='cloud'?'M-14-40l2-8 -8-4 9-2 -3-8 10 6 5-7 2 8 9-2 -2 7 -8 7 -1-5z':'M-13-41q-3-20 15-16 12 0 12 14l-6-5 -7 4 -6-1 -6 7z',hair)+e(-2.7,-40,1.55,1.95,ink)+e(5.6,-40,1.55,1.95,ink)+e(-3.1,-40.65,.54,.57,bone)+e(5.2,-40.65,.54,.57,bone)
 +l('M4-35l3-.4','#956b52',.8)
 +(who==='cloud'?p('M-12-29l5-4 7 3 -1 5 -9 3 -5-2z','#73838a')+e(-10,-27,1.2,1.2,bone)+l('M-1-28l6 11','#b08960',2.4)+p('M-13-48l-5-5 9 2 -1-7 8 7 4-6 1 6 -7 5z','#f6cd68'):'')
 +(who==='aerith'?p('M-10-21l13 1 7 18 -25-1z','#cf8e8a')+p('M-11-28l7-4 4 6 6-5 6 5 -2 6 -8-2 -12 1z','#983d39')+l('M-8-4l2-12m7 13 0-12','#ecc0a9',1.3):'')
 +(who==='tifa'?p('M-11-16l19 1 3 8 -24-1z','#493d3b')+l('M-6-30l2 12m9-12-2 13','#6e443b',2):'')
 +(who==='barret'?p('M-10-30l-7 1 -4 13 9 2 4-12z','#515451')+r(-21,-18,9,6,'#424647')+p('M-7-34l6 2 9-3 -3 7 -6 1z','#504238'):'')
 +(who==='aerith'?e(-9,-45,5,4,red)+g(12,-20,.3,blooms()):'')+(who==='sephiroth'?p('M-12-47l6-1 -1 21 -12 11z',hair)+l('M11-19l42-36','#cfcebf',2):'');
}
function blooms(){return rep(8,i=>{let x=Math.cos(i*2.4)*22,y=-5-Math.abs(Math.sin(i))*22;return l(`M${x*.5} 1L${x} ${y}`,darkGreen,1.8)+p(`M${x*.5} 0q-9-5-9-12 9 2 9 12z`,'#627544')+g(x,y,.62,rep(5,j=>e(Math.cos(j*1.256)*4.6,Math.sin(j*1.256)*3.3,4.5,3.8,i%3?'#e2b7a0':'#ac5050'))+e(0,0,2,2,gold));});}
function lamp(){return r(-2,-48,4,48,ink)+p('M-7-48l-2-12 8-7 9 6 -2 13z',ink)+r(-4,-59,8,9,gold);}
function meteor(){return p('M-21-8l70-99 -23 57 42-32 -55 78z',red)+p('M-19-9l60-81 -20 53z',gold)+e(-7,-2,31,29,'#ad6147')+p('M-34-10l13-16 13-2 -11 16 -5 17z','#e0a473');}
const props={broadleaf,gantry,crate,reactor,shinra,house:n=>house([red,'#798a76','#a38152'][n%3]),chapel,pine,rock,canyon:towerCanyon,temple,shell,rocket,cannon,train:locomotive,airship,flower:blooms,lamp,meteor,
 peak:()=>mountain('#918675'),ice:()=>mountain('#c5d1c7',true),crystal:()=>crystal(),black:()=>crystal('#534a63'),factory:n=>block(45+n%27,36+n%44,n%2?steel:'#888572'),
 ...Object.fromEntries(Object.keys(outfits).map(k=>[k,()=>puppet(k)]))};
// Each stage has its own ground inks, landmarks, supporting cast and vegetation.
const worlds=[
 ['#a7a68a','#737963','rail','factory','lamp',[['reactor',-185,-3,1.05],['reactor',175,-8,1],['shinra',0,-42,1.18],['train',-130,84,1],['barret',47,100,.88]]],
 ['#ac9577','#7b755d','rail','house','flower',[['factory',-180,-25,1.8],['chapel',40,4,1.25],['house',187,60,1.35],['aerith',24,86,.95],['tifa',-78,97,.85]]],
 ['#b2a385','#7e846a','path','pine','rock',[['peak',-145,-22,1.2],['peak',140,-28,1.15],['house',-62,35,1.35],['house',117,68,1.13],['sephiroth',30,53,1]]],
 ['#c9986e','#996f50','path','rock','canyon',[['canyon',-152,2,1.3],['canyon',145,-23,1.5],['canyon',-20,-59,.86],['red',63,84,1.1],['barret',-68,93,.9]]],
 ['#92a380','#657e62','path','pine','rock',[['temple',0,0,1.24],['crystal',-164,64,.83],['crystal',163,83,.69],['black',33,81,.38],['aerith',-54,96,.91]]],
 ['#82c2bb','#568e89','lake','shell','flower',[['shell',-168,7,.9],['shell',144,-25,1.1],['shell',-17,-47,.8],['aerith',23,65,.97],['sephiroth',56,28,1.08]]],
 ['#bbccca','#899fa0','crater','ice','crystal',[['ice',-140,-5,1.36],['ice',156,12,1.22],['crystal',4,37,1.35],['sephiroth',5,29,.83],['black',-45,84,.37]]],
 ['#72aaa0','#4d8d85','stream','crystal','rock',[['house',-147,11,1.23],['peak',151,-20,.85],['zack',80,47,.96],['tifa',-40,90,.92],['crystal',146,103,.62]]],
 ['#b7a580','#8b8768','path','house','pine',[['rocket',2,4,1.24],['house',-153,52,1.1],['factory',157,69,1.2],['airship',-133,-28,.72]]],
 ['#91978b','#687d74','rail','factory','lamp',[['shinra',-135,-15,.83],['cannon',53,39,1.25],['airship',150,-38,.7],['tifa',45,96,.92]]],
 ['#75877b','#506e64','crater','peak','crystal',[['ice',-153,-4,1.1],['peak',144,-15,1.24],['sephiroth',0,34,1.14],['meteor',83,9,1.05],['aerith',-94,78,.77]]],
 ['#9dac88','#70866c','path','pine','flower',[['reactor',-135,20,.8],['shinra',13,-14,.9],['pine',45,-3,1.4],['pine',-100,36,1.25],['red',-11,97,1.15],['cub',41,104,.66],['cub',62,99,.67]]]
];
export const sceneCount=worlds.length;
function printGround(theme,n){
 const [base,shade,kind]=theme;
 const edge=i=>-310+Math.sin(i*1.7+n)*6+Math.cos(i*.9)*9;
 let ground=p('M-750 '+edge(0)+rep(30,i=>' L'+(-700+i*50)+' '+edge(i+1))+'V340H-750Z',base);
 // Low printed weeds and mineral flecks collect in patches on the page.
 ground+=rep(75,i=>{
  const x=id(i+1,n+4)*1390-695,y=id(i+11,n+9)*598-290;
  return g(x,y,.52+id(i+16,3)*.62,rep(3,j=>{
   const dx=id(i+j,8)*22,dy=id(i,j+1)*7;
   return kind==='rail'?e(dx,dy,1.6,1,shade):l(`M${dx-3} ${dy-2}l3 2 1-5m0 4 4-3`,shade,1.1);
  }));
 });
 const road='M-76-340 C110-230 50-111 -38-22 S-105 181 -10 333';
 if(kind==='rail'){
 ground+=rep(7,i=>l(`M-720 ${i*98-280}l1440 -21`,shade,2))+rep(12,i=>l(`M${i*125-750} -310l-24 635`,shade,1));
 const line='M-740 62 Q-290 66 -100 80 T740 122';
 ground+=l(line,shade,36)+rep(74,i=>{let x=i*20-740;return l(`M${x} ${82+x*.05-13}l-8 29`,'#7a715f',6);})+l(line,ink,20)+l(line,'#aba78c',15)+l(line,'#756f5e',11);
 }else if(kind==='lake'||kind==='crater'){
 ground+=e(0,34,251,98,shade)+e(0,27,229,83,kind==='lake'?'#69a29d':'#566d6b')+e(0,21,192,63,kind==='lake'?'#79b5ae':'#435a5a');
 ground+=rep(9,i=>e(-105+i*13,115-i*10,19-i*.6,5,base));
 }else{
 ground+=l(road,shade,kind==='stream'?85:63)+l(road,kind==='stream'?'#a5cead':'#cfba91',kind==='stream'?67:53);
 }
 ground+=p('M-750 '+edge(0)+rep(30,i=>' L'+(-700+i*50)+' '+edge(i+1))+ ' l0 3 '+rep(30,i=>' L'+(700-i*50)+' '+(edge(30-i)+3))+'Z',bone);
 if(n===0||n===9){
  // The plate is an eight-sector machine, with bolted seams and buried conduits.
  ground+=e(0,-36,249,87,shade)+e(0,-40,239,82,'#929b82')+e(0,-42,224,74,shade);
  for(let j=0;j<8;j++){
   const a=j*Math.PI/4+.24;
   ground+=l('M0 -42L'+Math.cos(a)*230+' '+(-42+Math.sin(a)*77),'#a6aa90',4);
  }
  for(const z of [-36,-25])ground+=l('M-580 '+z+'q125 -45 218 -4t175 4',ink,6)+l('M-580 '+(z-1)+'q125 -45 218 -4t175 4','#a7ab8e',3);
 }else if(kind==='path'){
  ground+=rep(18,i=>{let y=-260+i*31;return e(7+Math.sin(y*.011-.5)*69,y,9+i%3,3,'#af9d7b');});
 }
 // Pressed paving and cut banks give the landmarks a physical base.
 if(['rail','path','lake'].includes(kind)){
  const cy=kind==='rail'?-42:26, radius=kind==='rail'?225:144;
  for(let band=0;band<3;band++){
   const outer=radius+band*9,inner=outer-7,count=band%2?33:32;
   ground+=rep(count,i=>{
    const a=(i+.05+band*.37)*Math.PI*2/count,b=a+Math.PI*1.86/count;
    const at=(angle,r)=>[Math.cos(angle)*r,cy+Math.sin(angle)*r*.36].join(' ');
    const d='M'+at(a,outer)+'L'+at(b,outer)+' '+at(b,inner)+' '+at(a,inner)+'Z';
    return p(d,shade)+l('M'+at(a,outer)+'L'+at(b,outer),kind==='rail'?'#ccc5a4':'#e0d1a6',1);
   });
  }
 }
 ground+=`<rect x="-748" y="-306" width="1496" height="635" fill="url(#sheetLight)"/><rect x="-748" y="-306" width="1496" height="635" fill="url(#fiber)" opacity=".36"/>`;
 return ground;
}
export function stage(n){
 const theme=worlds[n], chosen=[...theme[5]];
 if([0,1,8,9].includes(n))chosen.push(['gantry',-117,-11,1],['crate',91,77,.76],['crate',115,73,.62],['lamp',-64,66,.8]);
 if([1,2,3,4,5,7,8,11].includes(n))chosen.push(['broadleaf',-195,73,.9],['broadleaf',203,52,1.05],['broadleaf',-94,-48,.82],['flower',94,73,1]);
 for(let i=0;i<32;i++){
 const side=i%2?1:-1,x=side*(224+id(i,n+1)*292),y=-187+id(i+1,n+2)*388;
 const dressing=[['factory','lamp','factory','reactor'],['house','lamp','flower','rock'],['pine','rock','pine','house'],['rock','pine','house','canyon'],['pine','crystal','rock','flower'],['pine','flower','rock','shell'],['ice','rock','crystal','rock'],['crystal','pine','rock','flower'],['house','lamp','pine','rock'],['factory','lamp','house','factory'],['rock','peak','crystal','rock'],['pine','flower','rock','pine']][n];
 chosen.push([dressing[i%4],x,y,.44+id(i,n+8)*.66]);}
 for(let i=0;i<13;i++){const x=(i%2?1:-1)*(102+id(i,n+6)*240),y=85+id(i,n+11)*111;chosen.push([n===1||n===5||n===11?'flower':'rock',x,y,.28+id(i,n)*.38]);}
 if(n!==11)chosen.push(['cloud',-20,112,.99]);
 const cards=chosen.sort((a,b)=>a[2]-b[2]).map(([kind,x,y,s],i)=>{
 const seed=i*17+n;
 const variant=kind==='reactor'?i%8+1:kind==='house'?seed%3:kind==='rock'?seed%2:['factory','pine','broadleaf'].includes(kind)?seed%23:0;
 return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})"><g data-kind="${kind}" data-x="${x.toFixed(1)}" data-scale="${s.toFixed(2)}" data-row="${y.toFixed(1)}"><ellipse class="shadow" cx="7" cy="1" rx="${['cloud','tifa','aerith','red','cub','zack','sephiroth','barret','flower'].includes(kind)?13:33}" ry="5" fill="#273b32" opacity=".23"/><g class="hinge"><use href="#piece-${kind}-${variant}" /></g></g></g>`;
 }).join('');
 return {ground:printGround(theme,n),cards};
}
export function definitions(){
 const variants=new Set();
 for(let n=0;n<worlds.length;n++)for(const match of stage(n).cards.matchAll(/href="#piece-([a-z]+)-(\d+)"/g))variants.add(match[1]+'-'+match[2]);
 return [...variants].map(key=>{const [kind,v]=key.split('-');return `<g id="piece-${key}">${props[kind](Number(v))}</g>`;}).join('');
}
