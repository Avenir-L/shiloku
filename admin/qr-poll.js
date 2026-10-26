export function qrRetryDelay(error,failures){
 return [502,503,504].includes(error.status)&&failures<=3?3000*2**(failures-1):null;
}
