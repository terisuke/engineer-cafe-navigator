/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'vercel.app', '*.vercel.app']
    }
  },
  // WebSocket support for external integrations
  webpack: (config, { isServer }) => {
    config.externals.push({
      'node:buffer': 'commonjs buffer'
    });
    
    // Ignore markdown files in node_modules
    config.module.rules.push({
      test: /\.md$/,
      loader: 'ignore-loader'
    });
    
    // Handle native modules
    config.module.rules.push({
      test: /\.node$/,
      loader: 'node-loader'
    });
    
    // Additional fixes for libsql package
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    
    // Externalize problematic modules for server-side
    if (isServer) {
      config.externals.push('libsql', '@libsql/client');
    }
    
    return config;
  },
  // Support for loading VRM models and assets
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
