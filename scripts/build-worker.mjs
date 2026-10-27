import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
async function walk(path){const files=[];for(const e of await readdir(path,{withFileTypes:true})){if(e.isDirectory())files.push(...await walk(path+'/'+e.name));else if(e.name!=='sw.js')files.push(path+'/'+e.name);}return files;}
const files=await walk('dist'),hash=createHash('sha256');for(const f of files)hash.update(await readFile(f));const version=hash.digest('hex').slice(0,12);
const urls=files.map(f=>'./'+f.slice(5));
const worker=`
const CACHE='craft-guide-${version}';
const URLS=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);await cache.addAll(URLS);await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('craft-guide-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const hit=await caches.match(event.request);if(hit)return hit;
  try{return await fetch(event.request);}catch{
   if(event.request.mode==='navigate')return await caches.match(new URL('index.html',self.registration.scope))||Response.error();
   return Response.error();
  }
 })());
});`;
new Script(worker);await writeFile('dist/sw.js',worker);
