import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runPlannerCheck } from '@/lib/planner-checker'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const teacherId = formData.get('teacherId') as string | null

    if (!file || !teacherId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: '只支持 PDF 格式' }, { status: 400 })
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: '文件大小不能超过 20MB' }, { status: 400 })
    }

    // Verify teacher exists
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } })
    if (!teacher) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // Extract text from PDF (pdf-parse v2 is ESM-only, use dynamic import)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    let extractedText = ''
    try {
      // pdf-parse v1 is CJS; require() works reliably with serverExternalPackages
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const parsed = await pdfParse(buffer)
      extractedText = parsed.text?.trim() ?? ''
    } catch (parseErr) {
      console.error('[planner-checker/submit] pdf-parse error:', parseErr)
      return NextResponse.json({ error: 'PDF 解析失败，请确认文件未加密或损坏' }, { status: 422 })
    }

    if (!extractedText) {
      return NextResponse.json(
        { error: 'PDF 中未能提取到文字内容，请确认文件包含可选中的文字（非扫描图片）' },
        { status: 422 }
      )
    }

    //处理和过滤extractedText中特殊字符
    extractedText = extractedText.replace(/\u0000/g, '')   
    extractedText = extractedText.replace(/\uFFFD/g, '')  
    extractedText = extractedText.trim()

    // Create record
    const record = await prisma.plannerCheckRecord.create({
      data: {
        teacherId,
        fileName: file.name,
        extractedText,
        status: 'PENDING',
      },
      select: {
        id: true,
        fileName: true,
        status: true,
        result: true,
        errorMsg: true,
        createdAt: true,
      },
    })

    // 直接在进程内触发分析（不依赖 HTTP 自调用，避免反代/域名解析问题）
    void runPlannerCheck(record.id, extractedText).catch(err => {
      console.error('[planner-checker/submit] 触发分析失败:', err)
    })

    return NextResponse.json({
      record: {
        ...record,
        createdAt: record.createdAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[planner-checker/submit]', err)
    return NextResponse.json({ error: '服务器错误，请稍后重试' }, { status: 500 })
  }
}
