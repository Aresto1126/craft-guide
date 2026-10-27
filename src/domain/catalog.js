const idPattern=/^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
function choices(v){
 if(typeof v==='string')return idPattern.test(v.startsWith('#')?v.slice(1):v)?[v]:[];
 if(Array.isArray(v))return [...new Set(v.flatMap(choices))];
 if(v?.item)return choices(v.item);
 if(v?.tag&&idPattern.test(v.tag))return ['#'+v.tag];
 return [];
}
const nice=id=>id.split(':').pop().replaceAll('_',' ');
export function parseEntries(entries){
 const recipes=new Map(), names={},tags={},unsupported=[],warnings=[], itemIds=new Set();
 const sorted=[...entries].sort((a,b)=>(/ja_jp/.test(a.path)?1:0)-(/ja_jp/.test(b.path)?1:0));
 for(const entry of sorted){
  const p=entry.path.replaceAll('\\','/');let d;
  try{d=JSON.parse(entry.text);}catch{if(p.endsWith('.json'))warnings.push('JSON解析失敗: '+p);continue;}
  if(/assets\/[^/]+\/lang\/(ja_jp|en_us)\.json$/.test(p)){
   for(const [key,value] of Object.entries(d)){const m=key.match(/^(?:item|block)\.([^.]+)\.(.+)$/);if(m&&typeof value==='string'){const id=m[1]+':'+m[2].replaceAll('.','/');names[id]=value;itemIds.add(id);}}continue;
  }
  const tag=p.match(/data\/([^/]+)\/tags\/items?\/(.+)\.json$/);
  if(tag){const k=tag[1]+':'+tag[2];const values=(d.values??[]).map(v=>typeof v==='string'?v:v.id).filter(v=>typeof v==='string');tags[k]=d.replace?values:[...(tags[k]??[]),...values];continue;}
  const m=p.match(/data\/([^/]+)\/recipes?\/(.+)\.json$/);if(!m)continue;
  const id=m[1]+':'+m[2];
  if(recipes.has(id))warnings.push('同じレシピIDがあります。有効なパック順は未確認: '+id);
  if(d.conditions||d['neoforge:conditions']||d['fabric:load_conditions']){unsupported.push(id+'（条件付き）');continue;}
  let inputs=[];
  if(d.type==='minecraft:crafting_shaped'){
   if(!Array.isArray(d.pattern)||!d.key){unsupported.push(id);continue;}
   const counts={};for(const row of d.pattern)for(const char of row)if(char!==' ')counts[char]=(counts[char]??0)+1;
   inputs=Object.entries(counts).map(([k,count])=>({choices:choices(d.key[k]),count}));
  }else if(d.type==='minecraft:crafting_shapeless')inputs=(d.ingredients??[]).map(i=>({choices:choices(i),count:1}));
  else if(['minecraft:smelting','minecraft:blasting','minecraft:smoking','minecraft:campfire_cooking','minecraft:stonecutting'].includes(d.type))inputs=[{choices:choices(d.ingredient),count:1}];
  else{unsupported.push(id+' ('+String(d.type)+')');continue;}
  const output=typeof d.result==='string'?d.result:d.result?.id??d.result?.item;
  const count=typeof d.result==='object'?(d.result.count??1):(d.count??1);
  if(!idPattern.test(output??'')||!Number.isSafeInteger(count)||count<1||!inputs.length||inputs.some(i=>!i.choices.length)){unsupported.push(id+'（形式未対応）');continue;}
  recipes.set(id,{id,output,count,ingredients:inputs,type:d.type,source:entry.source??p});itemIds.add(output);
  for(const i of inputs)for(const choice of i.choices)if(!choice.startsWith('#'))itemIds.add(choice);
 }
 warnings.push('静的解析データです。スクリプト・サーバー設定・有効パック順による変更は未確認です。');
 return {items:[...itemIds].map(id=>({id,name:names[id]??nice(id),mod:id.split(':')[0]})),recipes:[...recipes.values()],tags,unsupported,warnings};
}
export function searchItems(c,q){const words=q.trim().toLowerCase().split(/\s+/);return c.items.filter(i=>words.every(w=>(i.id+' '+i.name+' '+i.mod).toLowerCase().includes(w))).sort((a,b)=>a.name.localeCompare(b.name,'ja'));}
export function calculateMaterials(c,itemId,quantity,selections={}){
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100000)throw Error('個数は1〜100000の整数で指定してください。');
 const materials={},unresolved=[],steps=[],surplus={},inventory={};let visits=0;
 const add=(id,n)=>{materials[id]=(materials[id]??0)+n;if(!Number.isSafeInteger(materials[id]))throw Error('必要数量が大きすぎます。');};
 function expand(id,n,trail){
  if(++visits>10000||trail.length>80||!Number.isSafeInteger(n))throw Error('計算が複雑すぎます。中間素材から分けて計算してください。');
  if(trail.includes(id))throw Error('循環レシピを検出しました: '+id);
  const available=inventory[id]??0, used=Math.min(available,n);inventory[id]=available-used;n-=used;if(!n)return;
  const candidates=c.recipes.filter(r=>r.output===id),pick=selections['recipe:'+id];
  if(candidates.length>1&&!pick){unresolved.push({key:'recipe:'+id,label:id,options:candidates.map(r=>r.id)});add(id,n);return;}
  const r=pick?candidates.find(r=>r.id===pick):candidates[0];
  if(pick&&!r)throw Error('選択したレシピがありません。');
  if(!r){add(id,n);return;}
  const batches=Math.ceil(n/r.count),extra=batches*r.count-n;inventory[id]=(inventory[id]??0)+extra;
  steps.push({item:id,recipe:r.id,batches,extra});
  for(const ing of r.ingredients){
   const tag=ing.choices.length===1&&ing.choices[0].startsWith('#')?ing.choices[0]:null;
   const resolve=(value,seen=[])=>value.startsWith('#')?(seen.includes(value)?[]:(c.tags[value.slice(1)]??[]).flatMap(v=>resolve(v,[...seen,value]))):[value];
   const opts=[...new Set(ing.choices.flatMap(v=>resolve(v)))],key=tag??r.id+':'+ing.choices.join('|');
   const choice=selections[key]??(opts.length===1?opts[0]:null);
   if(!choice||!opts.includes(choice)){unresolved.push({key,label:tag??'材料を選択',options:opts});add(tag??ing.choices.join(' / '),batches*ing.count);}
   else expand(choice,batches*ing.count,[...trail,id]);
  }
 }
 expand(itemId,quantity,[]);for(const [k,v]of Object.entries(inventory))if(v)surplus[k]=v;
 return {materials,unresolved:[...new Map(unresolved.map(v=>[v.key,v])).values()],steps,surplus};
}
