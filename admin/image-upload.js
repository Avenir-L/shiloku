const nativeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export async function decodeSiteImage(file, {
  nativeDecode = blob => createImageBitmap(blob),
  loadHeif = () => import('../scripts/heif-decoder.js?v=1.6.7'),
} = {}) {
  if (!file) throw Error('请先选择图片');
  if (file.size > 12 * 1024 * 1024) throw Error('原图超过 12 MB，请缩小文件后上传');
  const heif = /^image\/hei[cf](?:-sequence)?$/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '');
  if (!heif && !nativeTypes.includes(file.type)) throw Error('图片格式不支持，请选择 JPG、PNG、WebP、AVIF、HEIF 或 HEIC');
  try {
    return await nativeDecode(file);
  } catch {
    if (!heif) throw Error('图片读取失败，请检查文件是否完整');
  }
  let decoder;
  try { decoder = await loadHeif(); }
  catch { throw Error('HEIF 转换组件加载失败，请检查网络后重试'); }
  try { return await decoder.heicTo({blob: file, type: 'bitmap'}); }
  catch { throw Error('HEIF / HEIC 图片读取失败，文件可能损坏或使用了暂不兼容的编码'); }
}
