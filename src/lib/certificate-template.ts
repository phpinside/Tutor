/**
 * 证明模板纯逻辑（无服务端依赖，客户端组件可安全引用）：
 * - 模板字段定义与占位符渲染
 * - 表单输入校验与归一化
 * - 人民币大写金额转换
 */

export type CertificateTypeKey = 'INTERNSHIP' | 'LABOR_CONFIRMATION'

export type TemplateFieldType = 'text' | 'date' | 'number' | 'amount' | 'select'

export interface TemplateFieldDef {
  key: string
  label: string
  type: TemplateFieldType
  required?: boolean
  options?: string[]
  placeholder?: string
}

export interface CertificateTemplateConfig {
  id: string
  type: CertificateTypeKey
  name: string
  title: string
  companyName: string
  companyIds: string[]
  defaultCompanyId: string | null
  bodyText: string
  fields: TemplateFieldDef[]
  isActive: boolean
  sortOrder: number
}

export const CERTIFICATE_TYPE_LABELS: Record<CertificateTypeKey, string> = {
  INTERNSHIP: '实习证明',
  LABOR_CONFIRMATION: '劳务完成确认单',
}

/** 系统保留占位符（生成时自动填充），不允许定义为表单字段 */
export const RESERVED_FIELD_KEYS = ['companyName', 'amountCapital', 'date']

export function isValidChineseIdCard(value: string): boolean {
  return /^\d{17}[\dXx]$/.test(value)
}

export function formatDateCN(date: Date): string {
  const value = date.toISOString().slice(0, 10)
  const [year, month, day] = value.split('-')
  return `${year}年${month}月${day}日`
}

/** 从模板 JSON 字段安全解析字符串 id 列表（用于可选单位等配置） */
export function parseStringIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((item): item is string => typeof item === 'string' && item.length > 0))]
}

/** 从模板 JSON 字段安全解析字段定义（宽松过滤，异常数据降级为空数组） */
export function parseTemplateFields(raw: unknown): TemplateFieldDef[] {
  if (!Array.isArray(raw)) return []
  const result: TemplateFieldDef[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const key = typeof record.key === 'string' ? record.key.trim() : ''
    const label = typeof record.label === 'string' ? record.label.trim() : ''
    if (!key || !label) continue
    const type: TemplateFieldType = (['text', 'date', 'number', 'amount', 'select'] as const).includes(
      record.type as TemplateFieldType
    )
      ? (record.type as TemplateFieldType)
      : 'text'
    result.push({
      key,
      label,
      type,
      required: record.required === true,
      options: Array.isArray(record.options) ? record.options.filter((o): o is string => typeof o === 'string') : undefined,
      placeholder: typeof record.placeholder === 'string' ? record.placeholder : undefined,
    })
  }
  return result
}

/**
 * 将 {{key}} 占位符替换为实际值。
 * 值映射中不存在的 key 保留原文（便于在草稿预览中发现模板配置错误），空字符串正常替换。
 */
export function renderTemplateText(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (raw, key: string) => (key in values ? values[key] : raw))
}

const CN_DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
const CN_INT_UNITS = ['', '拾', '佰', '仟']
const CN_GROUP_UNITS = ['', '万', '亿']

/** 转换 4 位以内的数字组，如 0130 → 壹佰叁拾 */
function convertGroup(group: string): string {
  let result = ''
  let pendingZero = false
  for (let i = 0; i < group.length; i += 1) {
    const digit = Number(group[i])
    const unit = CN_INT_UNITS[group.length - 1 - i]
    if (digit === 0) {
      if (result !== '') pendingZero = true
    } else {
      if (pendingZero) {
        result += '零'
        pendingZero = false
      }
      result += CN_DIGITS[digit] + unit
    }
  }
  return result
}

function convertInteger(integerStr: string): string {
  const paddedLength = Math.ceil(integerStr.length / 4) * 4
  const padded = integerStr.padStart(Math.max(paddedLength, 4), '0')
  const groups: string[] = []
  for (let i = 0; i < padded.length; i += 4) groups.push(padded.slice(i, i + 4))
  let result = ''
  groups.forEach((group, index) => {
    const text = convertGroup(group)
    if (!text) return
    const unit = CN_GROUP_UNITS[groups.length - 1 - index] ?? ''
    const needsLeadingZero = result !== '' && group.startsWith('0')
    result += `${needsLeadingZero ? '零' : ''}${text}${unit}`
  })
  return result || '零'
}

/** 人民币小写金额转标准大写，如 3200.5 → 叁仟贰佰元伍角整；非法输入返回 null */
export function toChineseAmount(raw: string): string | null {
  const value = raw.replace(/[,\s¥￥]/g, '')
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value)) return null
  const [integerPart, decimalPart = ''] = value.split('.')
  const jiao = Number(decimalPart[0] ?? '0')
  const fen = Number(decimalPart[1] ?? '0')
  const hasDecimals = jiao > 0 || fen > 0
  const integerText = convertInteger(integerPart)

  if (Number(integerPart) === 0 && hasDecimals) {
    let result = ''
    if (jiao > 0) result += `${CN_DIGITS[jiao]}角`
    if (fen > 0) result += `${CN_DIGITS[fen]}分`
    return result
  }
  if (!hasDecimals) return `${integerText}元整`
  if (jiao > 0 && fen > 0) return `${integerText}元${CN_DIGITS[jiao]}角${CN_DIGITS[fen]}分`
  if (jiao > 0) return `${integerText}元${CN_DIGITS[jiao]}角整`
  return `${integerText}元零${CN_DIGITS[fen]}分`
}

/** 校验并归一化后的表单数据：公共字段落专列，其余存 extraData */
export interface CertificateFieldData {
  name: string | null
  gender: string | null
  idCard: string | null
  startDate: Date | null
  endDate: Date | null
  extraData: Record<string, string>
}

export type ValidateTemplateInputResult =
  | { ok: true; data: CertificateFieldData }
  | { ok: false; error: string }

function assignCommonKey(data: CertificateFieldData, key: string, value: string): boolean {
  switch (key) {
    case 'name':
      data.name = value
      return true
    case 'gender':
      data.gender = value
      return true
    case 'idCard':
      data.idCard = value
      return true
    default:
      return false
  }
}

/** 按模板字段定义校验用户输入；校验失败返回首个错误的中文提示 */
export function validateTemplateInput(
  template: CertificateTemplateConfig,
  input: Record<string, unknown>
): ValidateTemplateInputResult {
  const data: CertificateFieldData = { name: null, gender: null, idCard: null, startDate: null, endDate: null, extraData: {} }

  for (const field of template.fields) {
    const raw = input[field.key]
    const value = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : ''
    if (!value) {
      if (field.required) return { ok: false, error: `请填写「${field.label}」` }
      // 可选字段留空也写入空值，渲染层才能把 {{key}} 替换为空串而不是保留原文
      if (!assignCommonKey(data, field.key, '')) data.extraData[field.key] = ''
      continue
    }

    if (field.type === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: `「${field.label}」日期格式不正确` }
      const date = new Date(`${value}T00:00:00.000Z`)
      if (Number.isNaN(date.getTime())) return { ok: false, error: `「${field.label}」日期格式不正确` }
      if (field.key === 'startDate') data.startDate = date
      else if (field.key === 'endDate') data.endDate = date
      else data.extraData[field.key] = value
      continue
    }

    if (field.type === 'number' || field.type === 'amount') {
      const normalized = value.replace(/[,\s¥￥]/g, '')
      if (!/^\d{1,12}(\.\d{1,2})?$/.test(normalized)) return { ok: false, error: `「${field.label}」请输入有效金额` }
      data.extraData[field.key] = normalized
      continue
    }

    if (field.type === 'select') {
      if (field.options?.length && !field.options.includes(value)) return { ok: false, error: `「${field.label}」选项无效` }
      if (!assignCommonKey(data, field.key, value)) data.extraData[field.key] = value
      continue
    }

    if (field.key === 'idCard' && !isValidChineseIdCard(value)) {
      return { ok: false, error: '请输入有效的18位身份证号' }
    }
    if (!assignCommonKey(data, field.key, value)) data.extraData[field.key] = value
  }

  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    return { ok: false, error: '开始日期不能晚于结束日期' }
  }
  return { ok: true, data }
}

/** 组装占位符值表：公共字段 + extraData + 金额大写 */
export function buildPlaceholderValues(
  template: Pick<CertificateTemplateConfig, 'companyName'>,
  data: CertificateFieldData
): Record<string, string> {
  const values: Record<string, string> = { companyName: template.companyName }
  if (data.name) values.name = data.name
  if (data.gender) values.gender = data.gender
  if (data.idCard) values.idCard = data.idCard
  if (data.startDate) values.startDate = formatDateCN(data.startDate)
  if (data.endDate) values.endDate = formatDateCN(data.endDate)
  for (const [key, value] of Object.entries(data.extraData)) {
    values[key] = value
  }
  const amount = data.extraData.amount
  if (amount) {
    values.amountCapital = toChineseAmount(amount) ?? ''
  } else {
    values.amountCapital = ''
  }
  return values
}

/** 管理端模板预览用的示例数据 */
export function buildSamplePlaceholderValues(template: CertificateTemplateConfig): Record<string, string> {
  const values: Record<string, string> = { companyName: template.companyName }
  for (const field of template.fields) {
    switch (field.key) {
      case 'name':
        values.name = '张三'
        break
      case 'gender':
        values.gender = field.options?.[0] ?? '男'
        break
      case 'idCard':
        values.idCard = '110101200001011234'
        break
      case 'startDate':
        values.startDate = formatDateCN(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        break
      case 'endDate':
        values.endDate = formatDateCN(new Date())
        break
      case 'amount':
        values.amount = '3200.50'
        values.amountCapital = toChineseAmount('3200.50') ?? ''
        break
      default:
        values[field.key] = field.placeholder || `示例${field.label}`
    }
  }
  return values
}
