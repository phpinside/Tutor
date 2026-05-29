# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 onboarding system for part-time math tutors (伴学老师新手引导系统). The system transforms traditional "hiring + training + assessment" into a low-pressure, task-driven, phased onboarding experience.

**Tech Stack**: Next.js 15 (App Router), TypeScript, Server Components + Server Actions, Tailwind CSS, Prisma + PostgreSQL, deployed via Vercel/Docker.

## Development Commands

```bash
# Development
npm run dev          # Start dev server on port 3000
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
npm run db:generate  # Generate Prisma Client (required after schema changes)
npm run db:push      # Push schema changes to database (dev only)
npm run db:migrate   # Create and apply migration
npm run db:studio    # Open Prisma Studio GUI
npm run db:seed      # Seed database with initial data
```

**Critical**: Always run `npm run db:generate` after modifying `prisma/schema.prisma`.

## Architecture

### Route Structure

- `/onboarding/*` - Tutor-facing onboarding flow (requires `teacherId` cookie)
- `/admin/*` - Super admin dashboard (requires `admin_session` cookie with role-based access)
- `/operator/*` - Operator dashboard for team management (requires `operator_session` cookie)
- `/auth/*` - Unified login for both tutors and operators
- `/referral/dashboard/*` - Referral dashboard for tutors (requires `teacherId` cookie)
- `/api/*` - API routes (Qiniu upload, auth, poster generation, etc.)

### Server Actions Pattern

All data mutations use Server Actions in `src/app/actions/`:
- `teacher.ts` - Teacher CRUD and state management
- `task.ts` - Task submission and review workflow
- `auth.ts` - Authentication for tutors and operators
- `referral.ts` - Referral tracking and rewards
- `learningPlanner.ts` - Learning planner application workflow
- `config.ts` - Task and phase configuration management

### Middleware & Auth

`src/middleware.ts` handles route protection:
- Role-based access control for `/admin` routes (super_admin only)
- Operators can access `/admin/teachers/*` paths directly
- Teacher-only routes check for `teacherId` cookie
- Middleware runs in Edge Runtime (no Prisma access)

### Database-Driven Configuration

Tasks and phases are configured in the database via `TaskConfig` and `PhaseConfig` models, not hardcoded. Use `src/lib/config.ts` helpers to access:
- `getTaskConfigs()` - Fetch active tasks (cached with React `cache()`)
- `getPhaseConfigs()` - Fetch active phases
- Task video configs (`TASK_VIDEOS`) and upload configs (`TASK_VIDEO_UPLOADS`) are in code

### Task System

The onboarding has 7 tasks (index 0-6) across 3 phases:

| Task | Type | Description |
|------|------|-------------|
| 0 | INFO | 了解伴学兼职 (optional) |
| 1 | FORM | 填写基本信息 |
| 2 | VIDEO_UPLOAD | 自我介绍 and 讲题体验 (dual video) |
| 3 | TRAINING | 新手教程 (multi-video) |
| 4 | VIDEO_UPLOAD | 系统上手练习 (single video) |
| 5 | TRAINING | 1v1群消息培训 |
| 6 | ONLINE_TEST | 在线测试 |

Task components in `src/components/tasks/`: `TaskIntro.tsx`, `TaskForm.tsx`, `TaskVideoUpload.tsx`, `TaskTraining.tsx`, `TaskOnlineTest.tsx`.

### File Upload

Videos are uploaded to Qiniu cloud storage (七牛云). Configuration in `src/lib/config.ts` (`QINIU_CONFIG`). Upload hook: `src/lib/hooks/useQiniuUpload.ts`.

## Key Design Principles

1. **感知流程极简** - Only show current task, not full roadmap
2. **强任务弱步骤** - Use "新手任务" not "Step1/Step2"
3. **低压心理设计** - Avoid "考核/面试/淘汰", use "体验/过关/解锁"
4. **可中断可重做** - All tasks support interruption and resubmission with `NEEDS_REVISION` status

## Important Patterns

- Teacher state transitions: `NOT_STARTED` → `IN_PROGRESS` → `PENDING_REVIEW` → `COMPLETED` → `UNLOCKED`
- Task submission status: `NOT_STARTED` → `IN_PROGRESS` → `PENDING_FEEDBACK` → `COMPLETED` or `NEEDS_REVISION`
- Use React `cache()` for frequently accessed data (see `getTaskConfigs`)
- Server Actions should handle revalidation via `revalidatePath()`

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `QINIU_ACCESS_KEY` - Qiniu cloud storage access key
- `QINIU_SECRET_KEY` - Qiniu cloud storage secret key
