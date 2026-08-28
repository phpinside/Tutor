# 伴学老师新手引导系统

> 一个基于 Next.js 15 的数学伴学老师 Onboarding 系统,通过任务驱动、分阶段引导的方式帮助新老师完成准入流程。

## 📋 项目简介

本系统将传统的"招聘 + 培训 + 考核流程"设计为低压感、任务化、阶段式的新手引导系统,包含:

- ✅ **3个阶段**: 认识兼职 → 体验任务 → 上岗准备
- ✅ **7个任务**: 从信息了解到模拟实操的完整流程
- ✅ **智能审核**: 支持人工审核与反馈机制
- ✅ **进度追踪**: 实时展示完成进度和当前任务
- ✅ **可中断重做**: 任务可随时中断,支持调整后重试

## 🛠 技术栈

- **框架**: Next.js 15+ (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **数据库**: Prisma + PostgreSQL
- **组件**: React Server Components
- **数据处理**: Server Actions
- **部署**: Vercel / Docker

## 📦 快速开始

### 1. 安装依赖

```bash
npm install
# 或
pnpm install
# 或
yarn install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并配置:

```bash
cp .env.example .env
```

编辑 `.env` 文件:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/tutor_onboarding?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PORT=3000
TENCENT_MEETING_TOKEN="从腾讯会议 AI Skill 专区获取的共享服务账号 Token"
```

腾讯会议 Token 只能配置在服务端环境变量中，不要添加 `NEXT_PUBLIC_` 前缀，也不要提交真实 Token。

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npm run db:generate

# 推送数据库结构
npm run db:push

# 初始化种子数据
npm run db:seed
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看项目。

## 📁 项目结构

```
/Users/denggao/Documents/Tutor/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── actions/              # Server Actions
│   │   │   ├── teacher.ts        # 老师相关操作
│   │   │   └── task.ts           # 任务相关操作
│   │   ├── onboarding/           # 老师端引导页面
│   │   │   ├── page.tsx          # 引导首页
│   │   │   ├── task/[taskIndex]/ # 任务详情页
│   │   │   └── complete/         # 完成页
│   │   ├── admin/                # 管理后台
│   │   │   └── review/           # 任务审核页
│   │   ├── layout.tsx            # 根布局
│   │   ├── page.tsx              # 首页(重定向)
│   │   └── globals.css           # 全局样式
│   ├── components/               # React 组件
│   │   ├── ui/                   # 通用 UI 组件
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── PhaseIndicator.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── tasks/                # 任务相关组件
│   │   │   ├── TaskIntro.tsx     # 信息了解任务
│   │   │   ├── TaskForm.tsx      # 表单填写任务
│   │   │   ├── TaskVideoUpload.tsx # 视频上传任务
│   │   │   └── TaskTraining.tsx  # 培训观看任务
│   │   └── admin/                # 管理后台组件
│   │       └── ReviewForm.tsx    # 审核表单
│   └── lib/                      # 工具库
│       ├── prisma.ts             # Prisma 客户端
│       ├── config.ts             # 任务配置
│       └── utils.ts              # 工具函数
├── prisma/
│   ├── schema.prisma             # 数据库模型
│   └── seed.ts                   # 种子数据
├── public/                       # 静态资源
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

## 🎯 核心功能

### 老师端功能

1. **新手引导首页**
   - 显示当前进度和阶段
   - 展示当前任务卡片
   - 预览后续任务

2. **7个新手任务**
   - 任务0: 了解伴学兼职(可选)
   - 任务1: 填写基本信息
   - 任务2: 自我介绍和讲题体验
   - 任务3: 新手教程
   - 任务4: 系统上手练习
   - 任务5: 1v1群消息培训
   - 任务6: 1v1群消息模拟

3. **完成仪式页**
   - 恭喜文案和身份卡片
   - 接单入口和个人中心

### 管理后台功能

1. **任务审核**
   - 查看待审核任务列表
   - 审核提交内容
   - 给予通过/调整反馈

2. **数据统计**
   - 待审核数量
   - 审核效率统计

## 🎨 设计原则

本系统严格遵循以下设计原则:

1. **感知流程极简**: 任意时刻只显示当前任务和下一步奖励
2. **强任务弱步骤**: 使用"新手任务"而非"Step1/Step2"
3. **低压心理设计**: 避免"考核/面试"等高压词汇
4. **可中断可重做**: 所有任务支持中断和重新提交

## 📊 数据模型

### Teacher (老师)
- 基本信息: 姓名、学校、专业、擅长年级
- 状态追踪: 当前状态、当前阶段、当前任务索引

### TaskSubmission (任务提交)
- 提交内容: 表单数据、视频URL、文本内容
- 审核信息: 状态、反馈、审核时间
- 提交记录: 提交次数、观看进度

## 🚀 部署

### Vercel 部署(推荐)

1. 将代码推送到 GitHub
2. 在 Vercel 导入项目
3. 配置环境变量（至少包含 `DATABASE_URL`；启用会议预约时还需配置 `TENCENT_MEETING_TOKEN`）
4. 自动部署完成

### Docker 部署

```bash
# 构建镜像
docker build -t tutor-onboarding .

# 运行容器
docker run -p 3000:3000 \
  -e DATABASE_URL="your_database_url" \
  tutor-onboarding
```

## 📝 开发说明

### 添加新任务

1. 在 `src/lib/config.ts` 中添加任务配置
2. 在 `src/components/tasks/` 中创建任务组件
3. 在 `src/app/onboarding/task/[taskIndex]/page.tsx` 中添加路由逻辑
4. 更新数据库种子数据

### 自定义样式

所有样式定义在:
- `src/app/globals.css` - 全局样式和工具类
- `tailwind.config.ts` - Tailwind 配置

### API 端点

本项目使用 Server Actions,无需传统 API 路由:
- `src/app/actions/teacher.ts` - 老师相关操作
- `src/app/actions/task.ts` - 任务相关操作

## 🔧 常用命令

```bash
# 开发
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 运行 ESLint

# 数据库
npm run db:generate  # 生成 Prisma Client
npm run db:push      # 推送数据库结构
npm run db:migrate   # 创建迁移文件
npm run db:studio    # 打开 Prisma Studio
npm run db:seed      # 执行种子数据
```

## 📄 License

MIT

## 👥 贡献

欢迎提交 Issue 和 Pull Request!

## 📧 联系方式

如有问题,请联系伴学团队。

---

**注意**: 本系统为演示版本,视频上传功能需要集成云存储服务(如 Uploadthing、AWS S3 等)才能在生产环境使用。
