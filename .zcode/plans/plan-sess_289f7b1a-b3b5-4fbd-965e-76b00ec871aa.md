# 登录和注册表单输入去空格方案

## 背景

系统中所有登录和注册的表单输入目前存在去空格不一致的问题：
- `/auth/login`、`/auth/register` 的服务端已 trim，但**客户端提交时未 trim**（仅验证时 trim）
- `/admin/login`、`/operator/login` 的**客户端和服务端都没有任何 trim**
- `registerAndCreateTeacher`（teacher.ts）中 `referralCode` 未 trim/toUpperCase，`name` 等字段也未 trim
- `createOperator`（adminOperatorActions.ts）服务端未 trim（依赖客户端）

## 设计决策

1. **新建共享工具函数** `sanitizeInput()`，统一处理"空格和空字符"——去除 null 字符（`\0`）并 trim 两端空白，保留中间空格
2. **客户端 + 服务端双重 trim**：客户端提交前 trim（更好的 UX），服务端处理前 trim（权威保障，防止绕过）
3. **密码字段不 trim**：保留现有约定和安全最佳实践（密码中可能有意包含首尾空格）。`confirmPassword` 同理不 trim，以保证与 password 精确匹配

## 实现步骤

### 1. 新增工具函数 — `src/lib/utils.ts`

```ts
/**
 * 去除字符串两端的空格、空白字符和空字符（null）
 * 用于登录/注册等表单输入的统一清洗（不用于密码）
 */
export function sanitizeInput(value: string): string {
  if (typeof value !== 'string') return value
  return value.replace(/\0/g, '').trim()
}
```

### 2. 服务端改动（权威保障）

| 文件 | 函数 | 改动 |
|------|------|------|
| `src/app/actions/auth.ts` | `registerReferrer` | 将 `name/phone/referralCode` 的 `.trim()` 替换为 `sanitizeInput()`；referralCode 保持 `.toUpperCase()` |
| `src/app/actions/auth.ts` | `loginReferrer` | 将 `phone.trim()` 替换为 `sanitizeInput(phone)` |
| `src/app/actions/auth.ts` | `registerTeacher` | 同 registerReferrer |
| `src/app/actions/auth.ts` | `loginTeacher` | 同 loginReferrer |
| `src/app/actions/teacher.ts` | `registerAndCreateTeacher` | phone 用 `sanitizeInput`；`referralCode` 加 `sanitizeInput().toUpperCase()`；`teacherInfo` 中所有 string 字段统一 trim 后再 spread 到 create |
| `src/app/actions/adminOperatorActions.ts` | `createOperator` | `name/phone/remarks` 用 `sanitizeInput` |
| `src/app/api/admin/login/route.ts` | POST | `username` 用 `sanitizeInput`（password 不动） |
| `src/lib/adminAuth.ts` | `verifyAdminCredentials` | `username` 比较前 `sanitizeInput`（password 不动） |
| `src/app/api/operator/login/route.ts` | POST | `phone` 用 `sanitizeInput`（password 不动） |

### 3. 客户端改动（提交前 trim）

| 文件 | 改动 |
|------|------|
| `src/app/auth/login/page.tsx` | `handleSubmit` 中提交前 `sanitizeInput(phone)`，password 不动 |
| `src/app/auth/register/page.tsx` | `handleSubmit` 中提交前 trim `name/phone/referralCode`，password/confirmPassword 不动 |
| `src/app/admin/login/page.tsx` | `handleSubmit` 中 `sanitizeInput(username)`，password 不动 |
| `src/app/operator/(auth)/login/page.tsx` | `handleLogin` 中 `sanitizeInput(phone)`，password 不动 |
| `src/app/admin/operators/new/page.tsx` | 将现有 `.trim()` 替换为 `sanitizeInput`（name/phone/remarks），password 不动 |

### 不在本次范围

- 密码修改/重置流程（`resetOperatorPassword`、`updateOperatorProfile`、`resetTeacherPassword`）——非登录/注册
- 手机号查看二次验证（`TeacherPhoneRevealControl`）——非登录/注册
- 搜索功能中的 trim 不一致——非登录/注册

## 验证

- `npm run lint` 通过
- `npm run build` 通过（确认无类型错误）
