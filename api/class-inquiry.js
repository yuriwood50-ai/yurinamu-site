/**
 * 강의 문의 접수 → 운영자 Gmail 알림 (Vercel 서버리스 함수)
 *
 * 일러스트 의뢰(api/illustration-inquiry.js)와 같은 방식: Resend로 발송,
 * 키는 환경변수 RESEND_API_KEY, 발신은 onboarding@resend.dev(도메인 인증 전).
 * 메일이 실제로 나가지 않으면 실패로 응답하고, 폼은 성공 응답일 때만 접수 완료를 보여 준다.
 */
const { createHash } = require('node:crypto')
const { Resend } = require('resend')

const NOTIFY_FROM = '유리나무 강의 문의 <onboarding@resend.dev>'
const NOTIFY_TO = 'yuriwood50@gmail.com'

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// 자유 입력칸 최대 길이 — 폼(class.html)의 maxlength와 동일하게 유지
const TEXT_LIMITS = { org: 200, email: 254, message: 3000 }

class InvalidInput extends Error {}

/** 폼이 보낸 값을 검증해 알려진 필드만 정리해서 돌려준다. 세 칸 모두 필수. */
function normalizeFields(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new InvalidInput('fields')
  const f = {}
  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    const v = raw[key] ?? ''
    if (typeof v !== 'string') throw new InvalidInput(key)
    const s = v.trim()
    if (!s || s.length > max) throw new InvalidInput(key)
    f[key] = s
  }
  if (!EMAIL_PATTERN.test(f.email)) throw new InvalidInput('email')
  return f
}

/** 중복 발송 방지 키용 — HTTP 헤더로 가므로 ASCII 해시로 만든다. */
function digestOf(f) {
  return createHash('sha256').update(`${f.email}\n${f.org}\n${f.message}`).digest('hex').slice(0, 32)
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildRows(f) {
  return [
    ['기관 이름', f.org],
    ['이메일', f.email],
    ['문의 내용', f.message]
  ]
}

function buildText({ receivedAt, rows }) {
  const lines = rows.map(([k, v]) => `${k}: ${v}`).join('\n')
  return `유리나무 새 강의 문의\n\n접수시간: ${receivedAt}\n\n${lines}\n`
}

function buildHtml({ receivedAt, rows, replyTo }) {
  const trs = rows
    .map(([k, v]) => `
          <tr>
            <td style="padding:8px 16px 8px 0;color:#6B737C;font-size:14px;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td>
            <td style="padding:8px 0;color:#17202A;font-size:15px;white-space:pre-wrap;word-break:break-word">${escapeHtml(v)}</td>
          </tr>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="ko">
  <body style="margin:0;padding:32px 20px;background:#FAF9F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo',sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:32px;background:#FFFFFF;border:1px solid #E4E8EC;border-radius:8px">
      <h1 style="margin:0 0 16px;font-size:20px;color:#17202A">유리나무 새 강의 문의</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#17202A">접수시간: ${escapeHtml(receivedAt)}</p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #E4E8EC">${trs}</table>
      <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #E4E8EC;color:#6B737C;font-size:13px">
        이 메일에 답장하면 문의하신 분(${escapeHtml(replyTo)})에게 전달됩니다.
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
  if (!body || typeof body !== 'object' || JSON.stringify(body).length > 20000) {
    return res.status(400).json({ ok: false, error: 'invalid_body' })
  }

  // 숨김 칸(honeypot)이 채워져 있으면 봇으로 보고, 메일은 보내지 않고 성공처럼 응답한다.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    console.warn('Class inquiry honeypot triggered — not emailed')
    return res.status(200).json({ ok: true })
  }

  let fields
  try {
    fields = normalizeFields(body.fields)
  } catch (err) {
    if (err instanceof InvalidInput) return res.status(400).json({ ok: false, error: 'invalid_field', field: err.message })
    throw err
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set — class inquiry not emailed:', fields.org)
    return res.status(500).json({ ok: false, error: 'mail_not_configured' })
  }

  const now = new Date()
  const receivedAt = formatKst(now)
  const rows = buildRows(fields)

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send(
      {
        from: NOTIFY_FROM,
        to: [NOTIFY_TO],
        replyTo: fields.email,
        subject: `[강의 문의] ${fields.org}`,
        text: buildText({ receivedAt, rows }),
        html: buildHtml({ receivedAt, rows, replyTo: fields.email })
      },
      // 같은 문의를 같은 분 안에 여러 번 보내도 메일은 한 번만 나가게 한다.
      { idempotencyKey: `class-inquiry/${digestOf(fields)}/${now.toISOString().slice(0, 16)}` }
    )

    if (error) {
      console.error('Resend send error (class inquiry):', error.message)
      return res.status(502).json({ ok: false, error: 'mail_failed' })
    }

    console.log('Class inquiry emailed:', data?.id)
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Failed to send class inquiry email:', err)
    return res.status(502).json({ ok: false, error: 'mail_failed' })
  }
}
