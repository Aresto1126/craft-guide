import {extractArchive,relevant} from './archive.js';
self.onmessage=async({data:files})=>{
 try{
  const entries=[],warnings=[],mods=[];let total=0;const root=files[0]?.webkitRelativePath.split('/')[0]??'選択フォルダ';
  for(const f of files){
   const path=f.webkitRelativePath||f.name;if(/(?:^|\/)(saves|logs|screenshots|backups)\//.test(path))continue;
   if(/\.(js|zs)$/.test(path)&&/kubejs|scripts/.test(path)){warnings.push('スクリプト変更は未評価: '+path);continue;}
   if(/\.(jar|zip)$/.test(path)){
    if(!/(?:^|\/)(mods|datapacks|versions)\//.test(path)&&!path.endsWith('.jar'))continue;
    if(f.size>128*1024*1024){warnings.push('サイズ上限で省略: '+f.name);continue;}
    try{
     const budget={used:total,max:48*1024*1024};const extracted=extractArchive(new Uint8Array(await f.arrayBuffer()),budget);total=budget.used;warnings.push(...extracted.warnings);
     for(const entry of extracted.entries)entries.push({...entry,source:f.name+'!'+entry.path});
     if(/\/mods\//.test(path))mods.push(f.name);
    }catch(e){if(e.message.includes('解析上限'))throw e;warnings.push('アーカイブを読み込めません: '+f.name);}
   }else if(relevant(path)&&f.size<2*1024*1024){total+=f.size;if(total>48*1024*1024)throw Error('解析上限48MBに達しました。対象を分けてください。');entries.push({path,text:await f.text(),source:path});}
   if(entries.length>30000)throw Error('解析ファイル数の上限に達しました。');
  }
  self.postMessage({result:{name:root,path:'',entries,warnings,mods,minecraft:'未確認',loader:mods.length?'MOD環境（ローダー未確認）':'未確認'}});
 }catch(e){self.postMessage({error:e.message});}
};
