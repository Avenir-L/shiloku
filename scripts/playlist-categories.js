/** 歌单自定义分类（localStorage） */

const STORAGE_KEY = 'shiloku-playlist-categories-v1';

const SEED_CATEGORIES = [
    { id: 'rock', name: '摇滚' },
    { id: 'jpop', name: '日系' },
    { id: 'vocaloid', name: '虚拟歌手' },
    { id: 'electronic', name: '电音' },
];

const SEED_ASSIGNMENTS = {
    'local:listen.mp3': 'rock',
    'local:beautiful_world.mp3': 'jpop',
    'local:yuuhizaka.mp3': 'vocaloid',
    'local:Hypnotized.mp3': 'electronic',
    'local:medemede.mp3': 'jpop',
};

function defaultStore() {
    return {
        categories: [...SEED_CATEGORIES],
        assignments: { ...SEED_ASSIGNMENTS },
    };
}

function loadStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultStore();
        const data = JSON.parse(raw);
        return {
            categories: Array.isArray(data.categories) ? data.categories : defaultStore().categories,
            assignments: data.assignments && typeof data.assignments === 'object' ? data.assignments : {},
        };
    } catch {
        return defaultStore();
    }
}

function saveStore(store) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch { /* quota */ }
}

export function getSongKey(song) {
    if (!song) return '';
    if (song.isNeteaseOnly && song.neteaseId) return `netease:${song.neteaseId}`;
    if (song.src) return `local:${song.src}`;
    return `local:${song.title || 'unknown'}`;
}

export function listCategories() {
    return loadStore().categories.filter((cat) => cat?.id && cat?.name);
}

export function getCategoryName(categoryId) {
    if (!categoryId || categoryId === 'uncategorized') return null;
    const cat = listCategories().find((item) => item.id === categoryId);
    return cat?.name || null;
}

export function getSongCategoryId(song) {
    const key = getSongKey(song);
    if (!key) return 'uncategorized';
    const assigned = loadStore().assignments[key];
    if (!assigned) return 'uncategorized';
    if (listCategories().some((cat) => cat.id === assigned)) return assigned;
    return 'uncategorized';
}

export function setSongCategory(song, categoryId) {
    const key = getSongKey(song);
    if (!key) return false;
    const store = loadStore();
    if (!categoryId || categoryId === 'uncategorized') {
        delete store.assignments[key];
    } else if (listCategories().some((cat) => cat.id === categoryId)) {
        store.assignments[key] = categoryId;
    } else {
        return false;
    }
    saveStore(store);
    return true;
}

export function addCategory(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed || trimmed.length > 16) return null;
    const store = loadStore();
    if (store.categories.some((cat) => cat.name === trimmed)) return null;

    const id = `cat-${Date.now().toString(36)}`;
    store.categories.push({ id, name: trimmed });
    saveStore(store);
    return id;
}

export function renameCategory(categoryId, name) {
    const trimmed = String(name || '').trim();
    if (!trimmed || trimmed.length > 16) return false;
    const store = loadStore();
    const target = store.categories.find((cat) => cat.id === categoryId);
    if (!target) return false;
    if (store.categories.some((cat) => cat.id !== categoryId && cat.name === trimmed)) return false;
    target.name = trimmed;
    saveStore(store);
    return true;
}

export function deleteCategory(categoryId) {
    const store = loadStore();
    const index = store.categories.findIndex((cat) => cat.id === categoryId);
    if (index < 0) return false;
    store.categories.splice(index, 1);
    Object.keys(store.assignments).forEach((key) => {
        if (store.assignments[key] === categoryId) delete store.assignments[key];
    });
    saveStore(store);
    return true;
}

export function getFilterTabs(t) {
    const tabs = [
        { id: 'all', name: t?.('playlistAll') || '全部' },
        { id: 'uncategorized', name: t?.('playlistUncategorized') || '未分类' },
    ];
    listCategories().forEach((cat) => tabs.push({ id: cat.id, name: cat.name }));
    return tabs;
}
