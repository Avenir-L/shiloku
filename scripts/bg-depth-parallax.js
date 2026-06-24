/**

 * 基于深度图的 2.5D 视差背景：背景有景深，人物区域保持原样不拉扯

 */

import * as THREE from 'three';



const BG_URL = 'bg.jpg';

const DEPTH_URL = 'bg-depth.jpg';

const MASK_URL = 'bg-depth-mask.png';

const FOCUS_X = 0.58;

const OVERSCAN = 1.08;

const STRENGTH = 0.042;



function isDisabled() {

    return window.matchMedia(

        '(prefers-reduced-motion: reduce), (max-width: 768px), (hover: none) and (pointer: coarse)'

    ).matches;

}



function canAnimate() {

    return document.body.classList.contains('bg-ready')

        && document.body.classList.contains('intro-done')

        && !document.body.classList.contains('in-music-room');

}



function loadTexture(url) {

    return new Promise((resolve, reject) => {

        new THREE.TextureLoader().load(url, resolve, undefined, reject);

    });

}



export async function initBgDepthParallax(host) {

    if (!host || isDisabled()) return null;



    const fallback = document.getElementById('bg-image');

    let colorTex;

    let depthTex;

    let maskTex;



    try {

        [colorTex, depthTex, maskTex] = await Promise.all([

            loadTexture(BG_URL),

            loadTexture(DEPTH_URL),

            loadTexture(MASK_URL),

        ]);

    } catch {

        return null;

    }



    colorTex.colorSpace = THREE.SRGBColorSpace;

    [colorTex, depthTex, maskTex].forEach((tex) => {

        tex.minFilter = THREE.LinearFilter;

        tex.magFilter = THREE.LinearFilter;

    });



    const canvas = document.createElement('canvas');

    canvas.id = 'bg-depth-canvas';

    canvas.setAttribute('aria-hidden', 'true');

    host.appendChild(canvas);



    const renderer = new THREE.WebGLRenderer({

        canvas,

        alpha: false,

        antialias: true,

        powerPreference: 'low-power',

    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));



    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);

    camera.position.z = 1;



    const uniforms = {

        uColor: { value: colorTex },

        uDepth: { value: depthTex },

        uMask: { value: maskTex },

        uMouse: { value: new THREE.Vector2(0, 0) },

        uStrength: { value: STRENGTH },

    };



    const material = new THREE.ShaderMaterial({

        uniforms,

        vertexShader: `

            varying vec2 vUv;

            void main() {

                vUv = uv;

                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

            }

        `,

        fragmentShader: `

            uniform sampler2D uColor;

            uniform sampler2D uDepth;

            uniform sampler2D uMask;

            uniform vec2 uMouse;

            uniform float uStrength;

            varying vec2 vUv;



            void main() {

                float mask = texture2D(uMask, vUv).r;

                float depth = texture2D(uDepth, vUv).r;



                // 人物/近景：不位移，避免剪影被深度图拉变形

                // 背景：按深度做视差

                vec2 bgOffset = uMouse * depth * uStrength;

                vec2 offset = bgOffset * (1.0 - smoothstep(0.18, 0.72, mask));



                vec2 uv = clamp(vUv + offset, 0.001, 0.999);

                gl_FragColor = texture2D(uColor, uv);

            }

        `,

    });



    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);

    scene.add(mesh);



    let targetMouseX = 0;

    let targetMouseY = 0;

    let mouseX = 0;

    let mouseY = 0;

    let rafId = null;



    function layout() {

        const width = host.clientWidth;

        const height = host.clientHeight;

        if (!width || !height) return;



        renderer.setSize(width, height, false);



        const viewAspect = width / height;

        const texAspect = colorTex.image.width / colorTex.image.height;

        camera.left = -viewAspect;

        camera.right = viewAspect;

        camera.top = 1;

        camera.bottom = -1;

        camera.updateProjectionMatrix();



        let planeW;

        let planeH;

        if (viewAspect > texAspect) {

            planeW = viewAspect * 2 * OVERSCAN;

            planeH = planeW / texAspect;

        } else {

            planeH = 2 * OVERSCAN;

            planeW = planeH * texAspect;

        }



        mesh.scale.set(planeW, planeH, 1);

        const visibleW = viewAspect * 2;

        const visibleH = 2;

        mesh.position.x = (visibleW - planeW) * (FOCUS_X - 0.5);

        mesh.position.y = (visibleH - planeH) * 0.5;

    }



    function onMouseMove(e) {

        if (!canAnimate()) return;

        targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;

        targetMouseY = (e.clientY / window.innerHeight - 0.5) * -2;

    }



    function frame() {

        rafId = requestAnimationFrame(frame);



        if (canAnimate()) {

            mouseX += (targetMouseX - mouseX) * 0.07;

            mouseY += (targetMouseY - mouseY) * 0.07;

        } else {

            mouseX += (0 - mouseX) * 0.1;

            mouseY += (0 - mouseY) * 0.1;

        }



        uniforms.uMouse.value.set(mouseX, mouseY);



        if (document.body.classList.contains('in-music-room')) {

            canvas.style.opacity = '0';

            if (fallback) fallback.style.opacity = '';

            return;

        }



        canvas.style.opacity = document.body.classList.contains('bg-ready') ? '1' : '0';

        if (fallback && document.body.classList.contains('bg-depth-ready')) {

            fallback.style.opacity = '0';

        }



        renderer.render(scene, camera);

    }



    layout();

    window.addEventListener('resize', layout);

    window.addEventListener('mousemove', onMouseMove, { passive: true });



    const observer = new MutationObserver(layout);

    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });



    document.body.classList.add('bg-depth-ready');

    frame();



    return () => {

        cancelAnimationFrame(rafId);

        window.removeEventListener('resize', layout);

        window.removeEventListener('mousemove', onMouseMove);

        observer.disconnect();

        renderer.dispose();

        material.dispose();

        mesh.geometry.dispose();

        colorTex.dispose();

        depthTex.dispose();

        maskTex.dispose();

        canvas.remove();

        document.body.classList.remove('bg-depth-ready');

    };

}


