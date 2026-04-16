import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky, Stats, useGLTF, Grid, Text } from '@react-three/drei'
import { Suspense, useEffect, useState, useRef } from 'react'
import * as THREE from 'three'
import { Grass } from './components/Grass'

function Loading() {
  return (
    <Text position={[0, 5, 0]} fontSize={1} color="#666">
      Chargement...
    </Text>
  )
}

// Composant pour charger le terrain
function Terrain({ onTerrainLoaded }: { onTerrainLoaded: (mesh: THREE.Mesh, scale: THREE.Vector3, geometrySize: THREE.Vector3) => void }) {
  const { scene } = useGLTF('/island.glb')
  const hasLoaded = useRef(false)
  
  useEffect(() => {
    if (hasLoaded.current) return
    hasLoaded.current = true
    
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.scale.set(5,5,5)
        
        // Garder le matériau original du GLTF au lieu de le remplacer
        if (child.material) {
          console.log('Using original terrain material:', child.material)
          // Le mesh recevra les ombres, pas le matériau
        } else {
          // Fallback si pas de matériau
          child.material = new THREE.MeshPhongMaterial({ 
            color: '#5e875e',
            shininess: 30
          })
        }
        
        child.receiveShadow = true
        console.log('Terrain loaded:', child)
        
        // Pass both mesh, its scale, and geometry size
        const terrainScale = new THREE.Vector3()
        child.getWorldScale(terrainScale)
        
        // Calculate geometry size (bounding box)
        const geometrySize = new THREE.Vector3()
        child.geometry.computeBoundingBox()
        child.geometry.boundingBox?.getSize(geometrySize)
        
        // Get world position (center of terrain)
        const worldPosition = new THREE.Vector3()
        child.getWorldPosition(worldPosition)
        
        console.log('Terrain world position:', worldPosition)
        console.log('Terrain world bounds:', {
          minX: worldPosition.x - geometrySize.x * child.scale.x / 2,
          maxX: worldPosition.x + geometrySize.x * child.scale.x / 2,
          minZ: worldPosition.z - geometrySize.z * child.scale.z / 2,
          maxZ: worldPosition.z + geometrySize.z * child.scale.z / 2
        })
        
        onTerrainLoaded(child, terrainScale, geometrySize)
      }
    })
  }, [scene, onTerrainLoaded])

  return <primitive object={scene} />
}

// Composant de contrôle pour les propriétés
function ControlPanel({ 
  grassProps, 
  setGrassProps,
  setShowSecondGrass 
}: { 
  grassProps: any
  setGrassProps: (props: any) => void
  setShowSecondGrass: (show: boolean) => void
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 10,
      left: 10,
      background: 'rgba(0,0,0,0.7)',
      color: 'white',
      padding: '20px',
      borderRadius: '10px',
      fontFamily: 'monospace',
      zIndex: 1000,
      maxWidth: '300px'
    }}>
      <h3>🌿 Grass Component Demo</h3>
      <p>Densité d'herbe basée sur l'intensité verte de la texture</p>
      
      <div style={{ marginTop: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Base Color:
          <input 
            type="color" 
            value={grassProps.baseColor}
            onChange={(e) => setGrassProps({...grassProps, baseColor: e.target.value})}
            style={{ marginLeft: '10px' }}
          />
        </label>
        
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Tip Color 1:
          <input 
            type="color" 
            value={grassProps.tipColor1}
            onChange={(e) => setGrassProps({...grassProps, tipColor1: e.target.value})}
            style={{ marginLeft: '10px' }}
          />
        </label>
        
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Wind Strength:
          <input 
            type="range" 
            min="0" 
            max="0.3" 
            step="0.01"
            value={grassProps.windStrength}
            onChange={(e) => setGrassProps({...grassProps, windStrength: parseFloat(e.target.value)})}
            style={{ width: '100%' }}
          />
        </label>
        
        <label style={{ display: 'block', marginBottom: '15px' }}>
          <input 
            type="checkbox"
            checked={grassProps.enableShadows}
            onChange={(e) => setGrassProps({...grassProps, enableShadows: e.target.checked})}
          />
          Enable Shadows
        </label>
        
        <label style={{ display: 'block', marginBottom: '15px' }}>
          <input 
            type="checkbox"
            checked={grassProps.useTextureDensity}
            onChange={(e) => setGrassProps({...grassProps, useTextureDensity: e.target.checked})}
          />
          Use Texture-Based Density
        </label>

        {grassProps.useTextureDensity && (
          <>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Green Threshold:
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={grassProps.greenThreshold}
                onChange={(e) => setGrassProps({...grassProps, greenThreshold: parseFloat(e.target.value)})}
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: '0.8em' }}>{grassProps.greenThreshold.toFixed(2)}</span>
            </label>
            
            <label style={{ display: 'block', marginBottom: '15px' }}>
              Density Multiplier:
              <input 
                type="range" 
                min="0.5" 
                max="5" 
                step="0.1"
                value={grassProps.densityMultiplier}
                onChange={(e) => setGrassProps({...grassProps, densityMultiplier: parseFloat(e.target.value)})}
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: '0.8em' }}>{grassProps.densityMultiplier.toFixed(1)}x</span>
            </label>
          </>
        )}

        <label style={{ display: 'block', marginBottom: '15px' }}>
          <input 
            type="checkbox"
            onChange={(e) => setShowSecondGrass(e.target.checked)}
          />
          Show Second Grass Patch
        </label>
        
        <label style={{ display: 'block', marginBottom: '15px' }}>
          <input 
            type="checkbox"
            checked={grassProps.showDebugTerrain}
            onChange={(e) => setGrassProps({...grassProps, showDebugTerrain: e.target.checked})}
          />
          Show Debug Terrain (Red Wireframe)
        </label>
        
        <div style={{ marginTop: '15px', fontSize: '0.9em', color: '#aaa' }}>
          <strong>Controls:</strong>
          <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
            <li>Left drag: Rotate camera</li>
            <li>Right drag: Pan camera</li>
            <li>Scroll: Zoom</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [terrainData, setTerrainData] = useState<{ mesh: THREE.Mesh; scale: THREE.Vector3; geometrySize: THREE.Vector3 } | null>(null)
  const [showSecondGrass, setShowSecondGrass] = useState(false)
  const [grassProps, setGrassProps] = useState({
    baseColor: '#a8ff1d',
    tipColor1: '#9bd38d',
    tipColor2: '#1f352a',
    windStrength: 0.1,
    enableShadows: true,
    scale: 1, // Scale factor for grass instances
    count: 300,
    useTextureDensity: false,
    greenThreshold: 0.3,
    densityMultiplier: 1.0,
    showDebugTerrain: false
  })

  const handleTerrainLoaded = (mesh: THREE.Mesh, scale: THREE.Vector3, geometrySize: THREE.Vector3) => {
    setTerrainData({ mesh, scale, geometrySize })
  }

  return (
    <>
      <ControlPanel 
        grassProps={grassProps}
        setGrassProps={setGrassProps}
        setShowSecondGrass={setShowSecondGrass}
      />
      
      <Canvas
        shadows
        camera={{ 
          position: [-17, 12, -10], 
          fov: 75,
          near: 0.1,
          far: 1000 
        }}
        style={{ background: '#eeeeee' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[100, 100, 100]} 
          intensity={2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={200}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
        
        <OrbitControls 
          autoRotate
          autoRotateSpeed={-0.5}
          enableDamping
        />
        
        <Sky sunPosition={[100, 100, 100]} />
        <Grid 
          args={[100, 100]} 
          cellSize={10} 
          cellThickness={1} 
          cellColor="#6f6f6f"
          sectionSize={50} 
          sectionThickness={1.5} 
          sectionColor="#9d4b4b"
          fadeDistance={200}
        />
        
        {/* Ground reference - à remover une fois le terrainOK */}
        {/* <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#3d5c3d" />
        </mesh> */}
        
        <Suspense fallback={<Loading />}>
          <Terrain onTerrainLoaded={handleTerrainLoaded} />
          
          {terrainData ? (
            <>
              {/* Premier patch d'herbe - version avec densité basée sur texture */}
              <Grass
                terrainMesh={terrainData.mesh}
                terrainScale={terrainData.scale}
                terrainSize={terrainData.geometrySize}
                position={[0, 0, 0]}
                scale={grassProps.scale}
                count={grassProps.count}
                baseColor={grassProps.baseColor}
                tipColor1={grassProps.tipColor1}
                tipColor2={grassProps.tipColor2}
                enableWind={true}
                enableShadows={grassProps.enableShadows}
                windStrength={grassProps.windStrength}
                windSpeed={1.0}
                noiseScale={1.5}
                shadowDarkness={0.5}
                lightIntensity={1}
                useTextureDensity={grassProps.useTextureDensity}
                greenThreshold={grassProps.greenThreshold}
                densityMultiplier={grassProps.densityMultiplier}
                showDebugTerrain={grassProps.showDebugTerrain}
              />
              
              {/* Deuxième patch d'herbe - version avec couleurs différentes */}
              {showSecondGrass && (
                <Grass
                  terrainMesh={terrainData.mesh}
                  terrainScale={terrainData.scale}
                  position={[15, 0, -10]}
                  scale={grassProps.scale * 0.8}
                  count={3000}
                  baseColor="#1a472a"
                  tipColor1="#76c893"
                  tipColor2="#184e77"
                  enableWind={true}
                  enableShadows={grassProps.enableShadows}
                  windStrength={grassProps.windStrength * 1.5}
                  windSpeed={1.5}
                  noiseScale={2.0}
                  shadowDarkness={0.3}
                  lightIntensity={1.2}
                />
              )}
            </>
          ) : (
            <Text position={[0, 5, 0]} fontSize={1} color="#666">
              Chargement du terrain...
            </Text>
          )}
          
          {/* Instructions flottantes */}
          <Text
            position={[0, 15, 0]}
            fontSize={2}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            Grass Component Demo
          </Text>
          
          <Text
            position={[0, 12, 0]}
            fontSize={1}
            color="#333"
            anchorX="center"
            anchorY="middle"
          >
            Multiple instances with different properties
          </Text>
        </Suspense>
        
        <Stats />
        <fogExp2 attach="fog" args={['#eeeeee', 0.02]} />
      </Canvas>
    </>
  )
}