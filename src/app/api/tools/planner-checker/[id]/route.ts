import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const record = await prisma.plannerCheckRecord.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        status: true,
        result: true,
        errorMsg: true,
        createdAt: true,
      },
    })

    if (!record) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 })
    }

    return NextResponse.json({
      ...record,
      createdAt: record.createdAt.toISOString(),
    })
  } catch (err) {
    console.error('[planner-checker/[id]]', err)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
