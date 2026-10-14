import assert from 'node:assert/strict'
import { test } from 'node:test'
import path from 'node:path'
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import {
  DEFAULT_RANKING_TEAMS, getDefaultRankingPeriod, getRankingHeight,
  RANKING_FONT, renderRankingPoster,
} from '../src/lib/learning-manager-ranking'

const root = process.cwd()
GlobalFonts.registerFromPath(path.join(root, 'public/fonts/NotoSansCJKsc-Regular.otf'), RANKING_FONT)
const background = loadImage(path.join(root, 'public/operator-tools/learning-manager-ranking/background.png'))
const backdrop = loadImage(path.join(root, 'public/operator-tools/learning-manager-ranking/backdrop.png'))

test('default period uses last and this calendar-week Tuesday in Shanghai, across month and year boundaries', () => {
  assert.equal(getDefaultRankingPeriod(new Date('2026-10-14T04:00:00Z')), '2026年10月6日—2026年10月13日')
  assert.equal(getDefaultRankingPeriod(new Date('2026-10-13T04:00:00Z')), '2026年10月6日—2026年10月13日')
  assert.equal(getDefaultRankingPeriod(new Date('2026-10-11T15:59:59Z')), '2026年9月29日—2026年10月6日')
  assert.equal(getDefaultRankingPeriod(new Date('2026-10-11T16:00:00Z')), '2026年10月6日—2026年10月13日')
  assert.equal(getDefaultRankingPeriod(new Date('2026-10-12T04:00:00Z')), '2026年10月6日—2026年10月13日')
  assert.equal(getDefaultRankingPeriod(new Date('2026-01-01T00:00:00Z')), '2025年12月23日—2025年12月30日')
})

test('one, six and many teams render with complete fixed headers and footers', async () => {
  const image = await background
  const backdropImage = await backdrop
  const source = createCanvas(1055, 1491)
  source.getContext('2d').drawImage(image, 0, 0)
  const ctx = source.getContext('2d')
  for (const count of [1, 2, 5, 6, 7, 8, 20]) {
    const teams = Array.from({ length: count }, (_, index) => ({ ...DEFAULT_RANKING_TEAMS[index % 6], id: String(index) }))
    const canvas = createCanvas(1, 1)
    renderRankingPoster(canvas as unknown as HTMLCanvasElement, image as unknown as CanvasImageSource, backdropImage as unknown as CanvasImageSource, getDefaultRankingPeriod(new Date('2026-10-14T00:00:00Z')), teams, 1)
    assert.equal(canvas.width, 1055)
    assert.equal(canvas.height, getRankingHeight(count))
    const result = canvas.getContext('2d')
    assert.deepEqual(result.getImageData(0, 0, 1055, 200).data, ctx.getImageData(0, 0, 1055, 200).data, `header changed for ${count} teams`)
    assert.deepEqual(result.getImageData(0, canvas.height - 192, 1055, 192).data, ctx.getImageData(0, 1299, 1055, 192).data, `footer changed for ${count} teams`)
    // The upper card border remains unchanged while the blank lower body grows.
    if (count % 2 === 0) {
      assert.deepEqual(result.getImageData(1028, 488, 5, 200).data, ctx.getImageData(1028, 488, 5, 200).data)
    }
  }
})

test('long Chinese copy and explicit line breaks fit, invalid input fails visibly', async () => {
  const image = await background
  const backdropImage = await backdrop
  const canvas = createCanvas(1, 1)
  const render = (period: string, teams = DEFAULT_RANKING_TEAMS) => renderRankingPoster(canvas as unknown as HTMLCanvasElement, image as unknown as CanvasImageSource, backdropImage as unknown as CanvasImageSource, period, teams, 1)
  assert.doesNotThrow(() => render('2026年10月6日—2026年10月13日', [{
    ...DEFAULT_RANKING_TEAMS[0], name: '学管姓名'.repeat(4), grades: '小学初中高中'.repeat(6), introduction: '学习规划'.repeat(20), highlight: '跟进学习\n' + '学生持续成长'.repeat(12), teamName: '所属团队'.repeat(10),
  }]))
  assert.throws(() => render(''), /时间区间/)
  assert.throws(() => render('本周', []), /至少添加/)
  assert.throws(() => render('本周', [{ ...DEFAULT_RANKING_TEAMS[0], name: ' ' }]), /填写每位学管/)
  assert.throws(() => render('本周', [{ ...DEFAULT_RANKING_TEAMS[0], teamName: ' ' }]), /所属团队/)
  assert.throws(() => render('本周', [{ ...DEFAULT_RANKING_TEAMS[0], highlight: '过长文案'.repeat(500) }]), /文案过长/)
})

test('editing the affiliation changes only the new row below the highlight', async () => {
  const image = await background
  const backdropImage = await backdrop
  const before = createCanvas(1, 1)
  const after = createCanvas(1, 1)
  const person = DEFAULT_RANKING_TEAMS[0]
  for (const [canvas, teamName] of [[before, '华北一组'], [after, '华北二组']] as const) {
    renderRankingPoster(canvas as unknown as HTMLCanvasElement, image as unknown as CanvasImageSource, backdropImage as unknown as CanvasImageSource, '本周', [{ ...person, teamName }], 1)
  }
  const x = (1055 - 494) / 2
  const beforeCtx = before.getContext('2d')
  const afterCtx = after.getContext('2d')
  assert.deepEqual(beforeCtx.getImageData(0, 0, 1055, 463 + 258).data, afterCtx.getImageData(0, 0, 1055, 463 + 258).data)
  assert.notDeepEqual(beforeCtx.getImageData(x + 156, 463 + 258, 318, 48).data, afterCtx.getImageData(x + 156, 463 + 258, 318, 48).data)
  assert.equal(before.height, 986)
  assert.equal(getRankingHeight(6), 1672)
})

test('hiding affiliation reserves the row without shifting cards or the footer', async () => {
  const image = await background
  const backdropImage = await backdrop
  assert.ok(DEFAULT_RANKING_TEAMS.every((team) => team.showTeamName))
  for (const count of [1, 2, 6, 7]) {
    const teams = Array.from({ length: count }, (_, index) => ({ ...DEFAULT_RANKING_TEAMS[index % 6], id: String(index) }))
    const before = createCanvas(1, 1)
    const hidden = createCanvas(1, 1)
    const restored = createCanvas(1, 1)
    const render = (canvas: typeof before, showTeamName: boolean) => renderRankingPoster(
      canvas as unknown as HTMLCanvasElement, image as unknown as CanvasImageSource,
      backdropImage as unknown as CanvasImageSource, '本周',
      teams.map((team, index) => index === 0 ? { ...team, showTeamName } : team), 1,
    )
    render(before, true)
    render(hidden, false)
    render(restored, true)
    assert.equal(before.width, hidden.width)
    assert.equal(before.height, hidden.height)
    const original = before.getContext('2d')
    const result = hidden.getContext('2d')
    const start = 463 + 258
    const end = 463 + 306
    assert.deepEqual(original.getImageData(0, 0, 1055, start).data, result.getImageData(0, 0, 1055, start).data)
    assert.notDeepEqual(original.getImageData(0, start, 1055, end - start).data, result.getImageData(0, start, 1055, end - start).data)
    assert.deepEqual(original.getImageData(0, end, 1055, before.height - end).data, result.getImageData(0, end, 1055, hidden.height - end).data)
    assert.deepEqual(original.getImageData(0, 0, before.width, before.height).data, restored.getContext('2d').getImageData(0, 0, restored.width, restored.height).data)
  }
  const canvas = createCanvas(1, 1)
  assert.doesNotThrow(() => renderRankingPoster(
    canvas as unknown as HTMLCanvasElement, image as unknown as CanvasImageSource,
    backdropImage as unknown as CanvasImageSource, '本周',
    [{ ...DEFAULT_RANKING_TEAMS[0], showTeamName: false, teamName: '' }], 1,
  ))
})
