import { canManageWechatGroupQr } from '@/lib/wechatGroupQrAuth'
import QRCodeUploader from '@/components/admin/QRCodeUploader'
import NoPermission from '@/components/admin/NoPermission'

export const dynamic = 'force-dynamic'

export default async function OperatorQrcodePage() {
  // 与「运营复审权限」开关联动：关闭时同步关闭该配置能力
  if (!(await canManageWechatGroupQr())) {
    return (
      <NoPermission
        title="微信群二维码配置未开放"
        description={
          '该能力随「运营复审权限」开关一同开启，当前未开放。\n如需配置微信群二维码，请联系超级管理员。'
        }
        backHref="/operator/team"
        backLabel="返回工作台"
      />
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">微信群二维码</h1>
        <p className="text-gray-600">
          上传后立即对全部老师生效（老师在新手引导入群环节扫码使用）
        </p>
      </div>
      <QRCodeUploader />
    </div>
  )
}
