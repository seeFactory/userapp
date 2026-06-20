const DEFAULT_LEGAL = {
  operatorName: 'seeFactory 平台运营方',
  contactEmail: 'support@seefactory.ai',
  contactAddress: '中国北京市海淀区 seeFactory 运营中心',
  jurisdiction: '中华人民共和国法律'
}

function compact(value, fallback) {
  const text = String(value || '').trim()
  return text || fallback
}

export function normalizeLegalInfo(legal = {}) {
  return {
    operatorName: compact(legal.operatorName, DEFAULT_LEGAL.operatorName),
    contactEmail: compact(legal.contactEmail, DEFAULT_LEGAL.contactEmail),
    contactAddress: compact(legal.contactAddress, DEFAULT_LEGAL.contactAddress),
    jurisdiction: compact(legal.jurisdiction, DEFAULT_LEGAL.jurisdiction)
  }
}

export function formatAgreementLegalBlock(legal = {}) {
  const info = normalizeLegalInfo(legal)
  return [
    '平台主体信息',
    `运营主体：${info.operatorName}`,
    `联系邮箱：${info.contactEmail}`,
    `联系地址：${info.contactAddress}`,
    `适用法域：${info.jurisdiction}`
  ].join('\n')
}

export function formatAgreementContent(agreement = {}, legal = {}, fallback = '协议正文待后台发布') {
  const body = compact(agreement.contentMarkdown, fallback)
  return `${body}\n\n${formatAgreementLegalBlock(legal)}`
}
