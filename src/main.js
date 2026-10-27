import './ui/style.css';
import { freshState,migrateState,validateState } from './domain/state.js';
import { referenceCatalog,itemName } from './domain/reference.js';
import { searchItems,calculateMaterials } from './domain/catalog.js';
import { buildPrompt } from './domain/prompt.js';
import { createStorage,native,invoke } from './platform/storage.js';
import { chooseAndScan,finishScan } from './platform/scanner.js';
import { icon,itemIcon } from './ui/icons.js';

const root=document.querySelector('#app'),storage=createStorage();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID();
let state,loadError='',page='home',tab='instances',query='',selected='minecraft:hopper',quantity=1,bill=null,selections={},busy=false,aiBusy=false,aiStatus='',draftQuestion='',draftOnce='',consent=false;
let saveChain=Promise.resolve();
const env=()=>state.environments.find(e=>e.id===state.selectedEnv);
const catalog=()=>env().catalog??referenceCatalog;
async function transaction(change){
 const run=async()=>{if(loadError)throw Error('保存データを保護中です。復旧してから操作してください。');const next=structuredClone(state);change(next);validateState(next);await storage.save(next);state=next;};
 const p=saveChain.then(run);saveChain=p.catch(()=>{});await p;
}
function toast(message){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.setAttribute('role','status');el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),6000);}
function applyTheme(){document.documentElement.dataset.theme=state.settings.theme;document.documentElement.style.setProperty('--opacity',state.settings.opacity);document.documentElement.style.setProperty('--scale',state.settings.fontScale);}
function button(action,label,cls='',extra=''){return `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;}
function heading(title,desc){return `<div class="page-heading"><div class="eyebrow">YOUR PERSONAL CRAFTING COMPANION</div><h1>${title}</h1><p>${desc}</p></div>`;}
function render(){
 applyTheme();root.innerHTML=`<div class="shell ${state.settings.background?'':'no-bg'} ${page==='settings'?'no-chat':''}">
 <header class="topbar"><div class="brand">${icon('grass')}<div><strong>CRAFT GUIDE</strong><small>自分だけの攻略ガイド</small></div></div><div class="row"><span class="tag platform">${native()?'WINDOWS':'WEB'} / LOCAL FIRST</span>${button('theme-light','☀ ライト',state.settings.theme==='light'?'primary':'')}${button('theme-dark','☾ ダーク',state.settings.theme==='dark'?'primary':'')}</div></header>
 ${loadError?`<div class="error-banner" role="alert"><strong>保存データを保護しています</strong><p>${esc(loadError)}</p>${button('recover','前回のバックアップから復旧')} ${button('import','JSONバックアップから復元')}<small> 元の破損データを保持して復旧します。</small></div>`:''}
 <div class="workspace"><aside class="sidebar"><div class="eyebrow">PLAY ENVIRONMENTS</div><div class="environment-switch">${state.environments.map(e=>button('environment',`${icon(e.icon??'grass')}<span>${esc(e.name)}</span>`,e.id===state.selectedEnv?'active':'',`data-id="${esc(e.id)}" aria-pressed="${e.id===state.selectedEnv}"`)).join('')}</div>${button('add-env','＋ プレイ環境を追加','add-env')}
 <nav aria-label="メインメニュー">${[['home','home','ホーム'],['items','pickaxe','アイテム・レシピ'],['notes','book','攻略ノート'],['settings','settings','設定']].map(([p,i,n])=>button('navigate',`${icon(i)}${n}`,`nav-button ${p===page?'active':''}`,`data-page="${p}" ${p===page?'aria-current="page"':''}`)).join('')}</nav>
 <div class="sidebar-footer"><span class="offline-dot"></span>検索・計算・ノートはオフライン<br>AI送信時のみ通信します。<br><br><span class="eyebrow">CRAFT GUIDE / 0.1.0</span></div></aside>
 <main class="content" id="main-content">${page==='settings'?settingsView():page==='notes'?notesView():itemsView()}</main>${chatView()}</div></div><dialog id="modal"></dialog><input id="folder-input" type="file" webkitdirectory multiple class="hidden"><input id="backup-input" type="file" accept=".json,application/json" class="hidden">`;
 bindInputs();
}
function itemsView(){
 const c=catalog(),isHome=page==='home',results=searchItems(c,query),item=c.items.find(i=>i.id===selected),recipes=c.recipes.filter(r=>r.output===selected),r=recipes.find(r=>r.id===selections['recipe:'+selected])??recipes[0];
 return heading(isHome?'今日は何を作る？':'アイテム・レシピ',`${esc(env().name)}の情報を調べて、次の一歩へ。`)+`
 <form id="search-form" class="searchbox panel">${icon('search')}<input id="search" aria-label="アイテムを検索・質問する" placeholder="アイテム名・ID・MOD名で検索" value="${esc(query)}"><button class="primary" type="submit">検索</button></form>
 <div class="shortcuts">${button('show-items',`${icon('pickaxe')}<span>レシピを調べる<small>材料と使い道を確認</small></span>`,'shortcut panel')}${button('focus-calc',`${icon('ingot')}<span>素材を計算<small>中間素材もまとめて</small></span>`,'shortcut panel')}${button('focus-chat',`${icon('book')}<span>AIに相談<small>自分に合った説明で</small></span>`,'shortcut panel')}</div>
 <div class="row between"><span class="tag">${env().catalog?'ファイルから静的解析':'内蔵参考図鑑・実環境未確認'}</span><small>${c.items.length} アイテム / ${c.recipes.length} レシピ</small></div>
 ${query||!isHome?`<div class="section-label"><strong>検索結果 <span class="count">${results.length}</span></strong><small>表示上限 120件</small></div><div class="item-grid">${results.slice(0,120).map(i=>button('select-item',`${icon(itemIcon(i.id))}<span>${esc(i.name)}<small>${esc(i.mod)}</small></span>`,`item-button ${selected===i.id?'selected':''}`,`data-id="${esc(i.id)}"`)).join('')||'<div class="empty">一致するアイテムがありません。</div>'}</div>`:''}
 <div class="section-label"><strong>${isHome&&!query?'ピックアップ':'アイテム詳細'}</strong><small>材料はAIを使わず表示</small></div>
 ${item?`<section class="hero-card panel"><div class="item-header">${icon(itemIcon(item.id),'large')}<div><h2>${esc(item.name)}</h2><small class="mono">${esc(item.id)}</small></div></div>
 ${r?`<div class="recipe-columns"><div class="item-art">${icon(itemIcon(item.id),'large')}</div><div><h3>必要な素材 <span class="tag">完成数 ×${r.count}</span></h3>${r.ingredients.map(i=>`<div class="material-row">${icon(itemIcon(i.choices[0]))}<span>${esc(i.choices.map(id=>itemName(c,id)).join(' または '))}</span><strong>×${i.count}</strong></div>`).join('')}</div></div>
 <label class="field recipe-select">レシピ・設備<select id="recipe-choice">${recipes.map(v=>`<option value="${esc(v.id)}" ${v.id===r.id?'selected':''}>${esc(v.id)} / ${esc(v.type.split(':').pop())}</option>`).join('')}</select></label>
 <small class="mono">参照元: ${esc(r.source)}</small><div class="recipe-footer"><label for="quantity">作成個数</label><input id="quantity" type="number" min="1" max="100000" value="${quantity}">${button('calculate','必要素材を計算','primary')}${button('ask-item','使い方を相談')}</div>${bill?billView(c):''}`:`<div class="notice">対応するレシピはありません。採掘などで入手する素材、または未対応形式の可能性があります。</div>${button('ask-item','このアイテムについて相談')}`}
 <details><summary>このアイテムの使い道</summary>${c.recipes.filter(v=>v.ingredients.some(i=>i.choices.includes(selected))).slice(0,30).map(v=>button('select-item',esc(itemName(c,v.output)),'chip',`data-id="${esc(v.output)}"`)).join(' ')||'<small>対応する用途データがありません。</small>'}</details></section>`:'<div class="panel empty">一覧からアイテムを選んでください。<br>解析で情報が得られない場合は、設定から対象フォルダを確認してください。</div>'}
 <details class="footer-strip"><summary>解析範囲・注意事項 ${c.unsupported.length?`（未対応 ${c.unsupported.length} 件）`:''}</summary>${c.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}${c.unsupported.slice(0,30).map(w=>`<div class="mono">${esc(w)}</div>`).join('')}</details>`;
}
function billView(c){return `<div class="bill"><h3 class="bill-title">基礎素材の合計 <small>×${quantity} 個分</small></h3>${Object.entries(bill.materials).map(([id,n])=>`<div class="material-row">${icon(itemIcon(id))}<span>${esc(itemName(c,id))}</span><strong>×${n}</strong></div>`).join('')}
 ${bill.unresolved.map(u=>`<label class="field warning">${esc(u.label)} の選択が必要です<select class="material-choice" data-key="${esc(u.key)}"><option value="">選択してください</option>${u.options.map(o=>`<option value="${esc(o)}">${esc(itemName(c,o))}</option>`).join('')}</select></label>`).join('')}
 <p><small>燃料・設置設備は別途必要です。表示は静的レシピに基づく計算です。</small></p>${Object.keys(bill.surplus).length?`<small>余り: ${Object.entries(bill.surplus).map(([id,n])=>`${esc(itemName(c,id))} ×${n}`).join(' / ')}</small>`:''}${button('save-bill','この計算をノートに保存','chip')}</div>`;}
function notesView(){const notes=state.notes.filter(n=>n.envId===env().id);return heading('攻略ノート','調べたことも、次に作りたいものも。この環境だけの手帳。')+`<div class="notes-toolbar row between">${button('new-note','＋ ノートを書く','primary')}<span class="tag">${esc(env().name)} / ${notes.length} 件</span></div><div class="stack">${notes.map(n=>`<article class="note-card panel"><h3>${esc(n.title)}</h3><div class="pre">${esc(n.body)}</div><div class="row" style="margin-top:15px">${button('edit-note','編集','chip',`data-id="${esc(n.id)}"`)}${button('delete-note','削除','chip danger',`data-id="${esc(n.id)}"`)}</div></article>`).join('')||'<div class="empty panel">まだノートがありません。<br>レシピの計算結果やAIの説明も保存できます。</div>'}</div>`;}
function settingsView(){
 const tabs=[['instances','インスタンス管理'],['appearance','表示・テーマ'],['ai','AI連携'],['instructions','カスタム指示']];
 let body='';
 if(tab==='instances')body=`<div class="row between"><h2>プレイ環境を管理</h2>${button('add-env','＋ 環境を追加','primary')}</div><p class="muted">MODパックも自作構成も、インスタンス単位で登録します。</p><div class="environment-list">${state.environments.map(e=>`<article class="environment-card panel"><div class="row">${icon(e.icon??'grass')}<strong>${esc(e.name)}</strong><span class="tag">${e.catalog?'静的解析':'参考図鑑'}</span></div><small>${esc(e.minecraft??'バージョン未確認')} / ${esc(e.loader??'ローダー未確認')}</small><br><code class="mono">${esc(e.path||'ローカルパスなし（Web版は再選択が必要です）')}</code><div class="row">${button('edit-env','名前・進行状況を編集','chip',`data-id="${esc(e.id)}"`)}${button('rescan','再解析','chip',`data-id="${esc(e.id)}"`)} ${button('change-path','パス変更','chip',`data-id="${esc(e.id)}"`)}${button('remove-env','登録解除','chip danger',`data-id="${esc(e.id)}"`)}</div>${e.mods?.length?`<details><summary>MODファイル ${e.mods.length}件</summary><small class="pre">${esc(e.mods.join('\n'))}</small></details>`:''}</article>`).join('')}</div><div class="divider"></div><h2>バックアップ</h2><p class="muted">環境・ノート・指示をJSONで保存します。ローカルパスや会話も含むため、公開しないでください。</p><div class="row">${button('export','JSONを書き出す')}${button('import','JSONを読み込む')}</div>`;
 if(tab==='appearance')body=`<h2>表示を自分好みに</h2><div class="row">${button('theme-light','☀ ライト',state.settings.theme==='light'?'primary':'')}${button('theme-dark','☾ ダーク',state.settings.theme==='dark'?'primary':'')}</div><div class="divider"></div><div class="stack"><label class="field">パネルの不透明度 <span id="opacity-value">${Math.round(state.settings.opacity*100)}%</span><input id="opacity" type="range" min="0.65" max="1" step="0.01" value="${state.settings.opacity}"><small>100%にすると風景が透けなくなります。</small></label><label class="field">文字サイズ<select id="font-scale">${[[.85,'小さめ'],[1,'標準'],[1.15,'大きめ'],[1.3,'さらに大きく'],[1.5,'最大']].map(([v,n])=>`<option value="${v}" ${state.settings.fontScale===v?'selected':''}>${n}</option>`).join('')}</select></label><label class="checkline"><input id="background" type="checkbox" ${state.settings.background?'checked':''}>アプリ内の風景を表示する（ライト：平原／ダーク：洞窟）</label></div>`;
 if(tab==='instructions')body=`<h2>自分に合った説明にする</h2><form id="instructions-form" class="stack"><label class="field">全環境で共通の指示<textarea name="common" maxlength="20000">${esc(state.instructions.common)}</textarea></label><label class="field">${esc(env().name)} の指示<textarea name="environment" maxlength="20000" placeholder="例：初心者向け。効率より仕組みを理解したい。">${esc(env().instructions)}</textarea></label><small>共通 → 環境別 → 今回だけの順で、より具体的な指示を優先します。ChatGPT側の設定とは別に保存します。</small><button class="primary">指示を保存</button></form>`;
 if(tab==='ai')body=`<h2>追加課金なしのAI相談</h2><div class="notice">検索・計算・ノートにはAIを使いません。AIへの送信は、送信内容の確認と同意後に行います。</div><p class="muted">Windows版は、PCに導入済みの公式Codex CLIとChatGPT認証を使用します。APIキーは使いません。サブスクの利用枠を消費し、制限時は回復を待ちます。</p>${native()?button('ai-status','Codexの認証状態を確認'):'<p>Web版からCodex CLIを直接起動できません。「質問をコピー」でChatGPTに渡してください。</p>'}<p class="pre" role="status">${esc(aiStatus)}</p><details><summary>準備・送信データについて</summary><p>CLI未導入の場合は公式手順で導入し、ご自身で <code>codex login</code> を実行してください。アプリは認証情報を読み取りません。</p><p>送信対象は質問、必要なレシピ、共通・環境別・今回の指示、進行状況、同じ環境の直近の会話です。フォルダパスやMODファイル自体は送りません。</p><p>ネット接続が必要です。利用枠の残量はこの版では取得しません。モデルはCLIの既定を使用します。</p></details>`;
 return `<div class="settings-content">${heading('設定','環境、見た目、説明の好みを、ここから。')}<div class="tabs" role="tablist">${tabs.map(([id,name])=>button('tab',name,'',`role="tab" aria-selected="${tab===id}" data-tab="${id}"`)).join('')}</div><section class="setting-section panel" role="tabpanel">${body}</section></div>`;
}
function chatView(){const messages=state.messages.filter(m=>m.envId===env().id);return `<aside class="chat" aria-label="AI相談"><div class="chat-heading"><h2>${icon('book')}わかりやすく解説</h2><small>${esc(env().name)} ／ 自分に合った説明で</small></div><div class="chat-log" id="chat-log">${messages.length?messages.map(m=>`<article class="message ${m.role}"><small>${m.role==='user'?'あなた':'CRAFT GUIDE / AI回答・要確認'}</small><div class="pre">${esc(m.body)}</div>${m.role==='assistant'?button('save-message','ノートに保存','',`data-id="${esc(m.id)}"`):''}</article>`).join(''):`<div class="chat-welcome">${icon('book')}<h3>「わからない」を、<br>次の一歩に。</h3><p>機械の使い方や、次に作る設備を相談できます。</p><div class="flow">${icon('chest')}<span>→</span>${icon('hopper')}<span>→</span>${icon('chest')}</div><p><small>質問の送信前に、共有する内容を確認できます。</small></p></div>`}${aiBusy?'<div class="notice" role="status">回答を準備しています…（最大3分）</div>':''}</div><div class="chat-compose"><label class="field" for="question">相談する</label><textarea id="question" maxlength="4000" placeholder="例：ホッパーの使い方を教えて">${esc(draftQuestion)}</textarea><input class="once" id="once" maxlength="2000" aria-label="今回だけの指示" placeholder="今回だけの指示（例：短く説明）" value="${esc(draftOnce)}"><details id="prompt-details"><summary>適用する指示・送信内容を確認</summary><pre id="prompt-preview">質問を入力すると表示します。</pre></details>${native()?`<label class="checkline"><input type="checkbox" id="consent" ${consent?'checked':''}>この質問の関連データをCodex経由で送信することに同意する</label>`:''}<div class="actions">${button('copy-question','質問をコピー')}${native()?button('send-question',aiBusy?'回答中…':'AIに送信','primary',aiBusy?'disabled':''):''}</div><small>${native()?'追加購入・有料APIへの切替なし':'Web版はコピーしてChatGPTで相談できます。'}</small></div></aside>`;}
function bindInputs(){
 const on=(id,event,fn)=>document.getElementById(id)?.addEventListener(event,fn);
 on('search-form','submit',e=>{e.preventDefault();query=document.querySelector('#search').value.trim();page='items';render();});
 on('quantity','input',e=>quantity=Number(e.target.value));
 on('recipe-choice','change',e=>{selections['recipe:'+selected]=e.target.value;bill=null;render();});
 document.querySelectorAll('.material-choice').forEach(el=>el.addEventListener('change',()=>{selections[el.dataset.key]=el.value;compute();}));
 on('question','input',e=>{draftQuestion=e.target.value;updatePromptPreview();});on('once','input',e=>{draftOnce=e.target.value;updatePromptPreview();});on('consent','change',e=>consent=e.target.checked);
 on('opacity','input',e=>{document.documentElement.style.setProperty('--opacity',e.target.value);document.querySelector('#opacity-value').textContent=Math.round(e.target.value*100)+'%';});
 on('opacity','change',e=>safe(async()=>{await transaction(s=>s.settings.opacity=Number(e.target.value));}));
 on('font-scale','change',e=>safe(async()=>{await transaction(s=>s.settings.fontScale=Number(e.target.value));render();}));
 on('background','change',e=>safe(async()=>{await transaction(s=>s.settings.background=e.target.checked);render();}));
 on('instructions-form','submit',e=>{e.preventDefault();const d=new FormData(e.target);safe(async()=>{await transaction(s=>{s.instructions.common=d.get('common');s.environments.find(v=>v.id===s.selectedEnv).instructions=d.get('environment');});toast('指示を保存しました。');});});
 on('folder-input','change',e=>safe(()=>scanFiles(e.target.files)));
 on('backup-input','change',e=>safe(()=>importBackup(e.target.files[0])));
 updatePromptPreview();
}
function updatePromptPreview(){const target=document.querySelector('#prompt-preview');if(target){try{target.textContent=buildPrompt(state,env().id,draftQuestion,catalog(),draftOnce);}catch{target.textContent='質問を入力すると表示します。';}}}
async function safe(fn){try{await fn();}catch(e){toast(typeof e==='string'?e:e.message??'処理に失敗しました。');}}
function dialog(title,body){const el=document.querySelector('#modal');el.innerHTML=`<div class="row between"><h2>${esc(title)}</h2>${button('close-modal','閉じる','quiet')}</div><div class="body">${body}</div>`;el.showModal();return el;}
function noteDialog(note={title:'',body:''}){const el=dialog(note.id?'ノートを編集':'ノートを書く',`<form id="note-form" class="stack"><label class="field">タイトル<input name="title" required maxlength="200" value="${esc(note.title)}"></label><label class="field">本文<textarea name="body" required maxlength="100000" rows="9">${esc(note.body)}</textarea></label><button class="primary">保存する</button></form>`);el.querySelector('form').onsubmit=e=>{e.preventDefault();const d=new FormData(e.target);safe(async()=>{await transaction(s=>{const item={id:note.id??uid(),envId:s.selectedEnv,title:d.get('title').trim(),body:d.get('body')};if(!item.title)throw Error('タイトルを入力してください。');const i=s.notes.findIndex(n=>n.id===item.id);i<0?s.notes.push(item):s.notes[i]=item;});el.close();render();toast('ノートを保存しました。');});};}
let replaceEnv=null;
async function addEnvironment(id=null){replaceEnv=id;if(native()){await scanFiles();}else{document.querySelector('#folder-input').click();}}
async function scanFiles(files){
 if(busy)return;busy=true;toast('環境を解析しています。ゲームファイルは変更しません。');
 try{const raw=await chooseAndScan(files);if(!raw)return;const result=finishScan(raw);const editing=replaceEnv;
  const same=state.environments.find(e=>result.path&&e.path.toLowerCase()===result.path.toLowerCase()&&e.id!==editing);if(same)throw Error('このフォルダは「'+same.name+'」として登録済みです。');
  const existing=state.environments.find(e=>e.id===editing);const el=dialog(editing?'環境の解析を更新':'プレイ環境を追加',`<form class="stack"><label class="field">表示名<input name="name" required maxlength="120" value="${esc(existing?.name??result.name)}"></label><label class="field">アイコン<select name="icon"><option value="grass">草ブロック</option><option value="cave">洞窟</option><option value="chest">チェスト</option><option value="book">本</option></select></label><div class="notice">${result.catalog.items.length} アイテム / ${result.catalog.recipes.length} 対応レシピ / ${result.mods?.length??0} MODファイル<br>静的解析のため、ゲーム内での有効性は未確認です。</div><small>レシピが0件の場合、MODやデータパックが入った実際のゲームフォルダか確認してください。バニラの本体JARが含まれない環境では参考図鑑を別途利用できます。</small><button class="primary">${editing?'更新する':'追加する'}</button></form>`);
  el.querySelector('form').onsubmit=e=>{e.preventDefault();const d=new FormData(e.target);safe(async()=>{await transaction(s=>{const item={...existing,id:existing?.id??uid(),name:d.get('name').trim(),icon:d.get('icon'),path:result.path??'',instructions:existing?.instructions??'',progress:existing?.progress??'',catalog:result.catalog,mods:result.mods??[],minecraft:result.minecraft??'未確認',loader:result.loader??'未確認'};const i=s.environments.findIndex(v=>v.id===item.id);i<0?s.environments.push(item):s.environments[i]=item;s.selectedEnv=item.id;});query='';selected=catalog().items[0]?.id??'';bill=null;el.close();render();toast('環境を保存しました。');});};
 }finally{busy=false;replaceEnv=null;}
}
function editEnvironment(id){const e=state.environments.find(v=>v.id===id);const el=dialog('環境の設定',`<form class="stack"><label class="field">表示名<input name="name" maxlength="120" required value="${esc(e.name)}"></label><label class="field">進行状況・所持設備<textarea name="progress" maxlength="20000">${esc(e.progress)}</textarea></label><label class="field">環境別カスタム指示<textarea name="instructions" maxlength="20000">${esc(e.instructions)}</textarea></label><button class="primary">保存する</button></form>`);el.querySelector('form').onsubmit=event=>{event.preventDefault();const d=new FormData(event.target);safe(async()=>{await transaction(s=>{const item=s.environments.find(v=>v.id===id);item.name=d.get('name').trim();item.progress=d.get('progress');item.instructions=d.get('instructions');});el.close();render();});};}
function compute(){try{bill=calculateMaterials(catalog(),selected,quantity,selections);render();}catch(e){toast(e.message);}}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('クリップボードにコピーしました。');}catch{const el=dialog('コピーする内容',`<p>ブラウザが自動コピーを許可しませんでした。以下を選択してコピーしてください。</p><textarea class="full" rows="12" readonly>${esc(text)}</textarea>`);el.querySelector('textarea').select();}}
function exportBackup(){const data=JSON.stringify(state,null,2),url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`craft-guide-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function importBackup(file){if(!file)return;if(file.size>48*1024*1024)throw Error('バックアップの上限は48MBです。');const next=migrateState(JSON.parse(await file.text()));if(!confirm('現在のアプリデータを、選択したバックアップの内容に置き換えます。よろしいですか？'))return;if(loadError){await storage.restore(next);state=next;loadError='';}else await transaction(s=>{for(const k of Object.keys(s))delete s[k];Object.assign(s,next);});query='';selected=catalog().items[0]?.id??'';bill=null;render();toast('バックアップを読み込みました。');}
async function sendQuestion(){
 if(aiBusy)return;if(!consent)throw Error('送信内容を確認し、外部送信への同意にチェックしてください。');
 const id=env().id,q=draftQuestion,prompt=buildPrompt(state,id,q,catalog(),draftOnce);aiBusy=true;
 try{await transaction(s=>{s.messages.push({id:uid(),envId:id,role:'user',body:q});if(s.messages.length>1990)s.messages.splice(0,s.messages.length-1990);});draftQuestion='';draftOnce='';consent=false;render();const answer=await invoke('ask_guide',{prompt,consent:true});await transaction(s=>{if(s.environments.some(e=>e.id===id))s.messages.push({id:uid(),envId:id,role:'assistant',body:answer});});}
 finally{aiBusy=false;render();}
}
root.addEventListener('click',event=>{
 const b=event.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,id=b.dataset.id;
 safe(async()=>{
  if(action==='close-modal'){document.querySelector('#modal').close();return;}
  if(action==='navigate'){page=b.dataset.page;render();return;}
  if(action==='tab'){tab=b.dataset.tab;render();return;}
  if(action==='theme-light'||action==='theme-dark'){await transaction(s=>s.settings.theme=action==='theme-dark'?'dark':'light');render();return;}
  if(action==='environment'){await transaction(s=>s.selectedEnv=id);selected=catalog().items.some(i=>i.id==='minecraft:hopper')?'minecraft:hopper':catalog().items[0]?.id??'';query='';bill=null;selections={};draftQuestion='';draftOnce='';consent=false;render();return;}
  if(action==='show-items'){page='items';render();return;}
  if(action==='select-item'){selected=id;bill=null;selections={};render();return;}
  if(action==='focus-calc'){document.querySelector('#quantity')?.focus();return;}
  if(action==='calculate'){compute();return;}
  if(action==='focus-chat'){document.querySelector('#question')?.focus();return;}
  if(action==='ask-item'){draftQuestion=itemName(catalog(),selected)+'の使い方を教えて';render();document.querySelector('#question')?.focus();return;}
  if(action==='add-env'){await addEnvironment();return;}
  if(action==='edit-env'){editEnvironment(id);return;}
  if(action==='change-path'){await addEnvironment(id);return;}
  if(action==='rescan'){
   const e=state.environments.find(v=>v.id===id);
   if(native()&&e.path){const raw=await invoke('rescan_instance',{path:e.path});const r=finishScan(raw);await transaction(s=>Object.assign(s.environments.find(v=>v.id===id),{catalog:r.catalog,mods:r.mods,minecraft:r.minecraft,loader:r.loader}));bill=null;render();toast('再解析しました。パス変更は環境を追加し直してください。');}
   else await addEnvironment(id);return;
  }
  if(action==='remove-env'){
   if(state.environments.length===1)throw Error('最後の環境は解除できません。先に別の環境を追加してください。');
   if(!confirm('登録と、この環境のノート・会話を削除します。元のゲームファイルは削除しません。続行しますか？'))return;
   await transaction(s=>{s.environments=s.environments.filter(v=>v.id!==id);s.notes=s.notes.filter(v=>v.envId!==id);s.messages=s.messages.filter(v=>v.envId!==id);if(s.selectedEnv===id)s.selectedEnv=s.environments[0].id;});query='';bill=null;render();return;
  }
  if(action==='new-note'){noteDialog();return;}
  if(action==='edit-note'){noteDialog(state.notes.find(n=>n.id===id));return;}
  if(action==='delete-note'){if(confirm('このノートを削除しますか？')){await transaction(s=>s.notes=s.notes.filter(n=>n.id!==id));render();}return;}
  if(action==='save-message'){noteDialog({title:'AIの解説',body:state.messages.find(m=>m.id===id).body});return;}
  if(action==='save-bill'){noteDialog({title:itemName(catalog(),selected)+' ×'+quantity+' の必要素材',body:Object.entries(bill.materials).map(([i,n])=>`${itemName(catalog(),i)} ×${n}`).join('\n')+'\n\n静的レシピに基づく計算。燃料・設備は別途。'});return;}
  if(action==='export'){exportBackup();return;}
  if(action==='import'){document.querySelector('#backup-input').click();return;}
  if(action==='recover'){if(confirm('前回保存のバックアップから復旧しますか？破損した元データも保持します。')){state=await storage.recover();loadError='';render();}return;}
  if(action==='ai-status'){aiStatus='認証状態を確認しています…';render();try{aiStatus=await invoke('ai_status');}catch(e){aiStatus=String(e);}render();return;}
  if(action==='copy-question'){await copy(buildPrompt(state,env().id,draftQuestion,catalog(),draftOnce));return;}
  if(action==='send-question'){await sendQuestion();return;}
 });
});
try{state=await storage.load()??freshState();}catch(e){loadError=String(e.message??e);state=freshState();}
render();
// Service worker is limited to built Web deployments; no runtime network calls.
if(!native()&&import.meta.env.PROD&&'serviceWorker'in navigator)navigator.serviceWorker.register(new URL('sw.js',document.baseURI)).catch(()=>{});
