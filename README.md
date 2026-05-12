# Grass Component Documentation

## Overview

This project implements a sophisticated grass instancing system for React Three Fiber (R3F) that creates realistic grass rendering on terrain surfaces. The system uses texture-based density sampling, wind animation, and shadow support to achieve high-quality visual results.

## Key Features

- **Texture-based Density**: Grass grows more densely in areas where the terrain texture is greener/brighter
- **Dynamic Wind Animation**: Real-time wind bending of grass blades
- **Shadow Support**: Full shadow casting and receiving support
- **Flexible Configuration**: Extensive customization options for appearance and behavior
- **Smart Sampling**: Uses `MeshSurfaceSampler` to ensure grass grows on terrain surface
- **Texture Alignment**: Supports UV offset and flipping for precise texture mapping

## Installation

The project uses standard npm/yarn dependencies:

```json
{
  "dependencies": {
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.6.0",
    "@react-three/postprocessing": "^3.0.4",
    "lil-gui": "^0.21.0",
    "r3f-perf": "^7.2.3",
    "three": "^0.183.2"
  }
}
```

## Basic Usage

### Minimal Example

```jsx
import { Canvas } from '@react-three/fiber'
import { Grass } from './components/Grass'

function App() {
  return (
    <Canvas shadows>
      {/* Your terrain here */}
      <Grass />
    </Canvas>
  )
}
```

### Full Example with Terrain

```jsx
import { Canvas } from '@react-three/fiber'
import { Grass } from './components/Grass'

function App() {
  return (
    <Canvas shadows>
      {/* Terrain mesh named "terrain" */}
      {/* Texture holder mesh named "texture_holder" */}
      <Grass 
        terrainMesh={terrainMesh}
        densityTexture={densityTexture}
        terrainScale={terrainScale}
        terrainSize={terrainSize}
        count={8000}
        useTextureDensity={true}
      />
    </Canvas>
  )
}
```

## Critical Model Configuration

### Required Mesh Names

Your 3D model (GLTF/GLB) must contain two specific meshes:

1. **`terrain`** - The main mesh where grass will spawn
   - This is the surface that grass will grow on
   - Must be positioned correctly in your scene

2. **`texture_holder`** - Optional mesh that provides density texture
   - Contains the texture used for grass density sampling
   - Must have a material with a map texture
   - If omitted, the system falls back to the terrain mesh's material

### Texture Requirements

#### Density Texture (for texture-based grass)
- Should be grayscale (black and white)
- **Black (0,0,0)**: No grass will spawn
- **White (255,255,255)**: Maximum grass density
- **Gray values**: Proportional grass density

#### Grass Geometry Texture
- File: `/public/grass.jpeg` (alpha mask for grass silhouette)
- File: `/public/perlinnoise.webp` (procedural noise for variation)

## Props Reference

### Core Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `terrainMesh` | `THREE.Mesh` | Required | The mesh to place grass on |
| `terrainSize` | `THREE.Vector3` | Auto-calculated | Geometry bounding box size |
| `terrainScale` | `THREE.Vector3` | Auto-calculated | World scale of terrain |
| `densityTexture` | `THREE.Texture` | `null` | External texture for density |

### Grass Appearance

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `count` | `number` | `8000` | Maximum grass instances |
| `scale` | `number` | `1` | Size of individual grass blades |
| `baseColor` | `string` | `'#313f1b'` | Base diffuse color |
| `tipColor1` | `string` | `'#9bd38d'` | Tip gradient color 1 |
| `tipColor2` | `string` | `'#1f352a'` | Tip gradient color 2 |

### Density Control

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `useTextureDensity` | `boolean` | `false` | Enable texture-based density |
| `greenThreshold` | `number` | `0.3` | Min green value for placement |
| `densityMultiplier` | `number` | `2.0` | Density strength multiplier |
| `textureOffsetX` | `number` | `0` | UV offset X (-0.5 to 0.5) |
| `textureOffsetZ` | `number` | `0` | UV offset Z (-0.5 to 0.5) |
| `flipTextureX` | `boolean` | `false` | Flip X axis UVs |
| `flipTextureZ` | `boolean` | `false` | Flip Z axis UVs |

### Animation & Effects

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `enableWind` | `boolean` | `true` | Enable wind animation |
| `windStrength` | `number` | `0.1` | Wind bending intensity |
| `enableShadows` | `boolean` | `true` | Enable shadow mapping |
| `shadowDarkness` | `number` | `0.5` | Shadow darkness (0-1) |
| `lightIntensity` | `number` | `1` | Lighting intensity |
| `noiseScale` | `number` | `1.5` | Noise texture scale |

### Debug & Development

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showDebugTerrain` | `boolean` | `false` | Show red wireframe of terrain |

## Advanced Configuration

### Texture-Based Density Workflow

1. **Prepare your density texture**:
   - Create a grayscale image
   - Black areas = no grass
   - White areas = maximum grass

2. **Configure the Grass component**:
   ```jsx
   <Grass
     useTextureDensity={true}
     densityTexture={yourTexture}
     greenThreshold={0.4}  // Adjust sensitivity
     densityMultiplier={3.0}  // Increase density
   />
   ```

3. **Fine-tune alignment** (if needed):
   ```jsx
   <Grass
     flipTextureX={true}   // Mirror horizontally
     flipTextureZ={true}   // Mirror vertically
     textureOffsetX={0.1}  // Shift right
     textureOffsetZ={-0.05} // Shift forward
   />
   ```

### Wind Animation

The wind effect is controlled by a sine wave that varies based on grass height (UV Y coordinate):
- Grass at the **top** (UV Y = 0) bends more
- Grass at the **base** (UV Y = 1) bends less

Adjust with:
```jsx
<Grass
  enableWind={true}
  windStrength={0.2}  // Increase for more bending
  windSpeed={1.5}     // Increase for faster animation
/>
```

### Shadow Configuration

For realistic shadows:
1. Ensure directional light has shadows enabled:
   ```jsx
   <directionalLight
     position={[100, 100, 100]}
     castShadow
     shadow-mapSize={[2048, 2048]}
     shadow-camera-far={200}
   />
   ```

2. Enable shadows on grass:
   ```jsx
   <Grass enableShadows={true} shadowDarkness={0.5} />
   ```

## Troubleshooting

### Grass Not Appearing

1. **Check mesh names**: Ensure your model has "terrain" and "texture_holder" meshes
2. **Verify scale**: The terrain should be scaled (5,5,5) in the component
3. **Check texture**: Ensure `grass.jpeg` and `perlinnoise.webp` exist in `/public`

### Incorrect Density Mapping

1. **Flip axes**: Try `flipTextureX` or `flipTextureZ`
2. **Adjust offset**: Use `textureOffsetX/Z` to fine-tune alignment
3. **Check UVs**: Ensure your model's UV maps are correct

### Performance Issues

1. **Reduce count**: Lower `count` from 8000
2. **Disable shadows**: Set `enableShadows={false}`
3. **Lower wind strength**: Reduce `windStrength`

## Building the Project

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Development Notes

### Shader System

The grass uses a custom shader that:
- Injects wind animation into vertex shader
- Uses instanced rendering for performance
- Supports per-instance variation via noise texture

### Texture System

- **Noise texture** (`perlinnoise.webp`): Adds organic variation to grass placement
- **Alpha texture** (`grass.jpeg`): Defines grass silhouette and shape

### Performance Considerations

- Uses `InstancedMesh` for efficient rendering
- Caches texture analysis results
- Limits maximum instances to 8000 by default