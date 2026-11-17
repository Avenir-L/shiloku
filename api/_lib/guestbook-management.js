const key='shiloku:guestbook:v1';
export async function deleteGuestbookMessage(store,id){
 if(typeof id!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(id))throw Object.assign(Error('留言标识无效'),{status:400});
 const rows=await store.command(['ZREVRANGE',key,0,79]);
 const raw=rows.find(row=>{try{return JSON.parse(row).id===id}catch{return false}});
 if(!raw)throw Object.assign(Error('留言不存在或已删除，请刷新列表'),{status:404});
 await store.command(['ZREM',key,raw]);return {ok:true};
}
