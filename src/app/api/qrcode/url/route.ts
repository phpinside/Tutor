import { NextResponse } from 'next/server'
import { generatePrivateUrl, generateQRCodeKey } from '@/lib/qiniu'

export async function GET() {
  try {
    const key = generateQRCodeKey()
    // 生成 10 小时有效期的签名URL
    const signedUrl = generatePrivateUrl(key, Math.floor(Date.now() / 1000) + 36000)
    
    return NextResponse.json({
      url: signedUrl,
      expiresIn: 36000
    })
  } catch (error) {
    console.error('生成二维码URL失败:', error)
    return NextResponse.json(
      { error: '获取二维码失败' },
      { status: 500 }
    )
  }
}
