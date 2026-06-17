import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import styles from './ParticleDepthGallery.module.css'

/**
 * Scroll-driven depth gallery.
 * -------------------------------------------------------------------------
 * Crisp image planes laid out in depth; scrolling flies the camera through
 * them, crossfading by focus. A domain-warped "liquid light" background
 * shader blends its palette from whichever images are in focus, and the
 * whole field tilts with the pointer for parallax.
 *
 * Each item:
 *   {
 *     image:        '/img.webp',
 *     word:         'golden',      // caption word
 *     pms:          'PMS 135 C',   // caption code
 *     accentColor:  '#feca4f',     // swatch + CMYK/RGB/HEX
 *     textColor:    '#2e2e2e',     // caption color
 *     background:   '#fffaf0',     // mood base
 *     blob1:        '#ffdf94',     // mood accent A
 *     blob2:        '#fce7c4',     // mood accent B
 *     position:     { x: -0.9, y: 0 },
 *   }
 *
 * Props: items, className, style, planeGap, tilt, showLabels, invertScroll.
 * The parent element must have a height. Requires `three`.
 */

// Stylized, predictable color pipeline: hex in == pixels out.
THREE.ColorManagement.enabled = false

/* ============================================================ *
 * Background shader
 * ============================================================ */
const BG_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const BG_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform vec3 uBackgroundColor;
  uniform vec3 uBlob1Color;
  uniform vec3 uBlob2Color;
  uniform float uNoiseStrength;
  uniform float uBlobRadius;
  uniform float uBlobRadiusSecondary;
  uniform float uBlobStrength;
  uniform float uTime;
  uniform float uVelocityIntensity;

  float random(vec2 coord) {
    return fract(sin(dot(coord, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec3 color = uBackgroundColor;

    float animTime = uTime * 0.00028;
    vec2 blob1Center = vec2(
      0.50 + sin(animTime * 1.000) * 0.13 + sin(animTime * 1.618) * 0.05,
      0.48 + cos(animTime * 0.794) * 0.09 + cos(animTime * 1.272) * 0.03
    );
    vec2 blob2Center = vec2(
      0.35 + cos(animTime * 0.927) * 0.11 + cos(animTime * 1.414) * 0.04,
      0.55 + sin(animTime * 1.175) * 0.07 + sin(animTime * 0.618) * 0.03
    );

    float blob1 = smoothstep(uBlobRadius, 0.0, distance(vUv, blob1Center));
    float blob2 = smoothstep(uBlobRadiusSecondary, 0.0, distance(vUv, blob2Center));

    vec3 blob1SoftColor = mix(uBlob1Color, uBackgroundColor, 0.35);
    vec3 blob2SoftColor = mix(uBlob2Color, uBackgroundColor, 0.35);
    color = mix(color, blob1SoftColor, blob1 * uBlobStrength);
    color = mix(color, blob2SoftColor, blob2 * uBlobStrength);

    color += uVelocityIntensity * 0.10;

    float grain = random(vUv * vec2(1387.13, 947.91)) - 0.5;
    color += grain * uNoiseStrength;
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
  }
`

/* ============================================================ *
 * Item normalization
 * ============================================================ */
function normalizeItems(items = []) {
  return items.map((item, index) => {
    const fallbackColor = item.fallbackColor || item.color || item.accentColor || '#cccccc'
    const nestedLabel = item.label && typeof item.label === 'object' ? item.label : {}
    return {
      textureSrc: item.image || item.textureSrc || item.src || null,
      tint: item.tint || fallbackColor,
      accentColor: item.accentColor || fallbackColor,
      backgroundColor: item.background || item.backgroundColor || fallbackColor,
      blob1Color: item.blob1 || item.blob1Color || fallbackColor,
      blob2Color: item.blob2 || item.blob2Color || fallbackColor,
      position: item.position || { x: index % 2 === 0 ? -0.75 : 0.75, y: 0 },
      label: {
        word: item.word || nestedLabel.word || `mote ${String(index + 1).padStart(2, '0')}`,
        pms: item.pms || nestedLabel.pms || 'N/A',
        color: item.textColor || nestedLabel.color || '',
      },
    }
  })
}

/* ============================================================ *
 * Background (liquid-light shader quad)
 * ============================================================ */
class Background {
  constructor() {
    this.isInitialized = false
    this.scene = null
    this.camera = null
    this.material = null

    // Live + target palette (smoothly blended from the focused images).
    this.backgroundColor = new THREE.Color('#101016')
    this.blob1Color = new THREE.Color('#1a1a22')
    this.blob2Color = new THREE.Color('#2a2030')
    this.targetBackground = new THREE.Color().copy(this.backgroundColor)
    this.targetBlob1 = new THREE.Color().copy(this.blob1Color)
    this.targetBlob2 = new THREE.Color().copy(this.blob2Color)
    this.paletteSmoothing = 0.06

    // Soft blob shape.
    this.baseBlobRadius = 0.65
    this.secondaryBlobRadiusRatio = 0.78
    this.baseBlobStrength = 0.9
    this.noiseStrength = 0.04

    // Subtle motion response (depth -> radius, velocity -> strength + lift).
    this.depthToRadiusAmount = 0.08
    this.velocityToStrengthAmount = 0.1
    this.motionSmoothing = 0.1
    this.motionDepthProgress = 0
    this.motionVelocityIntensity = 0
    this.smoothedDepthProgress = 0
    this.smoothedVelocityIntensity = 0
    this.blobRadius = this.baseBlobRadius
    this.blobStrength = this.baseBlobStrength
  }

  init() {
    if (this.isInitialized) return
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.material = new THREE.ShaderMaterial({
      vertexShader: BG_VERTEX,
      fragmentShader: BG_FRAGMENT,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uBackgroundColor: { value: this.backgroundColor },
        uBlob1Color: { value: this.blob1Color },
        uBlob2Color: { value: this.blob2Color },
        uNoiseStrength: { value: this.noiseStrength },
        uBlobRadius: { value: this.blobRadius },
        uBlobRadiusSecondary: { value: this.blobRadius * this.secondaryBlobRadiusRatio },
        uBlobStrength: { value: this.blobStrength },
        uTime: { value: 0 },
        uVelocityIntensity: { value: 0 },
      },
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.scene.add(this.mesh)
    this.isInitialized = true
  }

  setTargetPalette(a, b, c) {
    if (a) this.targetBackground.copy(a)
    if (b) this.targetBlob1.copy(b)
    if (c) this.targetBlob2.copy(c)
  }

  setMotionResponse({ depthProgress, velocityIntensity } = {}) {
    if (Number.isFinite(depthProgress)) {
      this.motionDepthProgress = THREE.MathUtils.clamp(depthProgress, 0, 1)
    }
    if (Number.isFinite(velocityIntensity)) {
      this.motionVelocityIntensity = THREE.MathUtils.clamp(velocityIntensity, 0, 1)
    }
  }

  update(time = 0) {
    // Smooth palette toward the focused images.
    this.backgroundColor.lerp(this.targetBackground, this.paletteSmoothing)
    this.blob1Color.lerp(this.targetBlob1, this.paletteSmoothing)
    this.blob2Color.lerp(this.targetBlob2, this.paletteSmoothing)

    // Smooth motion response.
    this.smoothedDepthProgress = THREE.MathUtils.lerp(
      this.smoothedDepthProgress,
      this.motionDepthProgress,
      this.motionSmoothing
    )
    this.smoothedVelocityIntensity = THREE.MathUtils.lerp(
      this.smoothedVelocityIntensity,
      this.motionVelocityIntensity,
      this.motionSmoothing
    )
    this.blobRadius = THREE.MathUtils.clamp(
      this.baseBlobRadius + this.smoothedDepthProgress * this.depthToRadiusAmount,
      0.05,
      1
    )
    this.blobStrength = THREE.MathUtils.clamp(
      this.baseBlobStrength + this.smoothedVelocityIntensity * this.velocityToStrengthAmount,
      0,
      1
    )

    if (this.material) {
      const u = this.material.uniforms
      u.uBackgroundColor.value.copy(this.backgroundColor)
      u.uBlob1Color.value.copy(this.blob1Color)
      u.uBlob2Color.value.copy(this.blob2Color)
      u.uBlobRadius.value = this.blobRadius
      u.uBlobRadiusSecondary.value = this.blobRadius * this.secondaryBlobRadiusRatio
      u.uBlobStrength.value = this.blobStrength
      u.uNoiseStrength.value = this.noiseStrength
      u.uVelocityIntensity.value = this.smoothedVelocityIntensity
      u.uTime.value = time
    }
  }

  render(renderer) {
    if (this.isInitialized) renderer.render(this.scene, this.camera)
  }

  dispose() {
    if (!this.isInitialized) return
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.scene.clear()
    this.isInitialized = false
  }
}

/* ============================================================ *
 * ImageField (one image -> crisp depth plane)
 * ============================================================ */
class ImageField {
  constructor(config) {
    this.config = config
    this.focus = 0
    this.colors = {
      background: new THREE.Color(config.backgroundColor),
      blob1: new THREE.Color(config.blob1Color),
      blob2: new THREE.Color(config.blob2Color),
    }
  }

  build(texture) {
    const image = texture?.image
    const aspect = image && image.width > 0 && image.height > 0 ? image.width / image.height : 1
    this.aspect = aspect

    const isMobile = window.innerWidth <= 768
    const baseHeight = isMobile ? 1.7 : 2.4
    const planeSize = new THREE.Vector2(baseHeight * aspect, baseHeight)

    this.group = new THREE.Group()

    this.planeGeometry = new THREE.PlaneGeometry(planeSize.x, planeSize.y)
    this.planeMaterial = new THREE.MeshBasicMaterial({
      map: texture || null,
      color: texture ? 0xffffff : new THREE.Color(this.config.tint),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    })
    this.plane = new THREE.Mesh(this.planeGeometry, this.planeMaterial)
    this.plane.renderOrder = 0
    this.group.add(this.plane)

    return this.group
  }

  setFocus(focus) {
    this.focus = focus
    // Clean depth crossfade between images.
    if (this.planeMaterial) this.planeMaterial.opacity = focus
  }

  dispose() {
    this.planeGeometry?.dispose()
    this.planeMaterial?.dispose()
  }
}

/* ============================================================ *
 * Gallery (orchestrates fields, layout, focus, palette blend)
 * ============================================================ */
class Gallery {
  constructor(planeConfig, options) {
    this.planeConfig = planeConfig
    this.options = options
    this.fields = []
    this.texturesBySource = new Map()
    this.planeGap = options.planeGap
    this.mobileBreakpoint = 768
    this.mobileXSpreadFactor = 0.4
    this.viewOffset = 5 // camera sits this far in front of the focused image
    this.group = new THREE.Group()
    this._accA = new THREE.Color()
    this._accB = new THREE.Color()
    this._accC = new THREE.Color()
  }

  getXSpreadFactor() {
    return window.innerWidth <= this.mobileBreakpoint ? this.mobileXSpreadFactor : 1
  }

  init(scene) {
    this.planeConfig.forEach((config, index) => {
      const field = new ImageField(config)
      const texture = this.texturesBySource.get(config.textureSrc) || null
      const object = field.build(texture)
      this.layoutField(object, index)
      this.group.add(object)
      this.fields.push(field)
    })
    scene.add(this.group)
  }

  layoutField(object, index) {
    const spread = this.getXSpreadFactor()
    const base = this.planeConfig[index].position || { x: 0, y: 0 }
    object.position.set(base.x * spread, base.y, -index * this.planeGap)
  }

  relayout() {
    this.fields.forEach((field, index) => this.layoutField(field.group, index))
  }

  getDepthRange() {
    if (!this.fields.length) return { nearestZ: 0, deepestZ: 0 }
    const zs = this.fields.map((f) => f.group.position.z)
    return { nearestZ: Math.max(...zs), deepestZ: Math.min(...zs) }
  }

  getDepthProgress(cameraZ) {
    const { nearestZ, deepestZ } = this.getDepthRange()
    const span = nearestZ - deepestZ
    if (span <= 0) return 0
    return THREE.MathUtils.clamp((nearestZ - cameraZ) / span, 0, 1)
  }

  setPreloadedTextures(map) {
    this.texturesBySource = map instanceof Map ? map : new Map()
  }

  getTextureSources() {
    return [...new Set(this.planeConfig.map((c) => c.textureSrc).filter(Boolean))]
  }

  // Returns the most in-focus field index (for the caption).
  getActiveIndex() {
    let best = -1
    let bestFocus = 0.12
    this.fields.forEach((field, index) => {
      if (field.focus > bestFocus) {
        bestFocus = field.focus
        best = index
      }
    })
    return best
  }

  update(camera, pointer) {
    const focusRange = Math.max(this.planeGap * 1.05, 2)

    // Per-field focus.
    this.fields.forEach((field) => {
      const viewZ = field.group.position.z + this.viewOffset
      const distance = Math.abs(camera.position.z - viewZ)
      const focus = THREE.MathUtils.smoothstep(
        1 - THREE.MathUtils.clamp(distance / focusRange, 0, 1),
        0,
        1
      )
      field.setFocus(focus)
    })

    // Pointer-driven parallax tilt of the whole field.
    const tilt = this.options.tilt
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, pointer.x * tilt, 0.08)
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, -pointer.y * tilt, 0.08)
  }

  // Weighted palette from whichever fields are forming.
  getBlendedPalette() {
    let weightSum = 0
    this._accA.setRGB(0, 0, 0)
    this._accB.setRGB(0, 0, 0)
    this._accC.setRGB(0, 0, 0)
    this.fields.forEach((field) => {
      const w = field.focus * field.focus + 0.0001
      weightSum += w
      this._accA.r += field.colors.background.r * w
      this._accA.g += field.colors.background.g * w
      this._accA.b += field.colors.background.b * w
      this._accB.r += field.colors.blob1.r * w
      this._accB.g += field.colors.blob1.g * w
      this._accB.b += field.colors.blob1.b * w
      this._accC.r += field.colors.blob2.r * w
      this._accC.g += field.colors.blob2.g * w
      this._accC.b += field.colors.blob2.b * w
    })
    if (weightSum > 0) {
      this._accA.multiplyScalar(1 / weightSum)
      this._accB.multiplyScalar(1 / weightSum)
      this._accC.multiplyScalar(1 / weightSum)
    }
    return { a: this._accA, b: this._accB, c: this._accC }
  }

  dispose() {
    this.fields.forEach((field) => field.dispose())
  }
}

/* ============================================================ *
 * Label (kinetic title card, imperative ref updates)
 * ============================================================ */
class Label {
  constructor(gallery, refs) {
    this.gallery = gallery
    this.refs = refs // { overlay, index, word, chip, cmyk, rgb, hex, pms, enterClass }
    this.activeIndex = -1
  }

  init() {
    if (this.refs?.overlay) this.refs.overlay.style.opacity = '0'
  }

  normalizeHex(raw) {
    const fb = '#ffffff'
    if (typeof raw !== 'string') return fb
    let h = raw.trim()
    if (!h) return fb
    if (!h.startsWith('#')) h = `#${h}`
    if (/^#[0-9a-fA-F]{3}$/.test(h)) {
      h = `#${h.slice(1).split('').map((c) => c + c).join('')}`
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(h)) return fb
    return h.toLowerCase()
  }

  hexToRgb(hex) {
    const h = this.normalizeHex(hex).slice(1)
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    }
  }

  rgbToCmyk({ r, g, b }) {
    const rr = r / 255, gg = g / 255, bb = b / 255
    const k = 1 - Math.max(rr, gg, bb)
    if (k >= 0.999) return { c: 0, m: 0, y: 0, k: 100 }
    return {
      c: Math.round(((1 - rr - k) / (1 - k)) * 100),
      m: Math.round(((1 - gg - k) / (1 - k)) * 100),
      y: Math.round(((1 - bb - k) / (1 - k)) * 100),
      k: Math.round(k * 100),
    }
  }

  apply(index) {
    const field = this.gallery.fields[index]
    if (!field || this.activeIndex === index || !this.refs) return
    const label = field.config.label || {}
    const hex = this.normalizeHex(field.config.accentColor)
    const rgb = this.hexToRgb(hex)
    const cmyk = this.rgbToCmyk(rgb)

    if (this.refs.index) this.refs.index.textContent = String(index + 1).padStart(2, '0')
    if (this.refs.word) this.refs.word.textContent = label.word || 'mote'
    if (this.refs.chip) this.refs.chip.style.backgroundColor = hex
    if (this.refs.cmyk) this.refs.cmyk.textContent = `${cmyk.c} ${cmyk.m} ${cmyk.y} ${cmyk.k}`
    if (this.refs.rgb) this.refs.rgb.textContent = `${rgb.r} ${rgb.g} ${rgb.b}`
    if (this.refs.hex) this.refs.hex.textContent = hex.slice(1).toUpperCase()
    if (this.refs.pms) this.refs.pms.textContent = cmyk ? (label.pms || 'N/A') : 'N/A'
    if (this.refs.overlay) this.refs.overlay.style.color = label.color || ''

    // Retrigger the enter animation (this is what redraws the rule line).
    if (this.refs.overlay && this.refs.enterClass) {
      this.refs.overlay.classList.remove(this.refs.enterClass)
      void this.refs.overlay.offsetWidth
      this.refs.overlay.classList.add(this.refs.enterClass)
    }
    this.activeIndex = index
  }

  update() {
    if (!this.refs?.overlay) return
    const index = this.gallery.getActiveIndex()
    if (index < 0) {
      this.refs.overlay.style.opacity = '0'
      return
    }
    this.apply(index)
    this.refs.overlay.style.opacity = '1'
  }
}

/* ============================================================ *
 * Scroll (wheel/touch -> camera depth + velocity)
 * ============================================================ */
class Scroll {
  constructor(camera, gallery, target, invertScroll = false) {
    this.camera = camera
    this.gallery = gallery
    this.target = target
    this.isInitialized = false

    this.scrollTarget = 0
    this.scrollCurrent = 0
    this.scrollSmoothing = 0.08
    this.scrollToWorldFactor = 0.01
    this.wheelScrollSpeed = 1
    this.touchScrollSpeed = 1.8
    this.previousScrollCurrent = 0
    this.invertScroll = invertScroll

    this.rawVelocity = 0
    this.velocity = 0
    this.velocityDamping = 0.12
    this.velocityMax = 1.5
    this.velocityStopThreshold = 0.0001

    this.firstPlaneViewOffset = 5
    this.lastPlaneViewOffset = 5
    this.minCameraZ = -Infinity
    this.maxCameraZ = Infinity
    this.cameraStartZ = camera.position.z
    this.touchY = 0

    // Scroll-position bounds (in scrollTarget units), updated each frame.
    this.minScrollBound = 0
    this.maxScrollBound = 0

    this.onWheel = (e) => {
      const delta =
        this.normalizeWheelDelta(e) * this.wheelScrollSpeed * (this.invertScroll ? -1 : 1)
      if (this.shouldReleaseToPage(delta)) return // let the page scroll past the gallery
      e.preventDefault()
      this.scrollTarget += delta
    }
    this.onTouchStart = (e) => {
      this.touchY = e.touches[0]?.clientY ?? 0
    }
    this.onTouchMove = (e) => {
      const y = e.touches[0]?.clientY ?? this.touchY
      const rawDelta = this.touchY - y
      const delta = rawDelta * this.touchScrollSpeed * (this.invertScroll ? -1 : 1)
      this.touchY = y
      if (this.shouldReleaseToPage(delta)) {
        // The canvas uses `touch-action: none`, so the browser won't scroll the
        // page itself for this gesture. Drive it manually once the gallery has
        // run out of depth in this direction — this is what lets you reach the
        // top of the page again on touch devices.
        window.scrollBy(0, rawDelta)
        return
      }
      e.preventDefault()
      this.scrollTarget += delta
    }
  }

  // Hand scroll back to the page unless the gallery fills the viewport AND
  // still has depth to travel in the requested direction.
  shouldReleaseToPage(delta) {
    const rect = this.target.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight || 1
    const fillsViewport = rect.top <= 1 && rect.bottom >= vh - 1
    if (!fillsViewport) return true

    const eps = 0.5
    const atTop = this.scrollTarget <= this.minScrollBound + eps
    const atBottom = this.scrollTarget >= this.maxScrollBound - eps
    if (delta < 0 && atTop) return true
    if (delta > 0 && atBottom) return true
    return false
  }

  init() {
    if (this.isInitialized) return
    this.updateBounds()
    this.cameraStartZ = this.maxCameraZ
    this.camera.position.z = this.cameraStartZ
    this.minScrollBound = this.scrollFromCameraZ(this.maxCameraZ)
    this.maxScrollBound = this.scrollFromCameraZ(this.minCameraZ)
    this.scrollTarget = 0
    this.scrollCurrent = 0
    this.previousScrollCurrent = 0
    this.velocity = 0
    this.isInitialized = true
  }

  bindEvents() {
    this.target.addEventListener('wheel', this.onWheel, { passive: false })
    this.target.addEventListener('touchstart', this.onTouchStart, { passive: true })
    this.target.addEventListener('touchmove', this.onTouchMove, { passive: false })
  }

  updateBounds() {
    const range = this.gallery.getDepthRange()
    this.maxCameraZ = range.nearestZ + this.firstPlaneViewOffset
    this.minCameraZ = range.deepestZ + this.lastPlaneViewOffset
    if (this.minCameraZ > this.maxCameraZ) this.minCameraZ = this.maxCameraZ
  }

  cameraZFromScroll(s) {
    return this.cameraStartZ - s * this.scrollToWorldFactor
  }

  scrollFromCameraZ(z) {
    if (this.scrollToWorldFactor === 0) return 0
    return (this.cameraStartZ - z) / this.scrollToWorldFactor
  }

  normalizeWheelDelta(e) {
    if (e.deltaMode === 1) return e.deltaY * 16
    if (e.deltaMode === 2) return e.deltaY * window.innerHeight
    return e.deltaY
  }

  update() {
    this.updateBounds()
    this.minScrollBound = this.scrollFromCameraZ(this.maxCameraZ)
    this.maxScrollBound = this.scrollFromCameraZ(this.minCameraZ)
    this.scrollCurrent = THREE.MathUtils.lerp(this.scrollCurrent, this.scrollTarget, this.scrollSmoothing)
    const minScroll = this.minScrollBound
    const maxScroll = this.maxScrollBound
    this.scrollTarget = THREE.MathUtils.clamp(this.scrollTarget, minScroll, maxScroll)
    this.scrollCurrent = THREE.MathUtils.clamp(this.scrollCurrent, minScroll, maxScroll)

    this.rawVelocity = this.scrollCurrent - this.previousScrollCurrent
    this.velocity = THREE.MathUtils.lerp(this.velocity, this.rawVelocity, this.velocityDamping)
    this.velocity = THREE.MathUtils.clamp(this.velocity, -this.velocityMax, this.velocityMax)
    if (Math.abs(this.velocity) < this.velocityStopThreshold) this.velocity = 0
    this.previousScrollCurrent = this.scrollCurrent

    this.camera.position.z = THREE.MathUtils.clamp(
      this.cameraZFromScroll(this.scrollCurrent),
      this.minCameraZ,
      this.maxCameraZ
    )
  }

  dispose() {
    this.target.removeEventListener('wheel', this.onWheel)
    this.target.removeEventListener('touchstart', this.onTouchStart)
    this.target.removeEventListener('touchmove', this.onTouchMove)
  }
}

/* ============================================================ *
 * Engine
 * ============================================================ */
class Engine {
  constructor({ canvas, container, items, labelRefs, options }) {
    this.canvas = canvas
    this.container = container
    this.options = options
    this.isInitialized = false
    this.isRunning = false
    this.rafId = null
    this.preloaded = new Map()
    this.pointer = new THREE.Vector2(0, 0)
    this.pointerTarget = new THREE.Vector2(0, 0)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    this.camera.position.set(0, 0, 6)

    this.background = new Background()
    this.gallery = new Gallery(items, options)
    this.label = new Label(this.gallery, labelRefs)
    this.scroll = new Scroll(this.camera, this.gallery, container, options.invertScroll)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.autoClear = false

    this.animate = this.update.bind(this)
    this.resizeObserver = new ResizeObserver(() => this.resize())

    this.onPointerMove = (e) => {
      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1
      this.pointerTarget.set(x, -y)
    }
    this.onPointerLeave = () => this.pointerTarget.set(0, 0)
  }

  async init() {
    if (this.isInitialized) return
    this.preloaded = await this.preloadTextures()
    this.gallery.setPreloadedTextures(this.preloaded)

    this.background.init()
    this.gallery.init(this.scene)
    this.label.init()

    this.scroll.init()
    this.resize()
    this.resizeObserver.observe(this.container)
    this.scroll.bindEvents()
    this.container.addEventListener('pointermove', this.onPointerMove, { passive: true })
    this.container.addEventListener('pointerleave', this.onPointerLeave, { passive: true })

    this.isInitialized = true
    this.start()
  }

  start() {
    if (!this.isInitialized || this.isRunning) return
    this.isRunning = true
    this.update()
  }

  resize() {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    if (w <= 0 || h <= 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
    this.gallery.relayout()
  }

  async preloadTextures() {
    const sources = this.gallery.getTextureSources()
    if (!sources.length) return new Map()
    const loader = new THREE.TextureLoader()
    const map = new Map()
    await Promise.all(
      sources.map(async (src) => {
        try {
          const tex = await loader.loadAsync(src)
          tex.minFilter = THREE.LinearFilter
          tex.magFilter = THREE.LinearFilter
          tex.generateMipmaps = false
          map.set(src, tex)
        } catch (err) {
          console.warn(`Texture failed to load: ${src}`, err)
        }
      })
    )
    return map
  }

  update() {
    if (!this.isRunning) return
    this.rafId = requestAnimationFrame(this.animate)
    const time = performance.now()

    this.pointer.lerp(this.pointerTarget, 0.1)
    this.scroll.update()
    this.gallery.update(this.camera, this.pointer)
    this.label.update()

    const velocityMax = Math.max(this.scroll.velocityMax, 0.0001)
    const velNorm = THREE.MathUtils.clamp(Math.abs(this.scroll.velocity) / velocityMax, 0, 1)
    const palette = this.gallery.getBlendedPalette()
    this.background.setTargetPalette(palette.a, palette.b, palette.c)
    this.background.setMotionResponse({
      depthProgress: this.gallery.getDepthProgress(this.camera.position.z),
      velocityIntensity: velNorm,
    })
    this.background.update(time)

    this.renderer.clear(true, true, true)
    this.background.render(this.renderer)
    this.renderer.clearDepth()
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.isRunning = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.resizeObserver.disconnect()
    this.container.removeEventListener('pointermove', this.onPointerMove)
    this.container.removeEventListener('pointerleave', this.onPointerLeave)
    this.scroll.dispose()
    this.gallery.dispose()
    this.background.dispose()
    this.preloaded.forEach((t) => t.dispose())
    this.preloaded.clear()
    this.renderer.dispose()
  }
}

/* ============================================================ *
 * React component
 * ============================================================ */
export default function ParticleDepthGallery({
  items = [],
  className = '',
  style,
  planeGap = 5,
  tilt = 0.12,
  showLabels = true,
  invertScroll = false,
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  const overlayRef = useRef(null)
  const indexRef = useRef(null)
  const wordRef = useRef(null)
  const chipRef = useRef(null)
  const cmykRef = useRef(null)
  const rgbRef = useRef(null)
  const hexRef = useRef(null)
  const pmsRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas || !items.length) return

    const normalized = normalizeItems(items)
    const labelRefs = showLabels
      ? {
          overlay: overlayRef.current,
          index: indexRef.current,
          word: wordRef.current,
          chip: chipRef.current,
          cmyk: cmykRef.current,
          rgb: rgbRef.current,
          hex: hexRef.current,
          pms: pmsRef.current,
          enterClass: styles.enter,
        }
      : null

    const engine = new Engine({
      canvas,
      container,
      items: normalized,
      labelRefs,
      options: { planeGap, tilt, invertScroll },
    })

    let disposed = false
    engine.init().catch((err) => console.error('ParticleDepthGallery init failed', err))

    return () => {
      if (disposed) return
      disposed = true
      Promise.resolve().then(() => engine.dispose())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, planeGap, tilt, showLabels, invertScroll])

  return (
    <div ref={containerRef} className={`${styles.root} ${className}`} style={style}>
      <canvas ref={canvasRef} className={styles.canvas} />

      {showLabels && (
        <section ref={overlayRef} className={styles.overlay}>
          <p ref={indexRef} className={styles.index} />
          <div className={styles.caption}>
            <span ref={chipRef} className={styles.chip} />
            <p ref={wordRef} className={styles.word} />
          </div>
          <dl className={styles.specs}>
            <div className={styles.row}>
              <dt>CMYK</dt>
              <dd ref={cmykRef} className={styles.value} />
            </div>
            <div className={styles.row}>
              <dt>RGB</dt>
              <dd ref={rgbRef} className={styles.value} />
            </div>
            <div className={styles.row}>
              <dt>HEX</dt>
              <dd ref={hexRef} className={styles.value} />
            </div>
            <div className={styles.row}>
              <dt>PMS</dt>
              <dd ref={pmsRef} className={styles.value} />
            </div>
          </dl>
        </section>
      )}
    </div>
  )
}