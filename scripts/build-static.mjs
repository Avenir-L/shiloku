import {readdir,mkdir,cp,rm,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),out=new URL('../public/',import.meta.url);
// This is a fixed build output beneath the repository, never a caller-supplied path.
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const item of await readdir(root,{withFileTypes:true})){
 if(item.isFile()&&/\.(html|css|js|jpg|jpeg|png|webp|svg|ico|mp3|mp4|webm|lrc)$/.test(item.name))await cp(new URL(item.name,root),new URL(item.name,out));
}
for(const name of ['assets','bg-layers','fonts','gallery'])await cp(new URL(name+'/',root),new URL(name+'/',out),{recursive:true});
for(const name of ['status.json','guestbook.json'])await cp(new URL(name,root),new URL(name,out));
await mkdir(new URL('admin/',out),{recursive:true});
for(const name of ['index.html','admin.css','admin.js','login-background.webp'])await cp(new URL('admin/'+name,root),new URL('admin/'+name,out));
async function copyBrowserScripts(dir='scripts/'){
 for(const entry of await readdir(new URL(dir,root),{withFileTypes:true})){
  if(entry.isDirectory())await copyBrowserScripts(dir+entry.name+'/');
  else if(entry.name.endsWith('.js')){await mkdir(new URL(dir,out),{recursive:true});await cp(new URL(dir+entry.name,root),new URL(dir+entry.name,out))}
 }
}
await copyBrowserScripts();
// Recompute hashes from the emitted HTML on every build; future edits cannot
// accidentally leave a stale inline-script allowlist in production.
const home=new URL('index.html',out);
let html=(await readFile(home,'utf8')).replace(/\r\n?/g,'\n');
if(/\son\w+\s*=/.test(html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'')))throw Error('Inline event handlers are forbidden by the homepage CSP');
const hashes=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].filter(m=>m[1].trim()).map(m=>`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
const policy=`default-src 'self'; script-src 'self' https://cdn.jsdelivr.net ${hashes.join(' ')}; script-src-attr 'none'; style-src 'self' https: 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; media-src 'self' https: data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'`;
html=html.replace(/<head>/i,`<head>\n<meta http-equiv="Content-Security-Policy" content="${policy}">`);
await writeFile(home,html);
