import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      }
    ]
  },
  serverExternalPackages: ['qiniu', 'graceful-fs', 'mz']
}

export default nextConfig