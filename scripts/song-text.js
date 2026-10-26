export function appendSongText(node,title,artist){
 const name=node.ownerDocument.createElement('span');name.className='netease-song-title';name.textContent=String(title||'');
 const by=node.ownerDocument.createElement('span');by.className='netease-song-artist';by.textContent=String(artist||'');
 node.append(name,by);
}
