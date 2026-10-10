import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { generatePrivateUrl } from '@/lib/qiniu'
import { isSuperAdmin } from '@/lib/admin-auth'
import { readCertificateBackground } from '@/lib/student-certificate-template-files'

export const runtime = 'nodejs'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const template = await prisma.studentCertificateTemplate.findUnique({ where: { id } })
  if (!template || (!template.backgroundPath && !template.backgroundKey)) return new NextResponse(null, { status: 404 })
  const admin = await isSuperAdmin()
  const teacher = (await cookies()).get('teacherId')?.value
  if (!admin && (!teacher || !template.isActive || template.archivedAt)) return new NextResponse(null, { status: 403 })
  try {
    if (template.backgroundPath) {
      const buffer = await readCertificateBackground(template.backgroundPath)
      const type = template.backgroundPath.endsWith('.webp') ? 'image/webp' : /\.jpe?g$/.test(template.backgroundPath) ? 'image/jpeg' : 'image/png'
      return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=300' } })
    }
    const response = await fetch(generatePrivateUrl(template.backgroundKey!), { cache: 'no-store' })
    if (!response.ok) return new NextResponse(null, { status: 502 })
    const type = response.headers.get('content-type') || 'image/png'
    return new NextResponse(response.body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=300' } })
  } catch (error) {
    console.error('[student-certificate background]', error)
    return new NextResponse(null, { status: 502 })
  }
}
