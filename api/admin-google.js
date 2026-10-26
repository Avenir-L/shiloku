import {createGoogleAuth} from './_lib/admin/google.js';

export function createGoogleCallback({google=createGoogleAuth()}={}) {
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
    if(req.method!=='GET')return res.status(405).end();
    try {
      if(req.query?.error)throw new Error('Google sign in cancelled');
      const result=await google.finish(req);
      res.setHeader('Set-Cookie',[result.cookie,result.clearCookie]);
      res.setHeader('Location','/admin/#music');
    }catch(error){
      res.setHeader('Set-Cookie',google.clearCookie());
      res.setHeader('Location',error.status===403?'/admin/?login=google-denied':'/admin/?login=google-error');
    }
    return res.status(303).end();
  };
}
export default createGoogleCallback();
