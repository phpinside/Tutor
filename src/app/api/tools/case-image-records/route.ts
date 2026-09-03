import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { generateCaseImageKey, uploadToQiniu } from '@/lib/qiniu'
import { serializeCaseImageRecord } from '@/lib/case-image-records'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024

type CaseImagePayload = {
  templateId?: string
  templateName?: string
  studentRegion: string
  studentName: string
  studentGrade: string
  scoreTitle: string
  studyDuration: string
  scoreIncrease: string
  teamName?: string
  coachSignature?: string
  bottomNote?: string
}

function readPayload(raw: unknown): CaseImagePayload | null {
  if (typeof raw !== 'string') return null
  try {
    return JSON.parse(raw) as CaseImagePayload
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const teacherId = (await cookies()).get('teacherId')?.value
    if (!teacherId) return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true },
    })
    if (!teacher) return NextResponse.json({ error: '用户不存在' }, { status: 404 })

    const formData = await request.formData()
    const payload = readPayload(formData.get('payload'))
    const image = formData.get('image')

    if (!payload || !image || !(image instanceof Blob)) {
      return NextResponse.json({ error: '请求参数不完整' }, { status: 400 })
    }

    const requiredFields = [
      [payload.studentRegion, '学生地区'],
      [payload.studentName, '学生姓名'],
      [payload.studentGrade, '学生年级'],
      [payload.scoreTitle, '提分科目'],
      [payload.studyDuration, '学习时长'],
      [payload.scoreIncrease, '提分分数'],
    ] as const
    const missing = requiredFields.find(([value]) => !value || !value.trim())
    if (missing) {
      return NextResponse.json({ error: `请填写${missing[1]}` }, { status: 400 })
    }

    if (image.type !== 'image/png') {
      return NextResponse.json({ error: '案例图仅支持 PNG 格式' }, { status: 400 })
    }
    if (image.size === 0 || image.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: '案例图大小超出限制' }, { status: 400 })
    }

    const buffer = Buffer.from(await image.arrayBuffer())
    const studentName = payload.studentName.trim()
    const imageKey = generateCaseImageKey(teacherId, studentName)

    const uploadResult = await uploadToQiniu(buffer, imageKey)
    if (!uploadResult.success) {
      console.error('[case-image-records POST] 上传七牛云失败:', uploadResult.error)
      return NextResponse.json({ error: '案例图上传失败，请重试' }, { status: 500 })
    }

    const record = await prisma.caseImageRecord.create({
      data: {
        teacherId,
        templateId: payload.templateId?.trim() || null,
        templateName: payload.templateName?.trim() || null,
        studentRegion: payload.studentRegion.trim(),
        studentName,
        studentGrade: payload.studentGrade.trim(),
        scoreTitle: payload.scoreTitle.trim(),
        studyDuration: payload.studyDuration.trim(),
        scoreIncrease: payload.scoreIncrease.trim(),
        teamName: payload.teamName?.trim() || '',
        coachSignature: payload.coachSignature?.trim() || '',
        bottomNote: payload.bottomNote?.trim() || null,
        imageKey: uploadResult.key,
      },
    })

    return NextResponse.json({ record: serializeCaseImageRecord(record) }, { status: 201 })
  } catch (error) {
    console.error('[case-image-records POST]', error)
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 })
  }
}
