import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, extend } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three-stdlib'

extend({ MeshSurfaceSampler })

// Cache for texture analysis (performance)
const textureAnalysisCache = new Map<string, ImageData>()

// Analyze terrain texture to get color data
function analyzeTerrainTexture(terrainMesh: THREE.Mesh): ImageData | null {
  if (!terrainMesh.material) return null
  
  let texture: THREE.Texture | null = null
  
  if (terrainMesh.material instanceof THREE.MeshStandardMaterial || 
      terrainMesh.material instanceof THREE.MeshPhongMaterial ||
      terrainMesh.material instanceof THREE.MeshLambertMaterial) {
    texture = terrainMesh.material.map
  }
  
  if (!texture || !texture.image) return null
  
  const cacheKey = texture.uuid
  
  if (textureAnalysisCache.has(cacheKey)) {
    console.log('Using cached texture analysis')
    return textureAnalysisCache.get(cacheKey)!
  }
  
  console.log('Analyzing texture for the first time...')
  
  const image = texture.image as HTMLImageElement | HTMLCanvasElement
  if (!image || !('width' in image) || !('height' in image)) return null
  
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  
  canvas.width = image.width
  canvas.height = image.height
  ctx.drawImage(image, 0, 0)
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  textureAnalysisCache.set(cacheKey, imageData)
  
  return imageData
}

// Calculate green intensity at UV coordinates
function getGreenIntensity(imageData: ImageData, u: number, v: number): number {
  const x = Math.floor(u * imageData.width)
  const y = Math.floor((1 - v) * imageData.height)
  const index = (y * imageData.width + x) * 4
  
  if (index >= imageData.data.length) return 0
  
  const r = imageData.data[index] / 255
  const g = imageData.data[index + 1] / 255
  const b = imageData.data[index + 2] / 255
  
  return Math.max(0, g - Math.max(r, b) * 0.8)
}

// Props interface for reusable component
export interface GrassProps {
  terrainMesh: THREE.Mesh
  position?: [number, number, number]
  scale?: number
  count?: number
  baseColor?: string
  tipColor1?: string
  tipColor2?: string
  enableWind?: boolean
  enableShadows?: boolean
  windSpeed?: number
  windStrength?: number
  noiseScale?: number
  shadowDarkness?: number
  lightIntensity?: number
  useTextureDensity?: boolean
  greenThreshold?: number
  densityMultiplier?: number
}

// Uniforms type
type GrassUniforms = {
  uTime: { value: number }
  uEnableShadows: { value: number }
  uShadowDarkness: { value: number }
  uGrassLightIntensity: { value: number }
  uNoiseScale: { value: number }
  uWindSpeed: { value: number }
  uWindStrength: { value: number }
  baseColor: { value: THREE.Color }
  tipColor1: { value: THREE.Color }
  tipColor2: { value: THREE.Color }
  noiseTexture: { value: THREE.Texture | null }
  grassAlphaTexture: { value: THREE.Texture | null }
}

export function Grass({
  terrainMesh,
  position = [0, 0, 0],
  scale = 1,
  count = 8000,
  baseColor = '#313f1b',
  tipColor1 = '#9bd38d',
  tipColor2 = '#1f352a',
  enableWind = true,
  enableShadows = true,
  windSpeed = 1.0,
  windStrength = 0.1,
  noiseScale = 1.5,
  shadowDarkness = 0.5,
  lightIntensity = 1,
  useTextureDensity = false,
  greenThreshold = 0.3,
  densityMultiplier = 2.0
}: GrassProps) {
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null)
  const grassGeometryRef = useRef<THREE.BufferGeometry>(null)
  const uniformsRef = useRef<GrassUniforms>({
    uTime: { value: 0 },
    uEnableShadows: { value: enableShadows ? 1 : 0 },
    uShadowDarkness: { value: shadowDarkness },
    uGrassLightIntensity: { value: lightIntensity },
    uNoiseScale: { value: noiseScale },
    uWindSpeed: { value: windSpeed },
    uWindStrength: { value: windStrength },
    baseColor: { value: new THREE.Color(baseColor) },
    tipColor1: { value: new THREE.Color(tipColor1) },
    tipColor2: { value: new THREE.Color(tipColor2) },
    noiseTexture: { value: null },
    grassAlphaTexture: { value: null }
  })

  // Load textures
  const [noiseTexture, grassAlphaTexture] = useTexture([
    '/perlinnoise.webp',
    '/grass.jpeg'
  ]) as [THREE.Texture, THREE.Texture]

  // Configure textures
  useEffect(() => {
    noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping
    uniformsRef.current.noiseTexture.value = noiseTexture
    uniformsRef.current.grassAlphaTexture.value = grassAlphaTexture
  }, [noiseTexture, grassAlphaTexture])

  // Load grass model
  const { scene: grassScene } = useGLTF('/grassLODs.glb')
  
  // Find grass geometry in model
  useEffect(() => {
    let foundGeometry = false
    grassScene.traverse((child) => {
      if (child instanceof THREE.Mesh && !foundGeometry) {
        console.log('Found grass mesh:', child.name)
        const geometry = child.geometry.clone()
        geometry.scale(5, 5, 5)
        grassGeometryRef.current = geometry
        foundGeometry = true
      }
    })
    
    if (!foundGeometry) {
      console.warn('No grass geometry found in GLTF, using fallback')
      const fallbackGeometry = new THREE.ConeGeometry(0.1, 1, 3)
      fallbackGeometry.translate(0, 0.5, 0)
      grassGeometryRef.current = fallbackGeometry
    }
  }, [grassScene])

  // Create shader material
  const grassMaterial = useMemo(() => {
    const material = new THREE.MeshLambertMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.1,
      color: baseColor
    })

    material.onBeforeCompile = (shader) => {
      shader.uniforms = {
        ...shader.uniforms,
        ...uniformsRef.current
      }

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindStrength;`
      )

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        
        float windEffect = sin(uTime + position.x * 0.1 + position.z * 0.1) * uWindStrength * (1.0 - uv.y);
        transformed.x += windEffect;`
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Keep base material color`
      )
    }

    return material
  }, [baseColor])

  // Update uniforms with props
  useEffect(() => {
    uniformsRef.current.uEnableShadows.value = enableShadows ? 1 : 0
    uniformsRef.current.baseColor.value.set(baseColor)
    uniformsRef.current.tipColor1.value.set(tipColor1)
    uniformsRef.current.tipColor2.value.set(tipColor2)
    uniformsRef.current.uNoiseScale.value = noiseScale
    uniformsRef.current.uShadowDarkness.value = shadowDarkness
    uniformsRef.current.uGrassLightIntensity.value = lightIntensity
    uniformsRef.current.uWindSpeed.value = windSpeed
    uniformsRef.current.uWindStrength.value = windStrength
  }, [baseColor, tipColor1, tipColor2, enableShadows, noiseScale, shadowDarkness, lightIntensity, windSpeed, windStrength])

  // Create InstancedMesh with sampling on terrain
  const [instancedMesh, setInstancedMesh] = useState<THREE.InstancedMesh | null>(null)

  // Create InstancedMesh when everything is ready
  useEffect(() => {
    if (!grassGeometryRef.current || !terrainMesh.geometry) return

    console.log('Creating grass instances with geometry:', grassGeometryRef.current)

    // Analyze texture if needed
    let textureData: ImageData | null = null
    if (useTextureDensity) {
      textureData = analyzeTerrainTexture(terrainMesh)
      console.log('Texture analysis:', textureData ? 'Success' : 'Failed')
    }

    // Create sampler
    const sampler = new MeshSurfaceSampler(terrainMesh).build()
    
    // Variables for smart sampling
    const validPositions: Array<{
      position: THREE.Vector3
      normal: THREE.Vector3
      greenIntensity: number
    }> = []
    
    // First pass: collect valid positions
    const maxAttempts = count * 3
    const tempPosition = new THREE.Vector3()
    const tempNormal = new THREE.Vector3()
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      sampler.sample(tempPosition, tempNormal)
      
      let shouldPlace = true
      let greenIntensity = 1.0
      
      if (useTextureDensity && textureData) {
        const terrainSize = 50
        const u = (tempPosition.x / terrainSize) + 0.5
        const v = (tempPosition.z / terrainSize) + 0.5
          
        greenIntensity = getGreenIntensity(textureData, u, v)
        
        const placeProbability = greenIntensity > greenThreshold ? 
          greenIntensity * densityMultiplier : 
          0.1
          
        shouldPlace = Math.random() < placeProbability
      }
      
      if (shouldPlace) {
        validPositions.push({
          position: tempPosition.clone(),
          normal: tempNormal.clone(),
          greenIntensity
        })
        
        if (validPositions.length >= count) break
      }
    }
    
    // Sort by green intensity
    if (useTextureDensity) {
      validPositions.sort((a, b) => b.greenIntensity - a.greenIntensity)
    }
    
    // Create instanced mesh
    const finalCount = Math.min(validPositions.length, count)
    const mesh = new THREE.InstancedMesh(
      grassGeometryRef.current,
      grassMaterial,
      finalCount
    )
    mesh.receiveShadow = true
    mesh.castShadow = true
    
    console.log(`Placed ${finalCount} grass instances (${useTextureDensity ? 'texture-based' : 'uniform'})`)
    
    // Place instances
    const quaternion = new THREE.Quaternion()
    const scaleVec = new THREE.Vector3(scale, scale, scale)
    const matrix = new THREE.Matrix4()
    const yAxis = new THREE.Vector3(0, 1, 0)

    for (let i = 0; i < finalCount; i++) {
      const { position, normal, greenIntensity } = validPositions[i]
      
      quaternion.setFromUnitVectors(yAxis, normal)
      
      const randomRotation = new THREE.Euler(0, Math.random() * Math.PI * 2, 0)
      const randomQuaternion = new THREE.Quaternion().setFromEuler(randomRotation)
      quaternion.multiply(randomQuaternion)
      
      const variantScale = useTextureDensity ? 
        scale * (0.8 + greenIntensity * 0.4) : 
        scale
      scaleVec.setScalar(variantScale)
      
      matrix.compose(position, quaternion, scaleVec)
      mesh.setMatrixAt(i, matrix)
    }
    
    mesh.instanceMatrix.needsUpdate = true
    setInstancedMesh(mesh)
    
    return () => {
      mesh.dispose()
    }
  }, [terrainMesh, grassMaterial, count, scale, grassGeometryRef.current, useTextureDensity, greenThreshold, densityMultiplier])

  // Animation frame update
  useFrame((state) => {
    if (enableWind) {
      uniformsRef.current.uTime.value = state.clock.getElapsedTime()
    }
  })

  if (!instancedMesh) return null

  return (
    <primitive 
      object={instancedMesh} 
      ref={instancedMeshRef}
      position={position}
      castShadow
      receiveShadow
    />
  )
}