'use server'

import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { verifyAdminCredentials } from '@/lib/adminAuth'
import { accountInclude, availableRoles, changeAccountPassword } from '@/lib/auth/accounts'
import { getCurrentSession, startSession, endSession } from '@/lib/auth/session'
import { chooseWorkspace, isRole, ROLE_HOME, type Role } from '@/lib/auth/policy'
import { getClientIpFromForwarded } from '@/lib/rateLimit'
import { checkAuthRateLimit } from '@/lib/auth/rateLimit'
import { recordAudit } from '@/lib/auditLog'
import { ensureInviteCodes, createReferralRecord } from './teacher'
import { syncFollowUpWithInviter } from '@/lib/externalTutor'
import { sanitizeInput } from '@/lib/utils'

type LoginInput = { identifier?: string; phone?: string; username?: string; password: string; linkedPassword?: string; redirect?: string | null }
type LoginResult = { success: boolean; error?: string; requiresLink?: boolean; redirectTo?: string; teacherId?: string; name?: string }
const INVALID_LOGIN = '账号或密码错误'

export async function login(input: LoginInput): Promise<LoginResult> {
  try {
    const rawIdentifier = input.identifier ?? input.phone ?? input.username
    const identifier = typeof rawIdentifier === 'string' ? rawIdentifier.trim() : ''
    if (!identifier || identifier.length > 100 || typeof input.password !== 'string' || !input.password || input.password.length > 72) {
      return { success: false, error: '请输入有效的账号和密码（密码不超过72位）' }
    }
    const ip = getClientIpFromForwarded((await headers()).get('x-forwarded-for'))
    const attempts = await checkAuthRateLimit(`login:unified:${ip}:${identifier}`, 10, 15 * 60 * 1000)
    if (!attempts.allowed) return { success: false, error: `尝试次数过多，请 ${Math.ceil(attempts.retryAfterSec / 60)} 分钟后再试` }
    let account = await prisma.account.findUnique({ where: { login: identifier }, include: accountInclude })
    const [teacher, operator] = await Promise.all([
      prisma.teacher.findUnique({ where: { phone: identifier }, omit: { password: false } }), prisma.operator.findUnique({ where: { phone: identifier }, omit: { password: false } }),
    ])
    if (account) {
      if (!(await bcrypt.compare(input.password, account.passwordHash))) return { success: false, error: INVALID_LOGIN }
      if (!account.isEnabled) return { success: false, error: '账号已停用，请联系管理员' }
      const unlinked = [teacher, operator].filter(profile => profile && !profile.accountId)
      if (unlinked.length) {
        if (!input.linkedPassword) return { success: false, requiresLink: true, error: '账号验证成功，请输入另一套原密码，完成账号关联后继续' }
        for (const profile of unlinked) {
          if (!profile!.password || !(await bcrypt.compare(input.linkedPassword, profile!.password))) return { success: false, requiresLink: true, error: '关联密码错误，请重试或联系管理员核验' }
        }
        await prisma.$transaction(async tx => {
          if (teacher && !teacher.accountId) {
            const changed = await tx.teacher.updateMany({ where: { id: teacher.id, accountId: null, password: teacher.password }, data: { accountId: account!.id, password: account!.passwordHash } })
            if (changed.count !== 1) throw new Error('账号关联状态已变更')
            await tx.accountRole.upsert({ where: { accountId_role: { accountId: account!.id, role: 'TEACHER' } }, create: { accountId: account!.id, role: 'TEACHER' }, update: {} })
          }
          if (operator && !operator.accountId) {
            const changed = await tx.operator.updateMany({ where: { id: operator.id, accountId: null, password: operator.password }, data: { accountId: account!.id, password: account!.passwordHash } })
            if (changed.count !== 1) throw new Error('账号关联状态已变更')
            await tx.accountRole.upsert({ where: { accountId_role: { accountId: account!.id, role: operator.role } }, create: { accountId: account!.id, role: operator.role }, update: {} })
          }
        })
        account = await prisma.account.findUniqueOrThrow({ where: { id: account.id }, include: accountInclude })
      }
    } else if (teacher || operator) {
      const teacherValid = Boolean(teacher?.password && await bcrypt.compare(input.password, teacher.password))
      const operatorValid = Boolean(operator?.password && await bcrypt.compare(input.password, operator.password))
      if (!teacherValid && !operatorValid) return { success: false, error: INVALID_LOGIN }
      if (teacher?.accountId || operator?.accountId) return { success: false, error: '此账号已关联统一账号，请使用统一账号登录' }
      if (teacher && operator) {
        if (!input.linkedPassword) return { success: false, requiresLink: true, error: '账号验证成功，请输入另一套原密码，完成账号关联。关联后统一使用本次登录密码' }
        const linkedValid = teacherValid ? await bcrypt.compare(input.linkedPassword, operator.password) : await bcrypt.compare(input.linkedPassword, teacher.password)
        if (!linkedValid) return { success: false, requiresLink: true, error: '关联密码错误，请重试或联系管理员核验' }
      }
      if ((!teacher || teacher.permanentlyRejectedAt) && (!operator || !operator.isEnabled)) return { success: false, error: '账号暂无可用工作台，请联系管理员' }
      const passwordHash = await bcrypt.hash(input.password, 12)
      const roles: Role[] = [...(teacher ? ['TEACHER' as const] : []), ...(operator ? [operator.role] : [])]
      const defaultRole: Role = operator?.isEnabled ? operator.role : 'TEACHER'
      account = await prisma.$transaction(async tx => {
        const created = await tx.account.create({ data: { login: identifier, name: teacher?.name ?? operator!.name, passwordHash, defaultRole, roles: { create: roles.map(role => ({ role })) } } })
        if (teacher) {
          const changed = await tx.teacher.updateMany({ where: { id: teacher.id, accountId: null, password: teacher.password }, data: { accountId: created.id, password: passwordHash } })
          if (changed.count !== 1) throw new Error('账号迁移状态已变更')
        }
        if (operator) {
          const changed = await tx.operator.updateMany({ where: { id: operator.id, accountId: null, password: operator.password }, data: { accountId: created.id, password: passwordHash } })
          if (changed.count !== 1) throw new Error('账号迁移状态已变更')
        }
        return tx.account.findUniqueOrThrow({ where: { id: created.id }, include: accountInclude })
      })
    } else {
      // 独立配置仅供首次迁移；迁移后不能绕过统一密码或禁用状态。
      if (!(await verifyAdminCredentials(identifier, input.password))) return { success: false, error: INVALID_LOGIN }
      account = await prisma.account.create({ data: { login: identifier, name: '管理员', passwordHash: await bcrypt.hash(input.password, 12), defaultRole: 'SUPER_ADMIN', roles: { create: { role: 'SUPER_ADMIN' } } }, include: accountInclude })
    }
    const workspace = chooseWorkspace(availableRoles(account), account.lastRole, account.defaultRole, input.redirect)
    if (!workspace) return { success: false, error: '账号暂无可用工作台，请联系管理员' }
    if (account.teacher && !account.teacher.inviteCode) await ensureInviteCodes(account.teacher.id)
    await startSession(account.id, workspace.role, account.passwordHash)
    await recordAudit({ actorType: 'SYSTEM', actorId: account.id, actorName: account.name, action: input.linkedPassword ? 'LINK_AND_LOGIN_ACCOUNT' : 'LOGIN_ACCOUNT', targetType: 'ACCOUNT', targetId: account.id, detail: { role: workspace.role } })
    revalidatePath('/', 'layout')
    return { success: true, redirectTo: workspace.destination, teacherId: workspace.role === 'TEACHER' ? account.teacher?.id : undefined, name: account.name }
  } catch (error) {
    console.error('统一登录失败:', error instanceof Error ? error.name : 'unknown')
    return { success: false, error: '登录失败，请重试；如持续失败请联系管理员' }
  }
}

export async function loginReferrer(input: { phone: string; password: string }) { return login(input) }
export async function loginTeacher(phone: string, password: string) { return login({ phone, password }) }
export async function logoutReferrer() { await endSession(); revalidatePath('/', 'layout'); return { success: true, message: '已退出登录' } }
export async function logoutTeacher() { return logoutReferrer() }
export async function getCurrentReferrer() {
  const session = await getCurrentSession()
  if (!session || session.activeRole !== 'TEACHER' || !session.teacherId) return { success: false, error: '未登录' }
  const teacher = await prisma.teacher.findUnique({ where: { id: session.teacherId }, select: { id: true, name: true, phone: true, inviteCode: true, permanentlyRejectedAt: true } })
  return teacher ? { success: true, teacher } : { success: false, error: '会话已过期' }
}
export async function switchWorkspace(role: string) {
  const session = await getCurrentSession()
  if (!session || !isRole(role) || !session.roles.includes(role)) return { success: false, error: '该工作台不可用，请重新登录' }
  await startSession(session.accountId, role)
  revalidatePath('/', 'layout')
  return { success: true, redirectTo: ROLE_HOME[role] }
}
export async function setDefaultWorkspace(role: string) {
  const session = await getCurrentSession()
  if (!session || !isRole(role) || !session.roles.includes(role)) return { success: false, error: '无权设置该工作台' }
  await prisma.account.update({ where: { id: session.accountId }, data: { defaultRole: role } })
  revalidatePath('/account')
  return { success: true }
}
export async function updateOwnPassword(oldPassword: string, newPassword: string) {
  const session = await getCurrentSession()
  if (!session) return { success: false, error: '请重新登录' }
  if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 72) return { success: false, error: '密码需为 6–72 位' }
  const ip = getClientIpFromForwarded((await headers()).get('x-forwarded-for'))
  if (!(await checkAuthRateLimit(`password:${ip}:${session.accountId}`, 5, 15 * 60 * 1000)).allowed) return { success: false, error: '尝试次数过多，请稍后再试' }
  const account = await prisma.account.findUniqueOrThrow({ where: { id: session.accountId } })
  if (typeof oldPassword !== 'string' || !(await bcrypt.compare(oldPassword, account.passwordHash))) return { success: false, error: '原密码错误' }
  await changeAccountPassword(session.accountId, newPassword)
  await endSession()
  revalidatePath('/', 'layout')
  return { success: true }
}

type RegisterInput = { name: string; phone: string; password: string; confirmPassword: string; referralCode?: string; subjects?: string[]; primarySubject?: string }
export async function registerTeacher(input: RegisterInput) {
  try {
    const name = sanitizeInput(input.name), phone = sanitizeInput(input.phone)
    const { password, confirmPassword } = input
    if (!name || !/^1[3-9]\d{9}$/.test(phone)) return { success: false, error: '请填写姓名和有效手机号' }
    if (typeof password !== 'string' || password.length < 6 || password.length > 72) return { success: false, error: '密码需为 6–72 位' }
    if (password !== confirmPassword) return { success: false, error: '两次密码输入不一致' }
    const ip = getClientIpFromForwarded((await headers()).get('x-forwarded-for'))
    if (!(await checkAuthRateLimit(`register:${ip}`, 10, 15 * 60 * 1000)).allowed) return { success: false, error: '操作频繁，请稍后再试' }
    const [existingTeacher, account, operator, session] = await Promise.all([
      prisma.teacher.findUnique({ where: { phone } }), prisma.account.findUnique({ where: { login: phone } }),
      prisma.operator.findUnique({ where: { phone } }), getCurrentSession(),
    ])
    if (existingTeacher) return { success: false, error: '该手机号已注册，请登录；无法登录请联系管理员' }
    if ((account && account.id !== session?.accountId) || (operator && (!account || operator.accountId !== session?.accountId))) {
      return { success: false, error: '该手机号已有账号，请先登录，再申请教练工作台' }
    }
    if (account && !(await bcrypt.compare(password, account.passwordHash))) return { success: false, error: '请输入当前账号的登录密码' }
    if (account && !account.isEnabled) return { success: false, error: '账号已停用，请联系管理员' }
    const referralCode = input.referralCode ? sanitizeInput(input.referralCode).toUpperCase() : null
    const inviter = referralCode ? await prisma.teacher.findUnique({ where: { inviteCode: referralCode }, select: { id: true, phone: true } }) : null
    if (referralCode && !inviter) return { success: false, error: '邀请码无效' }
    const hash = account?.passwordHash ?? await bcrypt.hash(password, 12)
    const teacher = await prisma.$transaction(async tx => {
      const owner = account ?? await tx.account.create({ data: { login: phone, name, passwordHash: hash, defaultRole: 'TEACHER' } })
      await tx.accountRole.create({ data: { accountId: owner.id, role: 'TEACHER' } })
      return tx.teacher.create({ data: { name, phone, password: hash, accountId: owner.id, invitedById: inviter?.id, subjects: input.subjects ?? [], primarySubject: input.primarySubject ?? null } })
    })
    await ensureInviteCodes(teacher.id)
    if (inviter) await createReferralRecord(inviter.id, teacher.id)
    await syncFollowUpWithInviter(teacher.id, inviter?.phone ?? null)
    await startSession(teacher.accountId!, 'TEACHER', hash)
    revalidatePath('/', 'layout')
    return { success: true, teacherId: teacher.id, message: '注册成功' }
  } catch (error) {
    console.error('注册失败:', error instanceof Error ? error.name : 'unknown')
    return { success: false, error: '注册失败，请重试；已有账号请直接登录' }
  }
}
export async function registerReferrer(input: RegisterInput) { return registerTeacher(input) }
