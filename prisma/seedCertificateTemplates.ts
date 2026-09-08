import { PrismaClient, CertificateType } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * 初始证明模板种子（幂等，可重复执行）。
 * 运行：npx tsx prisma/seedCertificateTemplates.ts
 */

const INTERNSHIP_TEMPLATE = {
  type: 'INTERNSHIP' as CertificateType,
  name: '实习实践证明（标准版）',
  title: '实习实践证明',
  companyName: '北京一生二科技有限公司',
  bodyText: `兹证明 {{name}}，性别：{{gender}}，身份证号：{{idCard}}。

该生于 {{startDate}} 至 {{endDate}} 期间，在我单位参加 AI伴学项目实习实践。

在实践期间，该生参与了人工智能技术在教育与伴学服务场景中的应用实践，主要实践内容包括：
1. 参与AI伴学项目的实际运营与服务实践，了解人工智能赋能教育服务的模式；
2. 参与AI伴学平台及相关AI工具的使用与应用，了解人工智能技术在学习分析、学习服务等场景中的应用；
3. 协助开展学生学习过程的信息整理、学习反馈及相关数据记录；
4. 参与AI伴学项目相关资料整理、数据处理及项目运营支持工作；
5. 通过实际项目实践，了解人工智能、数字化技术与教育服务的融合应用，提升了信息处理、沟通协作及实践应用能力。

实践期间，该生能够遵守我单位相关管理制度，服从工作安排，认真完成实践任务，表现良好。

特此证明。`,
  fields: [
    { key: 'name', label: '姓名', type: 'text', required: true },
    { key: 'gender', label: '性别', type: 'select', required: true, options: ['男', '女'] },
    { key: 'idCard', label: '身份证号', type: 'text', required: true },
    { key: 'startDate', label: '实习开始日期', type: 'date', required: true },
    { key: 'endDate', label: '实习结束日期', type: 'date', required: true },
  ],
  sortOrder: 0,
}

const LABOR_CONFIRMATION_TEMPLATE = {
  type: 'LABOR_CONFIRMATION' as CertificateType,
  name: '劳务完成确认单（标准版）',
  title: '劳务完成确认单',
  companyName: '北京一生二科技有限公司',
  bodyText: `兹确认：
姓名：{{name}}
身份证号码：{{idCard}}

该人员于{{startDate}}至{{endDate}}期间，为我单位{{projectName}}提供AI伴学项目相关劳务服务。

一、服务内容
该人员根据我单位项目需求，参与AI伴学项目服务支持工作，主要完成以下事项：
1. 参与AI伴学项目相关运营及服务支持工作；
2. 协助开展学生学习过程的信息整理、学习反馈及相关记录工作；
3. 参与项目资料整理、数据处理及运营支持工作；
4. 按照项目安排完成其他相关服务事项。

二、服务完成情况
该人员已按照项目要求完成上述劳务服务内容，经我单位确认，相关服务工作已实际发生并达到约定要求。

三、服务费用确认
本次劳务服务对应费用为：
人民币（大写）：{{amountCapital}}
金额（小写）：¥{{amount}}元

上述费用为该人员完成AI伴学项目相关劳务服务对应的服务报酬。

特此确认。`,
  fields: [
    { key: 'name', label: '姓名', type: 'text', required: true },
    { key: 'idCard', label: '身份证号码', type: 'text', required: true },
    { key: 'startDate', label: '劳务开始日期', type: 'date', required: true, default: 'lastMonthStart' },
    { key: 'endDate', label: '劳务结束日期', type: 'date', required: true, default: 'lastMonthEnd' },
    { key: 'projectName', label: '项目名称（选填）', type: 'text', placeholder: '如：AI伴学项目' },
    { key: 'amount', label: '劳务费金额（元）', type: 'amount', required: true },
  ],
  sortOrder: 0,
}

async function main() {
  // 默认开具单位：不上传盖章图（stampKey 空）时使用系统默认公章
  const company = await prisma.certificateCompany.upsert({
    where: { name: '北京一生二科技有限公司' },
    update: {},
    create: { name: '北京一生二科技有限公司', stampKey: null, sortOrder: 0 },
  })
  console.log('✓ 已同步单位：北京一生二科技有限公司')

  for (const template of [INTERNSHIP_TEMPLATE, LABOR_CONFIRMATION_TEMPLATE]) {
    const { type, name, title, companyName, bodyText, fields, sortOrder } = template
    await prisma.certificateTemplate.upsert({
      where: { type_name: { type, name } },
      // 单位关联仅在首次创建时写入，避免重复执行种子覆盖管理端已配置的单位
      update: { title, companyName, bodyText, fields, sortOrder },
      create: { type, name, title, companyName, companyIds: [company.id], defaultCompanyId: company.id, bodyText, fields, sortOrder },
    })
    console.log(`✓ 已同步模板：${name}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
