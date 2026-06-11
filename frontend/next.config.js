/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable React Strict Mode to stop double-invocation of effects in dev
  reactStrictMode: false,

  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },

  // Next.js 16 uses Turbopack by default.
  // maplibre-gl is excluded from the server bundle automatically because
  // MapPreview is imported with { ssr: false }, so no webpack externals needed.
  turbopack: {},

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
