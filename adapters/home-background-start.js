(() => {
  const {runtime, bindings, host} = document.currentScript.dataset;
  const wallpaper = document.querySelector('#wallpaper');
  const loadScript = src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.fetchPriority = 'low';
    script.onload = resolve;
    script.onerror = () => reject(new Error('加载失败：' + src));
    document.head.append(script);
  });
  let complete, fail;
  window.nativePlayerReady = new Promise((resolve,reject)=>{complete=resolve;fail=reject;});
  window.nativePlayerReady.catch(()=>{});
  async function start() {
    try {
      await loadScript(runtime);
      if (bindings) await loadScript(bindings);
      await loadScript(host);
      complete();
    } catch (error) {
      fail(error);
      console.error(error);
      document.querySelector('#status').textContent = error.message;
    }
  }
  function waitForHome() {
    const scene = wallpaper.contentWindow;
    // The original wallpaper advances its position only when its cloud texture
    // has loaded and the render loop has started.
    if (!Number.isFinite(scene.position) || !scene.material?.uniforms.map.value.image?.naturalWidth) {
      setTimeout(waitForHome, 100);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) requestIdleCallback(start, {timeout:2000});
      else setTimeout(start, 0);
    }));
  }
  if (document.readyState === 'complete') waitForHome();
  else window.addEventListener('load', waitForHome, {once:true});
})();
