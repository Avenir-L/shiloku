import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../scripts/home-themes.js', import.meta.url), 'utf8');
function setup(saved = 'original') {
    const elements = [];
    const pending = [];
    const styles = {};
    const element = () => ({dataset:{}, attrs:{}, children:[], textContent:'', setAttribute(k,v){this.attrs[k]=v;}, removeAttribute(k){delete this.attrs[k];}, append(...items){this.children.push(...items);}, addEventListener(k,fn){this[k]=fn;}, focus(){}});
    const picker = element(), status = element(), summary = element(), options = element();
    picker.querySelector = selector => selector === 'summary' ? summary : selector === '[role="status"]' ? status : options;
    const root = element();
    root.style = {setProperty(k,v){styles[k]=v;}};
    const storage = {value:saved,getItem(){return this.value;},setItem(k,v){this.value=v;}};
    const media = {matches:false,addEventListener(k,fn){this.change=fn;}};
    vm.runInNewContext(source, {
        document:{querySelector:()=>picker,documentElement:root,body:{classList:{add(){}}},addEventListener(){},createElement(){const e=element();elements.push(e);return e;}},
        localStorage:storage,matchMedia:()=>media,
        Image:class {set src(url){pending.push({url,ok:()=>this.onload(),fail:()=>this.onerror()});}},
    });
    return {root,styles,storage,pending,status,media,button:id=>elements.find(e=>e.dataset.theme===id)};
}
const flush = async () => { for(let i=0;i<5;i++) await Promise.resolve(); };
test('stale loads cannot override the latest theme and original remains available',async()=>{
    const s=setup();
    s.button('train').click();s.button('sky').click();
    s.pending[1].ok();await flush();s.pending[0].ok();await flush();
    assert.equal(s.root.dataset.homeTheme,'sky');assert.equal(s.storage.value,'sky');
    s.button('original').click();await flush();assert.equal(s.styles['--home-theme-image'],'none');
});
test('AVIF falls back to WebP and total failure preserves the previous theme',async()=>{
    const s=setup();s.button('train').click();s.pending[0].fail();await flush();
    assert.match(s.pending[1].url,/\.webp$/);s.pending[1].ok();await flush();
    s.button('sky').click();s.pending[2].fail();await flush();s.pending[3].fail();await flush();
    assert.equal(s.root.dataset.homeTheme,'train');assert.equal(s.storage.value,'train');assert.match(s.status.textContent,/失败/);
});
test('invalid saved values cannot request arbitrary URLs; viewport changes use mobile crop',async()=>{
    const s=setup('https://evil.invalid/image');assert.equal(s.pending.length,0);
    s.button('umbrella').click();s.pending[0].ok();await flush();
    s.media.matches=true;s.media.change();assert.match(s.pending[1].url, /umbrella-mobile\.avif$/);
});
test('horizon restores with its cropped high quality assets on desktop and mobile',async()=>{
    const s=setup('horizon');assert.match(s.pending[0].url,/admin-sky-desktop-20261027hq\.avif$/);
    s.pending[0].ok();await flush();assert.equal(s.root.dataset.homeTheme,'horizon');
    s.media.matches=true;s.media.change();assert.match(s.pending[1].url,/admin-sky-mobile-20261027hq\.avif$/);
});
