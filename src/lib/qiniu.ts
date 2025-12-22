import * as qiniu from 'qiniu'
import { QINIU_CONFIG } from './config'

/**
 * 生成七牛云私有资源的下载 URL（带签名）
 * @param key 文件在七牛云上的 key（路径）
 * @param deadline 链接过期时间（Unix 时间戳，秒），默认 1 小时后过期
 * @returns 带签名的私有下载 URL
 */
export function generatePrivateUrl(key: string, deadline?: number): string {
  // 创建 Mac 认证对象
  const mac = new qiniu.auth.digest.Mac(
    QINIU_CONFIG.accessKey,
    QINIU_CONFIG.secretKey
  )

  // 创建配置对象
  const config = new qiniu.conf.Config()

  // 创建 BucketManager
  const bucketManager = new qiniu.rs.BucketManager(mac, config)

  // 设置默认过期时间为 1 小时后
  const expireTime = deadline || Math.floor(Date.now() / 1000) + 3600

  // 生成私有下载 URL
  const privateDownloadUrl = bucketManager.privateDownloadUrl(
    QINIU_CONFIG.domain,
    key,
    expireTime
  )

  return privateDownloadUrl
}

/**
 * 生成视频文件的存储key
 * @param teacherId 教师ID
 * @param taskIndex 任务索引
 * @param fileExt 文件扩展名（如 .mp4）
 * @returns 视频文件在七牛云上的key
 */
export function generateVideoKey(
  teacherId: string,
  taskIndex: number,
  fileExt: string
): string {
  const timestamp = Date.now()
  // 格式: uploads/task-{taskIndex}/{teacherId}-{timestamp}.{ext}
  return `uploads/task-${taskIndex}/${teacherId}-${timestamp}${fileExt}`
}

/**
 * 生成七牛云上传凭证
 * @param key 文件在七牛云上的 key（路径）
 * @param expires 过期时间（秒），默认 1 小时
 * @returns 上传凭证 token
 */
export function generateUploadToken(key: string, expires: number = 3600): string {
  // 创建 Mac 认证对象
  const mac = new qiniu.auth.digest.Mac(
    QINIU_CONFIG.accessKey,
    QINIU_CONFIG.secretKey
  )

  // 创建上传策略（简化配置以避免七牛云验证问题）
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: `${QINIU_CONFIG.bucket}:${key}`, // 指定bucket和key，覆盖上传
    deadline: Math.floor(Date.now() / 1000) + expires // 使用deadline而不是expires
  })

  // 生成上传token
  return putPolicy.uploadToken(mac)
}

/**
 * 检查视频 key 是否有效
 * @param key 文件 key
 * @returns 是否为有效的视频文件
 */
export function isValidVideoKey(key: string): boolean {
  if (!key) return false
  const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.m3u8']
  return videoExtensions.some(ext => key.toLowerCase().endsWith(ext))
}

