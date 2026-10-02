/**
 * Claude Design에서 export한 「일러스트 의뢰 접수」 번들(index.html)에
 * 실제 전송 기능을 넣어 illustration-inquiry.html 로 만든다.
 *
 * 번들 구조: <script type="__bundler/template">"<JSON 문자열로 인코딩된 페이지 HTML>"</script>
 * 질문 · 선택지 · 분기 · 디자인은 건드리지 않고 아래만 바꾼다.
 *   1. submit — /api/illustration-inquiry 로 보내고, 성공 응답일 때만 완료 화면으로
 *   2. 접수 버튼 — 전송 중에는 「의뢰 접수 중…」 + 비활성
 *   3. 실패 메시지 — 버튼 아래, 입력 내용은 그대로 유지
 *   4. 탭 제목
 *
 * 사용법: node tools/patch-inquiry-bundle.mjs <원본 index.html> illustration-inquiry.html
 * Design에서 폼을 다시 export했다면 이 스크립트를 다시 실행하면 된다.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [src, out] = process.argv.slice(2)
if (!src || !out) {
  console.error('사용법: node tools/patch-inquiry-bundle.mjs <원본 index.html> <출력 html>')
  process.exit(1)
}

const replacements = [
  {
    name: 'submit 핸들러',
    from: "submit = () => this.goId('done');",
    to: `submit = () => {
    if (this.state.sending) return;
    const a = this.state.a;
    let h = 0; const s = (a.email || '') + (a.name || '') + (a.brief || '');
    for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) % 9000;
    this.setState({ sending: true, sendErr: false });
    fetch('/api/illustration-inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refCode: 'YW-' + (1000 + h), answers: a, submittedAt: new Date().toISOString() })
    })
      .then((res) => res.json().catch(() => ({})).then((data) => res.ok && data && data.ok === true))
      .catch(() => false)
      .then((ok) => {
        if (ok) { this.setState({ sending: false }); this.goId('done'); }
        else { this.setState({ sending: false, sendErr: true }); }
      });
  };`
  },
  {
    name: '화면 이동 시 실패 메시지 지우기',
    from: 'this.setState({ id, flip: !this.state.flip, err: null, help: null });',
    to: 'this.setState({ id, flip: !this.state.flip, err: null, help: null, sendErr: false });'
  },
  {
    name: '버튼 상태 값',
    from: 'o.next = this.next; o.back = this.back;',
    to: `o.sending = !!this.state.sending;
    o.sendErr = !!this.state.sendErr;
    o.submitLabel = o.sending ? '의뢰 접수 중…' : '이 내용으로 의뢰 접수하기';
    o.submitWait = o.sending ? 'wait;pointer-events:none;opacity:0.6' : 'pointer';
    o.next = this.next; o.back = this.back;`
  },
  {
    name: '접수 버튼',
    from: '<button sc-camel-on-click="{{ submit }}" style="width:100%;min-height:72px;border:1px solid #3F5F89;background:#3F5F89;border-radius:6px;color:#FFFFFF;font-size:17px;font-weight:500;cursor:pointer;transition:background 200ms" style-hover="background:#33507A">이 내용으로 의뢰 접수하기</button>',
    to: `<button sc-camel-on-click="{{ submit }}" aria-disabled="{{ sending }}" aria-busy="{{ sending }}" style="width:100%;min-height:72px;border:1px solid #3F5F89;background:#3F5F89;border-radius:6px;color:#FFFFFF;font-size:17px;font-weight:500;cursor:{{ submitWait }};transition:background 200ms" style-hover="background:#33507A">{{ submitLabel }}</button>
                <sc-if value="{{ sendErr }}">
                  <p role="alert" style="margin:16px 0 0;font-size:15px;color:#986F5C;line-height:1.7">문의 전송 중 문제가 발생했어요.<br>잠시 후 다시 시도해 주세요.</p>
                </sc-if>`
  }
]

const lines = readFileSync(src, 'utf8').split('\n')
const tplLine = lines.findIndex((l, i) => i > 0 && /<script type="__bundler\/template">/.test(lines[i - 1]))
if (tplLine === -1) throw new Error('__bundler/template 블록을 찾지 못했습니다.')

let template = JSON.parse(lines[tplLine])
if (template.includes('/api/illustration-inquiry')) throw new Error('이미 패치된 파일입니다. Design에서 export한 원본으로 실행하세요.')

for (const r of replacements) {
  const count = template.split(r.from).length - 1
  if (count !== 1) throw new Error(`「${r.name}」 위치를 찾지 못했습니다 (${count}곳). Design 쪽 코드가 바뀐 것 같습니다.`)
  template = template.replace(r.from, () => r.to)
}

// 원본처럼 '</'를 이스케이프해야 템플릿 안의 '</script>'가 바깥 <script>를 닫지 않는다.
const BACKSLASH = String.fromCharCode(92)
lines[tplLine] = JSON.stringify(template).split('</').join('<' + BACKSLASH + 'u002F')

const patched = lines
  .join('\n')
  .replace('<title>Bundled Page</title>', '<title>일러스트 의뢰 접수 | 유리나무</title>')

writeFileSync(out, patched)
console.log(`패치 완료: ${out} (${patched.length.toLocaleString()} bytes)`)
