import {readdir,mkdir,cp,rm} from 'node:fs/promises';
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
