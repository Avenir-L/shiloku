// Component startup only. The original native player functions and listeners
// are loaded verbatim; account providers / app updater / saved queues are not
// started for this local Shiloku dataset. No transport or auto-hide reimplementation.
applySavedLyricPaletteState();
fx.particleLyrics=true;
createLyricsParticles();
bindVolumeControls();
setVolume(.35,false);
bindPlayerControlAnimations();
initControlGlassSurface();
controlsAutoHide=true;
shelfPinnedOpen=false;
controlsShelfSuppressUntil=0;
applyControlsAutoHidePreference();

function prepareRoomQueue(songs) {
  songs = Array.isArray(songs) ? songs.filter(Boolean) : [];
  if (!songs.length) return false;
  homeForcedOpen = false;
  homeSuppressed = false;
  setHomeControlsLocked(false);
  playQueue = songs.map(cloneSong);
  currentIdx = 0;
  currentLocalSong = null;
  activeRadioContext = null;
  safeRenderQueuePanel('local-import', { scrollCurrent: miniQueueOpen });
  safeShelfRebuild('local-import', true);
  forcePlaybackControlsInteractive();
  updateEmptyHomeVisibility({ forceLoad: false });
  setPlayIcon(false);
  return true;
}

/* The shell supplies one provider. Keep MineRadio's debounce, rendering and queue. */
fetchMusicSearchResults = async function(query) {
  const origin = ['localhost','127.0.0.1'].includes(location.hostname) ? 'https://shiloku.cn' : location.origin;
  const endpoint = origin + '/api/netease/';
  const response = await fetch(endpoint+'search?keywords='+encodeURIComponent(query), {credentials:'omit'});
  if (!response.ok) throw new Error('网易云搜索暂不可用');
  const data = await response.json();
  return {songs:data.songs.map(song => ({
    ...song, provider:'netease', source:'local', type:'local', localKey:'netease-'+song.id,
    duration:song.duration/1000, localUrl:endpoint+'audio?id='+encodeURIComponent(song.id),
    officialOnly: ![0,8].includes(song.fee)
  }))};
};
const nativePlayResult = playSearchResult;
const nativeQueueResult = queueSearchResult;
function officialSearchAction(i, action) {
  const song = playlist[i];
  if (song?.officialOnly) {
    window.open('https://music.163.com/song?id='+encodeURIComponent(song.id),'_blank','noopener,noreferrer');
    return;
  }
  action(i);
}
playSearchResult = i => officialSearchAction(i,nativePlayResult);
queueSearchResult = i => officialSearchAction(i,nativeQueueResult);
const originalRow = searchSongResultHtml;
searchSongResultHtml = (song,i) => song.officialOnly
  ? originalRow(song,i).replace('<div class="search-result-meta">','<div class="search-result-meta">去网易云收听 · ').replace(/<button class="add-btn"[\s\S]*?<\/button>/,'')
  : originalRow(song,i);

refreshBuiltInPlaylists(true);
