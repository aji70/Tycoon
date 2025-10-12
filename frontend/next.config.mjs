/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, webpack, dev }) => {
    // Enable WebAssembly experiments
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
      layers: true,
    };

    // Configure WASM file handling with proper rule ordering
    const wasmRule = {
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/wasm/[name].[hash][ext]',
      },
    };

    // Add WASM rule to the beginning to ensure it takes precedence
    config.module.rules.unshift(wasmRule);

    // Add rule for @dojoengine/torii-wasm JavaScript files
    config.module.rules.push({
      test: /@dojoengine[\\/]torii-wasm[\\/]pkg[\\/]web[\\/].*\.js$/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    });

    // Optimize WASM loading
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      splitChunks: {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          wasm: {
            test: /\.wasm$/,
            name: 'wasm',
            chunks: 'all',
            enforce: true,
          },
        },
      },
    };

    // Add fallbacks for Node.js modules in the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        os: false,
        url: false,
        zlib: false,
        path: false,
        buffer: false,
      };
    }

    // Handle WASM imports properly
    config.resolve.extensions = [
      ...config.resolve.extensions,
      '.wasm',
    ];

    // Add plugins for better WASM handling
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.WEBPACK_WASM_SUPPORT': JSON.stringify(true),
      })
    );

    // Only ignore problematic WASM modules in development
    if (dev) {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /dojo_c_bg\.wasm$/,
        })
      );
    }

    // Add support for dynamic imports of WASM
    config.output = {
      ...config.output,
      webassemblyModuleFilename: 'static/wasm/[modulehash].wasm',
      assetModuleFilename: 'static/media/[name].[hash][ext]',
    };

    return config;
  },
  experimental: {
    esmExternals: 'loose',
    webpackBuildWorker: true,
  },
  transpilePackages: [
    '@dojoengine/torii-wasm',
    '@dojoengine/sdk',
    '@dojoengine/core',
  ],
};

export default nextConfig;