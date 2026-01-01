import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

type Template = {
  id: string
  filename: string
  url: string
  name: string
}

export async function GET() {
  try {
    const templatesDir = path.join(process.cwd(), 'public/poster-templates')
    
    // 确保目录存在
    if (!fs.existsSync(templatesDir)) {
      return NextResponse.json({ templates: [] })
    }
    
    const files = fs.readdirSync(templatesDir)
    
    const templates: Template[] = files
      .filter(file => {
        // 只筛选图片文件，排除 README.md 等文件
        const ext = path.extname(file).toLowerCase()
        return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)
      })
      .sort((a, b) => {
        // 自然排序：template-1.png, template-2.png, template-10.png
        const numA = parseInt(a.match(/\d+/)?.[0] || '0')
        const numB = parseInt(b.match(/\d+/)?.[0] || '0')
        return numA - numB
      })
      .map((file, index) => ({
        id: `template-${index + 1}`,
        filename: file,
        url: `/poster-templates/${file}`,
        name: `模板 ${index + 1}`
      }))
    
    return NextResponse.json({ templates })
  } catch (error) {
    console.error('扫描模板目录失败:', error)
    return NextResponse.json({ templates: [], error: '扫描模板失败' })
  }
}
