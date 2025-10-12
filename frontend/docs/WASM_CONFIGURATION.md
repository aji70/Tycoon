# WebAssembly (WASM) Configuration for Blockopoly Frontend

This document explains the WebAssembly configuration implemented in the Blockopoly frontend project.

## Overview

The project has been configured to properly bundle and load WebAssembly modules using Next.js and webpack. This configuration supports the Dojo engine's WASM modules and provides utilities for working with WASM files.

## Configuration Files

### 1. Next.js Configuration (`next.config.mjs`)

The webpack configuration includes:

- **WebAssembly Experiments**: Enables `asyncWebAssembly`, `syncWebAssembly`, and `layers`
- **WASM File Handling**: Treats `.wasm` files as assets with proper filename generation
- **Code Splitting**: Separates WASM modules into their own chunks for optimal loading
- **Node.js Fallbacks**: Provides browser-compatible fallbacks for Node.js modules
- **Development Optimizations**: Ignores problematic WASM modules during development

### 2. TypeScript Declarations (`types/wasm.d.ts`)

Provides type definitions for:
- WASM module imports
- URL and inline WASM imports
- Dojo engine WASM modules
- Global WASM support detection

### 3. WASM Utilities (`utils/wasm-loader.ts`)

Helper functions for:
- Loading WASM modules with error handling
- Streaming WASM compilation for large files
- Checking WebAssembly support and capabilities
- Environment detection (browser vs Node.js)

## Usage Examples

### Basic WASM Module Import

```typescript
// Import a WASM module
import wasmModule from './path/to/module.wasm';

// Use the WASM loader utility
import { loadWasmModule } from '@/utils/wasm-loader';

const wasmInstance = await loadWasmModule('/path/to/module.wasm');
```

### Checking WASM Support

```typescript
import { isWasmSupported, getWasmCapabilities } from '@/utils/wasm-loader';

if (isWasmSupported()) {
  const capabilities = getWasmCapabilities();
  console.log('WASM capabilities:', capabilities);
}
```

### Using the Demo Component

```tsx
import WasmDemo from '@/components/WasmDemo';

export default function Page() {
  return (
    <div>
      <h1>WASM Support Status</h1>
      <WasmDemo />
    </div>
  );
}
```

## File Structure

```
frontend/
├── next.config.mjs          # Webpack WASM configuration
├── types/
│   └── wasm.d.ts           # TypeScript declarations
├── utils/
│   └── wasm-loader.ts      # WASM loading utilities
├── components/
│   └── WasmDemo.tsx        # Demo component
└── context/
    └── dojo-provider.tsx   # Dojo SDK with WASM support
```

## Key Features

### 1. Asset Resource Handling
WASM files are treated as assets and placed in the `static/wasm/` directory with content-based hashing for cache busting.

### 2. Code Splitting
WASM modules are automatically split into separate chunks, allowing for lazy loading and better performance.

### 3. Development Mode Optimizations
Problematic WASM modules (like `dojo_c_bg.wasm`) are ignored during development to prevent build errors.

### 4. Browser Compatibility
The configuration includes fallbacks for Node.js modules to ensure compatibility in browser environments.

### 5. TypeScript Support
Full TypeScript support with proper type definitions for WASM modules and imports.

## Troubleshooting

### Common Issues

1. **Module Not Found Errors**: 
   - Ensure WASM files are in the correct directory
   - Check that the file path is correct in imports

2. **Build Errors**:
   - Verify that all required webpack loaders are installed
   - Check for conflicting webpack rules

3. **Runtime Errors**:
   - Ensure WebAssembly is supported in the target environment
   - Check browser compatibility for WASM features

### Debug Information

The configuration includes debug information:
- `process.env.WEBPACK_WASM_SUPPORT` is set to indicate WASM support
- Console logging in the WASM utilities for debugging
- Error handling with detailed error messages

## Dependencies

The following packages are required for WASM support:

```json
{
  "devDependencies": {
    "wasm-loader": "^1.3.0",
    "file-loader": "^6.2.0"
  },
  "dependencies": {
    "@dojoengine/torii-wasm": "1.4.4",
    "@dojoengine/sdk": "1.4.4",
    "@dojoengine/core": "1.4.4"
  }
}
```

## Performance Considerations

1. **Lazy Loading**: WASM modules are loaded on-demand to reduce initial bundle size
2. **Caching**: Content-based hashing ensures efficient caching
3. **Compression**: WASM files benefit from gzip/brotli compression
4. **Streaming**: Large WASM files use streaming compilation when supported

## Security

- WASM modules are served from the same origin
- Content Security Policy should include `'unsafe-eval'` for WASM execution
- All WASM modules should be from trusted sources

## Future Enhancements

Potential improvements:
- WASM module preloading for critical modules
- Service worker caching for WASM files
- WASM module bundling optimization
- Support for WASM threads and SIMD when available