import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PhaseConfigForm from '@/components/admin/PhaseConfigForm'

export const dynamic = 'force-dynamic'

export default async function EditPhaseConfigPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  if (id === 'new') {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          添加新阶段
        </h1>
        <PhaseConfigForm />
      </div>
    )
  }
  
  const phase = await prisma.phaseConfig.findUnique({
    where: { id }
  })
  
  if (!phase) {
    notFound()
  }
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        编辑阶段: {phase.title}
      </h1>
      <PhaseConfigForm phase={phase} />
    </div>
  )
}

