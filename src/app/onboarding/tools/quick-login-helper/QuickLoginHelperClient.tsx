'use client'

import { useEffect, useRef, useState } from 'react'
import { BOOKMARK_HELPER_CONFIG } from '@/lib/bookmarkHelperConfig'

const { bookmarkName, targetWebsite } = BOOKMARK_HELPER_CONFIG

// 生成 Bookmarklet:只负责动态加载 A 网站的 /b-init.js,不含任何业务逻辑。
// 要求:单行、以 javascript: 开头、带时间戳防缓存、加载成功后移除 script 标签。
function buildBookmarklet(): string {
  const { aDomain } = BOOKMARK_HELPER_CONFIG
  const scriptUrl = `${aDomain}/b-init.js`
  const errorTip = `${bookmarkName}加载失败，请检查网络或联系管理员`
  return (
    "javascript:(()=>{const s=document.createElement('script');" +
    `s.src='${scriptUrl}?t='+Date.now();` +
    's.onload=()=>s.remove();' +
    `s.onerror=()=>alert('${errorTip}');` +
    '(document.head||document.documentElement).appendChild(s)})()'
  )
}

const BOOKMARKLET = buildBookmarklet()

// 复制文本到剪贴板,优先使用 Clipboard API,失败时降级到 execCommand
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 剪贴板 API 失败时继续走降级方案
    }
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

const STEPS = [
  '显示浏览器书签栏',
  `按住「${bookmarkName}」`,
  '拖到顶部书签栏',
  '打开 B 网站',
  '点击刚才添加的书签',
  '自动完成初始化',
]

export default function QuickLoginHelperClient() {
  const [toast, setToast] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bookmarkLinkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    // React 出于安全考虑会拦截 JSX 中的 javascript: href,
    // 因此挂载后通过 DOM 属性直接设置真实的 Bookmarklet 地址。
    if (bookmarkLinkRef.current) {
      bookmarkLinkRef.current.href = BOOKMARKLET
    }
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current)
      }
    }
  }, [])

  function showToast(message: string) {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current)
    }
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  async function handleCopy() {
    const ok = await copyText(BOOKMARKLET)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      showToast('已复制，可以手动新建书签并粘贴到网址栏。')
    } else {
      showToast('复制失败，请手动复制书签代码。')
    }
  }

  return (
    <div className="space-y-6">
      {/* 核心安装区域 */}
      <section className="bg-white rounded-2xl border-2 border-indigo-100 p-8 text-center">
        <a
          ref={bookmarkLinkRef}
          title="按住拖动到浏览器书签栏"
          onClick={(e) => {
            e.preventDefault()
            showToast('请把这个按钮拖到浏览器书签栏，而不是直接点击。')
          }}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-lg font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 shadow-lg shadow-indigo-200 select-none cursor-grab active:cursor-grabbing transition-all hover:shadow-xl hover:scale-105 hover:from-indigo-600 hover:to-violet-600 active:scale-95"
        >
          {bookmarkName}
        </a>

        <p className="mt-4 text-gray-600">按住上面的按钮，拖到浏览器书签栏。</p>

        {/* 拖动示意 */}
        <div className="mt-8 rounded-xl bg-gray-50 border border-gray-200 p-6 text-sm text-gray-600">
          <div className="flex flex-col items-center gap-1">
            <div className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold shadow">
              {bookmarkName}
            </div>
            <div className="text-indigo-500 font-bold">↓ 拖动</div>
            <div className="w-full border-t-2 border-gray-300 mt-2" />
            <div className="w-full text-left text-gray-400 pt-1">Chrome 书签栏</div>
            <div className="w-full flex items-center gap-1 text-gray-700 pb-1">
              <span>⭐</span>
              <span>{bookmarkName}</span>
            </div>
            <div className="w-full border-t-2 border-gray-300" />
          </div>
        </div>
      </section>

      {/* 使用方法 */}
      <section className="bg-white rounded-2xl border-2 border-indigo-100 p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">使用方法</h2>
        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-gray-700">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600 flex flex-wrap items-center gap-x-8 gap-y-2">
          <span>显示 / 隐藏书签栏：</span>
          <span className="font-mono">Windows：Ctrl + Shift + B</span>
          <span className="font-mono">Mac：⌘ + Shift + B</span>
        </div>
      </section>

      {/* 备用方式:复制书签代码 */}
      <section className="bg-white rounded-2xl border-2 border-indigo-100 p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">备用方式：复制书签代码</h2>
        <p className="text-sm text-gray-500 mb-4">
          部分浏览器不方便拖动时，可以复制代码后手动新建书签。
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleCopy} className="btn-primary">
            {copied ? '✓ 已复制' : '复制书签代码'}
          </button>
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="btn-secondary"
          >
            {showManual ? '收起手动安装教程' : '查看手动安装教程'}
          </button>
        </div>

        {showManual && (
          <div className="mt-5 rounded-xl bg-gray-50 border border-gray-200 p-5">
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold flex items-center justify-center">
                  1
                </span>
                <span>在浏览器中新建书签</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold flex items-center justify-center">
                  2
                </span>
                <span>名称填写「{bookmarkName}」</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold flex items-center justify-center">
                  3
                </span>
                <span>URL / 地址粘贴刚才复制的代码</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold flex items-center justify-center">
                  4
                </span>
                <span>保存，之后打开 B 网站点击该书签即可</span>
              </li>
            </ol>
          </div>
        )}
      </section>

      {/* 说明 */}
      <p className="text-xs text-gray-400 leading-relaxed px-1">
        当前目标网站：{targetWebsite}。如果点击书签后提示加载失败，可能是目标网站启用了
        CSP（内容安全策略），导致远程 Bookmarklet 脚本无法加载。如遇此情况，需要改用本地
        Bookmarklet 或浏览器扩展方案。
      </p>

      {/* 页面内轻量 Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] px-5 py-3 rounded-xl bg-gray-900 text-white text-sm shadow-xl animate-slide-up max-w-xs">
          {toast}
        </div>
      )}
    </div>
  )
}
