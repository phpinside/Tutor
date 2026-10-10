import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { uploadToQiniu } from '@/lib/qiniu'
import type { CertificateForm } from '@/lib/student-certificate-config'
import { serializeStudentCertificateRecord } from '@/lib/student-certificate-records'

export async function POST(request: NextRequest) {
  try {
    const teacherId = (await cookies()).get('teacherId')?.value
    if (!teacherId) return NextResponse.json({ error: '请先登录' }, { status: 401 })
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true } })
    if (!teacher) return NextResponse.json({ error: '用户不存在' }, { status: 404 })

    const body = await request.formData()
    const image = body.get('image')
    const raw = body.get('payload')
    if (!(image instanceof Blob) || typeof raw !== 'string') return NextResponse.json({ error: '请求参数不完整' }, { status: 400 })
    let data: CertificateForm & { templateId: string }
    try { data = JSON.parse(raw) } catch { return NextResponse.json({ error: '表单格式错误' }, { status: 400 }) }
    if (!data || typeof data !== 'object') return NextResponse.json({ error: '表单格式错误' }, { status: 400 })
    const template = await prisma.studentCertificateTemplate.findFirst({ where: { id: data.templateId, isActive: true, archivedAt: null } })
    if (!template) return NextResponse.json({ error: '奖状模板已停用，请刷新页面后重试' }, { status: 400 })
    const fields: Array<[keyof CertificateForm, number, boolean]> = [
      ['studentName', 40, true], ['grade', 30, false], ['subject', 30, false],
      ['awardName', 40, true], ['citation', 180, false], ['issuer', 80, false],
      ['issueDate', 10, true], ['teamName', 60, false], ['coachName', 60, false],
    ]
    for (const [key, limit, required] of fields) {
      if (typeof data[key] !== 'string' || data[key].length > limit || (required && !data[key].trim())) {
        return NextResponse.json({ error: `${key} 内容无效` }, { status: 400 })
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.issueDate)) return NextResponse.json({ error: '颁发日期无效' }, { status: 400 })
    if (image.type !== 'image/png' || image.size < 100 || image.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: '奖状图片格式或大小无效' }, { status: 400 })
    }
    const buffer = Buffer.from(await image.arrayBuffer())
    if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      return NextResponse.json({ error: '奖状图片格式无效' }, { status: 400 })
    }
    const safeName = data.studentName.trim().replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 30)
    const safeAward = data.awardName.trim().replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 30)
    const key = `uploads/student-certificates/${teacherId}/${safeName}_${safeAward}_${data.issueDate}_${Date.now()}.png`
    const upload = await uploadToQiniu(buffer, key)
    if (!upload.success) return NextResponse.json({ error: '奖状保存失败，请重试' }, { status: 500 })
    const record = await prisma.studentCertificateRecord.create({
      data: {
        teacherId, templateId: template.id, templateName: template.name, orientation: template.orientation,
        studentName: data.studentName.trim(), grade: data.grade.trim(), subject: data.subject.trim(),
        awardName: data.awardName.trim(), citation: data.citation.trim(), issuer: data.issuer.trim(),
        issueDate: data.issueDate, teamName: data.teamName.trim(), coachName: data.coachName.trim(),
        imageKey: upload.key,
      },
    })
    return NextResponse.json({ record: serializeStudentCertificateRecord(record) }, { status: 201 })
  } catch (error) {
    console.error('[student-certificate-records POST]', error)
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 })
  }
}
