import { Mesh, Program, Texture } from 'ogl'

import fragment from './image-fragment.glsl'
import vertex from './image-vertex.glsl'




export default class {
  constructor ({ geometry, gl, image, index, length, renderer, scene, screen, size, viewport }) {
    this.extra = 0

    this.geometry = geometry
    this.gl = gl
    this.image = image
    this.index = index
    this.length = length
    this.renderer = renderer
    this.scene = scene
    this.screen = screen
    this.size = size
    this.viewport = viewport

    this.createShader()
    this.createMesh()


    this.onResize()
  }

  createShader () {
    const texture = new Texture(this.gl, {
      generateMipmaps: false
    })

    this.program = new Program(this.gl, {
      depthTest: true,
      depthWrite: true,
      fragment,
      vertex,
      uniforms: {
        tMap: { value: texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [1, 1] },
        uViewportSizes: { value: [this.viewport.width, this.viewport.height] },
        uFocus: { value: 0 }, uOpacity: { value: 1 }, uSpeed: { value: 0 },
        uTime: { value: 100 * Math.random() }
      },
      transparent: true
    })

    const image = new Image()

    this.imageReady = new Promise(resolve => {
      image.onload = () => {
        texture.image = image
        this.program.uniforms.uImageSizes.value = [image.naturalWidth, image.naturalHeight]
        resolve()
      }
      image.onerror = resolve
      image.src = this.image
    })
  }

  createMesh () {
    this.plane = new Mesh(this.gl, {
      geometry: this.geometry,
      program: this.program
    })

    this.plane.setParent(this.scene)
  }

  update (scroll, arrival) {
    const fullTurn = 2 * Math.PI
    const turn = (this.x - scroll.current) / this.widthTotal
    const restingAngle = this.widthTotal / this.radius * (turn - Math.floor(turn + .5))
    const angle = restingAngle + fullTurn * (1 - arrival)
    // Introduce each frame beyond the right edge, before it crosses the viewport.
    this.plane.visible = angle <= Math.PI / 2
    const radius = this.radius
    // The top of the circle stays at y=.5; its centre stays below the viewport.
    this.plane.position.x = radius * Math.sin(angle)
    this.plane.position.y = .5 - radius + radius * Math.cos(angle)
    this.plane.rotation.z = Math.atan2(-Math.sin(angle), Math.cos(angle))
    this.program.uniforms.uSpeed.value = scroll.current - scroll.last
    if (Math.abs(this.program.uniforms.uSpeed.value) > .001) this.program.uniforms.uTime.value += .04
    this.plane.scale.z = .14
  }

  /**
   * Events.
   */
  onResize ({ screen, viewport } = {}) {
    if (screen) {
      this.screen = screen
    }

    if (viewport) {
      this.viewport = viewport

      this.plane.program.uniforms.uViewportSizes.value = [this.viewport.width, this.viewport.height]
    }

    const preferredScale = this.screen.width > 620 ? 1.25 : 1
    const fit = Math.min(preferredScale, this.screen.width * .76 / 320, this.screen.height * .50 / 252)
    const units = fit * this.viewport.height / this.screen.height
    this.baseWidth = this.size.width * units
    this.baseHeight = this.size.height * units
    this.plane.scale.x = this.baseWidth
    this.plane.scale.y = this.baseHeight
    this.program.uniforms.uPlaneSizes.value = [this.baseWidth, this.baseHeight]
  }
}
