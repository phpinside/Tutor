import React from 'react'

interface PhaseIndicatorProps {
  currentPhase: number
  totalPhases?: number
  phases?: { number: number; title: string }[]
}

export default function PhaseIndicator({ 
  currentPhase, 
  totalPhases = 3,
  phases: customPhases
}: PhaseIndicatorProps) {
  const defaultPhases = [
    { number: 1, title: '认识伴学' },
    { number: 2, title: '体验任务' },
    { number: 3, title: '上岗准备' }
  ]
  
  const phases = customPhases || defaultPhases
  
  return (
    <div className="flex items-center justify-between max-w-2xl mx-auto">
      {phases.map((phase, index) => {
        const isActive = phase.number === currentPhase
        const isCompleted = phase.number < currentPhase
        
        return (
          <div key={phase.number} className="flex items-center flex-1">
            {/* 阶段圆圈 */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                  isCompleted
                    ? 'bg-success-500 text-white'
                    : isActive
                    ? 'bg-primary-600 text-white ring-4 ring-primary-100'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {isCompleted ? '✓' : phase.number}
              </div>
              <span
                className={`text-xs mt-2 font-medium ${
                  isActive ? 'text-primary-600' : 'text-gray-500'
                }`}
              >
                {phase.title}
              </span>
            </div>
            
            {/* 连接线 */}
            {index < phases.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 mb-6">
                <div
                  className={`h-full transition-all duration-300 ${
                    phase.number < currentPhase ? 'bg-success-500' : 'bg-gray-200'
                  }`}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


