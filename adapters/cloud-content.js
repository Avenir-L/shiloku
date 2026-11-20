// Share one non-blocking read between the homepage, station and album.
window.cloudContent = fetch('/api/site-content?view=cloud', {
  cache: 'no-store', priority: 'low', signal: AbortSignal.timeout(8000)
}).then(response => response.ok ? response.json() : null).catch(() => null);
