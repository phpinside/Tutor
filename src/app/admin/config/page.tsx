import { getAllTaskConfigs, getAllPhaseConfigs } from '@/app/actions/config'
import Link from 'next/link'
import QRCodeUploader from '@/components/admin/QRCodeUploader'

export const dynamic = 'force-dynamic'

export default async function AdminConfigPage() {
  const tasks = await getAllTaskConfigs()
  const phases = await getAllPhaseConfigs()
  
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          系统配置管理
        </h1>
        <p className="text-gray-600">
          管理任务和阶段配置
        </p>
      </div>

      {/* 二维码配置区域 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          微信群二维码
        </h2>
        <QRCodeUploader />
      </div>
      
      
      {/* 任务配置区域 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            任务列表
          </h2>
          <Link
            href="/admin/config/task/new"
            className="btn-primary"
          >
            + 添加任务
          </Link>
        </div>
        
        {tasks.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              暂无任务配置
            </h3>
            <p className="text-gray-600 mb-4">
              点击"添加任务"按钮创建第一个任务
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{task.emoji}</span>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500">任务 {task.index}</span>
                        <span className="text-xs text-gray-500">阶段 {task.phase}</span>
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {task.title}
                        </h3>
                        <span className="badge-primary text-xs">
                          {task.type}
                        </span>
                        {task.isOptional && (
                          <span className="badge-gray text-xs">可选</span>
                        )}
                        {!task.isActive && (
                          <span className="badge text-xs bg-red-100 text-red-800">已禁用</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-1">
                        {task.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        预计时长: {task.estimatedMinutes} 分钟 · 
                        要求: {(task.requirements as string[]).length} 项
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/config/task/${task.id}`}
                      className="btn-outline text-sm px-3 py-1.5"
                    >
                      编辑
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 阶段配置区域 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            阶段列表
          </h2>
          <Link
            href="/admin/config/phase/new"
            className="btn-primary"
          >
            + 添加阶段
          </Link>
        </div>
        
        {phases.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              暂无阶段配置
            </h3>
            <p className="text-gray-600 mb-4">
              点击"添加阶段"按钮创建第一个阶段
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {phases.map((phase) => (
              <div key={phase.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
                      {phase.phase}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {phase.title}
                      </h3>
                      {!phase.isActive && (
                        <span className="badge text-xs bg-red-100 text-red-800 mt-1">
                          已禁用
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {phase.description}
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/config/phase/${phase.id}`}
                    className="btn-outline text-sm px-3 py-1.5 w-full text-center"
                  >
                    编辑
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

