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
  serverExternalPackages: ['qiniu', 'graceful-fs', 'mz', 'pdf-parse', 'pdfkit']
}

export default nextConfig
