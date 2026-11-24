import {frames,sheetSize} from './cards.js';

// Each crop shares one decoded atlas. Its origin is the actual fold at the foot.
export function cardstock(){
 const [w,h]=sheetSize;
 const shapes=Object.entries(frames).map(([key,[x,y,width,height,u,v,sw]])=>{
  const scale=width/sw;
  return `<clipPath id="crop-${key}"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath><g id="${key}" clip-path="url(#crop-${key})"><use href="#atlas" transform="translate(${x-u*scale} ${y-v*scale}) scale(${scale})"/></g>`;
 });
 return `<image id="atlas" href="cards.webp" width="${w}" height="${h}"/>${shapes.join('')}
 <pattern id="fiber" width="253" height="201" patternUnits="userSpaceOnUse"><image href="paper.png" width="253" height="201" preserveAspectRatio="none"/></pattern>
 <radialGradient id="sheetLight" cx="26%" cy="34%" r="79%"><stop stop-color="#fff0bb" stop-opacity=".27"/><stop offset=".58" stop-color="#f7d7a1" stop-opacity=".04"/><stop offset="1" stop-color="#584833" stop-opacity=".21"/></radialGradient>
 <filter id="kraft" filterUnits="userSpaceOnUse" x="-160" y="-240" width="330" height="270" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".012 .016 .004 0 .66  .012 .016 .004 0 .54  .010 .014 .004 0 .38  0 0 0 1 0"/></filter>`;
}
