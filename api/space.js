import {shield,createSingleFlight} from './_lib/request-guard.js';
import {createSpace} from './_lib/space.js';
import {createComments} from './_lib/space-comments.js';
export function createSpaceHandler({space=createSpace(),comments=createComments({space}),env=process.env}={}){
 const flight=createSingleFlight();
 return shield(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const isComments=req.query?.action==='comments';
  if(req.method!=='GET'&&!(isComments&&req.method==='POST'))return res.status(405).json({error:'不支持此操作'});
  try{
   if(isComments){
    const id=String(req.query.id||'');
    if(req.method==='GET')return res.status(200).json(await flight('comments:'+id+':'+Number(req.query.offset||0),()=>comments.list(id,{offset:Number(req.query.offset||0)})));
    const allowed=['https://www.shiloku.cn','https://shiloku.cn','https://shiloku.vercel.app',env.ADMIN_ORIGIN].filter(Boolean);
    const origin=req.headers.origin||'';
    const local=!env.VERCEL&&env.NODE_ENV!=='production'&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if(!allowed.includes(origin)&&!local)return res.status(403).json({error:'请求来源不受信任'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'需要 JSON 请求'});
    if(JSON.stringify(req.body||{}).length>5000)return res.status(413).json({error:'评论内容过长'});
    const ip=String(env.VERCEL?req.headers['x-vercel-forwarded-for']||'unknown':req.socket?.remoteAddress||'local').split(',')[0].trim();
    return res.status(201).json(await comments.add(id,req.body,ip));
   }
   const publicPost=({revision,...post})=>post;
   const result=req.query?.id
    ? {post:publicPost(await flight('post:'+String(req.query.id),()=>space.read(String(req.query.id))))}
    : await flight('list:'+Number(req.query?.offset||0),()=>space.list({offset:Number(req.query?.offset||0)}));
   return res.status(200).json(result.posts?{...result,posts:result.posts.map(publicPost)}:result);
  }catch(error){if(error.status===429)res.setHeader('Retry-After','600');return res.status(error.status||503).json({error:error.status?error.message:'日常暂时无法加载，请稍后重试'});}
 });
}
export default createSpaceHandler();
