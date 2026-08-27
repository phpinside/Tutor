import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serializeDraft } from '@/lib/internship-certificate-service'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacherId = (await cookies()).get('teacherId')?.value
  if (!teacherId) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const { id } = await params
  const draft = await prisma.internshipCertificateDraft.findFirst({ where: { id, teacherId } })
  if (!draft) return NextResponse.json({ error: '记录不存在' }, { status: 404 })

  return NextResponse.json({ draft: serializeDraft(draft) })
}
