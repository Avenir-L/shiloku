# Official Three.js Sky r128

Sky.r128.js is the complete unmodified official r128 example, MIT; license retained.
Source: https://github.com/mrdoob/three.js/blob/r128/examples/js/objects/Sky.js
Reference copy: ../../../../06-参考源码/高空远景候选/three-sky-r128/

Active class THREE.Sky uses the original scattering shaders. adapters/distant-atmosphere.js renders it once into a 512×128 smooth-color cache, then adapts projection/alpha blend to the existing clouds. This cache does not resize or reduce Wallpaper clouds. The original Sky is an analytic sky model, not a full curved-planet/cloud simulation.

The earlier handwritten tint-only experiment was stopped when the user reiterated reuse-first. It is archived in archive/retired-handwritten-horizon and is not loaded.
