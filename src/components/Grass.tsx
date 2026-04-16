/**
 * Grass Component - A sophisticated grass instancing system for React Three Fiber
 * 
 * This component creates realistic grass rendering on terrain surfaces using:
 * - Texture-based density sampling
 * - Wind animation effects
 * - Shadow support
 * - Smart position sampling to avoid clipping
 */
import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, extend } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three-stdlib'

// Register MeshSurfaceSampler as an extendable component for @react-three/fiber
extend({ MeshSurfaceSampler })

// Cache for texture analysis (performance optimization - avoid re-analyzing same texture)
const textureAnalysisCache = new Map<string, ImageData>()

/**
 * Analyze terrain texture to extract color data for grass placement decisions
 * This allows grass to grow more densely in greener areas of the terrain texture
 * 
 * @param terrainMesh - The terrain mesh whose texture we want to analyze
 * @returns ImageData with pixel data or null if analysis fails
 */
function analyzeTerrainTexture(terrainMesh: THREE.Mesh): ImageData | null {
  if (!terrainMesh.material) return null
  
  let texture: THREE.Texture | null = null
  
  // Check if material supports texture mapping
  if (terrainMesh.material instanceof THREE.MeshStandardMaterial || 
      terrainMesh.material instanceof THREE.MeshPhongMaterial ||
      terrainMesh.material instanceof THREE.MeshLambertMaterial) {
    texture = terrainMesh.material.map
  }
  
  if (!texture || !texture.image) return null
  
  const cacheKey = texture.uuid
  
  // Return cached analysis if available (performance)
  if (textureAnalysisCache.has(cacheKey)) {
    console.log('Using cached texture analysis')
    return textureAnalysisCache.get(cacheKey)!
  }
  
  console.log('Analyzing texture for the first time...')
  
  const image = texture.image as HTMLImageElement | HTMLCanvasElement
  if (!image || !('width' in image) || !('height' in image)) return null
  
  // Create off-screen canvas to analyze pixel data
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  
  canvas.width = image.width
  canvas.height = image.height
  ctx.drawImage(image, 0, 0)
  
  // Extract pixel data for texture analysis
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  textureAnalysisCache.set(cacheKey, imageData)
  
  return imageData
}

// Calculate green intensity at UV coordinates
// This determines how "grass-like" a terrain pixel is based on its color values
// Higher green intensity means more suitable for grass growth
function getGreenIntensity(imageData: ImageData, u: number, v: number): number {
  // Convert UV coordinates (0-1 range) to pixel coordinates
  const x = Math.floor(u * imageData.width)
  const y = Math.floor((1 - v) * imageData.height) // Flip Y because image coordinates differ from UV
  const index = (y * imageData.width + x) * 4 // RGBA has 4 values per pixel
  
  if (index >= imageData.data.length) return 0
  
  // Normalize RGB values to 0-1 range
  const r = imageData.data[index] / 255
  const g = imageData.data[index + 1] / 255
  const b = imageData.data[index + 2] / 255
  
  // Calculate green intensity: prioritize green over red/blue
  // Subtract a weighted version of the max of red/blue to emphasize green
  return Math.max(0, g - Math.max(r, b) * 0.8)
}

// Props interface for reusable component
export interface GrassProps {
  terrainMesh: THREE.Mesh           // The terrain mesh to place grass on
  terrainScale?: THREE.Vector3      // The scale of the terrain mesh
  terrainSize?: THREE.Vector3      // The geometry size (bounding box) of the terrain
  position?: [number, number, number] // Position in 3D space
  scale?: number                     // Overall scale of grass instances
  count?: number                     // Maximum number of grass instances
  baseColor?: string                 // Base color of grass (diffuse)
  tipColor1?: string                 // Tip color gradient stop 1
  tipColor2?: string                 // Tip color gradient stop 2
  enableWind?: boolean               // Enable wind animation
  enableShadows?: boolean            // Enable shadow receiving/casting
  windSpeed?: number                 // Speed of wind animation
  windStrength?: number              // Strength of wind bending
  noiseScale?: number                // Scale of noise texture
  shadowDarkness?: number            // Darkness of shadows
  lightIntensity?: number            // Intensity of lighting
  useTextureDensity?: boolean        // Use terrain texture for density
  greenThreshold?: number            // Minimum green value for placement
  densityMultiplier?: number         // Multiplier for texture-based density
  showDebugTerrain?: boolean         // Show debug terrain wireframe
}

// Uniforms type - data passed to shaders
export type GrassUniforms = {
  uTime: { value: number }                     // Time for animation
  uEnableShadows: { value: number }            // Shadow enable flag (0 or 1)
  uShadowDarkness: { value: number }           // Shadow darkness factor
  uGrassLightIntensity: { value: number }      // Light intensity multiplier
  uNoiseScale: { value: number }               // Noise texture scale
  uWindSpeed: { value: number }                // Wind animation speed
  uWindStrength: { value: number }             // Wind bending strength
  baseColor: { value: THREE.Color }            // Base color uniform
  tipColor1: { value: THREE.Color }            // Tip color uniform
  tipColor2: { value: THREE.Color }            // Base color uniform
  noiseTexture: { value: THREE.Texture | null }      // Noise texture for randomness
  grassAlphaTexture: { value: THREE.Texture | null } // Alpha texture for grass shape
}

export function Grass({
  terrainMesh,
  terrainScale,
  terrainSize,
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
  densityMultiplier = 2.0,
  showDebugTerrain = false
}: GrassProps) {
  // Refs for accessing mesh and geometry
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null)
  const grassGeometryRef = useRef<THREE.BufferGeometry>(null)
  
  // Store uniforms for shader communication
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
 
  // Load procedural textures (noise and grass alpha mask)
  const [noiseTexture, grassAlphaTexture] = useTexture([
    '/perlinnoise.webp',    // Noise for organic variation
    '/grass.jpeg'           // Alpha mask for grass silhouette
  ]) as [THREE.Texture, THREE.Texture]

  // Configure texture properties for proper wrapping
  useEffect(() => {
    noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping
    uniformsRef.current.noiseTexture.value = noiseTexture
    uniformsRef.current.grassAlphaTexture.value = grassAlphaTexture
  }, [noiseTexture, grassAlphaTexture])

  // Load grass model from GLTF asset
  const { scene: grassScene } = useGLTF('/grassLODs.glb')
  
  // Find and configure grass geometry in the loaded model
  useEffect(() => {
    let foundGeometry = false
    grassScene.traverse((child) => {
      if (child instanceof THREE.Mesh && !foundGeometry) {
        console.log('Found grass mesh:', child.name)
        const geometry = child.geometry.clone()
        geometry.scale(1,1,1) // Scale up the grass geometry
        grassGeometryRef.current = geometry
        foundGeometry = true
      }
    })
    
    // Fallback if no grass geometry found in model
    if (!foundGeometry) {
      console.warn('No grass geometry found in GLTF, using fallback')
      const fallbackGeometry = new THREE.ConeGeometry(0.1, 1, 3)
      fallbackGeometry.translate(0, 0.5, 0) // Position at center
      grassGeometryRef.current = fallbackGeometry
    }
  }, [grassScene])

  // Create custom shader material for grass
  const grassMaterial = useMemo(() => {
    // Use MeshLambertMaterial for good balance of performance and lighting
    const material = new THREE.MeshLambertMaterial({
      side: THREE.DoubleSide,      // Render both sides of geometry
      transparent: false,            // Enable transparency
      alphaTest: 0.1,              // Discard transparent pixels
      color: baseColor             // Base color
    })

    // Modify shader before compilation to add custom uniforms and behaviors
    material.onBeforeCompile = (shader) => {
      // Inject custom uniforms into shader
      shader.uniforms = {
        ...shader.uniforms,
        ...uniformsRef.current
      }

      // Add time and wind strength uniforms to vertex shader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindStrength;`
      )

      // Add wind animation effect to vertex shader
      // Wind affects X position based on time, position, and UV coordinate
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        
        // Calculate wind effect: stronger at top of grass (UV.y near 0)
        float windEffect = sin(uTime + position.x * 0.1 + position.z * 0.1) * uWindStrength * (1.0 - uv.y);
        transformed.x += windEffect;`
      )

      // Keep original fragment shader behavior
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Keep base material color`
      )
    }

    return material
  }, [baseColor]) // Recreate when baseColor changes

  // Update uniforms when props change
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

  // Create InstancedMesh with sampling on terrain surface
  const [instancedMesh, setInstancedMesh] = useState<THREE.InstancedMesh | null>(null)

  // Main effect for creating grass instances when dependencies change
  useEffect(() => {
    // Validate required geometry
    if (!grassGeometryRef.current || !terrainMesh.geometry) return

    console.log('Creating grass instances with geometry:', grassGeometryRef.current)
    console.log('Terrain scale:', terrainScale)
    console.log('Terrain geometry size:', terrainSize)

    // Analyze terrain texture for density-based placement if enabled
    // This allows grass to grow more densely in greener (more suitable) areas
    let textureData: ImageData | null = null
    if (useTextureDensity) {
      textureData = analyzeTerrainTexture(terrainMesh)
      console.log('Texture analysis:', textureData ? 'Success' : 'Failed')
    }

    // Create surface sampler to sample positions on terrain mesh
    // This ensures grass grows on terrain surface, not floating in air
    const sampler = new MeshSurfaceSampler(terrainMesh).build()
    
    // Storage for valid positions that pass density/placement tests
    const validPositions: Array<{
      position: THREE.Vector3    // World position on terrain
      normal: THREE.Vector3      // Surface normal for orientation
      greenIntensity: number     // Suitability score (0-1) for grass growth
    }> = []
    
    // Attempt to sample positions multiple times for better coverage
    // More attempts = more candidates to choose from
    const maxAttempts = count * 3
    const tempPosition = new THREE.Vector3()
    const tempNormal = new THREE.Vector3()
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Sample random position and normal on terrain surface
      sampler.sample(tempPosition, tempNormal)
      
      let shouldPlace = true
      let greenIntensity = 1.0
      
      // If using texture-based density, check if position is suitable
      if (useTextureDensity && textureData) {
        const terrainSize = 500  // Assumed terrain size
        // Convert world position to UV coordinates (0-1 range)
        const u = (tempPosition.x / terrainSize) + 0.5
        const v = (tempPosition.z / terrainSize) + 0.5
           
        // Get green intensity from texture at this position
        greenIntensity = getGreenIntensity(textureData, u, v)
        
        // Calculate probability of placing grass based on green intensity
        // Higher green = higher probability, with density multiplier
        const placeProbability = greenIntensity > greenThreshold ? 
          greenIntensity * densityMultiplier : 
          0.1  // Low probability for non-green areas
          
        shouldPlace = Math.random() < placeProbability
      }
      
      // Accept this position if it passes the placement test
      if (shouldPlace) {
        validPositions.push({
          position: tempPosition.clone(),
          normal: tempNormal.clone(),
          greenIntensity
        })
        
        // Stop once we have enough valid positions
        if (validPositions.length >= count) break
      }
    }
    
    // Sort positions by green intensity (highest first) when using texture
    // This prioritizes placing grass in most suitable areas
    if (useTextureDensity) {
      validPositions.sort((a, b) => b.greenIntensity - a.greenIntensity)
    }
    
    // Create actual instanced mesh with the selected positions
    const finalCount = Math.min(validPositions.length, count)
    const mesh = new THREE.InstancedMesh(
      grassGeometryRef.current,
      grassMaterial,
      finalCount
    )
    mesh.receiveShadow = true
    mesh.castShadow = true
    
    console.log(`Placed ${finalCount} grass instances (${useTextureDensity ? 'texture-based' : 'uniform'})`)
    
    // Log first few positions to debug
    if (validPositions.length > 0) {
      console.log('First 3 grass positions:', validPositions.slice(0, 3).map(p => ({
        x: p.position.x.toFixed(2),
        y: p.position.y.toFixed(2),
        z: p.position.z.toFixed(2)
      })))
    }
    
    // Place each instance with proper position, rotation, and scale
    const quaternion = new THREE.Quaternion()
    const scaleVec = new THREE.Vector3(scale, scale, scale)
    const matrix = new THREE.Matrix4()
    const yAxis = new THREE.Vector3(0, 1, 0)

    for (let i = 0; i < finalCount; i++) {
      const { position, normal, greenIntensity } = validPositions[i]
      
      // Orient grass blade to be perpendicular to terrain surface
      // This makes grass follow terrain contours naturally
      quaternion.setFromUnitVectors(yAxis, normal)
      
      // Add random rotation for natural, non-uniform appearance
      const randomRotation = new THREE.Euler(0, Math.random() * Math.PI * 2, 0)
      const randomQuaternion = new THREE.Quaternion().setFromEuler(randomRotation)
      quaternion.multiply(randomQuaternion)
      
      // Scale grass based on green intensity when using texture density
      // Greener areas get slightly larger grass for visual variety
      const variantScale = useTextureDensity ? 
        scale * (0.8 + greenIntensity * 0.4) : 
        scale
      scaleVec.setScalar(variantScale)
      
      // Combine position, rotation, and scale into transformation matrix
      matrix.compose(position, quaternion, scaleVec)
      mesh.setMatrixAt(i, matrix)
    }
    
    // Mark instance matrices as updated for rendering
    mesh.instanceMatrix.needsUpdate = true
    setInstancedMesh(mesh)
    
    // Cleanup: dispose geometry when component unmounts
    return () => {
      mesh.dispose()
    }
  }, [terrainMesh, grassMaterial, count, scale, grassGeometryRef.current, useTextureDensity, greenThreshold, densityMultiplier, terrainScale?.x])

  // Animation frame update
  useFrame((state) => {
    if (enableWind) {
      uniformsRef.current.uTime.value = state.clock.getElapsedTime()
    }
  })

  if (!instancedMesh && !showDebugTerrain) return null

  // Debug terrain mesh to visualize spawn area
  const debugTerrainMesh = showDebugTerrain && terrainMesh ? (
    <mesh
      geometry={terrainMesh.geometry.clone()}
      material={new THREE.MeshBasicMaterial({
        color: 'red',
        wireframe: true,
        transparent: true,
        opacity: 0.3
      })}
      scale={terrainScale || new THREE.Vector3(1, 1, 1)}
      position={position}
    />
  ) : null

  return (
    <>
      {debugTerrainMesh}
      {instancedMesh && (
        <primitive 
          object={instancedMesh} 
          ref={instancedMeshRef}
          position={position}
          castShadow
          receiveShadow
        />
      )}
    </>
  )
}