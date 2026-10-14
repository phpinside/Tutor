'use client'

import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_RANKING_TEAMS, getDefaultRankingPeriod, getRankingHeight,
  RANKING_BACKGROUND, RANKING_BACKDROP, RANKING_FONT, renderRankingPoster,
  type RankingTeam,
} from '@/lib/learning-manager-ranking'

const TEAM_FIELDS = [
  { key: 'name', label: '团队名称', placeholder: '例如：张洪瑞团队', maxLength: 16, rows: 1 },
  { key: 'grades', label: '擅长学段', placeholder: '例如：小学 / 初中', maxLength: 40, rows: 1 },
  { key: 'introduction', label: '核心简介', placeholder: '例如：学习规划 | 师资匹配 | 日常跟进 | 阶段反馈', maxLength: 80, rows: 2 },
  { key: 'highlight', label: '亮点总结', placeholder: '填写团队亮点，支持换行', maxLength: 80, rows: 3 },
] as const

function loadBackground(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('背景图片加载失败，请重试。'))
    image.src = src
  })
}

export default function LearningManagerRankingClient({ defaultPeriod }: { defaultPeriod: string }) {
  const [period, setPeriod] = useState(defaultPeriod)
  const [teams, setTeams] = useState<RankingTeam[]>(() => DEFAULT_RANKING_TEAMS.map((team) => ({ ...team })))
  const [background, setBackground] = useState<HTMLImageElement | null>(null)
  const [backdrop, setBackdrop] = useState<HTMLImageElement | null>(null)
  const [loadError, setLoadError] = useState('')
  const [renderError, setRenderError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [assetAttempt, setAssetAttempt] = useState(0)
  const [renderedContent, setRenderedContent] = useState('')
  const [downloading, setDownloading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const content = JSON.stringify({ period, teams })
  const ready = renderedContent === content && Boolean(background) && Boolean(backdrop) && !loadError && !renderError
  const error = loadError || renderError || downloadError

  useEffect(() => {
    let active = true
    setLoadError('')
    setBackground(null)
    setBackdrop(null)
    async function loadAssets() {
      const font = new FontFace(RANKING_FONT, 'url(/fonts/NotoSansCJKsc-Regular.otf)')
      const [image, backdropImage, loadedFont] = await Promise.all([
        loadBackground(RANKING_BACKGROUND), loadBackground(RANKING_BACKDROP), font.load(),
      ])
      if (!active) return
      document.fonts.add(loadedFont)
      setBackground(image)
      setBackdrop(backdropImage)
    }
    loadAssets().catch((cause: unknown) => {
      if (active) setLoadError(cause instanceof Error ? cause.message : '图片或字体加载失败，请重试。')
    })
    return () => { active = false }
  }, [assetAttempt])

  useEffect(() => {
    if (!background || !backdrop) return
    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        renderRankingPoster(canvas, background, backdrop, period, teams)
        setRenderError('')
        setRenderedContent(content)
      } catch (cause) {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
        setRenderedContent('')
        setRenderError(cause instanceof Error ? cause.message : '图片生成失败，请重试。')
      }
    }, 150)
    return () => window.clearTimeout(timer)
  }, [background, backdrop, period, teams, content])

  function updateTeam(id: string, field: keyof Omit<RankingTeam, 'id'>, value: string) {
    setDownloadError('')
    setTeams((current) => current.map((team) => team.id === id ? { ...team, [field]: value } : team))
  }

  function moveTeam(index: number, direction: number) {
    setTeams((current) => {
      const next = [...current]
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function downloadPoster() {
    const canvas = canvasRef.current
    if (!ready || !canvas || downloading) return
    setDownloading(true)
    setDownloadError('')
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('图片导出失败，请重试。')), 'image/png')
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `学管榜单-${period.replace(/[\\/:*?"<>|]/g, '-')}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) {
      setDownloadError(cause instanceof Error ? cause.message : '下载失败，请重试。')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_540px]">
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void downloadPoster() }}>
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-900">榜单时间</h2>
            <button type="button" onClick={() => setPeriod(getDefaultRankingPeriod())} className="text-sm text-blue-600 hover:text-blue-800">填入上周二—本周二</button>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">中文时间区间</span>
            <input value={period} onChange={(event) => setPeriod(event.target.value)} required maxLength={48} className="input w-full" />
          </label>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">默认按北京时间填写上周二—本周二的日期（周一为一周开始），可自由修改显示文案。</p>
        </section>

        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">学管团队 <span className="text-sm font-normal text-gray-500">共 {teams.length} 个</span></h2>
          <span className="text-xs text-gray-500">按从左到右、从上到下排列</span>
        </div>

        {teams.map((team, index) => (
          <fieldset key={team.id} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5">
            <legend className="sr-only">第 {index + 1} 个团队</legend>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900"><span className="mr-2 text-blue-600">{String(index + 1).padStart(2, '0')}</span>{team.name || '新团队'}</h3>
              <div className="flex gap-3 text-xs">
                <button type="button" aria-label={`上移第 ${index + 1} 个团队`} onClick={() => moveTeam(index, -1)} disabled={index === 0} className="text-gray-500 hover:text-blue-600 disabled:opacity-30">上移</button>
                <button type="button" aria-label={`下移第 ${index + 1} 个团队`} onClick={() => moveTeam(index, 1)} disabled={index === teams.length - 1} className="text-gray-500 hover:text-blue-600 disabled:opacity-30">下移</button>
                <button type="button" aria-label={`删除第 ${index + 1} 个团队`} onClick={() => setTeams((current) => current.filter((item) => item.id !== team.id))} disabled={teams.length === 1} className="text-red-500 hover:text-red-700 disabled:opacity-30">删除</button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {TEAM_FIELDS.map((field) => (
                <label key={field.key} className={`block min-w-0 ${field.rows > 1 ? 'sm:col-span-2' : ''}`}>
                  <span className="mb-1.5 block text-sm font-medium text-gray-700">{field.label}</span>
                  {field.rows === 1 ? (
                    <input aria-label={`第 ${index + 1} 个团队${field.label}`} value={team[field.key]} onChange={(event) => updateTeam(team.id, field.key, event.target.value)} required maxLength={field.maxLength} placeholder={field.placeholder} className="input w-full" />
                  ) : (
                    <textarea aria-label={`第 ${index + 1} 个团队${field.label}`} value={team[field.key]} onChange={(event) => updateTeam(team.id, field.key, event.target.value)} required maxLength={field.maxLength} rows={field.rows} placeholder={field.placeholder} className="input w-full resize-y" />
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <button type="button" onClick={() => setTeams((current) => [...current, { id: crypto.randomUUID(), name: '', grades: '', introduction: '', highlight: '' }])} className="w-full rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 px-4 py-4 font-medium text-blue-600 hover:border-blue-400 hover:bg-blue-100">＋ 添加学管团队</button>
        <p className="text-xs text-gray-500">团队数量增加时图片自动加长；最后一个单独的团队会居中展示。标题、评选依据、背景和底部文案保持固定。</p>
      </form>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 lg:sticky lg:top-32 xl:top-24">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">榜单预览</h2>
            <p className="mt-1 text-xs text-gray-500">高清 PNG · 2110 × {getRankingHeight(teams.length) * 2} 像素</p>
          </div>
          <button type="button" disabled={!ready || downloading} onClick={() => void downloadPoster()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{downloading ? '正在下载…' : '下载榜单图片'}</button>
        </div>
        <div aria-live="polite">
          {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {loadError && <button type="button" onClick={() => setAssetAttempt((attempt) => attempt + 1)} className="mb-3 text-sm text-blue-600">重新加载背景和字体</button>}
          {!background && !loadError && <p className="mb-3 text-sm text-gray-500">正在加载背景和中文字体…</p>}
          {background && !error && !ready && <p className="mb-3 text-xs text-gray-500">正在更新预览…</p>}
        </div>
        <div className="max-h-[75vh] overflow-auto rounded-xl bg-slate-100 p-2">
          <canvas ref={canvasRef} aria-label="学管榜单图片预览" className="block h-auto w-full shadow-sm" />
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-gray-500">
          <span>修改表单后自动更新，可滚动查看完整图片</span>
        </div>
      </section>
    </div>
  )
}
