import { NextResponse } from 'next/server'
import { validateAndDecodeAccessKey } from '../../../../lib/nfe-key'

const DEFAULT_CONSULTADANFE_URL = 'https://consultadanfe.com/api/v1/consulta'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: 'Corpo JSON inválido.' },
      { status: 400 },
    )
  }

  const accessKey =
    typeof body === 'object' && body !== null && 'accessKey' in body && typeof body.accessKey === 'string'
      ? body.accessKey
      : ''

  const validation = validateAndDecodeAccessKey(accessKey)
  if (!validation.valid) {
    return NextResponse.json(
      { code: 'INVALID_ACCESS_KEY', message: validation.error },
      { status: 400 },
    )
  }

  const customApiUrl = process.env.NFE_LOOKUP_API_URL
  const customApiKey = process.env.NFE_LOOKUP_API_KEY

  // 1. Provedor fiscal customizado (quando configurado via variáveis de ambiente)
  if (customApiUrl && customApiKey) {
    try {
      const upstream = await fetch(customApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customApiKey}`,
        },
        body: JSON.stringify({ accessKey: validation.data.accessKey }),
        cache: 'no-store',
      })

      if (upstream.status === 404) {
        return NextResponse.json(
          { code: 'NOT_FOUND', message: 'NF-e não localizada para a chave informada.' },
          { status: 404 },
        )
      }

      if (upstream.status === 429) {
        return NextResponse.json(
          {
            code: 'RATE_LIMITED',
            message: 'Limite temporário de consultas atingido. Tente novamente depois ou envie o arquivo XML.',
          },
          { status: 429 },
        )
      }

      if (!upstream.ok) {
        return NextResponse.json(
          {
            code: 'UPSTREAM_ERROR',
            message: 'Não foi possível consultar a nota no provedor configurado. Envie o arquivo XML como alternativa.',
          },
          { status: 502 },
        )
      }

      const payload = (await upstream.json()) as { xml?: string; pdfBase64?: string; pdf_base64?: string }
      if (payload.xml) {
        return NextResponse.json({ xml: payload.xml, provider: 'custom' }, { status: 200 })
      }
      const pdfBase64 = payload.pdfBase64 || payload.pdf_base64
      if (pdfBase64) {
        return NextResponse.json(
          { pdfBase64, accessKey: validation.data.accessKey, provider: 'custom' },
          { status: 200 },
        )
      }

      return NextResponse.json(
        { code: 'EMPTY_RESPONSE', message: 'O provedor externo não retornou XML nem PDF da NF-e.' },
        { status: 502 },
      )
    } catch {
      return NextResponse.json(
        {
          code: 'NETWORK_ERROR',
          message: 'Falha de comunicação ao consultar a chave. Envie o arquivo XML para processar localmente.',
        },
        { status: 502 },
      )
    }
  }

  // 2. API pública gratuita do ConsultaDanfe (NF-e modelo 55)
  if (validation.data.modelo !== '55') {
    return NextResponse.json(
      {
        code: 'UNSUPPORTED_MODEL',
        message:
          'A consulta gratuita por chave suporta apenas NF-e (modelo 55). Para NFC-e (modelo 65), envie o arquivo XML.',
      },
      { status: 400 },
    )
  }

  try {
    const upstream = await fetch(DEFAULT_CONSULTADANFE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        chave: validation.data.accessKey,
        format: 'json',
      }),
      cache: 'no-store',
    })

    if (upstream.status === 404) {
      return NextResponse.json(
        {
          code: 'NOT_FOUND',
          message:
            'Nota não encontrada na consulta gratuita por chave (ela atende NF-e do mês atual, ou mês anterior antes do dia 15). Para notas mais antigas, envie o arquivo XML.',
        },
        { status: 404 },
      )
    }

    if (upstream.status === 429) {
      return NextResponse.json(
        {
          code: 'RATE_LIMITED',
          message:
            'Limite temporário de consultas gratuitas atingido. Aguarde um instante ou envie o arquivo XML da nota.',
        },
        { status: 429 },
      )
    }

    const contentType = upstream.headers.get('content-type') || ''
    if (!upstream.ok) {
      let detail = ''
      if (contentType.includes('application/json')) {
        const errJson = (await upstream.json().catch(() => null)) as { message?: string; error?: string } | null
        detail = errJson?.message || errJson?.error || ''
      }
      return NextResponse.json(
        {
          code: 'UPSTREAM_ERROR',
          message:
            detail ||
            'Não foi possível obter o DANFE pela chave no momento. Envie o arquivo XML da nota para gerar o PDF localmente.',
        },
        { status: upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502 },
      )
    }

    const payload = (await upstream.json()) as {
      status?: string
      pdf_base64?: string
      xml?: string
      message?: string
    }

    if (payload.xml) {
      return NextResponse.json({ xml: payload.xml, provider: 'consultadanfe' }, { status: 200 })
    }

    if (payload.pdf_base64) {
      return NextResponse.json(
        {
          pdfBase64: payload.pdf_base64,
          accessKey: validation.data.accessKey,
          numero: validation.data.numero,
          provider: 'consultadanfe',
        },
        { status: 200 },
      )
    }

    return NextResponse.json(
      {
        code: 'EMPTY_PDF',
        message:
          payload.message ||
          'A consulta não retornou o PDF do DANFE. Envie o arquivo XML da nota para gerar localmente.',
      },
      { status: 502 },
    )
  } catch {
    return NextResponse.json(
      {
        code: 'NETWORK_ERROR',
        message:
          'Falha de conexão com o serviço de consulta por chave. Envie o arquivo XML da nota para gerar o DANFE localmente.',
      },
      { status: 502 },
    )
  }
}
