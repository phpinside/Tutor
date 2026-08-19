// 「快捷登录助手」Bookmarklet 安装页配置
// 修改域名或写入数据后,请同步修改 public/b-init.js 顶部的 CONFIG,保持两边一致。
export const BOOKMARK_HELPER_CONFIG = {
  // 书签名称(按钮文字,拖入书签栏后即书签显示名)
  bookmarkName: '🚀 快捷登录助手',

  // A 网站(本系统)域名,提供 /b-init.js,改这里即可
  // 本地开发测试时可临时改为 http://localhost:3000
  aDomain: 'https://tutor.bytemath.cn',

  // B 网站(目标管理后台)
  targetWebsite: 'https://manage.dingbanxue.com',
  targetHosts: ['manage.dingbanxue.com', 'www.manage.dingbanxue.com'],

  // 写入 B 网站 localStorage 的数据
  storage: {
    DeviceId: 'e29dd099ed5c908a68cae29cec7a5313',
    RoleTag: 'DeliveryCenter',
  },

  // 初始化成功后是否自动刷新 B 页面
  reloadAfterSuccess: true,
}
