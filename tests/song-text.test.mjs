import test from 'node:test';import assert from 'node:assert/strict';
import {appendSongText} from '../scripts/song-text.js';
test('untrusted song metadata is assigned as text, never parsed as HTML',()=>{
 const document={createElement(){return {set innerHTML(_){throw Error('HTML parser used')},set textContent(value){this.text=value}}}};
 const node={ownerDocument:document,children:[],append(...items){this.children.push(...items)}};
 const payload='<img src=x onerror=alert(1)>';
 appendSongText(node,payload,'<svg onload=alert(1)>');
 assert.equal(node.children.length,2);assert.equal(node.children[0].text,payload);assert.equal(node.children[1].text,'<svg onload=alert(1)>');
});
