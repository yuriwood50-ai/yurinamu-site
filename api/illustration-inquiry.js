/**
 * 일러스트 의뢰 접수 → 운영자 Gmail 알림 (Vercel 서버리스 함수)
 *
 * 커피(라떼 아티스트) 클래스 신청 페이지와 같은 방식: Resend로 발송,
 * 키는 환경변수 RESEND_API_KEY, 발신은 onboarding@resend.dev(도메인 인증 전).
 *
 * 그 프로젝트와 다른 점: 메일이 실제로 나가지 않으면 실패로 응답한다.
 * 폼은 성공 응답을 받았을 때만 「접수 완료」 화면으로 넘어간다.
 */
const { Resend } = require('resend')

const NOTIFY_FROM = '유리나무 의뢰 접수 <onboarding@resend.dev>'
const NOTIFY_TO = 'yuriwood50@gmail.com'

// 폼(illustration-inquiry.html)의 선택지 라벨과 동일하게 유지
const L = {
  kind: { cover: '출판 표지', inner: '출판 내지 삽화', character: '캐릭터 디자인', goods: '굿즈 · 상품화', web: '웹 · SNS 콘텐츠', undecided: '아직 정하지 못했어요', etc: '기타' },
  scope: { hero: '대표 이미지 1컷', spots: '작은 삽화 여러 컷', book: '책 한 권 분량', char1: '캐릭터 1종', charset: '캐릭터와 표정 세트', talk: '구성 상담 희망' },
  bg: { none: '배경 없음', simple: '간단한 공간 또는 소품', detail: '디테일한 전체 배경', unsure: '아직 모르겠어요' },
  usage: { book: '책 · 잡지', web: '웹 · SNS', ad: '광고 · 캠페인', poster: '포스터 · 패키지', merch: '굿즈 판매', ebook: '전자책', etc: '기타' },
  period: { y1: '1년', y3: '3년', perm: '기간 제한 없이', talk: '상담 희망' },
  region: { kr: '국내', global: '해외 포함', talk: '상담 희망' },
  excl: { non: '독점 아님', exc: '독점 필요', talk: '상담 희망' },
  when: { flex: '일정 협의 가능', rush: '빠른 작업 필요' },
  rush: { d3: '3일', h48: '48시간', h24: '24시간' },
  budget: { b1: '30만원 이하', b2: '30 – 50만원', b3: '50 – 100만원', b4: '100만원 이상', talk: '상담 후 결정' },
  output: { screen: '화면용', print: '인쇄용', both: '화면 · 인쇄 모두', unsure: '미정' },
  channel: { email: '이메일', kakao: '카카오톡', phone: '전화' }
}

const QTY_SCOPES = ['spots', 'book', 'charset']
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// 자유 입력칸 최대 길이
const TEXT_LIMITS = {
  brief: 3000, pname: 200, mood: 2000, ref: 2000, avoid: 2000, must: 2000,
  date: 100, size: 200, name: 100, org: 200, email: 254, reach: 100
}
const CHOICE_FIELDS = ['kind', 'scope', 'bg', 'period', 'region', 'excl', 'when', 'rush', 'budget', 'output', 'channel']

class InvalidInput extends Error {}

/** 폼이 보낸 답변을 검증해 알려진 필드만 정리해서 돌려준다. */
function normalizeAnswers(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new InvalidInput('answers')
  const a = {}

  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    const v = raw[key] ?? ''
    if (typeof v !== 'string') throw new InvalidInput(key)
    const s = v.trim()
    if (s.length > max) throw new InvalidInput(key)
    a[key] = s
  }

  for (const key of CHOICE_FIELDS) {
    const v = raw[key] ?? null
    if (v !== null && !Object.hasOwn(L[key], v)) throw new InvalidInput(key)
    a[key] = v
  }

  const usage = raw.usage ?? []
  if (!Array.isArray(usage) || usage.length > Object.keys(L.usage).length) throw new InvalidInput('usage')
  if (!usage.every((u) => Object.hasOwn(L.usage, u))) throw new InvalidInput('usage')
  a.usage = [...new Set(usage)]

  const qty = Number(raw.qty ?? 1)
  if (!Number.isInteger(qty) || qty < 1 || qty > 999) throw new InvalidInput('qty')
  a.qty = qty

  // 폼의 다음 단계 검사와 같은 필수값
  if (!a.kind) throw new InvalidInput('kind')
  if (!a.brief) throw new InvalidInput('brief')
  if (!a.scope) throw new InvalidInput('scope')
  if (a.usage.length === 0) throw new InvalidInput('usage')
  if (!EMAIL_PATTERN.test(a.email)) throw new InvalidInput('email')
  if (raw.ack !== true) throw new InvalidInput('ack')

  return a
}

/** 폼 완료 화면과 같은 계산식 — 화면의 접수번호와 메일의 접수번호가 항상 같다. */
function refCodeOf(raw) {
  const s = String(raw.email || '') + String(raw.name || '') + String(raw.brief || '')
  let h = 0
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) % 9000
  return 'YW-' + (1000 + h)
}

function formatKst(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).map((x) => [x.type, x.value])
  )
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`
}

/** 메일 본문 섹션 — [제목, [[항목, 값], ...]] */
function buildSections(a) {
  const label = (field, v) => (v ? L[field][v] : '')
  const speed = a.when === 'rush' ? '빠른 작업 필요' : a.when ? L.when[a.when] : '일반'
  const rush = a.when === 'rush' ? (a.rush ? `${L.rush[a.rush]} 이내` : '기간 미선택') : ''

  return [
    ['프로젝트', [
      ['의뢰 유형', label('kind', a.kind)],
      ['프로젝트명', a.pname],
      ['프로젝트 소개', a.brief]
    ]],
    ['작업 범위', [
      ['작업 범위', label('scope', a.scope)],
      ['컷 수', QTY_SCOPES.includes(a.scope) ? `${a.qty}컷` : ''],
      ['배경', label('bg', a.bg)]
    ]],
    ['사용 목적', [
      ['사용처', a.usage.map((u) => L.usage[u]).join(' · ')],
      ['사용 기간', label('period', a.period)],
      ['사용 지역', label('region', a.region)],
      ['독점 여부', label('excl', a.excl)]
    ]],
    ['그림 방향', [
      ['원하는 분위기', a.mood],
      ['참고 링크', a.ref],
      ['피하고 싶은 요소', a.avoid],
      ['반드시 포함할 요소', a.must]
    ]],
    ['일정 및 예산', [
      ['희망 납품일', a.date],
      ['진행 속도', speed],
      ['긴급 작업', rush],
      ['예산', label('budget', a.budget)]
    ]],
    ['결과물', [
      ['용도', label('output', a.output)],
      ['크기 / 비율', a.size]
    ]],
    ['의뢰인', [
      ['이름', a.name],
      ['회사 / 브랜드', a.org || '개인'],
      ['이메일', a.email],
      ['선호 연락 방식', label('channel', a.channel)],
      ['연락처 / 카카오톡', a.reach]
    ]]
  ]
}

function buildText({ refCode, receivedAt, sections }) {
  const body = sections
    .map(([title, rows]) => {
      const lines = rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
      return lines.length ? `■ ${title}\n\n${lines.join('\n')}` : ''
    })
    .filter(Boolean)
    .join('\n\n\n')
  return `유리나무 새 일러스트 의뢰\n\n접수번호: ${refCode}\n접수시간: ${receivedAt}\n\n\n${body}\n`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildHtml({ refCode, receivedAt, sections, replyTo }) {
  const blocks = sections
    .map(([title, rows]) => {
      const trs = rows
        .filter(([, v]) => v)
        .map(([k, v]) => `
          <tr>
            <td style="padding:8px 16px 8px 0;color:#6B737C;font-size:14px;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td>
            <td style="padding:8px 0;color:#17202A;font-size:15px;white-space:pre-wrap;word-break:break-word">${escapeHtml(v)}</td>
          </tr>`)
        .join('')
      if (!trs) return ''
      return `
        <h2 style="margin:28px 0 8px;font-size:15px;color:#3F5F89">■ ${escapeHtml(title)}</h2>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #E4E8EC">${trs}</table>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="ko">
  <body style="margin:0;padding:32px 20px;background:#FAF9F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo',sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:32px;background:#FFFFFF;border:1px solid #E4E8EC;border-radius:8px">
      <h1 style="margin:0 0 16px;font-size:20px;color:#17202A">유리나무 새 일러스트 의뢰</h1>
      <p style="margin:0;font-size:15px;color:#17202A">접수번호: <strong>${escapeHtml(refCode)}</strong></p>
      <p style="margin:4px 0 0;font-size:15px;color:#17202A">접수시간: ${escapeHtml(receivedAt)}</p>
      ${blocks}
      <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #E4E8EC;color:#6B737C;font-size:13px">
        이 메일에 답장하면 의뢰인(${escapeHtml(replyTo)})에게 전달됩니다.
      </p>
    </div>
  </body>
</html>`
}

function readBody(req) {
  // Vercel은 JSON이 깨져 있으면 req.body를 읽는 순간 예외를 던진다.
  let body
  try { body = req.body } catch { return null }
  if (typeof body === 'string') {
    try { return JSON.parse(body) } catch { return null }
  }
  return body
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  const body = readBody(req)
  if (!body || typeof body !== 'object' || JSON.stringify(body).length > 50000) {
    return res.status(400).json({ ok: false, error: 'invalid_body' })
  }

  let answers
  try {
    answers = normalizeAnswers(body.answers)
  } catch (err) {
    if (err instanceof InvalidInput) return res.status(400).json({ ok: false, error: 'invalid_field', field: err.message })
    throw err
  }

  // 폼은 앞뒤 공백을 자르지 않은 값으로 계산하므로 원본 값으로 계산한다.
  const refCode = refCodeOf(body.answers)
  if (body.refCode && body.refCode !== refCode) {
    console.warn('refCode mismatch:', body.refCode, refCode)
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set — inquiry not emailed:', refCode)
    return res.status(500).json({ ok: false, error: 'mail_not_configured' })
  }

  const now = new Date()
  const receivedAt = formatKst(now)
  const sections = buildSections(answers)
  const kindLabel = L.kind[answers.kind]
  const who = answers.name || '이름 미기재'

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send(
      {
        from: NOTIFY_FROM,
        to: [NOTIFY_TO],
        replyTo: answers.email,
        subject: `[유리나무 일러스트 의뢰] ${kindLabel} / ${who} / ${refCode}`,
        text: buildText({ refCode, receivedAt, sections }),
        html: buildHtml({ refCode, receivedAt, sections, replyTo: answers.email })
      },
      // 같은 의뢰를 같은 분 안에 여러 번 보내도 메일은 한 번만 나가게 한다.
      { idempotencyKey: `illustration-inquiry/${refCode}/${answers.email}/${now.toISOString().slice(0, 16)}` }
    )

    if (error) {
      console.error('Resend send error:', refCode, error.message)
      return res.status(502).json({ ok: false, error: 'mail_failed' })
    }

    console.log('Inquiry emailed:', refCode, data?.id)
    return res.status(200).json({ ok: true, refCode })
  } catch (err) {
    console.error('Failed to send inquiry email:', refCode, err)
    return res.status(502).json({ ok: false, error: 'mail_failed' })
  }
}
