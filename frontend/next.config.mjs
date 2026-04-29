// LOCATION: frontend/next.config.mjs
// IMPORTANT: Rename/delete next.config.ts and use this file instead

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable StrictMode — in dev, StrictMode mounts components TWICE
  // which closes the WebSocket before it opens, causing "ERROR" status
  reactStrictMode: false,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },

  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/:path*`,
      },
    ]
  },
}

export default nextConfig
