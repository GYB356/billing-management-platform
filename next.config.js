/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, dev }) => {
    // Add bundle splitting for translations
    config.optimization.splitChunks = {
      ...config.optimization.splitChunks,
      cacheGroups: {
        ...config.optimization.splitChunks.cacheGroups,
        translations: {
          test: /[\\/]locales[\\/]/,
          name(module) {
            const match = module.resource.match(/[\\/]locales[\\/]([a-z]{2})[\\/]/);
            return match ? `translation-${match[1]}` : 'translations';
          },
          chunks: 'async',
          minSize: 0,
          priority: 40
        }
      }
    };

    // Add service worker in production
    if (!isServer && !dev) {
      const WorkboxPlugin = require('workbox-webpack-plugin');
      config.plugins.push(
        new WorkboxPlugin.GenerateSW({
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\/locales\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'translations',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
                }
              }
            }
          ]
        })
      );
    }

    return config;
  },

  // Fix for SWC and Babel conflict
  transpilePackages: ['next-auth'],

  experimental: {
    optimizeCss: true,
    babelConfig: false, // Ensure Babel is not being used
  },

  swcMinify: true,

  // Resolve font loading issues
  images: {
    domains: ['fonts.googleapis.com', 'fonts.gstatic.com'],
  },

  // Use SWC compiler explicitly
  compiler: {
    styledComponents: true,
  }
};

module.exports = nextConfig;
