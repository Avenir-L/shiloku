import { fetchNeteaseCloud } from './sonic-netease-api.js';

const CACHE_PREFIX = 'shiloku:netease:';
const CACHE_TTL_MS = 30 * 60 * 1000;

function readNeteaseCache(key) {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function writeNeteaseCache(key, data) {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    /* 存储满了就跳过 */
  }
}

/** 只展示这些网易云歌单，顺序固定 */
const ALLOWED_PLAYLIST_NAMES = [
  '独属于我的时光印记',
  '用音乐找回过去的自己',
  '俄语',
  'Speravenir的2024年度歌单',
  '夕日阪的2025年度歌单',
  '喜欢的音乐',
  '日本語',
  '悲伤',
  '有力量的歌单',
  'MIKU!',
  '术术术',
  '背景BGM',
  '华语',
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function filterAllowedPlaylists(all) {
  const list = all || [];
  const normalize = (value) => String(value || '').replace(/阪/g, '坂').replace(/\s/g, '');
  const findByName = (name) => {
    const exact = list.find((playlist) => playlist.name === name);
    if (exact) return exact;
    const target = normalize(name);
    return list.find((playlist) => normalize(playlist.name) === target);
  };
  return ALLOWED_PLAYLIST_NAMES.map(findByName).filter(Boolean);
}

function playlistCoverUrl(cover) {
  let url = String(cover || '').trim();
  if (!url) return '';
  if (url.startsWith('http://')) url = `https://${url.slice(7)}`;
  return url.includes('?') ? `${url}&param=80y80` : `${url}?param=80y80`;
}

function songMatchesQuery(song, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    song?.name,
    song?.title,
    song?.artist,
    song?.album,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function initSonicNeteasePlaylists({
  drawer,
  onPlaySong,
  onPlayPlaylistSong,
  getLocalSongs,
  onPlayLocalSong,
  getPlaybackState,
}) {
  if (!drawer) return;

  let sourceTab = 'local';
  let playlists = [];
  let activePlaylistId = null;
  let cloudSongs = [];
  let cloudSearchQuery = '';
  let localSearchQuery = '';
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
      <div class="playlist-track-search" id="local-playlist-search-wrap" hidden>
        <input type="search" id="local-playlist-search-input" placeholder="在本地列表中搜索…" autocomplete="off" enterkeyhint="search">
      </div>
      <ul class="netease-cloud-results netease-playlists-songs" id="local-playlists-songs"></ul>
    </div>
    <div class="playlist-source-panel" data-panel="netease" hidden>
      <div class="netease-playlist-section">
        <div class="netease-playlist-section-head">
          <span class="netease-playlist-section-title">创建的歌单</span>
          <span class="netease-playlist-section-count" id="netease-playlist-count">0</span>
        </div>
        <div class="netease-cloud-playlists" id="netease-playlists-list"></div>
      </div>
      <div class="netease-playlist-tracks-section">
        <p class="netease-playlists-status" id="netease-playlists-status">Loading playlists…</p>
        <div class="playlist-track-search" id="netease-playlist-search-wrap" hidden>
          <input type="search" id="netease-playlist-search-input" placeholder="在当前歌单内搜索…" autocomplete="off" enterkeyhint="search">
        </div>
        <ul class="netease-cloud-results netease-playlists-songs" id="netease-playlists-songs"></ul>
      </div>
    </div>
  `;

  const localStatusEl = drawer.querySelector('#local-playlists-status');
  const localSongsEl = drawer.querySelector('#local-playlists-songs');
  const statusEl = drawer.querySelector('#netease-playlists-status');
  const playlistCountEl = drawer.querySelector('#netease-playlist-count');
  const playlistWrap = drawer.querySelector('#netease-playlists-list');
  const cloudSongsEl = drawer.querySelector('#netease-playlists-songs');
  const cloudSearchWrap = drawer.querySelector('#netease-playlist-search-wrap');
  const cloudSearchInput = drawer.querySelector('#netease-playlist-search-input');
  const localSearchWrap = drawer.querySelector('#local-playlist-search-wrap');
  const localSearchInput = drawer.querySelector('#local-playlist-search-input');
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

  cloudSearchInput?.addEventListener('input', () => {
    cloudSearchQuery = cloudSearchInput.value;
    renderCloudSongs();
  });

  localSearchInput?.addEventListener('input', () => {
    localSearchQuery = localSearchInput.value;
    renderLocalSongs();
  });

  function clearCloudSearch() {
    cloudSearchQuery = '';
    if (cloudSearchInput) cloudSearchInput.value = '';
    if (cloudSearchWrap) cloudSearchWrap.hidden = true;
  }

  function clearLocalSearch() {
    localSearchQuery = '';
    if (localSearchInput) localSearchInput.value = '';
    if (localSearchWrap) localSearchWrap.hidden = true;
  }

  function updateCloudTrackStatus(shown, total) {
    if (!total) {
      setNeteaseStatus(activePlaylistId ? 'No playable songs in this playlist' : 'Select a playlist');
      return;
    }
    const q = cloudSearchQuery.trim();
    if (!q) {
      setNeteaseStatus(`${total} tracks`);
      return;
    }
    if (!shown) {
      setNeteaseStatus('No matches in this playlist');
      return;
    }
    setNeteaseStatus(`${shown} / ${total} tracks`);
  }

  function updateLocalTrackStatus(shown, total) {
    if (!total) {
      setLocalStatus('No local tracks');
      return;
    }
    const q = localSearchQuery.trim();
    if (!q) {
      setLocalStatus(`${total} local tracks`);
      return;
    }
    if (!shown) {
      setLocalStatus('No matches in local list');
      return;
    }
    setLocalStatus(`${shown} / ${total} local tracks`);
  }

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
    const filtered = list.filter(({ song }) => songMatchesQuery(song, localSearchQuery));

    if (localSearchWrap) localSearchWrap.hidden = list.length === 0;

    localSongsEl.innerHTML = '';
    filtered.forEach(({ song, index }) => {
      const li = document.createElement('li');
      li.className = 'netease-playlist-song';
      if (playback.source === 'local' && playback.index === index) {
        li.classList.add('is-active');
      }
      li.innerHTML = `<span class="netease-song-title">${song.title || song.name || ''}</span><span class="netease-song-artist">${song.artist || ''}</span>`;
      li.addEventListener('click', () => onPlayLocalSong?.(index));
      localSongsEl.appendChild(li);
    });

    updateLocalTrackStatus(filtered.length, list.length);
  }

  function renderPlaylists() {
    if (!playlistWrap) return;
    playlistWrap.innerHTML = '';
    if (playlistCountEl) playlistCountEl.textContent = String(playlists.length);

    playlists.forEach((playlist) => {
      const btn = el(
        'button',
        `netease-cloud-playlist${activePlaylistId === playlist.id ? ' is-active' : ''}`,
      );
      btn.type = 'button';

      const cover = document.createElement('img');
      cover.className = 'netease-playlist-cover';
      cover.alt = '';
      cover.loading = 'lazy';
      cover.decoding = 'async';
      const coverSrc = playlistCoverUrl(playlist.cover);
      if (coverSrc) {
        cover.src = coverSrc;
        cover.addEventListener('error', () => {
          cover.removeAttribute('src');
          cover.classList.add('is-placeholder');
        }, { once: true });
      } else {
        cover.classList.add('is-placeholder');
      }

      const meta = el('span', 'netease-playlist-meta');
      const name = el('span', 'netease-playlist-name', playlist.name);
      meta.appendChild(name);

      btn.appendChild(cover);
      btn.appendChild(meta);
      btn.addEventListener('click', () => {
        activePlaylistId = playlist.id;
        loadPlaylistSongs(playlist);
      });
      playlistWrap.appendChild(btn);
    });
  }

  function renderCloudSongs() {
    if (!cloudSongsEl) return;
    const filtered = cloudSongs.filter((song) => songMatchesQuery(song, cloudSearchQuery));
    const playback = typeof getPlaybackState === 'function'
      ? getPlaybackState()
      : { source: 'local', neteaseId: null, playlistId: null };

    if (cloudSearchWrap) cloudSearchWrap.hidden = !activePlaylistId || cloudSongs.length === 0;

    cloudSongsEl.innerHTML = '';
    filtered.forEach((song) => {
      const li = document.createElement('li');
      li.className = 'netease-playlist-song';
      if (
        playback.source === 'netease'
        && playback.playlistId === activePlaylistId
        && playback.neteaseId != null
        && String(playback.neteaseId) === String(song.id)
      ) {
        li.classList.add('is-active');
      }
      li.innerHTML = `<span class="netease-song-title">${song.name}</span><span class="netease-song-artist">${song.artist || ''}</span>`;
      li.addEventListener('click', () => {
        const playlist = playlists.find((item) => item.id === activePlaylistId) || null;
        if (onPlayPlaylistSong) {
          onPlayPlaylistSong(song, { playlist, songs: cloudSongs });
          return;
        }
        onPlaySong?.(song);
      });
      cloudSongsEl.appendChild(li);
    });

    updateCloudTrackStatus(filtered.length, cloudSongs.length);
  }

  async function loadPlaylists({ silent = false } = {}) {
    const cachedAll = readNeteaseCache('playlists');
    if (cachedAll?.length && !playlists.length) {
      playlists = filterAllowedPlaylists(cachedAll);
      renderPlaylists();
      renderCloudSongs();
      if (!silent) setNeteaseStatus('Select a playlist');
    }

    if (loading) return;
    loading = true;
    if (!cachedAll?.length && !silent) setNeteaseStatus('Loading playlists…');
    try {
      const data = await fetchNeteaseCloud('/api/netease/playlists');
      writeNeteaseCache('playlists', data.playlists || []);
      playlists = filterAllowedPlaylists(data.playlists || []);
      activePlaylistId = null;
      cloudSongs = [];
      clearCloudSearch();
      renderPlaylists();
      renderCloudSongs();
      if (!playlists.length) {
        setNeteaseStatus('No matching playlists. Check your NetEase cookie in Settings.');
        return;
      }
      setNeteaseStatus('Select a playlist');
    } catch (error) {
      if (!playlists.length) {
        playlists = [];
        cloudSongs = [];
        clearCloudSearch();
        renderPlaylists();
        renderCloudSongs();
        setNeteaseStatus(
          error.status === 401
            ? 'Cookie expired. Open Settings and save your NetEase cookie again.'
            : error.status === 404
              ? 'NetEase API is unavailable on this deployment.'
              : 'Failed to load playlists.',
        );
      } else if (!silent) {
        setNeteaseStatus('Select a playlist');
      }
    } finally {
      loading = false;
    }
  }

  async function loadPlaylistSongs(playlist) {
    const cacheKey = `playlist:${playlist.id}`;
    const cachedSongs = readNeteaseCache(cacheKey);
    if (cachedSongs?.length) {
      cloudSongs = cachedSongs;
      activePlaylistId = playlist.id;
      clearCloudSearch();
      renderPlaylists();
      renderCloudSongs();
    }

    loading = true;
    if (!cachedSongs?.length) {
      clearCloudSearch();
      setNeteaseStatus(`Loading “${playlist.name}”…`);
    }
    try {
      const data = await fetchNeteaseCloud(
        `/api/netease/playlist?id=${encodeURIComponent(playlist.id)}&limit=100`,
      );
      cloudSongs = data.songs || [];
      writeNeteaseCache(cacheKey, cloudSongs);
      activePlaylistId = playlist.id;
      renderPlaylists();
      renderCloudSongs();
    } catch {
      if (!cachedSongs?.length) setNeteaseStatus('Failed to load playlist tracks');
    } finally {
      loading = false;
    }
  }

  async function prefetchNeteasePlaylists() {
    const cachedAll = readNeteaseCache('playlists');
    if (cachedAll?.length && !playlists.length) {
      playlists = filterAllowedPlaylists(cachedAll);
    }
    if (playlists.length || loading) return;
    await loadPlaylists({ silent: true });
  }

  async function syncToPlaylist(playlistId, { songs } = {}) {
    setSourceTab('netease');
    if (!playlists.length) await loadPlaylists();
    activePlaylistId = playlistId;
    if (Array.isArray(songs) && songs.length) {
      cloudSongs = songs;
      clearCloudSearch();
    } else if (activePlaylistId) {
      const playlist = playlists.find((item) => item.id === activePlaylistId);
      if (playlist) await loadPlaylistSongs(playlist);
    }
    renderPlaylists();
    renderCloudSongs();
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
  window.__prefetchNeteasePlaylists = prefetchNeteasePlaylists;
  window.__refreshPlaylistsDrawer = refresh;
  window.__syncNeteasePlaylistDrawer = syncToPlaylist;

  setSourceTab('local');
  renderLocalSongs();

  return { loadPlaylists, refresh, setSourceTab, syncToPlaylist };
}
