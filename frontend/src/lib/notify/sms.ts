import crypto from 'crypto'

function getSensConfig() {
  const serviceId = process.env.SENS_SERVICE_ID
  const accessKey = process.env.SENS_ACCESS_KEY
  const secretKey = process.env.SENS_SECRET_KEY
  const caller = process.env.SENS_CALLER

  if (!serviceId || !accessKey || !secretKey || !caller) {
    throw new Error('SENS env is not set properly')
  }
  return { serviceId, accessKey, secretKey, caller }
}

function makeSignature(opts: {
  method: string
  url: string
  timestamp: string
  accessKey: string
  secretKey: string
}) {
  const { method, url, timestamp, accessKey, secretKey } = opts
  const message = `${method} ${url}\n${timestamp}\n${accessKey}`
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64')
}

export async function sendSms(params: {
  to: string // 숫자만: 01012345678
  content: string
}) {
  const { serviceId, accessKey, secretKey, caller } = getSensConfig()

  const method = 'POST'
  const urlPath = `/sms/v2/services/${serviceId}/messages`
  const timestamp = Date.now().toString()
  const signature = makeSignature({ method, url: urlPath, timestamp, accessKey, secretKey })

  // SENS는 국제번호/하이픈 처리 민감 → 숫자만 남기는 게 안전
  const to = params.to.replaceAll(/[^0-9]/g, '')

  const res = await fetch(`https://sens.apigw.ntruss.com${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'x-ncp-apigw-timestamp': timestamp,
      'x-ncp-iam-access-key': accessKey,
      'x-ncp-apigw-signature-v2': signature,
    },
    body: JSON.stringify({
      type: 'SMS',
      from: caller.replaceAll(/[^0-9]/g, ''),
      content: params.content,
      messages: [{ to }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SENS SMS failed: ${res.status} ${text}`)
  }

  return res.json()
}
