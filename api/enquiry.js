const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit'
const WEB3FORMS_ACCESS_KEY = '0a985bb9-20c2-4a20-979f-4010cd47be7a'
const SUPPORT_EMAIL = 'debenhamsclaimdesk@gmail.com'

const limits = {
  Reference: 40,
  'Full name': 100,
  email: 160,
  'Phone number': 24,
  'Order number': 40,
  Topic: 80,
  Message: 2000,
}

function clean(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { success: false, message: 'Method not allowed.' })
  }

  try {
    const input = req.body && typeof req.body === 'object' ? req.body : {}
    if (clean(input.website, 200)) {
      return json(res, 200, { success: true })
    }

    const enquiry = {
      Reference: clean(input.Reference, limits.Reference),
      'Full name': clean(input['Full name'], limits['Full name']),
      email: clean(input.email, limits.email).toLowerCase(),
      'Phone number': clean(input['Phone number'], limits['Phone number']),
      'Order number': clean(input['Order number'], limits['Order number']) || 'Not provided',
      Topic: clean(input.Topic, limits.Topic),
      Message: clean(input.Message, limits.Message),
    }

    const phoneDigits = enquiry['Phone number'].replace(/\D/g, '')
    if (
      enquiry['Full name'].length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email) ||
      phoneDigits.length < 7 || phoneDigits.length > 15 ||
      !enquiry.Topic || enquiry.Message.length < 10
    ) {
      return json(res, 400, { success: false, message: 'Please check the required fields and try again.' })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    try {
      const response = await fetch(WEB3FORMS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'DebenhamsCustomerCare/1.0',
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: clean(input._subject, 180) || '[Debenhams Customer Care] New website enquiry',
          from_name: 'Debenhams Customer Care Website',
          name: enquiry['Full name'],
          email: enquiry.email,
          phone: enquiry['Phone number'],
          order_number: enquiry['Order number'],
          topic: enquiry.Topic,
          message: enquiry.Message,
          reference: enquiry.Reference,
          privacy_consent: 'Accepted',
          botcheck: '',
        }),
        signal: controller.signal,
      })

      const contentType = response.headers.get('content-type') || ''
      const result = contentType.includes('application/json')
        ? await response.json()
        : { success: false, message: await response.text() }

      if (!response.ok || !(result.success === true || result.success === 'true')) {
        console.error('Web3Forms rejected enquiry', { status: response.status, message: result.message })
        return json(res, 502, {
          success: false,
          message: `Our email service is temporarily unavailable. Please try again shortly or email ${SUPPORT_EMAIL}.`,
        })
      }

      return json(res, 200, { success: true })
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    console.error('Enquiry relay failed', error)
    return json(res, 502, {
      success: false,
      message: `We could not send your enquiry automatically. Please try again shortly or email ${SUPPORT_EMAIL}.`,
    })
  }
}
