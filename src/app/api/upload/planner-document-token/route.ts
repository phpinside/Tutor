import { NextRequest, NextResponse } from 'next/server'
import { generateLearningPlannerPdfKey, generateUploadToken } from '@/lib/qiniu'
import { QINIU_CONFIG } from '@/lib/config'
import { isValidLearningPlannerPdfName } from '@/lib/learningPlanner'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teacherId, fileName } = body
    const sessionTeacherId = request.cookies.get('teacherId')?.value

    if (!teacherId || !fileName) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    if (!sessionTeacherId || sessionTeacherId !== teacherId) {
      return NextResponse.json({ error: '无权上传该文件' }, { status: 403 })
    }

    const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
    if (fileExt !== '.pdf') {
      return NextResponse.json({ error: '学习规划书必须为 PDF 格式' }, { status: 400 })
    }

    if (!isValidLearningPlannerPdfName(fileName)) {
      return NextResponse.json(
        { error: '文件名格式不正确，请使用 {学生姓名}-数学学习规划建议书.pdf' },
        { status: 400 }
      )
    }

    const key = generateLearningPlannerPdfKey(teacherId, fileExt)
    const uploadToken = generateUploadToken(key, 3600)

    return NextResponse.json({
      uploadToken,
      key,
      domain: QINIU_CONFIG.domain,
      uploadUrl: 'https://up-z1.qiniup.com',
    })
  } catch (error) {
    console.error('生成学习规划书上传 token 失败:', error)
    return NextResponse.json({ error: '生成上传凭证失败' }, { status: 500 })
  }
}
