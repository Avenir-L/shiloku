import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';

function keyBytes(key) {
  const bytes=Buffer.from(key || '', 'base64');
  if(bytes.length!==32) throw new Error('管理加密密钥尚未配置');
  return bytes;
}
export function seal(value, key) {
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',keyBytes(key),iv);
  cipher.setAAD(Buffer.from('shiloku:music:v1'));
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return {v:1,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),data:encrypted.toString('base64url')};
}
export function unseal(record,key) {
  if(record?.v!==1) throw new Error('不支持的凭据格式');
  const cipher=createDecipheriv('aes-256-gcm',keyBytes(key),Buffer.from(record.iv,'base64url'));
  cipher.setAAD(Buffer.from('shiloku:music:v1'));
  cipher.setAuthTag(Buffer.from(record.tag,'base64url'));
  return Buffer.concat([cipher.update(Buffer.from(record.data,'base64url')),cipher.final()]).toString('utf8');
}
