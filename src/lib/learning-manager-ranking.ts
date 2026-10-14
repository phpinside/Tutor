export interface RankingTeam {
  id: string
  name: string
  grades: string
  introduction: string
  highlight: string
  teamName: string
  showTeamName: boolean
}

export const RANKING_BACKGROUND = '/operator-tools/learning-manager-ranking/background.png'
export const RANKING_BACKDROP = '/operator-tools/learning-manager-ranking/backdrop.png'
export const RANKING_WIDTH = 1055
export const RANKING_FONT = 'RankingSans'
const CARD_HEIGHT = 325
const ROW_GAP = 18
const ROW_PITCH = CARD_HEIGHT + ROW_GAP
const HEADER_HEIGHT = 453
const FOOTER_HEIGHT = 192

export const DEFAULT_RANKING_TEAMS: RankingTeam[] = [
  { id: 'team-1', name: '张洪瑞', teamName: '张洪瑞团队', grades: '小学 / 初中', introduction: '学习规划 | 师资匹配 | 日常跟进 | 阶段反馈', highlight: '重视整体成长，持续优化方案，\n助力学生稳步提升' },
  { id: 'team-2', name: '李莲宇', teamName: '李莲宇团队', grades: '高中', introduction: '高中服务 | 规划清晰 | 老师匹配 | 全程跟进', highlight: '聚焦高中学段，关注学习进度\n与阶段提升' },
  { id: 'team-3', name: '段思怡', teamName: '段思怡团队', grades: '小学高年段 / 初中', introduction: '学情诊断 | 定制规划 | 适配师资 | 习惯培养', highlight: '兼顾成绩提升与思维训练，\n灵活调整学习方案' },
  { id: 'team-4', name: '王赫', teamName: '王赫团队', grades: '初中 / 高中', introduction: '理科思维 | 老师匹配 | 课堂跟进 | 课后反馈', highlight: '聚焦理科学习，及时发现薄弱点\n并动态优化' },
  { id: 'team-5', name: '胡止瑜', teamName: '胡止瑜团队', grades: '小学 / 初中', introduction: '习惯养成 | 老师匹配 | 课堂跟进 | 课后反馈', highlight: '重视低龄到初中阶段习惯培养\n与长期成长' },
  { id: 'team-6', name: '祖永哲', teamName: '祖永哲团队', grades: '高中 / 初高中数理化', introduction: '优质师资 | 定制方案 | 排课督学 | 错题复盘', highlight: '一站式全程跟进，让招生更安心、\n交付更省心' },
].map((team) => ({ ...team, showTeamName: true }))

/** Monday-based calendar week in Shanghai; this Tuesday may be tomorrow on Monday. */
export function getDefaultRankingPeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now)
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value)
  const end = new Date(Date.UTC(part('year'), part('month') - 1, part('day')))
  end.setUTCDate(end.getUTCDate() + 1 - ((end.getUTCDay() + 6) % 7))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 7)
  const format = (date: Date) => `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
  return `${format(start)}—${format(end)}`
}

export function getRankingHeight(teamCount: number): number {
  const rows = Math.ceil(Math.max(1, teamCount) / 2)
  return HEADER_HEIGHT + 10 + rows * CARD_HEIGHT + (rows - 1) * ROW_GAP + 6 + FOOTER_HEIGHT
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const character of Array.from(paragraph)) {
      if (line && ctx.measureText(line + character).width > width) {
        lines.push(line)
        line = character
      } else {
        line += character
      }
    }
    lines.push(line)
  }
  return lines
}

/** Shrink and wrap without silently clipping the user's copy. */
function drawText(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number, width: number, height: number,
  fontSize: number, color = '#123c75', singleLine = false,
) {
  let lines: string[] = []
  let size = fontSize
  for (; size >= 10; size--) {
    ctx.font = `${size}px ${RANKING_FONT}, sans-serif`
    lines = singleLine ? [text.replace(/\n/g, ' ')] : wrapText(ctx, text, width)
    if (lines.every((line) => ctx.measureText(line).width <= width) && lines.length * size * 1.35 <= height) break
  }
  if (size < 10) throw new Error('文案过长，请缩短时间区间或学管文案后再生成。')
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  const top = y + (height - lines.length * size * 1.35) / 2
  lines.forEach((line, index) => ctx.fillText(line, x, top + index * size * 1.35))
}

function drawTeamLabel(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#ffedc6'
  ctx.beginPath()
  ctx.roundRect(x + 20, y + 263, 120, 38, 19)
  ctx.fill()
  ctx.fillStyle = '#0c3c71'
  // Match the existing navy people icons with a small code-drawn group icon.
  ctx.beginPath()
  ctx.arc(x + 36, y + 276, 4, 0, Math.PI * 2)
  ctx.arc(x + 44, y + 279, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(x + 30, y + 281, 12, 10, 3)
  ctx.roundRect(x + 41, y + 283, 7, 8, 2)
  ctx.fill()
  drawText(ctx, '所属团队', x + 61, y + 263, 74, 38, 17, '#123c75', true)
}

export function renderRankingPoster(
  canvas: HTMLCanvasElement, background: CanvasImageSource, backdrop: CanvasImageSource,
  period: string, teams: RankingTeam[], scale = 2,
) {
  if (!period.trim()) throw new Error('请填写中文时间区间。')
  if (!teams.length) throw new Error('请至少添加一位学管。')
  if (teams.some((team) => !team.name.trim() || !team.grades.trim() || !team.introduction.trim() || !team.highlight.trim() || (team.showTeamName && !team.teamName.trim()))) {
    throw new Error('请填写每位学管的姓名、擅长学段、核心简介、亮点总结和所属团队。')
  }
  const height = getRankingHeight(teams.length)
  canvas.width = RANKING_WIDTH * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持图片生成。')
  ctx.scale(scale, scale)
  ctx.drawImage(background, 0, 0, RANKING_WIDTH, HEADER_HEIGHT, 0, 0, RANKING_WIDTH, HEADER_HEIGHT)
  const middleHeight = height - HEADER_HEIGHT - FOOTER_HEIGHT
  ctx.drawImage(backdrop, 0, HEADER_HEIGHT, RANKING_WIDTH, 846, 0, HEADER_HEIGHT, RANKING_WIDTH, middleHeight)
  ctx.drawImage(background, 0, 1299, RANKING_WIDTH, FOOTER_HEIGHT, 0, height - FOOTER_HEIGHT, RANKING_WIDTH, FOOTER_HEIGHT)
  drawText(ctx, `每周学管推荐 | ${period.trim()}`, 286, 211, 448, 37, 23, '#12376d', true)
  teams.forEach((team, index) => {
    const sourceIndex = index % 6
    const sourceX = sourceIndex % 2 === 0 ? 26 : 535
    const cardWidth = sourceIndex % 2 === 0 ? 494 : 498
    const sourceY = [463, 745, 1028][Math.floor(sourceIndex / 2)]
    const sourceHeight = sourceIndex >= 4 ? 261 : 265
    const lastOdd = teams.length % 2 === 1 && index === teams.length - 1
    const x = lastOdd ? (1055 - 494) / 2 : index % 2 === 0 ? 26 : 535
    const y = 463 + Math.floor(index / 2) * ROW_PITCH
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, y, cardWidth, CARD_HEIGHT, 20)
    ctx.clip()
    // Extend only the blank cream body, preserving the header, labels and border.
    ctx.drawImage(background, sourceX, sourceY, cardWidth, 234, x, y, cardWidth, 234)
    ctx.drawImage(background, sourceX, sourceY + 234, cardWidth, 4, x, y + 234, cardWidth, 64)
    ctx.drawImage(background, sourceX, sourceY + 238, cardWidth, sourceHeight - 238, x, y + 298, cardWidth, 27)
    ctx.restore()
    drawText(ctx, team.name.trim(), x + 138, y + 10, 239, 54, 33, '#ffffff', true)
    drawText(ctx, team.grades.trim(), x + 156, y + 83, 318, 42, 20)
    drawText(ctx, team.introduction.trim(), x + 156, y + 134, 318, 43, 18)
    drawText(ctx, team.highlight.trim(), x + 156, y + 183, 318, 65, 20)
    // Visibility affects only the content; the reserved row and card dimensions stay fixed.
    if (team.showTeamName) {
      drawTeamLabel(ctx, x, y)
      drawText(ctx, team.teamName.trim(), x + 156, y + 258, 318, 48, 20)
    }
  })
}
