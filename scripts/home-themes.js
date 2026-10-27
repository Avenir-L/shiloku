const choices = [
    ['original', '原主题', 'assets/page-one-moon.png'],
    ['train', '列车', 'assets/theme-train-thumb.webp'],
    ['sky', '天空之城', 'assets/theme-sky-thumb.webp'],
    ['umbrella', '红伞', 'assets/theme-umbrella-thumb.webp'],
];
const key = 'shiloku-home-theme-v1';
const picker = document.querySelector('#home-themes');
const toggle = picker.querySelector('summary');
const status = picker.querySelector('[role="status"]');
let request = 0;
let selected = 'original';
let wanted = 'original';
const mobile = matchMedia('(max-width: 768px)');
const buttons = [];
const asset = (id) => `assets/theme-${id}-${mobile.matches ? 'mobile' : 'desktop'}`;

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(url);
        image.onerror = reject;
        image.src = url;
    });
}

async function selectTheme(id, close = false) {
    if (!choices.some(choice => choice[0] === id)) return;
    wanted = id;
    const token = ++request;
    status.textContent = '加载中…';
    picker.setAttribute('aria-busy', 'true');
    try {
        let url = '';
        if (id !== 'original') {
            const base = asset(id);
            try { url = await loadImage(`${base}.avif`); }
            catch { url = await loadImage(`${base}.webp`); }
        }
        if (token !== request) return;
        const root = document.documentElement;
        root.style.setProperty('--home-theme-image', url ? `url("${url}")` : 'none');
        root.dataset.homeTheme = id;
        if (id !== 'original') document.body.classList.add('bg-ready');
        selected = id;
        buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === id)));
        try { localStorage.setItem(key, id); } catch { /* Private browsing may disallow storage. */ }
        status.textContent = '';
        if (close) { picker.open = false; toggle.focus(); }
    } catch {
        if (token === request) { wanted = selected; status.textContent = '图片加载失败，请重试'; }
    } finally {
        if (token === request) picker.removeAttribute('aria-busy');
    }
}

for (const [id, name, thumbnail] of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.theme = id;
    button.setAttribute('aria-pressed', String(id === selected));
    const image = document.createElement('img');
    image.src = thumbnail;
    image.alt = '';
    image.loading = 'lazy';
    const label = document.createElement('span');
    label.textContent = name;
    button.append(image, label);
    button.addEventListener('click', () => selectTheme(id, true));
    picker.querySelector('.home-theme-options').append(button);
    buttons.push(button);
}
document.addEventListener('pointerdown', event => { if (!picker.contains(event.target)) picker.open = false; });
picker.addEventListener('keydown', event => {
    if (event.key === 'Escape') { picker.open = false; toggle.focus(); }
});
mobile.addEventListener('change', () => { if (wanted !== 'original') selectTheme(wanted); });
try { selectTheme(localStorage.getItem(key) || 'original'); } catch { selectTheme('original'); }
