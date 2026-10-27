import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {extractArchive} from '../src/platform/archive.js';
test('archive extraction never silently truncates when cumulative budget exceeded',()=>{
 const bytes=zipSync({'data/demo/recipe/a.json':strToU8('{}'),'data/demo/recipe/b.json':strToU8('{}')});
 assert.throws(()=>extractArchive(bytes,{used:0,max:3}),/解析上限/);
 assert.equal(extractArchive(bytes,{used:0,max:10}).entries.length,2);
});
