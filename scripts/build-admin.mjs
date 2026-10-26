import {build} from 'esbuild';
await build({entryPoints:['admin/app.js'],bundle:true,format:'esm',target:['es2022'],minify:true,outfile:'admin/admin.js'});
