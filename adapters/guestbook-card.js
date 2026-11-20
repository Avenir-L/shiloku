// Adapted from the site's scripts/site-extensions.js guestbook.
const preview = !['shiloku.cn','www.shiloku.cn'].includes(location.hostname);
const GUESTBOOK_LOCAL_KEY = 'shiloku.preview.guestbook.v1';
async function fetchGuestbookMessages() {
    const res = await fetch(preview ? 'https://shiloku.cn/api/guestbook' : '/api/guestbook', {cache:'no-store', signal:AbortSignal.timeout(10000)});
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.messages)) throw new Error('Guestbook unavailable');
    return data.messages;
}

function loadLocalGuestbook() {
    try {
        const raw = localStorage.getItem(GUESTBOOK_LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveLocalGuestbook(messages) {
    localStorage.setItem(GUESTBOOK_LOCAL_KEY, JSON.stringify(messages.slice(0, 30)));
}

async function submitGuestbook(name, message) {
    const res = await fetch('/api/guestbook', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:name || '访客',message}),signal:AbortSignal.timeout(10000)
    });
    const data = await res.json();
    if (!res.ok || data.ok !== true || !data.message || data.localOnly) throw new Error('Guestbook save failed');
    return {ok:true,entry:data.message};
}

function renderGuestbookMessages(messages) {
    const list = document.getElementById('guestbook-messages');
    if (!list) return;
    if (!messages.length) {
        list.innerHTML = `<p class="guestbook-empty">还没有留言</p>`;
        return;
    }
    list.innerHTML = messages.map((m) => {
        const d = new Date(m.time || Date.now());
        const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
        const safeName = escapeHtml(m.name || '访客');
        const safeMsg = escapeHtml(m.message || '');
        return `<article class="guestbook-item"><header><strong>${safeName}</strong><time>${dateStr}</time></header><p>${safeMsg}</p></article>`;
    }).join('');
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}


export function mountGuestbook(dialog) {
  const form = dialog.querySelector('form');
  const status = dialog.querySelector('[role=status]');
  const submit = form.querySelector('button');
  let published = [], request = 0;
  function render() {
    renderGuestbookMessages(preview ? [...loadLocalGuestbook(), ...published] : published);
  }
  async function refresh() {
    const version = ++request;
    try {
      const messages = await fetchGuestbookMessages();
      if (version !== request) return;
      published = messages;
      render();
    } catch {
      if (version !== request) return;
      render();
      status.textContent = '暂时读不到公开留言，再打开时会重试。';
    }
  }
  if (preview) submit.textContent = '保存到本机';
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const text = form.elements.message.value.trim();
    if (text.length < 2) {status.textContent='留言至少需要两个字。';return;}
    const name = form.elements.name.value.trim() || '访客';
    submit.disabled = true;
    try {
      if (preview) saveLocalGuestbook([{name,message:text,time:Date.now()}, ...loadLocalGuestbook()]);
      else {
        const {entry} = await submitGuestbook(name,text);
        ++request;
        published = [entry,...published];
      }
      form.elements.message.value='';
      render();
      dialog.querySelector('#guestbook-messages').scrollTop=0;
      status.textContent=preview?'已保存到当前浏览器。':'留言已发布。';
    } catch {status.textContent='保存失败，内容已保留，可以重试。';}
    finally {submit.disabled=false;}
  });
  return {open(){status.textContent='';render();refresh();}};
}
