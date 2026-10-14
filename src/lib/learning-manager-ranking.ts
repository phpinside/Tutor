export interface RankingTeam {
  id: string
  name: string
  grades: string
  introduction: string
  highlight: string
}

export const RANKING_BACKGROUND = '/operator-tools/learning-manager-ranking/background.png'
export const RANKING_BACKDROP = '/operator-tools/learning-manager-ranking/backdrop.png'
export const RANKING_WIDTH = 1055
export const RANKING_FONT = 'RankingSans'

export const DEFAULT_RANKING_TEAMS: RankingTeam[] = [
  { id: 'team-1', name: '张洪瑞团队', grades: '小学 / 初中', introduction: '学习规划 | 师资匹配 | 日常跟进 | 阶段反馈', highlight: '重视整体成长，持续优化方案，\n助力学生稳步提升' },
  { id: 'team-2', name: '李莲宇团队', grades: '高中', introduction: '高中服务 | 规划清晰 | 老师匹配 | 全程跟进', highlight: '聚焦高中学段，关注学习进度\n与阶段提升' },
  { id: 'team-3', name: '段思怡团队', grades: '小学高年段 / 初中', introduction: '学情诊断 | 定制规划 | 适配师资 | 习惯培养', highlight: '兼顾成绩提升与思维训练，\n灵活调整学习方案' },
  { id: 'team-4', name: '王赫团队', grades: '初中 / 高中', introduction: '理科思维 | 老师匹配 | 课堂跟进 | 课后反馈', highlight: '聚焦理科学习，及时发现薄弱点\n并动态优化' },
  { id: 'team-5', name: '胡止瑜团队', grades: '小学 / 初中', introduction: '习惯养成 | 老师匹配 | 课堂跟进 | 课后反馈', highlight: '重视低龄到初中阶段习惯培养\n与长期成长' },
  { id: 'team-6', name: '祖永哲团队', grades: '高中 / 初高中数理化', introduction: '优质师资 | 定制方案 | 排课督学 | 错题复盘', highlight: '一站式全程跟进，让招生更安心、\n交付更省心' },
]

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
  return 1491 + (Math.ceil(Math.max(1, teamCount) / 2) - 3) * 283
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
  if (size < 10) throw new Error('文案过长，请缩短时间区间或团队文案后再生成。')
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  const top = y + (height - lines.length * size * 1.35) / 2
  lines.forEach((line, index) => ctx.fillText(line, x, top + index * size * 1.35))
}

export function renderRankingPoster(
  canvas: HTMLCanvasElement, background: CanvasImageSource, backdrop: CanvasImageSource,
  period: string, teams: RankingTeam[], scale = 2,
) {
  if (!period.trim()) throw new Error('请填写中文时间区间。')
  if (!teams.length) throw new Error('请至少添加一个学管团队。')
  if (teams.some((team) => !team.name.trim() || !team.grades.trim() || !team.introduction.trim() || !team.highlight.trim())) {
    throw new Error('请填写每个团队的名称、擅长学段、核心简介和亮点总结。')
  }
  const height = getRankingHeight(teams.length)
  canvas.width = RANKING_WIDTH * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持图片生成。')
  ctx.scale(scale, scale)
  const rows = Math.ceil(teams.length / 2)
  // The six-team composition retains the exact source background pixels.
  if (teams.length === 6) {
    ctx.drawImage(background, 0, 0)
  } else {
    ctx.drawImage(background, 0, 0, 1055, 453, 0, 0, 1055, 453)
    const middleHeight = 846 + (rows - 3) * 283
    ctx.drawImage(backdrop, 0, 453, 1055, 846, 0, 453, 1055, middleHeight)
    ctx.drawImage(background, 0, 1299, 1055, 192, 0, height - 192, 1055, 192)
  }
  drawText(ctx, `每周学管推荐 | ${period.trim()}`, 286, 211, 448, 37, 23, '#12376d', true)
  teams.forEach((team, index) => {
    const sourceIndex = index % 6
    const sourceX = sourceIndex % 2 === 0 ? 26 : 535
    const cardWidth = sourceIndex % 2 === 0 ? 494 : 498
    const sourceY = [463, 745, 1028][Math.floor(sourceIndex / 2)]
    const sourceHeight = sourceIndex >= 4 ? 261 : 265
    const lastOdd = teams.length % 2 === 1 && index === teams.length - 1
    const x = lastOdd ? (1055 - 494) / 2 : index % 2 === 0 ? 26 : 535
    const y = [463, 745, 1028][Math.floor(index / 2)] ?? 463 + Math.floor(index / 2) * 283 - 1
    if (teams.length !== 6) {
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(x, y, cardWidth, 265, 20)
      ctx.clip()
      ctx.drawImage(background, sourceX, sourceY, cardWidth, sourceHeight, x, y, cardWidth, 265)
      ctx.restore()
    }
    drawText(ctx, team.name.trim(), x + 138, y + 10, 239, 54, 33, '#ffffff', true)
    drawText(ctx, team.grades.trim(), x + 156, y + 83, 318, 42, 20)
    drawText(ctx, team.introduction.trim(), x + 156, y + 134, 318, 43, 18)
    drawText(ctx, team.highlight.trim(), x + 156, y + 183, 318, 65, 20)
  })
}
