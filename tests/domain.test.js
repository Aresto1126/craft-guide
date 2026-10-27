import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, validateState, migrateState } from '../src/domain/state.js';
import { parseEntries, calculateMaterials, searchItems } from '../src/domain/catalog.js';
import { buildPrompt } from '../src/domain/prompt.js';

test('round-trip and migration retain notes; unknown future version rejected', () => {
  const s=freshState(); assert.equal(validateState(s).version,1);
  assert.throws(()=>validateState({...s,version:99}),/バージョン/);
  const old={...s}; delete old.version; assert.equal(migrateState(old).version,1);
});
test('dangling notes, duplicate environments and malformed instructions rejected', () => {
  const s=freshState();
  assert.throws(()=>validateState({...s,notes:[{id:'x',envId:'missing',title:'a',body:'b'}]}),/環境/);
  assert.throws(()=>validateState({...s,environments:[s.environments[0],s.environments[0]]}),/重複/);
  assert.throws(()=>validateState({...s,instructions:{common:33}}),/指示/);
});
const entries=[
 {path:'assets/demo/lang/ja_jp.json',text:JSON.stringify({'item.demo.gear':'鉄の歯車'})},
 {path:'data/demo/recipes/gear.json',text:JSON.stringify({type:'minecraft:crafting_shaped',pattern:[' I ','III',' I '],key:{I:{item:'minecraft:iron_ingot'}},result:{item:'demo:gear',count:2}})},
 {path:'data/demo/recipe/frame.json',text:JSON.stringify({type:'minecraft:crafting_shapeless',ingredients:['demo:gear','demo:gear'],result:{id:'demo:frame',count:1}})},
 {path:'data/demo/recipes/machine.json',text:'{"type":"demo:machine","result":{"item":"demo:unknown"}}'}
];
test('parse both recipe paths, modern item strings, translation and unsupported recipes',()=>{
 const c=parseEntries(entries); assert.equal(c.recipes.length,2); assert.equal(c.unsupported.length,1);
 assert.equal(searchItems(c,'歯車')[0].id,'demo:gear');
 const bill=calculateMaterials(c,'demo:frame',3); assert.equal(bill.materials['minecraft:iron_ingot'],15);
});
test('calculation rounds batches and detects cycles and unresolved alternatives',()=>{
 const c=parseEntries(entries); assert.equal(calculateMaterials(c,'demo:gear',3).materials['minecraft:iron_ingot'],10);
 const cyc={recipes:[{id:'loop',output:'a',count:1,ingredients:[{choices:['a'],count:1}]}],tags:{}};
 assert.throws(()=>calculateMaterials(cyc,'a',1),/循環/);
 assert.throws(()=>calculateMaterials(c,'demo:gear',0),/個数/);
 const tag={recipes:[{id:'tag',output:'a',count:1,ingredients:[{choices:['#c:ingots'],count:1}]}],tags:{'c:ingots':['b','c']}};
 assert.equal(calculateMaterials(tag,'a',1).unresolved.length,1);
 assert.equal(calculateMaterials(tag,'a',1,{'#c:ingots':'b'}).materials.b,1);
});
test('prompt includes selected environment only, scoped instructions, no local paths',()=>{
 const s=freshState(); s.instructions.common='短く'; s.environments[0].instructions='初心者向け';
 s.environments.push({id:'secret',name:'別環境',path:'C:\\private',instructions:'秘密'});
 const p=buildPrompt(s,s.environments[0].id,'使い方',{items:[],recipes:[]},'今回だけ箇条書き');
 assert.match(p,/短く/); assert.match(p,/初心者/); assert.match(p,/今回だけ/); assert.doesNotMatch(p,/private|秘密/);
});
test('modern tag-string ingredients retain tag choices',()=>{
 const c=parseEntries([{path:'data/demo/recipe/tag.json',text:JSON.stringify({type:'minecraft:crafting_shapeless',ingredients:['#c:ingots/iron'],result:{id:'demo:part'}})}]);
 assert.equal(c.recipes.length,1);assert.equal(c.recipes[0].ingredients[0].choices[0],'#c:ingots/iron');
});
