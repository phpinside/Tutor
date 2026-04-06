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
 * 生成私有视频下载 URL，并强制覆盖响应 Content-Type 为 video/mp4。
 * 适用于 .mov 等浏览器默认不内联播放的格式（需将 response-content-type 纳入签名范围）。
 */
export function generateVideoPrivateUrl(key: string, deadline?: number): string {
  const expireTime = deadline || Math.floor(Date.now() / 1000) + 3600

  // 对 key 中每段路径分别 encodeURIComponent，保留 '/'
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  // response-content-type 必须在签名前加入 URL
  const baseUrl = `${QINIU_CONFIG.domain}/${encodedKey}?response-content-type=video%2Fmp4&e=${expireTime}`

  const signature = (qiniu.util as any).hmacSha1(baseUrl, QINIU_CONFIG.secretKey)
  const encodedSign = (qiniu.util as any).base64ToUrlSafe(signature)
  const downloadToken = `${QINIU_CONFIG.accessKey}:${encodedSign}`
  return `${baseUrl}&token=${downloadToken}`
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
 * 生成学习规划书 PDF 的存储 key
 * @param teacherId 教师 ID
 * @param fileExt 文件扩展名
 * @returns PDF 文件在七牛云上的 key
 */
export function generateLearningPlannerPdfKey(
  teacherId: string,
  fileExt: string = '.pdf'
): string {
  const timestamp = Date.now()
  return `uploads/learning-planner/${teacherId}-${timestamp}${fileExt}`
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

/**
 * 从七牛云 URL 中提取 key
 * @param fileUrl 七牛云 URL 或已保存的 key
 * @returns 文件 key
 */
export function extractQiniuKey(fileUrl: string): string {
  try {
    const url = new URL(fileUrl)
    return decodeURIComponent(url.pathname.substring(1))
  } catch {
    return fileUrl
  }
}

/**
 * 生成微信群二维码的固定 key
 * @returns 二维码在七牛云上的固定 key
 */
export function generateQRCodeKey(): string {
  return 'qrcode/wechat-group.png'
}



/**
 * 上传文件到七牛云
 * @param buffer 文件Buffer
 * @param key 文件在七牛云上的 key
 * @returns Promise<上传结果>
 */
export async function uploadToQiniu(buffer: Buffer, key: string): Promise<{ success: boolean; key: string; url: string; error?: string }> {
  return new Promise((resolve) => {
    try {
    
      // 生成上传token
      const uploadToken = generateUploadToken(key, 3600)

      // 配置对象
      const config = new qiniu.conf.Config()
      // 华北区域
      // @ts-ignore
      config.zone = qiniu.zone.Zone_z1

      // 创建表单上传对象
      const formUploader = new qiniu.form_up.FormUploader(config)
      const putExtra = new qiniu.form_up.PutExtra()

      // 上传文件
      formUploader.put(uploadToken, key, buffer, putExtra, (err, body, info) => {
        if (err) {
          console.error('七牛云上传错误:', err)
          resolve({
            success: false,
            key: '',
            url: '',
            error: err.message || '上传失败'
          })
          return
        }

        if (info.statusCode === 200) {
          const url = `${QINIU_CONFIG.domain}/${body.key}`
          resolve({
            success: true,
            key: body.key,
            url
          })
        } else {
          console.error('七牛云上传失败:', info.statusCode, body)
          resolve({
            success: false,
            key: '',
            url: '',
            error: `上传失败: ${info.statusCode}`
          })
        }
      })
    } catch (error) {
      console.error('七牛云上传异常:', error)
      resolve({
        success: false,
        key: '',
        url: '',
        error: error instanceof Error ? error.message : '上传异常'
      })
    }
  })
}
