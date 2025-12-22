import { NextRequest, NextResponse } from 'next/server'
import { generateUploadToken, generateVideoKey } from '@/lib/qiniu'
import { QINIU_CONFIG } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teacherId, taskIndex, fileName } = body

    // 参数验证
    if (!teacherId || taskIndex === undefined || !fileName) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 验证文件类型
    const allowedExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm']
    const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
    
    if (!allowedExtensions.includes(fileExt)) {
      return NextResponse.json(
        { error: '不支持的视频格式' },
        { status: 400 }
      )
    }

    // 生成文件key
    const key = generateVideoKey(teacherId, taskIndex, fileExt)

    // 生成上传token（1小时有效期）
    const uploadToken = generateUploadToken(key, 3600)
    
    console.log('生成上传凭证:', {
      key,
      bucket: QINIU_CONFIG.bucket,
      domain: QINIU_CONFIG.domain
    })

    // 返回上传所需的信息
    return NextResponse.json({
      uploadToken,
      key,
      domain: QINIU_CONFIG.domain,
      uploadUrl: 'https://up-z1.qiniup.com' // 七牛云华北区域上传地址
    })
  } catch (error) {
    console.error('生成上传token失败:', error)
    return NextResponse.json(
      { error: '生成上传凭证失败' },
      { status: 500 }
    )
  }
}

