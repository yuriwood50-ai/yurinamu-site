/**
 * class.html 강의 문의 폼 — /api/class-inquiry로 보내고,
 * 성공 응답일 때만 폼 자리를 접수 완료 문구로 바꾼다.
 */
(function () {
  const form = document.getElementById('class-inquiry-form')
  if (!form) return

  const done = document.getElementById('ci-done')
  const errorBox = document.getElementById('ci-error')
  const button = form.querySelector('button[type="submit"]')
  const buttonLabel = button.textContent
  const FAIL_MESSAGE = '전송이 안 됐어요. yuriwood50@gmail.com으로 직접 보내 주세요.'
  let sending = false

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (sending) return

    // 공백만 입력한 칸도 빈칸으로 보고 브라우저 기본 안내를 띄운다.
    for (const el of form.querySelectorAll('[required]')) {
      el.value = el.value.trim()
    }
    if (!form.reportValidity()) return

    sending = true
    button.disabled = true
    button.textContent = '보내는 중…'
    errorBox.hidden = true

    const fields = {
      org: form.elements.org.value,
      email: form.elements.email.value,
      message: form.elements.message.value
    }

    fetch('/api/class-inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields, website: form.elements.website.value })
    })
      .then((res) => res.json().catch(() => ({})).then((data) => res.ok && data && data.ok === true))
      .catch(() => false)
      .then((ok) => {
        sending = false
        if (ok) {
          form.hidden = true
          done.hidden = false
          done.focus()
        } else {
          button.disabled = false
          button.textContent = buttonLabel
          errorBox.textContent = FAIL_MESSAGE
          errorBox.hidden = false
        }
      })
  })

  // 이메일 주소 복사 버튼
  for (const btn of document.querySelectorAll('.copy-btn[data-copy]')) {
    const label = btn.textContent
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy
      const copied = navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard'))
      copied
        .then(() => { btn.textContent = '복사됐어요' })
        .catch(() => { btn.textContent = '복사 안 됨' })
        .then(() => setTimeout(() => { btn.textContent = label }, 2000))
    })
  }
})()
