/**
 * WASM Loading Utilities
 * Provides helper functions for loading and initializing WebAssembly modules
 */
export interface WasmModule {
  instance: WebAssembly.Instance;
  module: WebAssembly.Module;
}

/**
 * Load a WASM module from a URL or file path
 * @param wasmPath - Path to the WASM file
 * @param importObject - Optional import object for WASM instantiation
 * @returns Promise resolving to the WASM module
 */
export async function loadWasmModule(
  wasmPath: string,
  importObject?: WebAssembly.Imports
): Promise<WasmModule> {
  try {
    // Browser environment - use fetch
    const response = await fetch(wasmPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM module: ${response.statusText}`);
    }
    
    const wasmBytes = await response.arrayBuffer();
    const module = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(module, importObject || {});
    
    return { instance, module };
  } catch (error) {
    console.error('Failed to load WASM module:', error);
    throw new Error(`WASM loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load a WASM module with streaming compilation (more efficient for large files)
 * @param wasmPath - Path to the WASM file
 * @param importObject - Optional import object for WASM instantiation
 * @returns Promise resolving to the WASM instance
 */
export async function loadWasmModuleStreaming(
  wasmPath: string,
  importObject?: WebAssembly.Imports
): Promise<WebAssembly.Instance> {
  try {
    if (typeof window !== 'undefined' && 'instantiateStreaming' in WebAssembly) {
      // Use streaming compilation if available
      const response = await fetch(wasmPath);
      const result = await WebAssembly.instantiateStreaming(response, importObject || {});
      return result.instance;
    } else {
      // Fallback to regular loading
      const { instance } = await loadWasmModule(wasmPath, importObject);
      return instance;
    }
  } catch (error) {
    console.error('Failed to load WASM module with streaming:', error);
    throw new Error(`WASM streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if WebAssembly is supported in the current environment
 * @returns boolean indicating WASM support
 */
export function isWasmSupported(): boolean {
  return typeof WebAssembly !== 'undefined' && 
         typeof WebAssembly.instantiate === 'function';
}

/**
 * Get WASM capabilities of the current environment
 * @returns object with capability flags
 */
export function getWasmCapabilities() {
  return {
    supported: isWasmSupported(),
    streaming: typeof WebAssembly !== 'undefined' && 'instantiateStreaming' in WebAssembly,
    threads: typeof SharedArrayBuffer !== 'undefined',
    simd: (() => {
      try {
        return typeof WebAssembly !== 'undefined' && 
               WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
      } catch {
        return false;
      }
    })(),
  };
}