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
  serverExternalPackages: ['qiniu', 'graceful-fs', 'mz', 'pdf-parse', 'pdfkit'],
  // fileLogger 仅在 Node runtime 执行（见 src/instrumentation.ts 的 NEXT_RUNTIME 守卫），
  // Edge 编译（middleware/instrumentation）用空模块占位以通过构建
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === 'edge') {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        util: false
      }
    }
    return config
  }
}


// P1-5 安全响应头（全站）
nextConfig.headers = async () => [
  {
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ],
  },
]

export default nextConfig
