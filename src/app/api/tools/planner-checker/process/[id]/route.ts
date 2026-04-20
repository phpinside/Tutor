import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

function loadSystemPrompt(): string {
  const promptPath = path.join(process.cwd(), 'src', 'config', 'prompts', 'planner-checker.md')
  return fs.readFileSync(promptPath, 'utf-8')
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const record = await prisma.plannerCheckRecord.findUnique({ where: { id } })
  if (!record) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 })
  }

  if (record.status === 'PROCESSING' || record.status === 'COMPLETED') {
    return NextResponse.json({ message: '已在处理中或已完成' })
  }

  // Mark as processing
  await prisma.plannerCheckRecord.update({
    where: { id },
    data: { status: 'PROCESSING' },
  })

  // Run analysis asynchronously so we can return immediately
  void runAnalysis(id, record.extractedText)

  return NextResponse.json({ message: '分析已开始' })
}

async function runAnalysis(id: string, extractedText: string) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('未配置 OPENAI_API_KEY')
    }

    const client = new OpenAI({
      apiKey,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
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
    
    //打印 rawResult
    console.log('rawResult', rawResult)

    // Validate it's parseable JSON
    JSON.parse(rawResult)

    await prisma.plannerCheckRecord.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        result: rawResult,
      },
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '分析失败，请重试'
    console.error(`[planner-checker/process/${id}]`, err)

    await prisma.plannerCheckRecord.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMsg,
      },
    }).catch(() => {})
  }
}
