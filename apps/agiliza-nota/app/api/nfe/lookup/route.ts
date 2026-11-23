import { NextResponse } from 'next/server'
import { validateAndDecodeAccessKey } from '../../../../lib/nfe-key'

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

  const apiUrl = process.env.NFE_LOOKUP_API_URL
  const apiKey = process.env.NFE_LOOKUP_API_KEY

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      {
        code: 'LOOKUP_NOT_CONFIGURED',
        message:
          'Consulta automática por chave não está habilitada nesta instância. Envie o arquivo XML da NF-e para gerar o DANFE em PDF gratuitamente no navegador.',
      },
      { status: 503 },
    )
  }

  try {
    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
          message: 'Não foi possível consultar a nota no provedor externo. Envie o arquivo XML como alternativa.',
        },
        { status: 502 },
      )
    }

    const payload = (await upstream.json()) as { xml?: string }
    if (!payload.xml) {
      return NextResponse.json(
        { code: 'EMPTY_XML', message: 'O provedor externo não retornou o XML da NF-e.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ xml: payload.xml }, { status: 200 })
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
