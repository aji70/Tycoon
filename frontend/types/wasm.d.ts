/**
 * TypeScript declarations for WebAssembly modules
 */

declare module '*.wasm' {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}

declare module '*.wasm?url' {
  const wasmUrl: string;
  export default wasmUrl;
}

declare module '*.wasm?inline' {
  const wasmBytes: Uint8Array;
  export default wasmBytes;
}

// Extend the global namespace for WASM support detection
declare global {
  interface Window {
    WebAssembly: typeof WebAssembly;
  }
  
  namespace NodeJS {
    interface ProcessEnv {
      WEBPACK_WASM_SUPPORT?: string;
    }
  }
}

// Dojo engine WASM module declarations
declare module '@dojoengine/torii-wasm' {
  export function init(): Promise<any>;
  export function createClient(config: any): Promise<any>;
  // Add other exports as needed
}

declare module '@dojoengine/sdk' {
  export function init<T = any>(config: any): Promise<T>;
  // Add other exports as needed
}

export {};