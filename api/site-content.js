import {createSiteContent} from './_lib/site-content.js';
export function createContentHandler({content=createSiteContent()}={}){
 return async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD'].includes(req.method))return res.status(405).json({error:'只支持读取公开内容'});
  try{
   if(req.query?.avatar==='1'){
    const {profile}=await content.read();
    res.setHeader('Cache-Control','no-store');res.setHeader('Location',profile.avatar);
    return res.status(302).end();
   }
   if(req.query?.image){
    const image=await content.image(String(req.query.image));
    res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    res.setHeader('Content-Type',image.type);res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
    return req.method==='HEAD'?res.status(200).end():res.status(200).end(image.bytes);
   }
   const data=await content.read();
   res.setHeader('Cache-Control','no-store');
   // Only public artwork metadata is sent to visitors.
   const result={profile:data.profile,gallery:data.gallery.filter(item=>!item.hidden),revision:data.revision};
   return req.method==='HEAD'?res.status(200).end():res.status(200).json(result);
  }catch(error){res.setHeader('Cache-Control','no-store');return res.status(error.status||503).json({error:error.status?error.message:'主站内容暂时无法读取'});}
 };
}
export default createContentHandler();
