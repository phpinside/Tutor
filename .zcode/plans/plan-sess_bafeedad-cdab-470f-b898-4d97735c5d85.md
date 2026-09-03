# 案例图生成器·历史生成记录功能

## 现状
`onboarding/tools/case-image-generator` 目前是纯前端 Canvas 生成，图片仅存本地 dataURL，无上传、无数据库记录。需新增：生成后自动上传七牛云 + 写库、老师端历史记录列表(只看自己的)、管理端全量记录页。

## 1. 数据库 (prisma/schema.prisma)
新增模型，并在 `Teacher` 上加反向关系 `caseImageRecords CaseImageRecord[]`:

```prisma
model CaseImageRecord {
  id             String   @id @default(cuid())
  teacherId      String
  teacher        Teacher  @relation(fields: [teacherId], references: [id])
  templateId     String?
  templateName   String?
  studentRegion  String   // 学生地区
  studentName    String   // 学生姓名
  studentGrade   String   // 学生年级
  scoreTitle     String   // 提分科目（数学/物理/化学喜报）
  studyDuration  String   // 学习时长
  scoreIncrease  String   // 提分分数
  teamName       String   // 团队名
  coachSignature String   // 教练署名
  bottomNote     String?  // 提升策略简介
  imageKey       String   // 七牛云存储 key
  createdAt      DateTime @default(now())
  @@index([teacherId, createdAt])
}
```

执行 `npm run db:generate` + `npm run db:migrate`(迁移名 `add_case_image_record`)。

## 2. 七牛云 (src/lib/qiniu.ts)
- 新增 `generateCaseImageKey(teacherId, studentName)`: `uploads/case-images/{teacherId}/{清洗后的学生显示名}-{timestamp}.png`(中文文件名可作下载默认名,沿用现有下载命名 `案例喜报-X同学-时间戳.png` 的风格)
- 新增 `generateCaseImagePrivateUrl(key, { download?, deadline? })`: 照抄 `generateVideoPrivateUrl` 的手写签名模式,`download: true` 时在签名前把 `attname=1` 加进 URL,强制下载响应
- 服务端上传复用现有 `uploadToQiniu(buffer, key)`

## 3. 序列化辅助 (src/lib/case-image-records.ts, 新文件)
- `CaseImageRecordDTO` 类型(全字符串字段 + `imageUrl`/`imageDownloadUrl` + 可选 `teacherName`/`teacherPhone`)
- `serializeCaseImageRecord(record, teacher?)`: Date→ISO 字符串,签名生成查看 URL(1 小时有效)与下载 URL(attname)。供老师页、API、管理页三处复用(仿 internship-certificate-service 模式)

## 4. 新增 API (src/app/api/tools/case-image-records/route.ts, POST)
- 鉴权: 读 `teacherId` cookie,无效返回 401/404(仿现有 tools API)
- 接收 FormData: `image`(canvas.toBlob 的 PNG Blob,校验类型/≤10MB) + `payload`(JSON: 表单 9 字段 + templateId/templateName)
- `uploadToQiniu` 上传 → `prisma.caseImageRecord.create` → 返回 201 + 序列化记录;失败返回错误信息

## 5. 老师端历史记录
**page.tsx**: 鉴权后 `prisma.caseImageRecord.findMany({ where: { teacherId }, orderBy: { createdAt: 'desc' }, take: 50 })`,序列化后作为 `initialRecords` 传入客户端(仿 internship-certificate 页面);加 `export const dynamic = 'force-dynamic'`。

**CaseImageGeneratorClient.tsx**:
- 接收 `initialRecords` props,维护 `records` state
- `generateImage()` 成功后(拿到 canvas)追加自动保存: `canvas.toBlob` → FormData → POST 上述 API → 成功则把新记录 prepend 到列表,失败仅提示"历史记录保存失败"不阻断本地预览/下载
- 页面底部新增"历史生成记录"card: 每条显示 生成时间、学生地区、学生姓名、学生年级、提分科目、学习时长、提分分数、团队名、教练署名,行内"查看大图/下载"按钮;空态提示
- 查看大图: 简单 fixed 遮罩 Modal,`<img src={imageUrl}>`;下载: `imageDownloadUrl`(attname 由七牛强制下载,跨域场景无需 download 属性)

## 6. 管理端全量记录页
- 新建 `src/app/admin/case-image-records/page.tsx`: 照抄 `admin/internship-certificates/page.tsx` 的 super_admin 鉴权样板;`findMany({ orderBy: { createdAt: 'desc' }, include: { teacher: { select: { id, name, phone } } } })` 全量拉取(轻量列表模式,无分页),序列化(含生成人姓名/手机)传客户端
- 新建 `CaseImageRecordManagementClient.tsx`: 客户端搜索过滤(学生姓名/团队名/教师名)+ 记录表格(列同老师端,外加"生成人"列)+ 查看大图 Modal + 下载
- `src/middleware.ts` `ROUTE_PERMISSIONS` 增加 `'/admin/case-image-records': ['super_admin']`
- `src/app/admin/AdminLayoutClient.tsx` `MENU_ITEMS` 增加 `{ path: '/admin/case-image-records', label: '案例记录', roles: ['super_admin'] }`

## 7. 验证
- `npm run lint`、`npm run build`
- dev 启动后: 老师登录生成案例 → 自动出现在历史列表,查看大图/下载可用;再次生成产生第二条记录;管理端账号登录后台可见该记录及生成人

## 不做的事(明确范围)
- 记录删除/编辑功能(未要求)
- 老师端轮询(生成后 POST 返回即更新,无需轮询)
- 管理端分页(沿用轻量全量模式,量大后可再加)