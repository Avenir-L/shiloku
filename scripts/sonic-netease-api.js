export async function fetchNeteaseCloud(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Netease request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}
