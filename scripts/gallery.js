/**
 * Procreate 作品集：读取 gallery/manifest.json，网格展示 + 灯箱
 */
import { t } from './i18n.js?v=20260628g';

const MANIFEST_URL = 'gallery/manifest.json';
let manifestCache = null;
let lightboxIndex = 0;
let lightboxItems = [];
let allItems = [];
let activeFilter = 'all';

function isDraft(item) {
    return Boolean(item?.wip) || /未命名|未完成/.test(item?.title || '');
}

async function loadManifest() {
    if (manifestCache) return manifestCache;
    const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error('manifest');
    manifestCache = await res.json();
    return manifestCache;
}

function sortedItems(items = []) {
    return [...items].sort((a, b) => {
        const da = isDraft(a) ? 1 : 0;
        const db = isDraft(b) ? 1 : 0;
        if (da !== db) return da - db;
        return String(a.id).localeCompare(String(b.id));
    });
}

function filterItems(items, filter = activeFilter) {
    if (filter === 'draft') return items.filter((item) => isDraft(item));
    if (filter === 'done') return items.filter((item) => !isDraft(item));
    return items;
}

function updateGalleryMeta(items) {
    const countEl = document.getElementById('gallery-count');
    if (!countEl) return;
    const total = allItems.length;
    const visible = items.length;
    if (!total) {
        countEl.textContent = '';
        return;
    }
    if (activeFilter === 'all') {
        countEl.textContent = t('galleryCount', { n: total });
        return;
    }
    countEl.textContent = t('galleryCountFiltered', { visible, total });
}

function renderGrid(items) {
    const grid = document.getElementById('gallery-grid');
    const toolbar = document.getElementById('gallery-toolbar');
    if (!grid) return;

    grid.innerHTML = '';
    updateGalleryMeta(items);

    if (!allItems.length) {
        if (toolbar) toolbar.hidden = true;
        grid.innerHTML = `<p class="gallery-empty">${t('galleryEmpty')}</p>`;
        return;
    }

    if (toolbar) toolbar.hidden = false;

    if (!items.length) {
        grid.innerHTML = `<p class="gallery-empty">${t('galleryEmptyFilter')}</p>`;
        return;
    }

    const featuredId = items.find((item) => !isDraft(item))?.id || items[0]?.id;

    items.forEach((item, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'gallery-card hover-target';
        if (item.id === featuredId && activeFilter !== 'draft') {
            card.classList.add('is-featured');
        }
        card.style.setProperty('--card-i', String(index));
        card.dataset.id = item.id;

        const draft = isDraft(item);
        card.innerHTML = `
            <div class="gallery-card-media">
                <img src="gallery/${item.file}" alt="${item.title}" loading="lazy" decoding="async">
                <span class="gallery-card-shine" aria-hidden="true"></span>
                <span class="gallery-card-index">${String(index + 1).padStart(2, '0')}</span>
                <span class="gallery-card-overlay">
                    <span class="gallery-card-title">${item.title}</span>
                    ${draft ? `<span class="gallery-card-draft">${t('galleryDraft')}</span>` : ''}
                </span>
            </div>
        `;
        card.addEventListener('click', () => openLightbox(item.id, items));
        grid.appendChild(card);
    });
}

function setActiveFilter(filter) {
    activeFilter = filter;
    document.querySelectorAll('.gallery-filter').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.filter === filter);
    });
    renderGrid(filterItems(sortedItems(allItems), filter));
}

function openModal() {
    const modal = document.getElementById('gallery-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-open');
}

function closeModal() {
    const modal = document.getElementById('gallery-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-open');
    closeLightbox();
}

function openLightbox(id, items) {
    lightboxItems = sortedItems(items);
    lightboxIndex = Math.max(0, lightboxItems.findIndex((it) => it.id === id));
    const box = document.getElementById('gallery-lightbox');
    if (!box) return;
    box.classList.remove('hidden');
    box.setAttribute('aria-hidden', 'false');
    updateLightbox();
}

function closeLightbox() {
    const box = document.getElementById('gallery-lightbox');
    if (!box) return;
    box.classList.add('hidden');
    box.setAttribute('aria-hidden', 'true');
}

function updateLightbox() {
    const item = lightboxItems[lightboxIndex];
    if (!item) return;
    const img = document.getElementById('gallery-lightbox-img');
    const title = document.getElementById('gallery-lightbox-title');
    const counter = document.getElementById('gallery-lightbox-counter');
    if (img) {
        img.src = `gallery/${item.file}`;
        img.alt = item.title;
    }
    if (title) {
        title.textContent = item.title + (isDraft(item) ? ` · ${t('galleryDraft')}` : '');
    }
    if (counter) {
        counter.textContent = `${lightboxIndex + 1} / ${lightboxItems.length}`;
    }
}

function stepLightbox(delta) {
    if (!lightboxItems.length) return;
    lightboxIndex = (lightboxIndex + delta + lightboxItems.length) % lightboxItems.length;
    updateLightbox();
}

export async function openGallery() {
    const grid = document.getElementById('gallery-grid');
    const toolbar = document.getElementById('gallery-toolbar');
    activeFilter = 'all';
    document.querySelectorAll('.gallery-filter').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.filter === 'all');
    });
    if (toolbar) toolbar.hidden = true;
    if (grid) grid.innerHTML = `<p class="gallery-empty">${t('galleryLoading')}</p>`;
    openModal();
    try {
        const data = await loadManifest();
        allItems = data.items || [];
        renderGrid(filterItems(sortedItems(allItems), activeFilter));
    } catch {
        allItems = [];
        if (grid) grid.innerHTML = `<p class="gallery-empty">${t('galleryEmpty')}</p>`;
    }
}

export function setupGallery() {
    const open = () => openGallery().catch(() => {});
    document.getElementById('gallery-open-btn')?.addEventListener('click', open);
    document.getElementById('gallery-tag-btn')?.addEventListener('click', open);
    document.getElementById('gallery-close')?.addEventListener('click', closeModal);
    document.getElementById('gallery-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'gallery-modal') closeModal();
    });
    document.querySelectorAll('.gallery-filter').forEach((btn) => {
        btn.addEventListener('click', () => setActiveFilter(btn.dataset.filter || 'all'));
    });
    document.getElementById('gallery-lightbox-close')?.addEventListener('click', closeLightbox);
    document.getElementById('gallery-lightbox-prev')?.addEventListener('click', () => stepLightbox(-1));
    document.getElementById('gallery-lightbox-next')?.addEventListener('click', () => stepLightbox(1));
    document.getElementById('gallery-lightbox')?.addEventListener('click', (e) => {
        if (e.target.id === 'gallery-lightbox') closeLightbox();
    });
    window.addEventListener('keydown', (e) => {
        const box = document.getElementById('gallery-lightbox');
        const modal = document.getElementById('gallery-modal');
        if (e.key === 'Escape') {
            if (box && !box.classList.contains('hidden')) closeLightbox();
            else if (modal && !modal.classList.contains('hidden')) closeModal();
        }
        if (box && !box.classList.contains('hidden')) {
            if (e.key === 'ArrowLeft') stepLightbox(-1);
            if (e.key === 'ArrowRight') stepLightbox(1);
        }
    });
}
