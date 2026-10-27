import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=(await readFile(new URL('../scripts/background-dissolve.js',import.meta.url),'utf8')).replace('export async function','async function');
function setup(reduced=false){
    const frames=new Map(),canvases=[],listeners=new Map();let next=0,appended=0;
    const context={scale(){},drawImage(){},clearRect(){}};
    const host={append(){appended++;}};
    const scope={innerWidth:390,innerHeight:844,devicePixelRatio:3,performance:{now:()=>0},matchMedia:()=>({matches:reduced}),
        getComputedStyle:()=>({opacity:'1',backgroundImage:'url("assets/old.avif")',backgroundPosition:'50% 50%',filter:'none'}),
        requestAnimationFrame(fn){frames.set(++next,fn);return next;},cancelAnimationFrame(id){frames.delete(id);},
        Image:class{naturalWidth=2912;naturalHeight=1368;set src(value){queueMicrotask(()=>this.onload());}},
        window:{addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k){listeners.delete(k);}},
        document:{hidden:false,body:{classList:{contains:()=>true}},getElementById:()=>({parentElement:host,getBoundingClientRect:()=>({left:-16,top:-34,width:422,height:912})}),
            createElement(){const c={setAttribute(){},getContext:()=>context,remove(){this.removed=true;}};canvases.push(c);return c;},
            addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k){listeners.delete(k);}},
    };
    vm.createContext(scope);vm.runInContext(code,scope);
    return {prepare:scope.prepareBackgroundDissolve,frames,canvases,listeners,scope,appended:()=>appended};
}
test('reduced motion skips canvas entirely',async()=>{const s=setup(true);assert.equal(await s.prepare(),null);assert.equal(s.canvases.length,0);});
test('animation ends and removes temporary surface and listeners',async()=>{
    const s=setup(),effect=await s.prepare({x:40,y:80});effect.play();assert.equal(s.appended(),1);
    assert.equal(s.canvases[0].width,585);assert.equal(s.frames.size,1);
    [...s.frames.values()][0](3000);assert.equal(s.canvases[0].removed,true);assert.equal(s.listeners.size,0);
});
test('cancel before playback and viewport interruption never leave a covering canvas',async()=>{
    const s=setup(),early=await s.prepare();early.cancel();early.play();assert.equal(s.appended(),0);
    const effect=await s.prepare();effect.play();s.listeners.get('resize')();
    assert.equal(s.canvases[2].removed,true);assert.equal(s.frames.size,0);assert.equal(s.listeners.size,0);
});
