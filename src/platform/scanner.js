import { parseEntries } from '../domain/catalog.js';
import { native,invoke } from './storage.js';
export async function chooseAndScan(files){
 if(native())return invoke('choose_instance');
 if(!files?.length)throw Error('インスタンスのフォルダを選択してください。');
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./scan-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{worker.terminate();data.error?reject(Error(data.error)):resolve(data.result);};
  worker.onerror=()=>{worker.terminate();reject(Error('解析処理に失敗しました。'));};worker.postMessage([...files]);
 });
}
export function finishScan(raw){const catalog=parseEntries(raw.entries);catalog.warnings.push(...(raw.warnings??[]));return {...raw,catalog,entries:undefined};}
