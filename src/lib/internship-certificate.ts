import PDFDocument from 'pdfkit'
import path from 'node:path'

export interface InternshipCertificateData {
  name: string
  gender: string
  idCard: string
  startDate: Date
  endDate: Date
  companyName: string
}

function formatDate(date: Date): string {
  const value = date.toISOString().slice(0, 10)
  const [year, month, day] = value.split('-')
  return `${year}年${month}月${day}日`
}

/** 生成仅供审核使用的实习证明草稿 PDF；不包含公章或签名。 */
export function generateInternshipCertificatePdf(data: InternshipCertificateData): Promise<Buffer> {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansCJKsc-Regular.otf')

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 70, bottom: 70, left: 76, right: 76 } })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.font(fontPath)

    // 斜向水印和顶部声明，确保该文件不会被误认为已正式开具的证明。
    doc.save()
    doc.rotate(-32, { origin: [300, 430] })
    doc.fillColor('#d97706').fillOpacity(0.16).fontSize(38)
    doc.text('草稿 · 待审核盖章', 35, 405, { width: 520, align: 'center' })
    doc.restore()
    doc.fillColor('#92400e').fillOpacity(1).fontSize(11)
    doc.text('草稿 / 待审核盖章 · 不具备正式证明效力', 76, 42, { align: 'center', width: 443 })

    doc.fillColor('#111827').fontSize(20).text('实习实践证明', { align: 'center' })
    doc.moveDown(1.2)

    const bodyWidth = 443
    doc.fontSize(12).fillColor('#1f2937').lineGap(4)
    doc.text(`兹证明 ${data.name}，性别：${data.gender}，身份证号：${data.idCard}。`, { width: bodyWidth })
    doc.moveDown(0.3)
    doc.text(`该生于 ${formatDate(data.startDate)} 至 ${formatDate(data.endDate)} 期间，在我单位参加 AI伴学项目实习实践。`, { width: bodyWidth })
    doc.moveDown(0.3)
    doc.text('在实践期间，该生参与了人工智能技术在教育与伴学服务场景中的应用实践，主要实践内容包括：', { width: bodyWidth })
    doc.moveDown(0.25)

    const items = [
      '参与AI伴学项目的实际运营与服务实践，了解人工智能赋能教育服务的模式；',
      '参与AI伴学平台及相关AI工具的使用与应用，了解人工智能技术在学习分析、学习服务等场景中的应用；',
      '协助开展学生学习过程的信息整理、学习反馈及相关数据记录；',
      '参与AI伴学项目相关资料整理、数据处理及项目运营支持工作；',
      '通过实际项目实践，了解人工智能、数字化技术与教育服务的融合应用，提升了信息处理、沟通协作及实践应用能力。',
    ]
    items.forEach((item, index) => {
      doc.text(`${index + 1}. ${item}`, { width: bodyWidth })
      doc.moveDown(0.1)
    })

    doc.moveDown(0.2)
    doc.text('实践期间，该生能够遵守我单位相关管理制度，服从工作安排，认真完成实践任务，表现良好。', { width: bodyWidth })
    doc.moveDown(0.3)
    doc.text('特此证明。', { width: bodyWidth })
    doc.moveDown(1.5)

    doc.text(`单位名称：${data.companyName}`, { width: bodyWidth })
    doc.moveDown(1.6)
    doc.text('（单位公章）', { width: bodyWidth, align: 'right' })
    doc.moveDown(1.0)
    doc.text(`日期：${formatDate(data.endDate)}`, { width: bodyWidth, align: 'right' })

    doc.fillColor('#92400e').fontSize(10).text('本文件为系统自动生成的待审核草稿，需经单位审核并线下盖章后方可使用。', 76, 770, {
      width: bodyWidth,
      align: 'center',
    })

    doc.end()
  })
}
