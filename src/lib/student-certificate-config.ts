export type CertificateForm = {
  studentName: string
  grade: string
  subject: string
  awardName: string
  citation: string
  issuer: string
  issueDate: string
  teamName: string
  coachName: string
}

export const CERTIFICATE_AWARDS = [
  { name: '进步之星', citation: '在近期的学习中，你积极进取、持续努力，取得了令人欣喜的进步。愿你保持热爱，继续闪耀！' },
  { name: '单科突破奖', citation: '你在学科学习中勇于挑战、勤于练习，实现了值得骄傲的突破。愿你再接再厉，迈向新的高度！' },
  { name: '知识攻克奖', citation: '面对难点，你主动探索、反复钻研，成功掌握了关键知识。你的认真与坚持值得表扬！' },
  { name: '错题清零奖', citation: '你认真复盘每一道错题，找到问题根源并不断改进。愿这份踏实助你走得更远！' },
  { name: '自律学习奖', citation: '你坚持按计划学习，主动管理时间，以自律和行动积累了成长的力量。特此表彰！' },
  { name: '专注学习奖', citation: '你始终保持专注，认真投入每一次学习和练习。愿这份专注成为你继续成长的力量！' },
  { name: '独立思考奖', citation: '你敢于提出问题，乐于独立思考，在探索中形成了自己的见解。期待你继续保持好奇心！' },
  { name: '举一反三奖', citation: '你善于梳理方法、迁移知识，能够从一道题读懂一类题。愿你继续探索更广阔的知识世界！' },
  { name: '坚持不懈奖', citation: '学习路上，你不畏困难、坚持向前，用一次次努力证明了自己的韧性。特此表彰！' },
  { name: '阶段达标奖', citation: '你认真完成了本阶段的学习目标，展现出扎实的积累和持续成长的决心。祝贺你！' },
  { name: '伴学成长奖', citation: '在伴学旅程中，你积极参与、勇于尝试，不断收获知识与信心。愿你保持这份成长的热情！' },
  { name: '年度优秀学员', citation: '这一年，你以勤奋、坚持和主动探索书写了精彩的学习故事。愿你怀揣梦想，继续前行！' },
] as const

export const CERTIFICATE_GRADES = [
  '小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级',
  '初一', '初二', '初三', '高一', '高二', '高三',
]
export const CERTIFICATE_SUBJECTS = ['数学', '英语', '物理', '化学', '综合']

export type CertificateOrientation = 'LANDSCAPE' | 'PORTRAIT'
export type CertificateSlotKey = 'title' | 'studentName' | 'detail' | 'awardLabel' | 'awardName' | 'citation' | 'teamName' | 'coachName' | 'issuer' | 'issueDate'
export const CERTIFICATE_SLOT_LABELS: Record<CertificateSlotKey, string> = {
  title: '固定标题（可选）', studentName: '学员姓名', detail: '年级 / 科目', awardLabel: '颁授提示',
  awardName: '奖项名称（主标题）', citation: '颁奖词', teamName: '伴学团队', coachName: '教练名称',
  issuer: '颁发单位', issueDate: '颁发日期',
}
export const CERTIFICATE_SLOT_KEYS = Object.keys(CERTIFICATE_SLOT_LABELS) as CertificateSlotKey[]

export type CertificateTextSlot = {
  x: number; y: number; width: number; height: number // 0..1 relative to page
  fontSize: number // logical pixels at a 1200px wide landscape / 848px wide portrait page
  color: string
  align: 'left' | 'center' | 'right'
  weight: 400 | 700
  visible: boolean
  frame?: boolean // Draw a frame when the background has no built-in detail plaque.
}
export type CertificateSlots = Record<CertificateSlotKey, CertificateTextSlot>
export type CertificateTemplate = {
  id: string
  name: string
  description: string
  title: string
  orientation: CertificateOrientation
  backgroundUrl: string
  slots: CertificateSlots
  isActive: boolean
  sortOrder: number
  archivedAt: string | null
}

export const CERTIFICATE_SIZE = {
  LANDSCAPE: { width: 3508, height: 2480, mm: '297 × 210 mm', label: '横版' },
  PORTRAIT: { width: 2480, height: 3508, mm: '210 × 297 mm', label: '竖版' },
} as const

export function defaultCertificateSlots(orientation: CertificateOrientation): CertificateSlots {
  const portrait = orientation === 'PORTRAIT'
  const make = (x: number, y: number, width: number, height: number, fontSize: number, color: string, align: CertificateTextSlot['align'] = 'center', weight: CertificateTextSlot['weight'] = 400): CertificateTextSlot =>
    ({ x, y, width, height, fontSize, color, align, weight, visible: true })
  const slots: CertificateSlots = portrait ? {
    title: make(.16, .15, .68, .07, 54, '#433047', 'center', 700),
    studentName: make(.12, .34, .76, .075, 48, '#433047', 'center', 700),
    detail: make(.25, .455, .50, .05, 25, '#433047'),
    awardLabel: make(.18, .29, .64, .035, 20, '#806b7f'),
    awardName: make(.12, .16, .76, .10, 66, '#a74752', 'center', 700),
    citation: make(.16, .54, .68, .19, 25, '#433047'),
    teamName: make(.22, .805, .26, .03, 17, '#806b7f', 'left'),
    coachName: make(.22, .77, .26, .03, 17, '#806b7f', 'left'),
    issuer: make(.52, .77, .26, .03, 17, '#433047', 'right'),
    issueDate: make(.52, .805, .26, .03, 17, '#433047', 'right'),
  } : {
    title: make(.20, .175, .60, .075, 64, '#432521', 'center', 700),
    studentName: make(.27, .385, .46, .075, 52, '#432521', 'center', 700),
    detail: make(.37, .508, .26, .044, 26, '#432521'),
    awardLabel: make(.25, .337, .50, .028, 20, '#866d5c'),
    awardName: make(.14, .16, .72, .12, 86, '#ac3031', 'center', 700),
    citation: make(.15, .59, .70, .10, 23, '#432521'),
    teamName: make(.16, .819, .29, .03, 17, '#866d5c', 'left'),
    coachName: make(.16, .775, .29, .03, 17, '#866d5c', 'left'),
    issuer: make(.55, .775, .29, .03, 17, '#432521', 'right'),
    issueDate: make(.55, .819, .29, .03, 17, '#432521', 'right'),
  }
  slots.title.visible = false
  slots.detail.frame = portrait
  return slots
}

// Shared text hierarchy, with each landscape plaque calibrated to its background.
export const CERTIFICATE_LIBRARY_TEMPLATES = [
  { id: 'royal', name: '皇家典藏风', description: '重大荣誉 · 卓越学员', image: 'royal.jpg', ink: '#3c2721', muted: '#79584c', award: '#a5222c' },
  { id: 'azure', name: '蔚蓝荣耀风', description: '综合表彰 · 学习进步', image: 'azure.jpg', ink: '#173a62', muted: '#627a96', award: '#1754a1' },
  { id: 'british', name: '英伦学院风', description: '初高中 · 学术奖项', image: 'british.jpg', ink: '#18243f', muted: '#687083', award: '#7b2a2d' },
  { id: 'blackGold', name: '黑金至尊风', description: '最高级别荣誉', image: 'blackGold.jpg', ink: '#28221c', muted: '#766752', award: '#916418' },
  { id: 'scholar', name: '国风书香风', description: '品德 · 勤学 · 阅读', image: 'scholar.jpg', ink: '#3a302b', muted: '#786b5c', award: '#9c342b' },
  { id: 'champagne', name: '香槟雅金风', description: '通用型高端奖状', image: 'champagne.jpg', ink: '#514438', muted: '#897a69', award: '#a57845' },
  { id: 'sunshine', name: '阳光成长风', description: '小学生成长 · 进步', image: 'sunshine.jpg', ink: '#614533', muted: '#8c7257', award: '#d46e25' },
  { id: 'laurel', name: '桂冠荣耀风', description: '优秀学员 · 学科之星', image: 'laurel.jpg', ink: '#293c35', muted: '#66766d', award: '#28704d' },
] as const

const LANDSCAPE_CONTENT_POSITIONS = {
  royal: { labelY: .35, nameY: .39, detailY: .516 },
  azure: { labelY: .33, nameY: .385, detailY: .508 },
  british: { labelY: .337, nameY: .38, detailY: .499 },
  blackGold: { labelY: .316, nameY: .366, detailY: .485 },
  scholar: { labelY: .305, nameY: .35, detailY: .484 },
  champagne: { labelY: .34, nameY: .384, detailY: .510 },
  sunshine: { labelY: .321, nameY: .368, detailY: .495 },
  laurel: { labelY: .324, nameY: .372, detailY: .501 },
} satisfies Record<(typeof CERTIFICATE_LIBRARY_TEMPLATES)[number]['id'], { labelY: number; nameY: number; detailY: number }>

export function libraryCertificateSlots(seed: (typeof CERTIFICATE_LIBRARY_TEMPLATES)[number], orientation: CertificateOrientation = 'LANDSCAPE'): CertificateSlots {
  const slots = defaultCertificateSlots(orientation)
  if (orientation === 'LANDSCAPE') {
    const position = LANDSCAPE_CONTENT_POSITIONS[seed.id]
    slots.awardLabel.y = position.labelY
    slots.studentName.y = position.nameY
    slots.detail.y = position.detailY
  }
  for (const key of CERTIFICATE_SLOT_KEYS) {
    slots[key].color = key === 'awardName' ? seed.award : ['title', 'studentName', 'detail', 'citation', 'issuer', 'issueDate'].includes(key) ? seed.ink : seed.muted
  }
  return slots
}

export function defaultCertificateForm(date: string): CertificateForm {
  return {
    studentName: '王小明', grade: '小学五年级', subject: '数学',
    awardName: CERTIFICATE_AWARDS[0].name, citation: CERTIFICATE_AWARDS[0].citation,
    issuer: '鼎伴学-华北交付中心', issueDate: date, teamName: '星光伴学团队', coachName: '李教练',
  }
}
