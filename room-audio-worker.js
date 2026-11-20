// Keep the native audio element and its seek requests. Only split open-ended
// reads of the site's packaged MP3s into bounded CDN requests.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const range = /^bytes=(\d+)-$/.exec(request.headers.get('Range') || '');
  if (request.method === 'GET' && range && url.origin === self.location.origin &&
      /^\/music\/[\w-]+\.mp3$/i.test(url.pathname)) {
    event.respondWith(streamTrack(request, Number(range[1])));
  }
});

async function streamTrack(request, start) {
  const abort = new AbortController();
  const stop = () => abort.abort();
  request.signal.addEventListener('abort', stop, {once:true});
  if (request.signal.aborted) stop();
  const cleanup = () => request.signal.removeEventListener('abort', stop);
  let cursor = start;
  async function part(size) {
    const headers = new Headers(request.headers);
    headers.set('Range', 'bytes=' + cursor + '-' + (cursor + size - 1));
    return fetch(new Request(request, {headers, signal:abort.signal}));
  }
  try {
    let response = await part(65536);
    const bounds = r => /^bytes (\d+)-(\d+)\/(\d+)$/.exec(r.headers.get('Content-Range') || '');
    const first = bounds(response);
    if (response.status !== 206 || !first || Number(first[1]) !== start) {
      cleanup();
      return response.status === 200 ? response : fetch(request);
    }
    const total = Number(first[3]);
    const body = new ReadableStream({
      async pull(controller) {
        try {
          response ??= await part(Math.min(262144, total - cursor));
          const span = bounds(response);
          if (response.status !== 206 || !span || Number(span[1]) !== cursor || Number(span[3]) !== total)
            throw Error('Unexpected audio byte range');
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (!bytes.length || bytes.length !== Number(span[2]) - cursor + 1) throw Error('Incomplete audio range');
          cursor += bytes.length;
          controller.enqueue(bytes);
          response = null;
          if (cursor === total) { controller.close(); cleanup(); }
        } catch (error) { cleanup(); controller.error(error); }
      },
      cancel() { stop(); cleanup(); }
    });
    return new Response(body, {status:206,headers:{
      'Content-Type':'audio/mpeg','Accept-Ranges':'bytes',
      'Content-Range':'bytes '+start+'-'+(total-1)+'/'+total,'Content-Length':String(total-start)
    }});
  } catch (error) { cleanup(); if (abort.signal.aborted) throw error; return fetch(request); }
}
