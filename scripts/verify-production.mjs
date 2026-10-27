import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const prefix='/craft-guide/',base=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!url.startsWith(prefix))throw Error();let p=resolve(base,url.slice(prefix.length)||'index.html');if(!p.startsWith(base))throw Error();res.setHeader('Content-Type',mime[extname(p)]??'application/octet-stream');res.end(await readFile(p));}catch{res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(1430,'127.0.0.1',r));
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1500,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('Browser:',m.text());});page.setDefaultTimeout(15000);
 await page.goto('http://127.0.0.1:1430'+prefix);await page.getByRole('heading',{name:'今日は何を作る？'}).waitFor();
 assert.equal(await page.locator('.shell').evaluate(el=>getComputedStyle(el).backgroundImage.includes('/craft-guide/art/')),true);
 console.log('SW status',await page.evaluate(async()=>({secure:isSecureContext,registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:r.active?.state,installing:r.installing?.state}))})));
 await page.evaluate(async()=>{await Promise.race([(async()=>{await navigator.serviceWorker.ready;await new Promise(r=>{if(navigator.serviceWorker.controller)r();else navigator.serviceWorker.addEventListener('controllerchange',r,{once:true})});})(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Service worker did not become ready in 15s')),15000))]);});
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/light.png',fullPage:true});
 await page.getByRole('button',{name:'☾ ダーク',exact:true}).click();await page.screenshot({path:'artifacts/dark.png',fullPage:true});
 await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'今日は何を作る？'}).waitFor();await page.getByRole('button',{name:'必要素材を計算',exact:true}).click();assert.match(await page.locator('.bill').innerText(),/鉄鉱石/);assert.deepEqual(errors,[]);
 await writeFile('artifacts/production-check.json',JSON.stringify({subpath:prefix,offline:true,calculation:true,pageErrors:errors,screenshots:['light.png','dark.png']},null,2));
 console.log('PASS: production subpath, scenic assets, service worker offline reload, calculation; zero page errors.');
}finally{await browser.close();server.close();}
