import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.argv[2]??'https://aresto1126.github.io/craft-guide/';
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1500,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));const response=await page.goto(url);assert.equal(response.status(),200);
 await expect(page.getByRole('heading',{name:'今日は何を作る？'})).toBeVisible();
 await page.getByRole('button',{name:'☾ ダーク',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'必要素材を計算',exact:true}).click();await expect(page.locator('.bill')).toContainText('鉄鉱石');
 await page.getByRole('button',{name:'この計算をノートに保存'}).click();await page.getByLabel('タイトル',{exact:true}).fill('公開確認用ノート');await page.getByRole('button',{name:'保存する',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'攻略ノート',exact:true}).click();await expect(page.getByRole('heading',{name:'公開確認用ノート'})).toBeVisible();
 await page.getByRole('button',{name:'ホーム',exact:true}).click();await page.getByLabel('アイテムを検索・質問する').fill('ホッパー');await page.getByRole('button',{name:'検索',exact:true}).click();await expect(page.locator('.item-grid')).toContainText('ホッパー');
 const bg=await page.locator('.shell').evaluate(el=>getComputedStyle(el).backgroundImage);assert.match(bg,/\/craft-guide\/art\/cave\.svg/);
 assert.deepEqual(errors,[]);await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/public-dark.png',fullPage:true});
 await writeFile('artifacts/public-check.json',JSON.stringify({url,status:200,theme:true,search:true,calculation:true,noteSaveReload:true,subpathAssets:true,pageErrors:errors},null,2));console.log('PASS: actual public URL, theme, search, calculation, note save/reload, subpath scenery; zero page errors.');
}finally{await browser.close();}
