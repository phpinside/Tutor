import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  // 业务查询默认不返回凭据；认证入口必须显式请求密码哈希。
  omit: { teacher: { password: true }, operator: { password: true } },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
})

// 在所有环境都使用全局单例，避免 serverless 环境中重复创建实例
globalForPrisma.prisma = prisma

