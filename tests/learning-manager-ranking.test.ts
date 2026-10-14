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
    // Card border remains complete on the right column after changing team count.
    if (count % 2 === 0) {
      assert.deepEqual(result.getImageData(1028, 488, 5, 210).data, ctx.getImageData(1028, 488, 5, 210).data)
    }
  }
})

test('long Chinese copy and explicit line breaks fit, invalid input fails visibly', async () => {
  const image = await background
  const backdropImage = await backdrop
  const canvas = createCanvas(1, 1)
  const render = (period: string, teams = DEFAULT_RANKING_TEAMS) => renderRankingPoster(canvas as unknown as HTMLCanvasElement, image as unknown as CanvasImageSource, backdropImage as unknown as CanvasImageSource, period, teams, 1)
  assert.doesNotThrow(() => render('2026年10月6日—2026年10月13日', [{
    ...DEFAULT_RANKING_TEAMS[0], name: '团队名称'.repeat(4), grades: '小学初中高中'.repeat(6), introduction: '学习规划'.repeat(20), highlight: '跟进学习\n' + '学生持续成长'.repeat(12),
  }]))
  assert.throws(() => render(''), /时间区间/)
  assert.throws(() => render('本周', []), /至少添加/)
  assert.throws(() => render('本周', [{ ...DEFAULT_RANKING_TEAMS[0], name: ' ' }]), /填写每个团队/)
  assert.throws(() => render('本周', [{ ...DEFAULT_RANKING_TEAMS[0], highlight: '过长文案'.repeat(500) }]), /文案过长/)
})
