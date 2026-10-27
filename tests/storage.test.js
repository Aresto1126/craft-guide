import test from 'node:test';
import assert from 'node:assert/strict';
import { WebStorage } from '../src/platform/storage.js';
import { freshState } from '../src/domain/state.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
test('save/load and backup survive quota error',async()=>{
 const m=memory(),a=new WebStorage(m); const s=freshState(); await a.save(s); assert.equal((await a.load()).version,1);
 m.setItem=()=>{throw Error('quota')}; s.settings.theme='dark'; await assert.rejects(a.save(s),/保存/);
 assert.equal((await a.load()).settings.theme,'light');
});
test('corrupt data is never silently initialized or overwritten',async()=>{
 const m=memory();m.setItem('craft-guide:v1','broken');const a=new WebStorage(m);
 await assert.rejects(a.load(),/破損/);await assert.rejects(a.save(freshState()),/破損/);
 assert.equal(m.getItem('craft-guide:v1'),'broken');
});
test('explicit imported backup restores protected data while retaining damaged original',async()=>{
 const m=memory();m.setItem('craft-guide:v1','broken');const a=new WebStorage(m);await assert.rejects(a.load());
 assert.equal(typeof a.restore,'function');await a.restore(freshState());assert.equal((await a.load()).version,1);
 assert.equal(m.getItem('craft-guide:v1:damaged'),'broken');
});
