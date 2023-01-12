import { ClientHttp2Stream, OutgoingHttpHeaders } from 'node:http2'
import { _fetch } from './http2'

export type RequestInfo = string | URL

export interface RequestInit {
  method?: string
  headers?: OutgoingHttpHeaders
  body?: string | Buffer
  keepAlive?: number
  timeout?: number
}

export interface Response {
  readonly headers: OutgoingHttpHeaders
  readonly ok: boolean
  readonly status: number
  readonly url: string

  readonly body: ClientHttp2Stream

  readonly buffer: () => Promise<Buffer>
  readonly arrayBuffer: () => Promise<ArrayBuffer>
  readonly json: () => Promise<unknown>
  readonly text: () => Promise<string>
}

export async function fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  // Parse input url
  const url = typeof input === 'string' ? new URL(input) : input

  // Send http request
  const res = await _fetch(url, {
    method: init?.method,
    headers: init?.headers,
    body: init?.body,
    keepAlive: init?.keepAlive,
    timeout: init?.timeout
  })

  // Build response
  return {
    headers: res.headers,
    status: res.status,
    ok: res.status >= 200 && res.status < 400,
    url: url.href,
    body: res.body,
    async buffer() {
      return res.buffer()
    },
    async arrayBuffer() {
      const buffer = await res.buffer()
      return Uint8Array.from(buffer)
    },
    async text() {
      const buffer = await res.buffer()
      return buffer.toString('utf8')
    },
    async json() {
      const buffer = await res.buffer()
      const text = buffer.toString('utf8')
      return JSON.parse(text)
    }
  }
}
