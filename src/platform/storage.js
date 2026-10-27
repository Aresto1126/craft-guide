import { migrateState, validateState } from '../domain/state.js';
export const native=()=>!!globalThis.__TAURI_INTERNALS__;
export async function invoke(command,args={}){const {invoke:call}=await import('@tauri-apps/api/core');return call(command,args);}
export class WebStorage{
 constructor(storage=globalThis.localStorage){this.storage=storage;this.key='craft-guide:v1';this.blocked=false;}
 async load(){
  try{const raw=this.storage.getItem(this.key);return raw===null?null:migrateState(JSON.parse(raw));}
  catch(e){this.blocked=true;throw Error('保存データが破損しているか読み込めません。元データは保持しています。 '+e.message);}
 }
 async save(s){
  if(this.blocked)throw Error('破損データを保護中のため保存できません。');
  validateState(s);
  try{
   const previous=this.storage.getItem(this.key);if(previous!==null){migrateState(JSON.parse(previous));this.storage.setItem(this.key+':backup',previous);}
   this.storage.setItem(this.key,JSON.stringify(s));
  }catch(e){throw Error('保存に失敗しました。既存データは保持しています。 '+e.message);}
 }
 async recover(){const raw=this.storage.getItem(this.key+':backup');if(!raw)throw Error('復旧用バックアップがありません。');const s=migrateState(JSON.parse(raw));const broken=this.storage.getItem(this.key);if(broken)this.storage.setItem(this.key+':damaged',broken);this.storage.setItem(this.key,raw);this.blocked=false;return s;}
 async restore(s){validateState(s);const old=this.storage.getItem(this.key);try{if(old!==null)this.storage.setItem(this.key+':damaged',old);this.storage.setItem(this.key,JSON.stringify(s));this.blocked=false;}catch(e){throw Error('バックアップの復元に失敗しました。元データは保持しています。 '+e.message);}}
}
export class NativeStorage{
 async load(){const raw=await invoke('load_data');return raw===null?null:migrateState(JSON.parse(raw));}
 async save(s){validateState(s);await invoke('save_data',{data:JSON.stringify(s)});}
 async recover(){return migrateState(JSON.parse(await invoke('recover_data')));}
 async restore(s){validateState(s);await invoke('restore_data',{data:JSON.stringify(s)});}
}
export const createStorage=()=>native()?new NativeStorage():new WebStorage();
