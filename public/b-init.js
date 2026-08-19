/**
 * 快捷登录助手 - 初始化脚本 (b-init.js)
 * 由「快捷登录助手」书签(Bookmarklet)加载,仅在允许的目标网站上执行。
 *
 * 功能:向目标网站(B 网站)的 localStorage 写入指定的 DeviceId / RoleTag,
 *       校验写入结果,并在成功后按配置决定是否刷新页面。
 *
 * 安全说明:
 * - 本脚本只在 CONFIG.allowedHosts 列出的域名下执行,其他网站点击书签只会弹提示。
 * - 不读取密码 / Cookie,不上传任何数据,不调用 eval() / new Function()。
 * - 只写入 CONFIG.storage 中列出的键,不清空原有 localStorage。
 *
 * CSP 限制:
 * 如果目标网站配置了 Content Security Policy,可能会阻止浏览器通过
 * document.createElement('script') 加载本文件(书签点击后弹「加载失败」)。
 * 这是浏览器的安全机制,不应绕过;如遇此情况,需改用本地 Bookmarklet
 * (把本文件内容直接内联进书签)或浏览器扩展方案。
 *
 * 注意:本文件的 CONFIG 与 src/lib/bookmarkHelperConfig.ts 保持一致,
 *       修改其中任一处时请同步另一处。
 */
(() => {
  'use strict'

  // ==================== 配置(改这里即可) ====================
  const CONFIG = {
    // 允许执行的目标网站(B 网站)域名
    allowedHosts: [
      'manage.dingbanxue.com',
      'school.dingbanxue.com',
    ],

    // 需要写入 localStorage 的数据
    storage: {
      DeviceId: 'e29dd099ed5c908a68cae29cec7a5313',
      RoleTag: 'DeliveryCenter',
    },

    // 初始化成功后是否自动刷新页面
    reloadAfterSuccess: true,
  }

  // ==================== 运行锁:防止短时间连续点击书签重复执行 ====================
  if (window.__B_SITE_HELPER_RUNNING__) {
    return
  }
  window.__B_SITE_HELPER_RUNNING__ = true

  // ==================== Toast 提示(不依赖目标网站任何 CSS) ====================
  function showToast(message, type) {
    const toast = document.createElement('div')
    toast.textContent = message
    const isSuccess = type === 'success'
    toast.style.cssText = [
      'position: fixed',
      'top: 20px',
      'right: 20px',
      'z-index: 2147483647',
      'padding: 12px 20px',
      'border-radius: 10px',
      'background: ' + (isSuccess ? '#16a34a' : '#dc2626'),
      'color: #ffffff',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
      'font-size: 14px',
      'line-height: 1.5',
      'box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25)',
      'max-width: 320px',
      'pointer-events: none',
    ].join(';')
    document.body.appendChild(toast)
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast)
      }
    }, 2500)
  }

  // ==================== 域名校验:仅允许在 B 网站执行 ====================
  const currentHost = location.hostname
  if (CONFIG.allowedHosts.indexOf(currentHost) === -1) {
    showToast('请先打开管理入口后再使用本工具。', 'error')
    return
  }

  // ==================== 写入 localStorage 并校验结果 ====================
  const entries = Object.keys(CONFIG.storage)

  try {
    for (let i = 0; i < entries.length; i++) {
      const key = entries[i]
      // 逐项写入,不动目标网站其他 localStorage 数据
      localStorage.setItem(key, String(CONFIG.storage[key]))
    }
  } catch (error) {
    // localStorage 不可用(隐私模式 / 被禁用等)
    showToast('无法写入浏览器数据，请检查浏览器隐私设置。', 'error')
    return
  }

  // 写入后立即读取验证,确保值正确
  for (let i = 0; i < entries.length; i++) {
    const key = entries[i]
    if (localStorage.getItem(key) !== String(CONFIG.storage[key])) {
      showToast('初始化失败，请重新尝试。', 'error')
      return
    }
  }

  // ==================== 全部成功:提示并按配置刷新 ====================
  showToast('✓ 初始化成功', 'success')

  if (CONFIG.reloadAfterSuccess) {
    // 短暂展示成功提示后刷新,刷新后运行锁自然清除
    setTimeout(() => {
      location.reload()
    }, 800)
  }
})()
