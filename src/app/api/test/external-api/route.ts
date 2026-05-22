import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const API_URL = process.env.EXTERNAL_TUTOR_API_URL || 'https://flowapi.chulu.net/v1/external/tutors/info'
  const API_TOKEN = process.env.EXTERNAL_TUTOR_API_TOKEN

  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone') || '18051726775'
  const tutorId = searchParams.get('tutorId') || 'cmmbw1d560001tyi7qzdpj8nv'

  const url = new URL(API_URL)
  url.searchParams.set('phone', phone)
  url.searchParams.set('tutorId', tutorId)

  const result = {
    url: url.toString(),
    hasToken: !!API_TOKEN,
    tokenPrefix: API_TOKEN ? API_TOKEN.substring(0, 10) + '...' : 'none',
  }

  try {
    console.log('测试外部API调用:', url.toString())

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-External-Token': API_TOKEN || '',
        'Accept': '*/*',
        'User-Agent': 'TutorOnboarding/1.0.0',
      },
    })

    result['status'] = response.status
    result['statusText'] = response.statusText
    result['ok'] = response.ok

    const body = await response.text()

    try {
      result['body'] = JSON.parse(body)
    } catch {
      result['body'] = body
    }

    return NextResponse.json({ success: response.ok, result })
  } catch (error) {
    result['error'] = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, result })
  }
}
