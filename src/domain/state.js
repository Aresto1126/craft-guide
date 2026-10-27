export function freshState(){ return {version:1,settings:{theme:'light',opacity:0.9,fontScale:1,background:true},instructions:{common:'結論から説明し、専門用語には短い説明を添えてください。'},environments:[{id:'reference',name:'バニラ参考図鑑',path:'',icon:'grass',instructions:'',progress:'',catalog:null}],selectedEnv:'reference',notes:[],messages:[]}; }
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max=20000)=>typeof v==='string'&&v.length<=max;
export function migrateState(value){
 if(!record(value))throw Error('データ構造が不正です。');
 const s=structuredClone(value); if(s.version===undefined)s.version=1;
 return validateState(s);
}
export function validateState(s){
 const fail=m=>{throw Error(m);};
 if(!record(s)||s.version!==1)fail('未対応の保存バージョンです。');
 if(!record(s.settings)||!['light','dark'].includes(s.settings.theme)||!Number.isFinite(s.settings.opacity)||s.settings.opacity<0.65||s.settings.opacity>1||!Number.isFinite(s.settings.fontScale)||s.settings.fontScale<0.85||s.settings.fontScale>1.5||typeof s.settings.background!=='boolean')fail('表示設定が不正です。');
 if(!record(s.instructions)||!text(s.instructions.common))fail('カスタム指示が不正です。');
 if(!Array.isArray(s.environments)||!s.environments.length||s.environments.length>100)fail('環境一覧が不正です。');
 const ids=new Set();
 for(const e of s.environments){
  if(!record(e)||!text(e.id,100)||!e.id||!text(e.name,120)||!e.name.trim()||!text(e.path??'',2000)||!text(e.instructions??'')||!text(e.progress??''))fail('環境の内容が不正です。');
  if(ids.has(e.id))fail('環境IDが重複しています。');ids.add(e.id);
  if(e.catalog)validateCatalog(e.catalog);
 }
 if(!ids.has(s.selectedEnv))fail('選択中の環境がありません。');
 for(const [key,limit] of [['notes',5000],['messages',2000]]){
  if(!Array.isArray(s[key])||s[key].length>limit)fail('保存件数が不正です。');
  const keys=new Set();
  for(const n of s[key]){
   if(!record(n)||!text(n.id,100)||keys.has(n.id)||!ids.has(n.envId))fail('ノート・会話の環境参照またはIDが不正です。');keys.add(n.id);
   if(key==='notes'&&(!text(n.title,200)||!text(n.body,100000)))fail('ノートが不正です。');
   if(key==='messages'&&(!['user','assistant'].includes(n.role)||!text(n.body,100000)))fail('会話が不正です。');
  }
 }
 return s;
}
export function validateCatalog(c){
 if(!record(c)||!Array.isArray(c.items)||!Array.isArray(c.recipes)||!record(c.tags)||!Array.isArray(c.unsupported)||!Array.isArray(c.warnings)||c.items.length>100000||c.recipes.length>50000)throw Error('図鑑データが不正です。');
 for(const i of c.items)if(!text(i.id,300)||!text(i.name,1000))throw Error('アイテム情報が不正です。');
 const ids=new Set();
 for(const r of c.recipes){
  if(!record(r)||!text(r.id,500)||ids.has(r.id)||!text(r.output,300)||!Number.isSafeInteger(r.count)||r.count<1||r.count>100000||!Array.isArray(r.ingredients)||r.ingredients.length>1000||!text(r.type,300)||!text(r.source,3000))throw Error('レシピ情報が不正です。');ids.add(r.id);
  for(const i of r.ingredients)if(!record(i)||!Array.isArray(i.choices)||!i.choices.length||i.choices.length>500||!i.choices.every(v=>text(v,300))||!Number.isSafeInteger(i.count)||i.count<1||i.count>100000)throw Error('材料情報が不正です。');
 }
 for(const [k,v] of Object.entries(c.tags))if(!text(k,300)||!Array.isArray(v)||v.length>10000||!v.every(x=>text(x,300)))throw Error('タグ情報が不正です。');
 if(!c.warnings.every(v=>text(v,3000))||!c.unsupported.every(v=>text(v,3000)))throw Error('解析情報が不正です。');
 return c;
}
