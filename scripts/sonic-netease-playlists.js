import { fetchNeteaseCloud } from './sonic-netease-api.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function initSonicNeteasePlaylists({
  drawer,
  onPlaySong,
  getLocalSongs,
  onPlayLocalSong,
  getPlaybackState,
}) {
  if (!drawer) return;

  let sourceTab = 'local';
  let playlists = [];
  let activePlaylistId = null;
  let cloudSongs = [];
  let loading = false;

  drawer.innerHTML = `
    <div class="playlist-drawer-top">
      <div class="playlist-drawer-header">PLAYLISTS</div>
    </div>
    <div class="playlist-source-tabs">
      <button type="button" class="playlist-source-tab is-active" data-source="local">LOCAL</button>
      <button type="button" class="playlist-source-tab" data-source="netease">NETEASE</button>
    </div>
    <div class="playlist-source-panel" data-panel="local">
      <p class="netease-playlists-status" id="local-playlists-status"></p>
      <ul class="netease-cloud-results netease-playlists-songs" id="local-playlists-songs"></ul>
    </div>
    <div class="playlist-source-panel" data-panel="netease" hidden>
      <p class="netease-playlists-status" id="netease-playlists-status">Loading playlists…</p>
      <div class="netease-cloud-playlists" id="netease-playlists-list"></div>
      <ul class="netease-cloud-results netease-playlists-songs" id="netease-playlists-songs"></ul>
    </div>
  `;

  const localStatusEl = drawer.querySelector('#local-playlists-status');
  const localSongsEl = drawer.querySelector('#local-playlists-songs');
  const statusEl = drawer.querySelector('#netease-playlists-status');
  const playlistWrap = drawer.querySelector('#netease-playlists-list');
  const cloudSongsEl = drawer.querySelector('#netease-playlists-songs');
  const sourceTabs = drawer.querySelectorAll('.playlist-source-tab');
  const localPanel = drawer.querySelector('[data-panel="local"]');
  const neteasePanel = drawer.querySelector('[data-panel="netease"]');

  function setSourceTab(next) {
    sourceTab = next === 'netease' ? 'netease' : 'local';
    sourceTabs.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.source === sourceTab);
    });
    localPanel.hidden = sourceTab !== 'local';
    neteasePanel.hidden = sourceTab !== 'netease';
    if (sourceTab === 'local') renderLocalSongs();
    else if (!playlists.length) loadPlaylists();
    else {
      renderPlaylists();
      renderCloudSongs();
    }
  }

  sourceTabs.forEach((btn) => {
    btn.addEventListener('click', () => setSourceTab(btn.dataset.source));
  });

  function setNeteaseStatus(text) {
    if (statusEl) statusEl.textContent = text || '';
  }

  function setLocalStatus(text) {
    if (localStatusEl) localStatusEl.textContent = text || '';
  }

  function renderLocalSongs() {
    if (!localSongsEl) return;
    const list = typeof getLocalSongs === 'function' ? getLocalSongs() : [];
    const playback = typeof getPlaybackState === 'function'
      ? getPlaybackState()
      : { source: 'local', index: -1 };

    localSongsEl.innerHTML = '';
    list.forEach(({ song, index }) => {
      const li = document.createElement('li');
      li.className = 'netease-playlist-song';
      if (playback.source === 'local' && playback.index === index) {
        li.classList.add('is-active');
      }
      li.innerHTML = `<span class="netease-song-title">${song.title || song.name || ''}</span><span class="netease-song-artist">${song.artist || ''}</span>`;
      li.addEventListener('click', () => onPlayLocalSong?.(index));
      localSongsEl.appendChild(li);
    });

    if (!list.length) {
      setLocalStatus('No local tracks');
      return;
    }
    setLocalStatus(`${list.length} local tracks`);
  }

  function renderPlaylists() {
    playlistWrap.innerHTML = '';
    playlists.forEach((playlist) => {
      const btn = el(
        'button',
        `netease-cloud-playlist${activePlaylistId === playlist.id ? ' is-active' : ''}`,
        playlist.name,
      );
      btn.type = 'button';
      btn.addEventListener('click', () => {
        activePlaylistId = playlist.id;
        loadPlaylistSongs(playlist);
      });
      playlistWrap.appendChild(btn);
    });
  }

  function renderCloudSongs() {
    cloudSongsEl.innerHTML = '';
    cloudSongs.forEach((song) => {
      const li = document.createElement('li');
      li.className = 'netease-playlist-song';
      li.innerHTML = `<span class="netease-song-title">${song.name}</span><span class="netease-song-artist">${song.artist || ''}</span>`;
      li.addEventListener('click', () => onPlaySong?.(song));
      cloudSongsEl.appendChild(li);
    });
  }

  async function loadPlaylists() {
    if (loading) return;
    loading = true;
    setNeteaseStatus('Loading playlists…');
    try {
      const data = await fetchNeteaseCloud('/api/netease/playlists');
      playlists = data.playlists || [];
      activePlaylistId = null;
      cloudSongs = [];
      renderPlaylists();
      renderCloudSongs();
      if (!playlists.length) {
        setNeteaseStatus('No playlists found. Check your NetEase cookie in Settings.');
        return;
      }
      setNeteaseStatus('Select a playlist');
    } catch (error) {
      playlists = [];
      cloudSongs = [];
      renderPlaylists();
      renderCloudSongs();
      setNeteaseStatus(
        error.status === 401
          ? 'Cookie expired. Open Settings and save your NetEase cookie again.'
          : 'Failed to load playlists.',
      );
    } finally {
      loading = false;
    }
  }

  async function loadPlaylistSongs(playlist) {
    loading = true;
    setNeteaseStatus(`Loading “${playlist.name}”…`);
    try {
      const data = await fetchNeteaseCloud(
        `/api/netease/playlist?id=${encodeURIComponent(playlist.id)}&limit=100`,
      );
      cloudSongs = data.songs || [];
      renderPlaylists();
      renderCloudSongs();
      setNeteaseStatus(cloudSongs.length ? `${cloudSongs.length} tracks` : 'No playable songs in this playlist');
    } catch {
      setNeteaseStatus('Failed to load playlist tracks');
    } finally {
      loading = false;
    }
  }

  function refresh() {
    renderLocalSongs();
    if (sourceTab === 'netease') {
      renderPlaylists();
      renderCloudSongs();
    }
  }

  window.__loadNeteasePlaylists = () => {
    if (sourceTab === 'netease') loadPlaylists();
    else renderLocalSongs();
  };
  window.__refreshPlaylistsDrawer = refresh;

  setSourceTab('local');
  renderLocalSongs();

  return { loadPlaylists, refresh, setSourceTab };
}
