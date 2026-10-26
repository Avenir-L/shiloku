export function mergeTrackMetadata(entry,details){
 if(!details||String(entry.neteaseId)!==String(details.id))return entry;
 const result={...entry};
 if(typeof details.name==='string'&&details.name.trim())result.title=details.name;
 const names=Array.isArray(details.artists)?details.artists.map(a=>a?.name).filter(n=>typeof n==='string'&&n.trim()):[];
 const artist=names.length?names.join(' / '):details.artist;
 if(typeof artist==='string'&&artist.trim())result.artist=artist;
 if(typeof details.album==='string'&&details.album.trim())result.album=details.album;
 if(names.length)result.artists=details.artists.map(a=>({id:a.id,name:a.name}));
 if(Number.isFinite(details.duration)&&details.duration>0)result.duration=details.duration;
 if(!entry.src&&typeof details.cover==='string'&&/^https:\/\//.test(details.cover))result.cover=details.cover;
 if(details.albumId)result.albumId=details.albumId;
 if(details.publishedAt)result.publishedAt=details.publishedAt;
 return result;
}
