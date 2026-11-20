import {build} from 'esbuild';
await build({entryPoints:['adapters/ring/App.js'],bundle:true,format:'esm',target:['es2022'],minify:true,loader:{'.glsl':'text'},outfile:'adapters/ring/bundle.js'});
await build({entryPoints:['admin/app.js'],bundle:true,format:'esm',target:['es2022'],minify:true,outfile:'admin/admin.js',external:['../scripts/heif-decoder.js?v=1.6.7']});
await build({entryPoints:['admin/heif-decoder-entry.js'],bundle:true,format:'esm',target:['es2022'],minify:true,outfile:'scripts/heif-decoder.js'});
