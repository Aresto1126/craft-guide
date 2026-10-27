import {test,expect} from '@playwright/test';
test('theme, opacity, font and instructions persist after reload',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'今日は何を作る？'})).toBeVisible();
 await page.getByRole('button',{name:'☾ ダーク',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('tab',{name:'表示・テーマ'}).click();
 await page.getByLabel('文字サイズ').selectOption('1.15');await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('tab',{name:'カスタム指示'}).click();
 await page.getByLabel('全環境で共通の指示').fill('短く、理由も説明');await page.getByRole('button',{name:'指示を保存'}).click();await expect(page.getByRole('status')).toContainText('保存');
 await page.getByRole('button',{name:'ホーム',exact:true}).click();await page.getByLabel('相談する',{exact:true}).fill('ホッパーの使い方');await page.getByText('適用する指示・送信内容を確認').click();await expect(page.locator('#prompt-preview')).toContainText('短く、理由も説明');
});
test('material calculation and note edit survive reload; malformed backup does not replace data',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'必要素材を計算',exact:true}).click();await expect(page.locator('.bill')).toContainText('鉄鉱石');
 await page.getByRole('button',{name:'この計算をノートに保存'}).click();await page.getByLabel('タイトル',{exact:true}).fill('ホッパー計画');await page.getByRole('button',{name:'保存する',exact:true}).click();
 await page.getByRole('button',{name:'攻略ノート',exact:true}).click();await expect(page.getByRole('heading',{name:'ホッパー計画'})).toBeVisible();await page.reload();
 await page.getByRole('button',{name:'攻略ノート',exact:true}).click();await expect(page.getByRole('heading',{name:'ホッパー計画'})).toBeVisible();
 await page.getByRole('button',{name:'設定',exact:true}).click();await page.locator('#backup-input').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});await expect(page.getByRole('status')).toContainText('バージョン');
 await page.getByRole('button',{name:'攻略ノート',exact:true}).click();await expect(page.getByRole('heading',{name:'ホッパー計画'})).toBeVisible();
});
test('web folder scan registers a real recipe and instructions isolate environments',async({page})=>{
 await page.goto('/');
 await page.locator('#folder-input').setInputFiles('tests/fixtures/instance');
 await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByLabel('表示名').fill('自作MOD');await page.getByRole('button',{name:'追加する',exact:true}).click();
 await page.getByLabel('アイテムを検索・質問する').fill('歯車');await page.getByRole('button',{name:'検索',exact:true}).click();await expect(page.locator('.item-grid')).toContainText('鉄の歯車');
 await page.getByRole('button',{name:'設定',exact:true}).click();await page.getByRole('tab',{name:'カスタム指示'}).click();await page.getByLabel('自作MOD の指示').fill('歯車専用の指示');await page.getByRole('button',{name:'指示を保存'}).click();
 await page.getByRole('button',{name:'バニラ参考図鑑',exact:true}).click();await page.getByRole('button',{name:'ホーム',exact:true}).click();await page.getByLabel('相談する',{exact:true}).fill('教えて');await page.getByText('適用する指示・送信内容を確認').click();await expect(page.locator('#prompt-preview')).not.toContainText('歯車専用');
});
test('corrupt saved data protected; UI does not silently overwrite it',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('craft-guide:v1','broken'));await page.reload();await expect(page.getByRole('alert')).toContainText('保護');await page.getByRole('button',{name:'☾ ダーク',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('craft-guide:v1'))).toBe('broken');
});
test('valid exported JSON can restore corruption even without automatic backup',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'☾ ダーク',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 const backup=await page.evaluate(()=>localStorage.getItem('craft-guide:v1'));
 await page.evaluate(()=>{localStorage.removeItem('craft-guide:v1:backup');localStorage.setItem('craft-guide:v1','broken')});await page.reload();
 page.on('dialog',dialog=>dialog.accept());await page.locator('#backup-input').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(backup)});
 await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.locator('html')).toHaveAttribute('data-theme','dark');expect(await page.evaluate(()=>localStorage.getItem('craft-guide:v1:damaged'))).toBe('broken');
});
test('no horizontal overflow at mobile width and no automatic external data requests',async({page})=>{
 const requests=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:1420')&&!r.url().startsWith('data:'))requests.push(r.url());});
 await page.setViewportSize({width:390,height:844});await page.goto('/');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(requests).toEqual([]);
});
