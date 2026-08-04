import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

function loadSystemPrompt(): string {
  const promptPath = path.join(process.cwd(), 'src', 'config', 'prompts', 'planner-checker.md')
  return fs.readFileSync(promptPath, 'utf-8')
}

/**
 * 执行规划书自查分析。
 * 可在进程内直接调用（无需绕一圈 HTTP 自调用）。
 *
 * 状态流转：PENDING/FAILED → PROCESSING → COMPLETED/FAILED
 */
export async function runPlannerCheck(id: string, extractedText: string) {
  // 防重入：若已在处理中或已完成则跳过
  const current = await prisma.plannerCheckRecord.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!current) return
  if (current.status === 'PROCESSING' || current.status === 'COMPLETED') return

  await prisma.plannerCheckRecord.update({
    where: { id },
    data: { status: 'PROCESSING', errorMsg: null },
  })

  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('未配置 OPENAI_API_KEY')
    }

    const client = new OpenAI({
      apiKey,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
      timeout: 120000,   // 2 分钟，防止 LLM 调用挂死
      maxRetries: 2,
    })
    const systemPrompt = loadSystemPrompt()

    const userMessage = `以下是需要审查的规划书内容：\n\n---\n\n${extractedText}\n\n---\n\n请按照要求输出 JSON 格式的分析结果。`

    const completion = await client.chat.completions.create({
      model: 'glm-5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
    })

    const rawResult = completion.choices[0]?.message?.content ?? ''
    JSON.parse(rawResult) // 校验是合法 JSON

    await prisma.plannerCheckRecord.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        result: rawResult,
      },
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '分析失败，请重试'
    console.error(`[planner-checker/${id}]`, err)

    await prisma.plannerCheckRecord.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMsg,
      },
    })
  }
}
