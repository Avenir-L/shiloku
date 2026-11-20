import { Renderer, Camera, Transform, Box, Raycast } from 'ogl'
import { lerp } from './math.js'
import Media from './Media.js'
const formats = {
  landscape: { width: 320, height: 180 },
  square: { width: 215, height: 215 },
  portrait: { width: 168, height: 252 }
}
const pictures = ['landscape', 'portrait', 'square', 'landscape', 'portrait', 'square', 'landscape', 'portrait', 'square']
  .map(format => ({ image: 'assets/ring/sample-' + format + '.webp', size: formats[format] }))
export default class App {
  constructor (host, close, photos = null) {
    this.host = host
    this.close = close
    this.focus = 0
    this.photos = photos

    this.scroll = {
      ease: 0.05,
      current: 0,
      target: 0,
      last: 0
    }

    

    this.createRenderer()
    this.createCamera()
    this.createScene()

    this.onResize()

    this.createGeometry()
    this.createMedias()




    this.addEventListeners()


  }

  createRenderer () {
    this.renderer = new Renderer({alpha:true, dpr:Math.min(devicePixelRatio, 2)})

    this.gl = this.renderer.gl
    this.gl.clearColor(0, 0, 0, 0)

    this.host.prepend(this.gl.canvas)
  }

  createCamera () {
    this.camera = new Camera(this.gl)
    this.camera.fov = 45
    this.camera.position.z = 20
  }

  createScene () {
    this.scene = new Transform()
  }

  createGeometry () {
    this.planeGeometry = new Box(this.gl,{widthSegments:32,heightSegments:32})
    this.raycast = new Raycast()
  }

  createMedias () {
    this.mediasImages = this.photos === null ? pictures : this.photos.map(({image}) => ({image, size:{...formats.square}}))
    this.medias = this.mediasImages.map(({ image, size }, index) => {
      const media = new Media({
        geometry: this.planeGeometry,
        gl: this.gl,
        image,
        index,
        length: this.mediasImages.length,
        renderer: this.renderer,
        scene: this.scene,
        screen: this.screen,
        size,
        viewport: this.viewport
      })

      if (this.photos) media.imageReady.then(() => {
        const [w,h] = media.program.uniforms.uImageSizes.value
        const scale = Math.min(320/w,252/h)
        media.size = {width:w*scale,height:h*scale}
        media.onResize()
        this.layoutRing()
      })
      return media
    })
    this.layoutRing()
  }

  onTouchDown (event) {
    this.isDown = true

    this.scroll.position = this.scroll.current
    this.start = event.touches ? event.touches[0].clientX : event.clientX
  }

  onTouchMove (event) {
    if (!this.isDown) return

    const x = event.touches ? event.touches[0].clientX : event.clientX
    const distance = (this.start - x) * this.viewport.width / this.screen.width

    this.scroll.target = this.scroll.position + distance
  }

  onTouchUp (event) {
    this.isDown = false

    this.onCheck()
  }

  onCheck () {
    if (!this.medias.length) return
    const total = this.medias[0].widthTotal
    const target = this.scroll.target
    const stops = this.medias.map(({x}) => x + Math.round((target - x) / total) * total)
    this.scroll.target = stops.reduce((nearest, x) =>
      Math.abs(target - x) < Math.abs(target - nearest) ? x : nearest)
  }

  layoutRing () {
    const radius = Math.max(this.viewport.height * 1.7, this.viewport.width * .85)
    const gapPixels = this.screen.width > 620 ? 60 : Math.min(24, this.screen.width * .035)
    const gap = this.viewport.width / this.screen.width * gapPixels
    let cursor = 0
    for (const media of this.medias) {
      media.radius = radius
      // Measure the span at the inner corners so neighboring prints stay clear.
      const span = 2 * radius * Math.atan((media.baseWidth + gap) / (2 * radius - media.baseHeight))
      media.x = cursor + span / 2
      cursor += span
    }
    const origin = this.medias[0]?.x ?? 0
    for (const media of this.medias) {
      media.x -= origin
      media.widthTotal = cursor
    }
  }

  /**
   * Resize.
   */
  onResize () {
    this.screen = {
      height: window.innerHeight,
      width: window.innerWidth
    }

    this.renderer.setSize(this.screen.width, this.screen.height)

    this.camera.perspective({
      aspect: this.gl.canvas.width / this.gl.canvas.height
    })

    const fov = this.camera.fov * (Math.PI / 180)
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z
    const width = height * this.camera.aspect

    this.viewport = {
      height,
      width
    }

    if (this.medias) {
      this.medias.forEach(media => media.onResize({
        screen: this.screen,
        viewport: this.viewport
      }))
      this.layoutRing()
    }
  }

  /**
   * Update.
   */
  update () {
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease)

    if (this.scroll.current > this.scroll.last) {
      this.direction = 'right'
    } else {
      this.direction = 'left'
    }

    if (this.medias) {
      this.medias.forEach(media => media.update(this.scroll, this.arrival))
    }

    this.applyFocus()
    this.renderer.render({
      scene: this.scene,
      camera: this.camera
    })

    this.scroll.last = this.scroll.current

    this.frame = requestAnimationFrame(() => this.update())
  }

  /**
   * Listeners.
   */
  applyFocus () {
    if (!this.selected) return
    const now = performance.now()
    const elapsed = Math.min(1, (now - this.focusStart) / 680)
    const eased = elapsed * elapsed * (3 - 2 * elapsed)
    this.focus = lerp(this.fromFocus, this.focusTarget, eased)
    const m = this.selected, p = m.plane, t = this.focus
    const [iw, ih] = m.program.uniforms.uImageSizes.value
    const height = Math.min(this.viewport.height * .70, this.viewport.width * .93 * ih / iw)
    p.position.x *= 1-t
    p.position.y *= 1-t
    p.rotation.z *= 1-t
    p.position.z *= 1-t
    p.scale.x = lerp(m.baseWidth, height*iw/ih, t)
    p.scale.y = lerp(m.baseHeight, height, t)
    m.program.uniforms.uPlaneSizes.value = [p.scale.x,p.scale.y]
    m.program.uniforms.uFocus.value = t
    for (const item of this.medias) item.program.uniforms.uOpacity.value = item === m ? 1 : 1-t
    if (elapsed === 1 && !this.focusTarget) this.selected = null
  }

  selectAt (x, y) {
    this.raycast.castMouse(this.camera, [2*x/this.screen.width-1, 1-2*y/this.screen.height])
    const [hit] = this.raycast.intersectMeshes(this.medias.map(item => item.plane).filter(plane => plane.visible))
    const media = this.medias.find(item => item.plane === hit)
    if (!media) return
    this.scroll.target = this.scroll.current
    this.selected = media
    this.focusTarget = 1
    this.fromFocus = 0
    this.focusStart = performance.now()
    this.close.hidden = false
    this.close.focus({preventScroll:true})
  }

  dismiss () {
    if (!this.selected || !this.focusTarget) return
    this.fromFocus = this.focus
    this.focusTarget = 0
    this.focusStart = performance.now()
    this.close.hidden = true
    this.host.focus({preventScroll:true})
  }

  setActive (active) {
    cancelAnimationFrame(this.frame)
    this.isDown = false
    this.host.hidden = !active
    if (active) { this.onResize(); this.update(); return }
    this.close.hidden = true
    if (this.selected) {
      this.fromFocus = this.focusTarget = 0
      this.focusStart = -1000
      this.applyFocus()
    }
  }

  addEventListeners () {
    const canvas = this.gl.canvas
    canvas.addEventListener('pointerdown', e => {
      if (this.arrival !== 1 || this.selected || !e.isPrimary || e.button !== 0) return
      this.dragged = false
      this.startY = e.clientY
      this.onTouchDown(e)
      canvas.setPointerCapture(e.pointerId)
    })
    canvas.addEventListener('pointermove', e => {
      if (!this.isDown || !e.isPrimary) return
      if (Math.hypot(e.clientX-this.start,e.clientY-this.startY)>6) this.dragged = true
      if (this.dragged) this.onTouchMove(e)
    })
    canvas.addEventListener('pointerup', e => {
      if (!this.isDown || !e.isPrimary) return
      this.isDown = false
      if (this.dragged) this.onCheck()
      else this.selectAt(e.clientX,e.clientY)
    })
    canvas.addEventListener('pointercancel', () => { this.isDown=false; this.onCheck() })
    this.close.addEventListener('click', () => this.dismiss())
    window.addEventListener('keydown', e => { if (e.key==='Escape') this.dismiss() })
    window.addEventListener('resize', () => { if (!this.host.hidden) this.onResize() })
  }
}
