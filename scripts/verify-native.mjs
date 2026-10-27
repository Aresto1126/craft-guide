import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'craft-guide-native-'));
const proc=spawn(resolve('src-tauri/target/debug/craft-guide.exe'),[],{windowsHide:true,env:{...process.env,CRAFTGUIDE_TEST_DATA_DIR:dir,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9228'},stdio:'ignore'});
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:9228/json/version');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,'WebView2 debugging endpoint ready');
 browser=await chromium.connectOverCDP('http://127.0.0.1:9228');const context=browser.contexts()[0];let page=context.pages()[0];for(let i=0;!page&&i<40;i++){await new Promise(r=>setTimeout(r,200));page=context.pages()[0];}assert.ok(page);
 await page.getByRole('heading',{name:'今日は何を作る？'}).waitFor();assert.equal(await page.evaluate(()=>!!window.__TAURI_INTERNALS__),true);
 await page.getByRole('button',{name:'☾ ダーク',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.reload();await page.getByRole('heading',{name:'今日は何を作る？'}).waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 const saved=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));assert.equal(saved.settings.theme,'dark');
 // Registered test fixture authorizes a native rescan without opening a native folder dialog.
 saved.environments.push({id:'native-fixture',name:'ネイティブ解析テスト',path:resolve('tests/fixtures/instance'),instructions:'',progress:'',catalog:null});await writeFile(join(dir,'state.json'),JSON.stringify(saved));await page.reload();
 await page.getByRole('button',{name:'設定',exact:true}).click();const fixture=page.locator('.environment-card').filter({hasText:'ネイティブ解析テスト'});await fixture.getByRole('button',{name:'再解析',exact:true}).click();await page.getByRole('status').filter({hasText:'再解析しました'}).waitFor();
 const scanned=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));assert.equal(scanned.environments.find(e=>e.id==='native-fixture').catalog.recipes[0].output,'demo:gear');
 await page.getByRole('tab',{name:'AI連携'}).click();await page.getByRole('button',{name:'Codexの認証状態を確認'}).click();await page.getByRole('status').filter({hasText:'ChatGPT認証'}).waitFor({timeout:30000});
 await page.getByRole('button',{name:'ホーム',exact:true}).click();await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/windows-native.png',fullPage:true});
 let aiInference=false;
 if(process.env.CRAFTGUIDE_VERIFY_AI==='1'){
  const answer=await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('ask_guide',{prompt:'これはアプリ連携の接続試験です。ツールやファイルを使わず「接続確認済み」とだけ回答してください。',consent:true}));
  assert.match(answer,/接続確認済み/);aiInference=true;
 }
 await writeFile('artifacts/native-check.json',JSON.stringify({testDataDir:dir,webview2:true,saveReload:true,nativeScan:true,chatGPTAuthentication:true,aiInference},null,2));console.log('PASS: actual WebView2 startup, Rust JSON save/reload, native fixture scan, ChatGPT auth check. AI inference: '+aiInference+' (synthetic connection test only).');
}finally{if(browser)await browser.close();proc.kill();}
