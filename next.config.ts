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
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 服务端：将 qiniu 相关模块标记为外部依赖，避免打包
      config.externals = config.externals || []
      config.externals.push('qiniu', 'graceful-fs', 'mz')
    } else {
      // 客户端：完全排除这些服务端专用模块
      config.resolve.alias = {
        ...config.resolve.alias,
        'qiniu': false,
        'graceful-fs': false,
        'mz': false
      }
    }
    return config
  }
}

export default nextConfig

