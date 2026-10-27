import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('public/art',{recursive:true});
let seed=8421;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const rect=(x,y,w,h,c,o=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" opacity="${o}"/>`;
for(const dark of [false,true]){
 let a=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">`];
 if(!dark){
  a.push(rect(0,0,1600,1000,'#a6d8e7'),rect(1248,110,104,104,'#fff1bb'));
  for(const [x,y]of [[80,90],[500,150],[1050,70]])a.push(rect(x,y,170,22,'#e8f4ed'),rect(x+40,y-20,100,20,'#e8f4ed'));
  for(let layer=0;layer<3;layer++)for(let x=0;x<1600;x+=48){const y=390+layer*125+Math.round((Math.sin(x/180+layer)*70+rand()*25)/24)*24;a.push(rect(x,y,48,1000-y,['#6c9a86','#588f69','#507f49'][layer]),rect(x,y,48,16,['#9fbe83','#88ad67','#83a951'][layer]));}
  a.push(`<path d="M850 620h130v80h-55v70h80v95h130v135H480V890h220v-90h90v-90h60z" fill="#7fbac6"/>`);
  for(let i=0;i<50;i++){const x=Math.floor(rand()*100)*16,y=650+Math.floor(rand()*20)*16;a.push(rect(x,y,28,8,rand()>.5?'#719e50':'#a7b75d'));}
  for(const [x,y,s]of [[80,400,1.5],[1330,480,1.5],[330,560,1],[1120,580,.8],[500,440,.65]]){
   a.push(`<g transform="translate(${x} ${y}) scale(${s})">`,rect(48,50,24,150,'#72533d'),rect(48,50,8,150,'#8d6744'),rect(0,0,136,100,'#3e7048'),rect(16,-24,100,24,'#5a8b4f'),rect(0,0,48,48,'#69964f'),rect(88,60,48,40,'#305f43'),`</g>`);
  }
  for(let i=0;i<30;i++){const x=Math.floor(rand()*100)*16,y=780+Math.floor(rand()*12)*16;if(x>600&&x<1150)continue;a.push(rect(x+5,y+8,4,14,'#426641'),rect(x,y,14,8,i%3?'#eadb9a':'#f0eee0'));}
 }else{
  a.push(rect(0,0,1600,1000,'#17232a'));
  for(let y=0;y<1000;y+=64)for(let x=0;x<1600;x+=64){const edge=x<270||x>1300||y<170||y>820;const colors=edge?['#303c40','#354247','#28373c','#3b4649']:['#1b2a30','#203037','#22323a'];a.push(rect(x,y,64,64,colors[Math.floor(rand()*colors.length)]),rect(x+2,y+2,60,5,'#687074',.12));}
  a.push(`<path d="M340 0h100v210h-32v130h-36v-170h-32zM1100 0h80v220h-24v160h-30v-150h-26z" fill="#34434a"/>`);
  for(const [x,y]of [[80,320],[1340,240],[1460,650],[190,720]])for(let i=0;i<7;i++)a.push(rect(x+Math.floor(rand()*5)*12,y+Math.floor(rand()*5)*12,8,10,i%2?'#55a0a6':'#6c9694'));
  for(const [x,y]of [[250,600],[1300,500],[700,790]]){a.push(`<circle cx="${x}" cy="${y}" r="180" fill="#e9a04a" opacity=".07"/>`,rect(x,y,8,42,'#9c754c'),rect(x-4,y-16,16,22,'#f0b75e'),rect(x,y-12,8,14,'#ffe2a0'));}
  a.push(`<path d="M900 900h70v30h150v35h210v35H850z" fill="#b56d39" opacity=".6"/>`);
 }
 a.push('</svg>');await writeFile(`public/art/${dark?'cave':'plains'}.svg`,a.join(''));
}
// Original 32x32 RGBA ICO, no external icon dependency.
const size=32,pixels=Buffer.alloc(size*size*4),andMask=Buffer.alloc(size*4);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const p=((size-1-y)*size+x)*4;const top=y<11;const c=top?((x+y)%5?[88,146,66]:[130,174,77]):((x*7+y*3)%6?[112,78,49]:[141,102,61]);pixels[p]=c[2];pixels[p+1]=c[1];pixels[p+2]=c[0];pixels[p+3]=255;}
const dib=Buffer.alloc(40);dib.writeUInt32LE(40);dib.writeInt32LE(size,4);dib.writeInt32LE(size*2,8);dib.writeUInt16LE(1,12);dib.writeUInt16LE(32,14);dib.writeUInt32LE(pixels.length,20);
const hdr=Buffer.alloc(22);hdr.writeUInt16LE(1,2);hdr.writeUInt16LE(1,4);hdr[6]=size;hdr[7]=size;hdr.writeUInt16LE(1,10);hdr.writeUInt16LE(32,12);hdr.writeUInt32LE(dib.length+pixels.length+andMask.length,14);hdr.writeUInt32LE(22,18);
await mkdir('src-tauri/icons',{recursive:true});await writeFile('src-tauri/icons/icon.ico',Buffer.concat([hdr,dib,pixels,andMask]));
