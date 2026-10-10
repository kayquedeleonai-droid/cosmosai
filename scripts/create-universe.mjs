// Deterministic, original vector background. No external image requests.
import { writeFileSync } from 'node:fs';
let seed=48273;
const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const stars=Array.from({length:1250},()=>{
  const x=(random()*1800).toFixed(2),y=(random()*1300).toFixed(2);
  const radius=(random()<.035?1.2+random():.2+random()*.65).toFixed(2);
  const opacity=(.1+random()*.45).toFixed(2);
  const color=['#d4dce8','#8593aa','#bccbd9','#b9b0a5'][Math.floor(random()*4)];
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}" opacity="${opacity}"/>`;
}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1300" viewBox="0 0 1800 1300">
<defs>
 <radialGradient id="base"><stop stop-color="#080e18"/><stop offset="1" stop-color="#020305"/></radialGradient>
 <radialGradient id="mist"><stop stop-color="#24505b" stop-opacity=".28"/><stop offset=".5" stop-color="#192e48" stop-opacity=".13"/><stop offset="1" stop-color="#060a14" stop-opacity="0"/></radialGradient>
 <filter id="nebula" x="-60%" y="-60%" width="220%" height="220%"><feTurbulence type="fractalNoise" baseFrequency=".009 .013" numOctaves="4" seed="41" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="180"/><feGaussianBlur stdDeviation="12"/></filter>
 <filter id="wisps" x="-60%" y="-60%" width="220%" height="220%"><feTurbulence type="fractalNoise" baseFrequency=".009 .011" numOctaves="4" seed="27" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="115"/><feGaussianBlur stdDeviation="3"/></filter>
 <radialGradient id="galaxy"><stop stop-color="#ded3b0" stop-opacity=".32"/><stop offset=".13" stop-color="#a7a59a" stop-opacity=".12"/><stop offset=".5" stop-color="#7f6f92" stop-opacity=".08"/><stop offset="1" stop-color="#080b15" stop-opacity="0"/></radialGradient>
 <radialGradient id="vignette"><stop offset=".25" stop-color="#020204" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient>
</defs>
<path fill="url(#base)" d="M0 0h1800v1300H0z"/>
<ellipse cx="1260" cy="650" rx="800" ry="850" fill="url(#mist)"/>
<g filter="url(#nebula)" fill="none">
 <path d="M1480-150C1020 120 1460 350 1120 510S1460 800 1000 1030 1290 1330 820 1400" stroke="#224359" stroke-width="92" opacity=".34"/>
 <path d="M1380-150C1000 200 1260 370 1110 590S1190 820 930 960 1180 1230 740 1420" stroke="#254741" stroke-width="39" opacity=".36"/>
 <path d="M530-70C630 290 220 380 380 630S690 860 340 1210" stroke="#42314d" stroke-width="77" opacity=".29"/>
 <path d="M1600 80C1310 340 1640 570 1400 840" stroke="#393147" stroke-width="68" opacity=".28"/>
</g>
<g filter="url(#wisps)" fill="none" stroke-width="7" opacity=".18">
 <path d="M1450-120C1040 180 1400 290 1110 520S1410 840 990 1080" stroke="#648072"/>
 <path d="M530 30C510 360 250 430 420 610S560 900 330 1160" stroke="#586071"/>
 <path d="M1490 160C1320 460 1510 650 1320 980" stroke="#717161"/>
</g>
${stars}
<ellipse cx="247" cy="315" rx="75" ry="35" transform="rotate(34 247 315)" fill="url(#galaxy)"/>
<ellipse cx="1470" cy="780" rx="100" ry="50" transform="rotate(-34 1470 780)" fill="url(#galaxy)"/>
<ellipse cx="412" cy="1080" rx="70" ry="35" transform="rotate(-18 412 1080)" fill="url(#galaxy)"/>
<path fill="url(#vignette)" d="M0 0h1800v1300H0z"/>
</svg>`;
writeFileSync(new URL('../public/cosmos-universe.svg',import.meta.url),svg);
