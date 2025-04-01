/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure SWC is enabled
  swcMinify: true,

  // Remove any Babel-specific configurations
  experimental: {
    babelConfig: false, // Ensure Babel is not being used
  },
};

module.exports = nextConfig;