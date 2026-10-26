// A software authenticator for isolated tests; never used by production code.
import {generateKeyPairSync,randomBytes,createHash,sign} from 'node:crypto';
import {encodeCBOR} from '@levischuck/tiny-cbor';
const sha=value=>createHash('sha256').update(value).digest();
export function testPasskey() {
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const jwk=publicKey.export({format:'jwk'}),id=randomBytes(32),idString=id.toString('base64url');
  let counter=0;
  const cose=encodeCBOR(new Map([[1,2],[3,-7],[-1,1],[-2,new Uint8Array(Buffer.from(jwk.x,'base64url'))],[-3,new Uint8Array(Buffer.from(jwk.y,'base64url'))]]));
  return {
    registration(options,origin) {
      const clientDataJSON=Buffer.from(JSON.stringify({type:'webauthn.create',challenge:options.challenge,origin,crossOrigin:false}));
      const len=Buffer.alloc(2);len.writeUInt16BE(id.length);
      const authData=Buffer.concat([sha(options.rp.id),Buffer.from([0x45]),Buffer.alloc(4),Buffer.alloc(16),len,id,Buffer.from(cose)]);
      const attestationObject=encodeCBOR(new Map([['fmt','none'],['attStmt',new Map()],['authData',new Uint8Array(authData)]]));
      return {id:idString,rawId:idString,type:'public-key',response:{clientDataJSON:clientDataJSON.toString('base64url'),attestationObject:Buffer.from(attestationObject).toString('base64url'),transports:['internal']},clientExtensionResults:{},authenticatorAttachment:'platform'};
    },
    authentication(options,origin) {
      const clientDataJSON=Buffer.from(JSON.stringify({type:'webauthn.get',challenge:options.challenge,origin,crossOrigin:false}));
      const count=Buffer.alloc(4);count.writeUInt32BE(++counter);
      const authData=Buffer.concat([sha(options.rpId),Buffer.from([5]),count]);
      const signature=sign('sha256',Buffer.concat([authData,sha(clientDataJSON)]),privateKey);
      return {id:idString,rawId:idString,type:'public-key',response:{clientDataJSON:clientDataJSON.toString('base64url'),authenticatorData:authData.toString('base64url'),signature:signature.toString('base64url')},clientExtensionResults:{},authenticatorAttachment:'platform'};
    },
  };
}
