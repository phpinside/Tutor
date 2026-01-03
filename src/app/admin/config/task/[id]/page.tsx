import { getTaskConfig } from '@/app/actions/config'
import { notFound } from 'next/navigation'
import TaskConfigForm from '@/components/admin/TaskConfigForm'

export const dynamic = 'force-dynamic'

export default async function EditTaskConfigPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  if (id === 'new') {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          添加新任务
        </h1>
        <TaskConfigForm />
      </div>
    )
  }
  
  const task = await getTaskConfig(id)
  
  if (!task) {
    notFound()
  }
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        编辑任务: {task.title}
      </h1>
      <TaskConfigForm task={task} />
    </div>
  )
}

