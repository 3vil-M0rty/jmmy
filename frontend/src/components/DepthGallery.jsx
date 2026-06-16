import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import styles from './DepthGallery.module.css'

/**
 * DepthGallery
 * -------------------------------------------------------------------------
 * A scroll-driven WebGL "atmospheric depth gallery".
 * Original Three.js demo by Houmahani Kane (Codrops) — ported to a reusable,
 * self-contained React component with a CSS module.
 *
 * It renders ONLY the experience (canvas + optional label overlay). No header,
 * no footer. Everything is driven by the `items` prop.
 *
 * Each item can use flat fields or a nested `label` object:
 *   {
 *     image:        '/path/to/image.webp', // texture (optional -> falls back to color)
 *     word:         'golden',              // label word
 *     pms:          'PMS 135 C',           // label PMS code
 *     accentColor:  '#feca4f',             // chip + CMYK/RGB/HEX swatch
 *     textColor:    '#2e2e2e',             // label text color
 *     fallbackColor:'#feca4f',             // plane color before/without a texture
 *     background:   '#fffaf0',             // mood background color
 *     blob1:        '#ffdf94',             // mood blob 1
 *     blob2:        '#fce7c4',             // mood blob 2
 *     position:     { x: -0.9, y: 0 },     // layout offset (optional)
 *   }
 *
 * IMPORTANT: the parent element must have a height (the component fills it).
 * Requires `three` (tested against three >= 0.16x).
 */

/* ============================================================ *
 * Shaders for the mood-blob background
 * ============================================================ */
const BG_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const BG_FRAGMENT = /* glsl */ `
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
    const fallbackColor =
      item.fallbackColor || item.color || item.accentColor || '#ffffff'
    const nestedLabel = item.label && typeof item.label === 'object' ? item.label : {}
    return {
      textureSrc: item.image || item.textureSrc || item.src || null,
      fallbackColor,
      accentColor: item.accentColor || fallbackColor,
      backgroundColor: item.background || item.backgroundColor || fallbackColor,
      blob1Color: item.blob1 || item.blob1Color || fallbackColor,
      blob2Color: item.blob2 || item.blob2Color || fallbackColor,
      position: item.position || { x: index % 2 === 0 ? -0.8 : 0.8, y: 0 },
      label: {
        word: item.word || nestedLabel.word || `tone ${String(index + 1).padStart(2, '0')}`,
        pms: item.pms || nestedLabel.pms || 'N/A',
        color: item.textColor || nestedLabel.color || '',
      },
    }
  })
}

/* ============================================================ *
 * Background (mood-blob shader quad)
 * ============================================================ */
class Background {
  constructor() {
    this.isInitialized = false
    this.scene = null
    this.camera = null
    this.material = null
    this.mesh = null

    this.backgroundColor = new THREE.Color('#FBE8CD')
    this.blob1Color = new THREE.Color('#FFD56D')
    this.blob2Color = new THREE.Color('#5D816A')
    this.nextBackgroundColor = new THREE.Color()
    this.nextBlob1Color = new THREE.Color()
    this.nextBlob2Color = new THREE.Color()

    this.baseBlobRadius = 0.65
    this.secondaryBlobRadiusRatio = 0.78
    this.baseBlobStrength = 0.9

    this.depthToRadiusAmount = 0.08
    this.velocityToStrengthAmount = 0.1
    this.motionSmoothing = 0.1
    this.motionDepthProgress = 0
    this.motionVelocityIntensity = 0
    this.smoothedDepthProgress = 0
    this.smoothedVelocityIntensity = 0

    this.blobRadius = this.baseBlobRadius
    this.blobStrength = this.baseBlobStrength
    this.noiseStrength = 0.04
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

    const geometry = new THREE.PlaneGeometry(2, 2)
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)
    this.applyMotionToBlob()
    this.isInitialized = true
  }

  setMoodColors({ background, blob1, blob2 } = {}) {
    if (background) this.backgroundColor.set(background)
    if (blob1) this.blob1Color.set(blob1)
    if (blob2) this.blob2Color.set(blob2)
    this.updateUniformColors()
  }

  setMoodBlend({ currentMood, nextMood, blend } = {}) {
    if (!currentMood) return
    const safeBlend = THREE.MathUtils.clamp(blend ?? 0, 0, 1)
    if (!nextMood || safeBlend <= 0) {
      this.setMoodColors(currentMood)
      return
    }
    this.backgroundColor
      .set(currentMood.background)
      .lerp(this.nextBackgroundColor.set(nextMood.background), safeBlend)
    this.blob1Color.set(currentMood.blob1).lerp(this.nextBlob1Color.set(nextMood.blob1), safeBlend)
    this.blob2Color.set(currentMood.blob2).lerp(this.nextBlob2Color.set(nextMood.blob2), safeBlend)
    this.updateUniformColors()
  }

  updateUniformColors() {
    if (!this.material) return
    this.material.uniforms.uBackgroundColor.value.copy(this.backgroundColor)
    this.material.uniforms.uBlob1Color.value.copy(this.blob1Color)
    this.material.uniforms.uBlob2Color.value.copy(this.blob2Color)
    this.material.uniforms.uNoiseStrength.value = this.noiseStrength
  }

  updateBlobUniforms() {
    if (!this.material) return
    this.material.uniforms.uBlobRadius.value = this.blobRadius
    this.material.uniforms.uBlobRadiusSecondary.value =
      this.blobRadius * this.secondaryBlobRadiusRatio
    this.material.uniforms.uBlobStrength.value = this.blobStrength
  }

  setMotionResponse({ depthProgress, velocityIntensity } = {}) {
    if (Number.isFinite(depthProgress)) {
      this.motionDepthProgress = THREE.MathUtils.clamp(depthProgress, 0, 1)
    }
    if (Number.isFinite(velocityIntensity)) {
      this.motionVelocityIntensity = THREE.MathUtils.clamp(velocityIntensity, 0, 1)
    }
  }

  applyMotionToBlob() {
    const nextBlobRadius = this.baseBlobRadius + this.smoothedDepthProgress * this.depthToRadiusAmount
    const nextBlobStrength =
      this.baseBlobStrength + this.smoothedVelocityIntensity * this.velocityToStrengthAmount
    this.blobRadius = THREE.MathUtils.clamp(nextBlobRadius, 0.05, 1)
    this.blobStrength = THREE.MathUtils.clamp(nextBlobStrength, 0, 1)
    this.updateBlobUniforms()
  }

  update(time = 0) {
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
    if (this.material) {
      this.material.uniforms.uTime.value = time
      this.material.uniforms.uVelocityIntensity.value = this.smoothedVelocityIntensity
    }
    this.applyMotionToBlob()
  }

  render(renderer) {
    if (!this.isInitialized) return
    renderer.render(this.scene, this.camera)
  }

  dispose() {
    if (!this.isInitialized) return
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.scene.clear()
    this.scene = null
    this.camera = null
    this.mesh = null
    this.material = null
    this.isInitialized = false
  }
}

/* ============================================================ *
 * Gallery (image planes, parallax, breath, depth fade)
 * ============================================================ */
class Gallery {
  constructor(planeConfig, container) {
    this.isInitialized = false
    this.container = container
    this.planes = []
    this.texturesBySource = new Map()
    this.useTextures = true
    this.planeGap = 5
    this.desktopPlaneScale = 1
    this.mobilePlaneScale = 0.65
    this.mobileXSpreadFactor = 0.25
    this.mobileBreakpoint = 768
    this.planeConfig = planeConfig
    this.moodSampleOffset = 1
    this.planeFadeSampleOffset = 1
    this.planeFadeSmoothing = 0.14

    // Parallax
    this.parallaxEnabled = true
    this.parallaxAmountX = 0.16
    this.parallaxAmountY = 0.08
    this.parallaxSmoothing = 0.08
    this.pointerTarget = new THREE.Vector2(0, 0)
    this.pointerCurrent = new THREE.Vector2(0, 0)

    // Breath
    this.breathEnabled = true
    this.breathTiltAmount = 0.045
    this.breathScaleAmount = 0.03
    this.breathSmoothing = 0.14
    this.breathGain = 1.1
    this.breathIntensity = 0
    this.targetBreathIntensity = 0

    // Gesture drift
    this.gestureParallaxEnabled = true
    this.gestureParallaxAmountY = 0.05
    this.gestureParallaxSmoothing = 0.05
    this.driftCurrent = 0
    this.driftTarget = 0

    this.onPointerMove = (event) => {
      const rect = this.container.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1
      this.pointerTarget.set(x, -y)
    }
    this.onPointerLeave = () => {
      this.pointerTarget.set(0, 0)
    }
  }

  async init(scene) {
    if (this.isInitialized) return
    this.setPlanes(scene)
    this.updatePlaneMaterialMode()
    this.updatePlaneScale()
    this.layoutPlanes()
    this.bindPointerEvents()
    this.isInitialized = true
  }

  setPlanes(scene) {
    const planeGeometry = new THREE.PlaneGeometry(3, 3)
    this.planeConfig.forEach((plane, index) => {
      const texture = this.texturesBySource.get(plane.textureSrc) || null
      const textureImage = texture?.image
      const aspectRatio =
        textureImage && textureImage.width > 0 && textureImage.height > 0
          ? textureImage.width / textureImage.height
          : 1
      const fallbackColor = plane.fallbackColor || '#ffffff'
      const labelData = plane.label
      const planeMaterial = new THREE.MeshBasicMaterial({
        color: fallbackColor,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        opacity: index === 0 ? 1 : 0,
      })
      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial)
      planeMesh.userData.basePosition = plane.position
      planeMesh.userData.baseColor = fallbackColor
      planeMesh.userData.accentColor = plane.accentColor
      planeMesh.userData.backgroundColor = plane.backgroundColor
      planeMesh.userData.blob1Color = plane.blob1Color
      planeMesh.userData.blob2Color = plane.blob2Color
      planeMesh.userData.label = labelData
      planeMesh.userData.texture = texture
      planeMesh.userData.aspectRatio = aspectRatio
      scene.add(planeMesh)
      this.planes.push(planeMesh)
    })
    this.planeGeometry = planeGeometry
  }

  updatePlaneScale() {
    const isMobileViewport = window.innerWidth <= this.mobileBreakpoint
    const scale = isMobileViewport ? this.mobilePlaneScale : this.desktopPlaneScale
    this.planes.forEach((plane) => {
      const aspectRatio = plane.userData.aspectRatio || 1
      plane.scale.set(scale * aspectRatio, scale, 1)
    })
  }

  layoutPlanes() {
    const xSpreadFactor = this.getXSpreadFactor()
    this.planes.forEach((plane, index) => {
      const basePosition = plane.userData.basePosition || { x: 0, y: 0 }
      const xPosition = basePosition.x * xSpreadFactor
      plane.position.set(xPosition, basePosition.y, -index * this.planeGap)
    })
  }

  getXSpreadFactor() {
    const isMobileViewport = window.innerWidth <= this.mobileBreakpoint
    return isMobileViewport ? this.mobileXSpreadFactor : 1
  }

  getDepthRange() {
    if (!this.planes.length) return { nearestZ: 0, deepestZ: 0 }
    const zPositions = this.planes.map((plane) => plane.position.z)
    return { nearestZ: Math.max(...zPositions), deepestZ: Math.min(...zPositions) }
  }

  getDepthProgress(cameraZ) {
    const { nearestZ, deepestZ } = this.getDepthRange()
    const depthSpan = nearestZ - deepestZ
    if (depthSpan <= 0) return 0
    return THREE.MathUtils.clamp((nearestZ - cameraZ) / depthSpan, 0, 1)
  }

  getMoodColorsByIndex(index) {
    if (index < 0 || index >= this.planes.length) return null
    const { backgroundColor, blob1Color, blob2Color } = this.planes[index].userData
    if (!backgroundColor) return null
    return { background: backgroundColor, blob1: blob1Color, blob2: blob2Color }
  }

  getMoodBlendData(cameraZ) {
    if (!this.planes.length) return null
    const safeCameraZ = Number.isFinite(cameraZ) ? cameraZ : this.planes[0].position.z
    const moodSampleZ = safeCameraZ - this.planeGap * this.moodSampleOffset
    const lastPlaneIndex = this.planes.length - 1

    if (lastPlaneIndex === 0 || this.planeGap <= 0) {
      const singleMood = this.getMoodColorsByIndex(0)
      if (!singleMood) return null
      return { currentMood: singleMood, nextMood: singleMood, blend: 0 }
    }

    const firstPlaneZ = this.planes[0].position.z
    const normalizedDepth = THREE.MathUtils.clamp(
      (firstPlaneZ - moodSampleZ) / this.planeGap,
      0,
      lastPlaneIndex
    )
    const currentPlaneIndex = Math.floor(normalizedDepth)
    const nextPlaneIndex = Math.min(currentPlaneIndex + 1, lastPlaneIndex)
    const blend = normalizedDepth - currentPlaneIndex

    const currentMood = this.getMoodColorsByIndex(currentPlaneIndex)
    const nextMood = this.getMoodColorsByIndex(nextPlaneIndex) || currentMood
    if (!currentMood || !nextMood) return null
    return { currentMood, nextMood, blend }
  }

  getPlaneBlendData(cameraZ) {
    if (!this.planes.length) return null
    const planeGap = Math.max(this.planeGap, 0.0001)
    const firstPlaneZ = this.planes[0].position.z
    const lastPlaneIndex = this.planes.length - 1
    const sampledCameraZ = cameraZ - planeGap * this.planeFadeSampleOffset
    const normalizedDepth = THREE.MathUtils.clamp(
      (firstPlaneZ - sampledCameraZ) / planeGap,
      0,
      lastPlaneIndex
    )
    const currentPlaneIndex = Math.floor(normalizedDepth)
    const nextPlaneIndex = Math.min(currentPlaneIndex + 1, lastPlaneIndex)
    const blend = normalizedDepth - currentPlaneIndex
    return { currentPlaneIndex, nextPlaneIndex, blend }
  }

  getTextureSources() {
    const textureSources = this.planeConfig
      .map((planeDefinition) => planeDefinition.textureSrc)
      .filter(Boolean)
    return [...new Set(textureSources)]
  }

  setPreloadedTextures(texturesBySource) {
    this.texturesBySource = texturesBySource instanceof Map ? texturesBySource : new Map()
  }

  updatePlaneMaterialMode() {
    this.planes.forEach((plane) => {
      const planeMaterial = plane.material
      const texture = plane.userData.texture || null
      const hasTexture = Boolean(texture)
      planeMaterial.map = this.useTextures && hasTexture ? texture : null
      planeMaterial.color.set(this.useTextures && hasTexture ? '#ffffff' : plane.userData.baseColor)
      planeMaterial.needsUpdate = true
    })
  }

  updatePlaneVisibility(cameraZ) {
    const blendData = this.getPlaneBlendData(cameraZ)
    if (!blendData) return
    const { currentPlaneIndex, nextPlaneIndex, blend } = blendData
    this.planes.forEach((plane, index) => {
      let targetOpacity = 0
      if (index === currentPlaneIndex) targetOpacity = 1 - blend
      if (index === nextPlaneIndex) targetOpacity = Math.max(targetOpacity, blend)
      const currentOpacity = Number.isFinite(plane.material.opacity) ? plane.material.opacity : 0
      plane.material.opacity = THREE.MathUtils.lerp(
        currentOpacity,
        targetOpacity,
        this.planeFadeSmoothing
      )
      plane.material.needsUpdate = true
    })
  }

  bindPointerEvents() {
    this.container.addEventListener('pointermove', this.onPointerMove, { passive: true })
    this.container.addEventListener('pointerleave', this.onPointerLeave, { passive: true })
  }

  updatePlaneMotion(scroll = null) {
    this.pointerCurrent.lerp(this.pointerTarget, this.parallaxSmoothing)

    const velocityMax = Math.max(scroll?.velocityMax || 1, 0.0001)
    const velocityNormalized = THREE.MathUtils.clamp(
      Math.abs(scroll?.velocity || 0) / velocityMax,
      0,
      1
    )
    const scrollDrift = THREE.MathUtils.clamp((scroll?.velocity || 0) / velocityMax, -1, 1)
    this.targetBreathIntensity = this.breathEnabled
      ? THREE.MathUtils.clamp(velocityNormalized * this.breathGain, 0, 1)
      : 0
    this.breathIntensity = THREE.MathUtils.lerp(
      this.breathIntensity,
      this.targetBreathIntensity,
      this.breathSmoothing
    )
    this.driftTarget = this.gestureParallaxEnabled ? scrollDrift : 0
    this.driftCurrent = THREE.MathUtils.lerp(
      this.driftCurrent,
      this.driftTarget,
      this.gestureParallaxSmoothing
    )

    const xSpreadFactor = this.getXSpreadFactor()

    this.planes.forEach((plane, index) => {
      const basePosition = plane.userData.basePosition || { x: 0, y: 0 }
      const xPosition = basePosition.x * xSpreadFactor
      const yPosition = basePosition.y
      const zPosition = -index * this.planeGap
      const opacity = Number.isFinite(plane.material.opacity) ? plane.material.opacity : 0
      const depthInfluence = 1 + index * 0.05
      const parallaxInfluence = this.parallaxEnabled ? opacity * depthInfluence : 0

      const parallaxOffsetX = this.pointerCurrent.x * this.parallaxAmountX * parallaxInfluence
      const parallaxOffsetY = this.pointerCurrent.y * this.parallaxAmountY * parallaxInfluence
      const gestureOffsetY = this.driftCurrent * this.gestureParallaxAmountY

      plane.position.x = xPosition + parallaxOffsetX
      plane.position.y = yPosition + parallaxOffsetY + gestureOffsetY
      plane.position.z = zPosition

      const breathInfluence = this.breathEnabled ? this.breathIntensity * opacity : 0
      const tiltX = -this.pointerCurrent.y * this.breathTiltAmount * breathInfluence
      const tiltY = this.pointerCurrent.x * this.breathTiltAmount * breathInfluence
      plane.rotation.x = tiltX
      plane.rotation.y = tiltY
      plane.rotation.z = 0

      const aspectRatio = plane.userData.aspectRatio || 1
      const baseScale =
        window.innerWidth <= this.mobileBreakpoint ? this.mobilePlaneScale : this.desktopPlaneScale
      const scalePulse = 1 + this.breathScaleAmount * breathInfluence
      plane.scale.x = baseScale * aspectRatio * scalePulse
      plane.scale.y = baseScale * scalePulse
      plane.scale.z = 1
    })
  }

  update(camera = null, scroll = null) {
    if (!camera) return
    this.updatePlaneVisibility(camera.position.z)
    this.updatePlaneMotion(scroll)
  }

  dispose() {
    this.container.removeEventListener('pointermove', this.onPointerMove)
    this.container.removeEventListener('pointerleave', this.onPointerLeave)
    this.planes.forEach((plane) => plane.material.dispose())
    this.planeGeometry?.dispose()
  }
}

/* ============================================================ *
 * Label (color-spec overlay, updated imperatively via refs)
 * ============================================================ */
class Label {
  constructor(gallery, refs) {
    this.gallery = gallery
    this.refs = refs // { overlay, index, word, chip, cmyk, rgb, hex, pms }
    this.activePlaneIndex = -1
  }

  init() {
    if (this.refs?.overlay) this.refs.overlay.style.opacity = '0'
  }

  normalizeHexColor(rawColor) {
    const fallbackColor = '#ffffff'
    if (typeof rawColor !== 'string') return fallbackColor
    let hexColor = rawColor.trim()
    if (!hexColor) return fallbackColor
    if (!hexColor.startsWith('#')) hexColor = `#${hexColor}`
    if (/^#[0-9a-fA-F]{3}$/.test(hexColor)) {
      const shortHex = hexColor.slice(1)
      hexColor = `#${shortHex.split('').map((c) => `${c}${c}`).join('')}`
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(hexColor)) return fallbackColor
    return hexColor.toLowerCase()
  }

  hexToRgb(hexColor) {
    const normalizedColor = this.normalizeHexColor(hexColor).slice(1)
    return {
      r: Number.parseInt(normalizedColor.slice(0, 2), 16),
      g: Number.parseInt(normalizedColor.slice(2, 4), 16),
      b: Number.parseInt(normalizedColor.slice(4, 6), 16),
    }
  }

  rgbToCmyk({ r, g, b }) {
    const red = r / 255
    const green = g / 255
    const blue = b / 255
    const black = 1 - Math.max(red, green, blue)
    if (black >= 0.999) return { c: 0, m: 0, y: 0, k: 100 }
    return {
      c: Math.round(((1 - red - black) / (1 - black)) * 100),
      m: Math.round(((1 - green - black) / (1 - black)) * 100),
      y: Math.round(((1 - blue - black) / (1 - black)) * 100),
      k: Math.round(black * 100),
    }
  }

  buildColorSpecs(accentColor, pmsValue) {
    const normalizedAccentColor = this.normalizeHexColor(accentColor)
    const rgb = this.hexToRgb(normalizedAccentColor)
    const cmyk = this.rgbToCmyk(rgb)
    return {
      chipHex: normalizedAccentColor,
      cmyk: `${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`,
      rgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
      hex: normalizedAccentColor.slice(1).toUpperCase(),
      pms: pmsValue || 'N/A',
    }
  }

  getTargetPlaneIndex(cameraZ) {
    const blendData = this.gallery.getPlaneBlendData(cameraZ)
    if (!blendData) return -1
    return blendData.blend >= 0.5 ? blendData.nextPlaneIndex : blendData.currentPlaneIndex
  }

  applyPlaneContent(planeIndex) {
    const plane = this.gallery.planes[planeIndex]
    if (!plane || this.activePlaneIndex === planeIndex || !this.refs) return
    const labelData = plane.userData.label || {}
    const colorSpecs = this.buildColorSpecs(plane.userData.accentColor, labelData.pms)

    if (this.refs.index) this.refs.index.textContent = String(planeIndex + 1).padStart(2, '0')
    if (this.refs.word) this.refs.word.textContent = labelData.word || 'tone'
    if (this.refs.chip) this.refs.chip.style.backgroundColor = colorSpecs.chipHex
    if (this.refs.cmyk) this.refs.cmyk.textContent = colorSpecs.cmyk
    if (this.refs.rgb) this.refs.rgb.textContent = colorSpecs.rgb
    if (this.refs.hex) this.refs.hex.textContent = colorSpecs.hex
    if (this.refs.pms) this.refs.pms.textContent = colorSpecs.pms
    if (this.refs.overlay) this.refs.overlay.style.color = labelData.color || ''

    this.activePlaneIndex = planeIndex
  }

  update(camera = null) {
    if (!camera || !this.refs?.overlay) return
    const targetPlaneIndex = this.getTargetPlaneIndex(camera.position.z)
    if (targetPlaneIndex < 0) {
      this.refs.overlay.style.opacity = '0'
      return
    }
    this.applyPlaneContent(targetPlaneIndex)
    this.refs.overlay.style.opacity = '1'
  }
}

/* ============================================================ *
 * Trail (glowing tapered tube following a procedural path)
 * ============================================================ */
class Trail {
  constructor() {
    this.group = new THREE.Group()
    this.points = []
    this.mesh = null

    this.minDistance = 0.006
    this.maxPoints = 220
    this.curveTension = 0.5
    this.curveSegments = 220
    this.radialSegments = 8
    this.radiusHead = 0.012
    this.radiusTail = 0.003
    this.pointSmoothing = 0.3
    this.maxTrimPerFrame = 4
    this.jumpResetDistance = 999

    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f6f9ff'),
      emissive: new THREE.Color('#7fd5ff'),
      emissiveIntensity: 1.35,
      roughness: 0.2,
      metalness: 0.05,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
    })
  }

  get object() {
    return this.group
  }

  addPoint(position) {
    if (!(position instanceof THREE.Vector3)) return
    const lastPoint = this.points[this.points.length - 1] || null
    if (lastPoint && position.distanceToSquared(lastPoint) < this.minDistance * this.minDistance) {
      return
    }
    const nextPoint = position.clone()
    if (lastPoint && nextPoint.distanceTo(lastPoint) > this.jumpResetDistance) {
      this.points = [nextPoint]
      if (this.mesh) {
        this.mesh.geometry.dispose()
        this.group.remove(this.mesh)
        this.mesh = null
      }
      return
    }
    const easedPoint = lastPoint
      ? lastPoint.clone().lerp(nextPoint, this.pointSmoothing)
      : nextPoint
    this.points.push(easedPoint)

    let trimBudget = this.maxTrimPerFrame
    while (this.points.length > this.maxPoints && trimBudget > 0) {
      this.points.shift()
      trimBudget -= 1
    }
    if (this.points.length < 2) return

    const curve = new THREE.CatmullRomCurve3(this.points, false, 'centripetal', this.curveTension)
    const segments = Math.max(24, Math.min(this.curveSegments, this.points.length * 4))
    const nextGeometry = this.createTaperedTube(curve, segments, this.radiusHead, this.radiusTail)

    if (!this.mesh) {
      this.mesh = new THREE.Mesh(nextGeometry, this.material)
      this.mesh.renderOrder = 1200
      this.group.add(this.mesh)
      return
    }
    this.mesh.geometry.dispose()
    this.mesh.geometry = nextGeometry
  }

  createTaperedTube(curve, segments, radiusHead, radiusTail) {
    const pathPoints = curve.getSpacedPoints(segments)
    const radialSegments = this.radialSegments
    const ringPoints = radialSegments + 1
    const vertices = []
    const indices = []

    const up = new THREE.Vector3(0, 0, 1)
    const tangent = new THREE.Vector3()
    const normal = new THREE.Vector3()
    const binormal = new THREE.Vector3()
    const radialOffset = new THREE.Vector3()
    const vertexPosition = new THREE.Vector3()

    for (let i = 0; i < pathPoints.length; i += 1) {
      const t = i / Math.max(pathPoints.length - 1, 1)
      const radius = radiusHead + (radiusTail - radiusHead) * Math.pow(t, 1.5)
      curve.getTangent(t, tangent).normalize()
      normal.crossVectors(up, tangent).normalize()
      if (normal.lengthSq() === 0) normal.set(1, 0, 0)
      binormal.crossVectors(tangent, normal).normalize()

      for (let j = 0; j <= radialSegments; j += 1) {
        const angle = (j / radialSegments) * Math.PI * 2
        const cx = -Math.cos(angle) * radius
        const cy = Math.sin(angle) * radius
        radialOffset.copy(normal).multiplyScalar(cx).addScaledVector(binormal, cy)
        vertexPosition.copy(pathPoints[i]).add(radialOffset)
        vertices.push(vertexPosition.x, vertexPosition.y, vertexPosition.z)
      }
    }

    for (let i = 0; i < pathPoints.length - 1; i += 1) {
      for (let j = 0; j < radialSegments; j += 1) {
        const baseIndex = i * ringPoints + j
        indices.push(baseIndex, baseIndex + ringPoints, baseIndex + 1)
        indices.push(baseIndex + ringPoints, baseIndex + ringPoints + 1, baseIndex + 1)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }

  dispose() {
    this.reset()
    this.material.dispose()
  }

  reset() {
    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.group.remove(this.mesh)
      this.mesh = null
    }
    this.points = []
  }
}

/* ============================================================ *
 * TrailHeadParticles (sparkles near the trail head)
 * ============================================================ */
class TrailHeadParticles {
  constructor() {
    this.group = new THREE.Group()
    this.group.renderOrder = 1300

    this.isEnabled = true
    this.maxParticles = 18
    this.spawnPerSecond = 20
    this.spawnRadius = 0.52
    this.speedMin = 0.05
    this.speedMax = 0.22
    this.lifeMin = 0.25
    this.lifeMax = 0.6
    this.sizeMin = 0.007
    this.sizeMax = 0.02
    this.dragPerFrame = 0.94

    this.spawnAccumulator = 0
    this.nextSpawnIndex = 0
    this.sharedGeometry = new THREE.SphereGeometry(1, 5, 4)
    this.particles = []

    for (let index = 0; index < this.maxParticles; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#f6f9ff'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      })
      const mesh = new THREE.Mesh(this.sharedGeometry, material)
      mesh.visible = false
      this.group.add(mesh)
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        lifeRemaining: 0,
        totalLife: 0,
      })
    }
  }

  get object() {
    return this.group
  }

  setEnabled(isEnabled) {
    if (this.isEnabled && !isEnabled) this.clear()
    this.isEnabled = Boolean(isEnabled)
    this.group.visible = this.isEnabled
  }

  update(deltaSeconds, headPosition, opacity = 1, shouldSpawn = true) {
    const safeDelta = Math.min(Math.max(deltaSeconds || 0, 0), 0.1)
    if (this.isEnabled && shouldSpawn && safeDelta > 0) {
      this.spawnAccumulator += safeDelta * this.spawnPerSecond
      const spawnCount = Math.floor(this.spawnAccumulator)
      this.spawnAccumulator -= spawnCount
      for (let index = 0; index < spawnCount; index += 1) {
        this.spawnParticle(headPosition)
      }
    } else {
      this.spawnAccumulator = 0
    }

    const clampedOpacity = THREE.MathUtils.clamp(opacity, 0, 1)
    const drag = Math.pow(this.dragPerFrame, safeDelta * 60)

    this.particles.forEach((particle) => {
      if (particle.lifeRemaining <= 0) return
      particle.lifeRemaining -= safeDelta
      if (particle.lifeRemaining <= 0) {
        particle.lifeRemaining = 0
        particle.mesh.visible = false
        particle.mesh.material.opacity = 0
        return
      }
      particle.velocity.multiplyScalar(drag)
      particle.mesh.position.addScaledVector(particle.velocity, safeDelta)
      const lifeRatio = particle.lifeRemaining / particle.totalLife
      particle.mesh.material.opacity = lifeRatio * clampedOpacity * 0.75
    })
  }

  spawnParticle(headPosition) {
    const particle = this.particles[this.nextSpawnIndex]
    this.nextSpawnIndex = (this.nextSpawnIndex + 1) % this.particles.length
    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * this.spawnRadius
    particle.mesh.position.set(
      headPosition.x + Math.cos(angle) * radius,
      headPosition.y + (Math.random() - 0.5) * this.spawnRadius * 0.6,
      headPosition.z + Math.sin(angle) * radius
    )
    const size = THREE.MathUtils.lerp(this.sizeMin, this.sizeMax, Math.random())
    particle.mesh.scale.setScalar(size)
    particle.mesh.visible = true
    const speed = THREE.MathUtils.lerp(this.speedMin, this.speedMax, Math.random())
    particle.velocity.set(
      (Math.random() - 0.5) * speed,
      (Math.random() - 0.5) * speed * 0.6,
      (Math.random() - 0.5) * speed
    )
    particle.totalLife = THREE.MathUtils.lerp(this.lifeMin, this.lifeMax, Math.random())
    particle.lifeRemaining = particle.totalLife
    particle.mesh.material.opacity = 0.4
  }

  dispose() {
    this.clear()
    this.particles.forEach((particle) => particle.mesh.material.dispose())
    this.sharedGeometry.dispose()
    this.group.clear()
    this.particles = []
  }

  clear() {
    this.spawnAccumulator = 0
    this.particles.forEach((particle) => {
      particle.lifeRemaining = 0
      particle.totalLife = 0
      particle.mesh.visible = false
      particle.mesh.material.opacity = 0
    })
  }
}

/* ============================================================ *
 * TrailController (drives the trail along a procedural path)
 * ============================================================ */
const FULL_CIRCLE_RADIANS = Math.PI * 2

class TrailController {
  constructor({ gallery, enabled = true, enableParticles = true }) {
    this.trail = new Trail()
    this.trailHeadParticles = new TrailHeadParticles()
    this.gallery = gallery
    this.trailHeadPosition = new THREE.Vector3()
    this._prevTime = null

    this.configuration = {
      isEnabled: enabled,
      pathSettings: {
        startXPosition: -0.96,
        startYPosition: -1.05,
        horizontalWidth: 3,
        horizontalCycles: 1.85,
        verticalAmplitude: 0.78,
        verticalCycles: 2.1,
        distanceAheadOfCamera: 1.65,
        baseDepthOffset: 4.78,
        depthSpan: 6.52,
        progressDepthOffset: -0.1,
      },
      responsiveSettings: {
        mobileBreakpoint: 768,
        mobileWidthScale: 0.35,
        mobileStartXOffset: 0.35,
      },
      pointSettings: {
        minimumPointCount: 14,
        maximumPointCount: 220,
        reverseLengthScale: 0.55,
        initialSeedPointCount: 10,
        initialSeedStepZ: 0.12,
        trimPerFrameForward: 4,
        trimPerFrameReverse: 32,
      },
      opacitySettings: {
        baseOpacity: 0.51,
        idleOpacityAtStart: 0.55,
        idleProgressThreshold: 0.01,
        startVisibilityBias: 0.1,
        edgeFadeStart: 0.04,
        edgeFadeEnd: 0.2,
        opacitySmoothing: 0.12,
      },
      visualSettings: {
        trailColor: '#f6f9ff',
        glowColor: '#ffffff',
        glowIntensity: 1.35,
        curveTension: 0.67,
        pointSmoothing: 0.53,
      },
      specialEffectsSettings: {
        showHeadParticles: enableParticles,
      },
      directionChangeEpsilon: 0.0005,
    }

    this.runtimeState = {
      hasSeededInitialPoints: false,
      hasUserMovedFromStart: false,
      previousProgress: null,
      previousDirection: 0,
      currentOpacity: this.configuration.opacitySettings.baseOpacity,
    }

    this.applyVisualSettings()
  }

  applyVisualSettings() {
    const { visualSettings, opacitySettings } = this.configuration
    this.trail.material.color.set(visualSettings.trailColor)
    this.trail.material.emissive.set(visualSettings.glowColor)
    this.trail.material.emissiveIntensity = visualSettings.glowIntensity
    this.trail.material.opacity = opacitySettings.baseOpacity
    this.trail.material.needsUpdate = true
    this.trail.curveTension = visualSettings.curveTension
    this.trail.pointSmoothing = visualSettings.pointSmoothing
    this.trailHeadParticles.particles.forEach((particle) => {
      particle.mesh.material.color.set(visualSettings.trailColor)
    })
  }

  init(scene, camera) {
    scene.add(this.trail.object)
    scene.add(this.trailHeadParticles.object)
    this.seedInitialPoints(camera)
  }

  dispose() {
    this.trail.dispose()
    this.trailHeadParticles.dispose()
  }

  update(camera = null, scroll = null, time = null) {
    if (!camera) return
    let deltaSeconds = 0
    if (Number.isFinite(time)) {
      if (this._prevTime != null) deltaSeconds = (time - this._prevTime) / 1000
      this._prevTime = time
    }
    deltaSeconds = Math.min(Math.max(deltaSeconds, 0), 0.1)

    this.trail.object.visible = this.configuration.isEnabled
    const shouldShowHeadParticles =
      this.configuration.isEnabled && this.configuration.specialEffectsSettings.showHeadParticles
    this.trailHeadParticles.setEnabled(shouldShowHeadParticles)
    if (!this.configuration.isEnabled) return

    const currentProgress = this.getProgress(camera, scroll)
    if (currentProgress > this.configuration.opacitySettings.idleProgressThreshold) {
      this.runtimeState.hasUserMovedFromStart = true
    }

    const currentDirection = this.getDirection(currentProgress)
    const hasDirectionReversed =
      currentDirection !== 0 &&
      this.runtimeState.previousDirection !== 0 &&
      currentDirection !== this.runtimeState.previousDirection

    this.updateLength(currentProgress, currentDirection || this.runtimeState.previousDirection)
    const trailHeadPosition = this.computeHeadPosition(camera.position.z, currentProgress)
    this.updateOpacity(currentProgress)

    if (hasDirectionReversed) {
      this.trail.reset()
      const restartLeadPosition = trailHeadPosition.clone()
      restartLeadPosition.z += currentDirection * this.configuration.pointSettings.initialSeedStepZ
      this.trail.addPoint(restartLeadPosition)
    }

    this.trail.addPoint(trailHeadPosition)

    if (currentDirection !== 0) this.runtimeState.previousDirection = currentDirection
    this.runtimeState.previousProgress = currentProgress

    this.trailHeadParticles.update(
      deltaSeconds,
      trailHeadPosition,
      this.runtimeState.currentOpacity,
      true
    )
  }

  getProgress(camera, scroll) {
    const scrollRange = (scroll?.maxCameraZ ?? 0) - (scroll?.minCameraZ ?? 0)
    if (Number.isFinite(scrollRange) && scrollRange > 0) {
      return THREE.MathUtils.clamp(
        ((scroll?.maxCameraZ ?? camera.position.z) - camera.position.z) / scrollRange,
        0,
        1
      )
    }
    const blend = this.gallery.getPlaneBlendData(camera.position.z)
    if (blend) {
      const lastIndex = Math.max(this.gallery.planes.length - 1, 1)
      return THREE.MathUtils.clamp((blend.currentPlaneIndex + blend.blend) / lastIndex, 0, 1)
    }
    return this.gallery.getDepthProgress(camera.position.z)
  }

  computeHeadPosition(cameraZ, progress) {
    const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1)
    const { pathSettings, responsiveSettings } = this.configuration
    const horizontalCycles = Math.max(pathSettings.horizontalCycles, 0.0001)
    const verticalCycles = Math.max(pathSettings.verticalCycles, 0.0001)
    const isMobileViewport =
      typeof window !== 'undefined' && window.innerWidth <= responsiveSettings.mobileBreakpoint
    const responsiveStartXPosition =
      pathSettings.startXPosition + (isMobileViewport ? responsiveSettings.mobileStartXOffset : 0)
    const responsiveHorizontalWidth =
      pathSettings.horizontalWidth * (isMobileViewport ? responsiveSettings.mobileWidthScale : 1)

    const xPosition =
      responsiveStartXPosition +
      Math.sin(clampedProgress * FULL_CIRCLE_RADIANS * horizontalCycles) * responsiveHorizontalWidth
    const yPosition =
      pathSettings.startYPosition +
      Math.sin(clampedProgress * FULL_CIRCLE_RADIANS * verticalCycles) * pathSettings.verticalAmplitude
    const depthProgress =
      pathSettings.progressDepthOffset + clampedProgress * (1 - pathSettings.progressDepthOffset)
    const zPosition =
      cameraZ +
      pathSettings.distanceAheadOfCamera -
      (pathSettings.baseDepthOffset + depthProgress * pathSettings.depthSpan)

    this.trailHeadPosition.set(xPosition, yPosition, zPosition)
    return this.trailHeadPosition
  }

  seedInitialPoints(camera) {
    if (this.runtimeState.hasSeededInitialPoints || !camera) return
    const startPosition = this.computeHeadPosition(camera.position.z, 0).clone()
    for (
      let index = this.configuration.pointSettings.initialSeedPointCount;
      index >= 0;
      index -= 1
    ) {
      const seedPosition = startPosition.clone()
      seedPosition.z -= index * this.configuration.pointSettings.initialSeedStepZ
      this.trail.addPoint(seedPosition)
    }
    this.runtimeState.hasSeededInitialPoints = true
  }

  getDirection(progress) {
    if (this.runtimeState.previousProgress === null) return 0
    const progressDelta = progress - this.runtimeState.previousProgress
    if (Math.abs(progressDelta) <= this.configuration.directionChangeEpsilon) return 0
    return Math.sign(progressDelta)
  }

  updateLength(progress, direction) {
    const { pointSettings } = this.configuration
    const lengthProgress = direction < 0 ? progress * pointSettings.reverseLengthScale : progress
    this.trail.maxPoints = Math.round(
      THREE.MathUtils.lerp(
        pointSettings.minimumPointCount,
        pointSettings.maximumPointCount,
        THREE.MathUtils.clamp(lengthProgress, 0, 1)
      )
    )
    this.trail.maxTrimPerFrame =
      direction < 0 ? pointSettings.trimPerFrameReverse : pointSettings.trimPerFrameForward
  }

  updateOpacity(progress) {
    const { opacitySettings } = this.configuration
    const startDistance = THREE.MathUtils.clamp(progress + opacitySettings.startVisibilityBias, 0, 1)
    const endDistance = 1 - progress
    const closestEdgeDistance = Math.min(startDistance, endDistance)
    const edgeVisibility = THREE.MathUtils.smoothstep(
      closestEdgeDistance,
      opacitySettings.edgeFadeStart,
      opacitySettings.edgeFadeEnd
    )
    const startupVisibility =
      !this.runtimeState.hasUserMovedFromStart && progress <= opacitySettings.idleProgressThreshold
        ? opacitySettings.idleOpacityAtStart
        : 0
    const visibility = Math.max(edgeVisibility, startupVisibility)
    const targetOpacity = opacitySettings.baseOpacity * visibility
    this.runtimeState.currentOpacity = THREE.MathUtils.lerp(
      this.runtimeState.currentOpacity,
      targetOpacity,
      opacitySettings.opacitySmoothing
    )
    this.trail.material.opacity = this.runtimeState.currentOpacity
  }
}

/* ============================================================ *
 * Scroll (wheel/touch -> camera depth + velocity)
 * ============================================================ */
class Scroll {
  constructor(camera, gallery, target, invertScroll = false) {
    this.camera = camera
    this.gallery = gallery
    this.target = target // element to bind wheel/touch on
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

    this.useScrollBounds = true
    this.firstPlaneViewOffset = 5
    this.lastPlaneViewOffset = 5
    this.minCameraZ = -Infinity
    this.maxCameraZ = Infinity
    this.cameraStartZ = this.camera.position.z
    this.touchY = 0

    this.onWheel = (event) => {
      event.preventDefault()
      const normalizedWheelDelta = this.normalizeWheelDelta(event) * this.wheelScrollSpeed
      this.addScrollInput(normalizedWheelDelta)
    }
    this.onTouchStart = (event) => {
      this.touchY = event.touches[0]?.clientY ?? 0
    }
    this.onTouchMove = (event) => {
      event.preventDefault()
      const currentTouchY = event.touches[0]?.clientY ?? this.touchY
      const deltaY = this.touchY - currentTouchY
      this.addScrollInput(deltaY * this.touchScrollSpeed)
      this.touchY = currentTouchY
    }
  }

  init() {
    if (this.isInitialized) return
    this.updateCameraBounds()
    this.cameraStartZ = this.maxCameraZ
    this.camera.position.z = this.cameraStartZ
    this.scrollTarget = 0
    this.scrollCurrent = 0
    this.previousScrollCurrent = this.scrollCurrent
    this.rawVelocity = 0
    this.velocity = 0
    this.isInitialized = true
  }

  bindEvents() {
    this.target.addEventListener('wheel', this.onWheel, { passive: false })
    this.target.addEventListener('touchstart', this.onTouchStart, { passive: true })
    this.target.addEventListener('touchmove', this.onTouchMove, { passive: false })
  }

  updateCameraBounds() {
    const depthRange = this.gallery.getDepthRange()
    this.maxCameraZ = depthRange.nearestZ + this.firstPlaneViewOffset
    this.minCameraZ = depthRange.deepestZ + this.lastPlaneViewOffset
    if (this.minCameraZ > this.maxCameraZ) this.minCameraZ = this.maxCameraZ
  }

  cameraZFromScroll(scrollAmount) {
    return this.cameraStartZ - scrollAmount * this.scrollToWorldFactor
  }

  scrollFromCameraZ(cameraZ) {
    if (this.scrollToWorldFactor === 0) return 0
    return (this.cameraStartZ - cameraZ) / this.scrollToWorldFactor
  }

  normalizeWheelDelta(event) {
    if (event.deltaMode === 1) return event.deltaY * 16
    if (event.deltaMode === 2) return event.deltaY * window.innerHeight
    return event.deltaY
  }

  addScrollInput(deltaY) {
    const scrollDirection = this.invertScroll ? -1 : 1
    this.scrollTarget += deltaY * scrollDirection
  }

  updateVelocity() {
    this.rawVelocity = this.scrollCurrent - this.previousScrollCurrent
    this.velocity = THREE.MathUtils.lerp(this.velocity, this.rawVelocity, this.velocityDamping)
    this.velocity = THREE.MathUtils.clamp(this.velocity, -this.velocityMax, this.velocityMax)
    if (Math.abs(this.velocity) < this.velocityStopThreshold) this.velocity = 0
    this.previousScrollCurrent = this.scrollCurrent
  }

  update() {
    this.updateCameraBounds()
    this.scrollCurrent = THREE.MathUtils.lerp(
      this.scrollCurrent,
      this.scrollTarget,
      this.scrollSmoothing
    )
    if (this.useScrollBounds) {
      const minimumScroll = this.scrollFromCameraZ(this.maxCameraZ)
      const maximumScroll = this.scrollFromCameraZ(this.minCameraZ)
      this.scrollTarget = THREE.MathUtils.clamp(this.scrollTarget, minimumScroll, maximumScroll)
      this.scrollCurrent = THREE.MathUtils.clamp(this.scrollCurrent, minimumScroll, maximumScroll)
    }
    this.updateVelocity()
    const nextCameraZ = this.cameraZFromScroll(this.scrollCurrent)
    if (this.useScrollBounds) {
      this.camera.position.z = THREE.MathUtils.clamp(nextCameraZ, this.minCameraZ, this.maxCameraZ)
      return
    }
    this.camera.position.z = nextCameraZ
  }

  dispose() {
    this.target.removeEventListener('wheel', this.onWheel)
    this.target.removeEventListener('touchstart', this.onTouchStart)
    this.target.removeEventListener('touchmove', this.onTouchMove)
  }
}

/* ============================================================ *
 * Engine (wires everything together + render loop)
 * ============================================================ */
class Engine {
  constructor({ canvas, container, items, labelRefs, options }) {
    this.canvas = canvas
    this.container = container
    this.options = options
    this.isInitialized = false
    this.isRunning = false
    this.animationFrameRequestId = null
    this.preloadedTextures = new Map()

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    this.camera.position.set(0, 0, 6)

    this.background = new Background()
    this.gallery = new Gallery(items, container)
    this.gallery.planeGap = options.planeGap
    this.gallery.parallaxEnabled = options.enableParallax
    this.label = new Label(this.gallery, labelRefs)
    this.trailController = new TrailController({
      gallery: this.gallery,
      enabled: options.enableTrail,
      enableParticles: options.enableParticles,
    })
    this.scroll = new Scroll(this.camera, this.gallery, container, options.invertScroll)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.autoClear = false

    this.animate = this.update.bind(this)
    this.resizeObserver = new ResizeObserver(() => this.resize())
  }

  async init() {
    if (this.isInitialized) return
    this.preloadedTextures = await this.preloadTextures()
    this.gallery.setPreloadedTextures(this.preloadedTextures)

    await this.gallery.init(this.scene)
    this.label.init()
    this.background.init()
    this.trailController.init(this.scene, this.camera)

    this.scroll.init()
    this.resize()
    this.resizeObserver.observe(this.container)
    this.scroll.bindEvents()

    this.isInitialized = true
    this.start()
  }

  start() {
    if (!this.isInitialized || this.isRunning) return
    this.isRunning = true
    this.update()
  }

  resize() {
    const width = this.container.clientWidth || 1
    const height = this.container.clientHeight || 1
    if (width <= 0 || height <= 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    this.gallery.updatePlaneScale()
    this.gallery.layoutPlanes()
  }

  async preloadTextures() {
    const textureSources = this.gallery.getTextureSources()
    if (!textureSources.length) return new Map()
    const textureLoader = new THREE.TextureLoader()
    const loadedTextures = new Map()
    await Promise.all(
      textureSources.map(async (textureSource) => {
        try {
          const texture = await textureLoader.loadAsync(textureSource)
          texture.colorSpace = THREE.SRGBColorSpace
          loadedTextures.set(textureSource, texture)
        } catch (error) {
          console.warn(`Texture failed to load: ${textureSource}`, error)
        }
      })
    )
    return loadedTextures
  }

  update() {
    if (!this.isRunning) return
    this.animationFrameRequestId = requestAnimationFrame(this.animate)
    const time = performance.now()

    this.scroll.update()
    this.trailController.update(this.camera, this.scroll, time)
    this.gallery.update(this.camera, this.scroll)
    this.label.update(this.camera)

    const moodBlendData = this.gallery.getMoodBlendData(this.camera.position.z)
    if (moodBlendData) this.background.setMoodBlend(moodBlendData)

    const planeBlendData = this.gallery.getPlaneBlendData(this.camera.position.z)
    const depthProgress = this.gallery.getDepthProgress(this.camera.position.z)
    const velocityMax = this.scroll?.velocityMax || 1
    const velocityIntensity = THREE.MathUtils.clamp(
      Math.abs(this.scroll?.velocity || 0) / Math.max(velocityMax, 0.0001),
      0,
      1
    )
    const blend = planeBlendData?.blend ?? 0
    const distanceFromBlendCenter = Math.abs(blend - 0.5) * 2
    const transitionStability = THREE.MathUtils.smoothstep(distanceFromBlendCenter, 0.35, 1)
    this.background.setMotionResponse({
      depthProgress,
      velocityIntensity: velocityIntensity * transitionStability,
    })
    this.background.update(time)

    this.renderer.clear(true, true, true)
    this.background.render(this.renderer)
    this.renderer.clearDepth()
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.isRunning = false
    if (this.animationFrameRequestId !== null) {
      cancelAnimationFrame(this.animationFrameRequestId)
      this.animationFrameRequestId = null
    }
    this.resizeObserver.disconnect()
    this.scroll.dispose()
    this.gallery.dispose()
    this.trailController.dispose()
    this.background.dispose()
    this.preloadedTextures.forEach((texture) => texture.dispose())
    this.preloadedTextures.clear()
    this.renderer.dispose()
  }
}

/* ============================================================ *
 * React component
 * ============================================================ */
export default function DepthGallery({
  items = [],
  className = '',
  style,
  planeGap = 5,
  enableTrail = true,
  enableParticles = true,
  enableParallax = true,
  showLabels = true,
  invertScroll = false,
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  // Label overlay refs (updated imperatively by the engine, no re-renders)
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
        }
      : null

    const engine = new Engine({
      canvas,
      container,
      items: normalized,
      labelRefs,
      options: { planeGap, enableTrail, enableParticles, enableParallax, invertScroll },
    })

    let cancelled = false
    engine.init().catch((error) => console.error('DepthGallery init failed', error))

    return () => {
      cancelled = true
      // dispose even if init resolved after unmount
      Promise.resolve().then(() => engine.dispose())
      void cancelled
    }
    // Re-create the experience if the inputs that shape the scene change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, planeGap, enableTrail, enableParticles, enableParallax, showLabels, invertScroll])

  return (
    <div ref={containerRef} className={`${styles.root} ${className}`} style={style}>
      <canvas ref={canvasRef} className={styles.canvas} />

      {showLabels && (
        <section ref={overlayRef} className={styles.overlay}>
          <div className={styles.left}>
            <p ref={indexRef} className={styles.index} />
            <p ref={wordRef} className={styles.word} />
            <span ref={chipRef} className={styles.chip} />
          </div>
          <article className={`${styles.card} ${styles.right}`}>
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
          </article>
        </section>
      )}
    </div>
  )
}
