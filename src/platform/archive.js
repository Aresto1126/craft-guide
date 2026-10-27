import {unzipSync,strFromU8} from 'fflate';
export const relevant=p=>/data\/[^/]+\/(recipes?|tags\/items?)\/.+\.json$/.test(p)||/assets\/[^/]+\/lang\/(ja_jp|en_us)\.json$/.test(p)||/(fabric\.mod\.json|(?:neo)?mods\.toml|mcmod\.info|pack\.mcmeta|manifest\.json|mmc-pack\.json|instance\.cfg|version\.json)$/.test(p);
export function extractArchive(bytes,budget={used:0,max:48*1024*1024}){
 const warnings=[];
 const output=unzipSync(bytes,{filter:entry=>{
  if(!relevant(entry.name))return false;
  if(entry.originalSize>2*1024*1024){warnings.push('サイズ上限で省略: '+entry.name);return false;}
  if(budget.used+entry.originalSize>budget.max)throw Error('解析上限48MBに達しました。対象を分けてください。');
  budget.used+=entry.originalSize;return true;
 }});
 return {entries:Object.entries(output).map(([path,bytes])=>({path,text:strFromU8(bytes)})),warnings};
}
