/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true, // Enable gzip compression
  poweredByHeader: false, // Remove X-Powered-By header for security
  swcMinify: true, // Use SWC minification (faster than Terser)
  // Optimize images if you add any
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Add headers for caching
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
