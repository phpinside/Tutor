import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runPlannerCheck } from '@/lib/planner-checker'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const record = await prisma.plannerCheckRecord.findUnique({ where: { id } })
  if (!record) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 })
  }

  if (record.status === 'PROCESSING' || record.status === 'COMPLETED') {
    return NextResponse.json({ message: '已在处理中或已完成' })
  }

  // 进程内触发分析（PENDING / FAILED 均可重试）
  void runPlannerCheck(id, record.extractedText).catch(err => {
    console.error(`[planner-checker/process/${id}] 触发分析失败:`, err)
  })

  return NextResponse.json({ message: '分析已开始' })
}
