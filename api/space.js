import {createSpace} from './_lib/space.js';
export function createSpaceHandler({space=createSpace()}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'此接口只支持读取公开说说'});
  try{return res.status(200).json(req.query?.id?{post:await space.read(String(req.query.id))}:await space.list({offset:Number(req.query?.offset||0)}));}
  catch(error){return res.status(error.status||503).json({error:error.status?error.message:'日常暂时无法加载，请稍后重试'});}
 };
}
export default createSpaceHandler();
