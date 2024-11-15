import type { ClientHttp2Stream, IncomingHttpHeaders, OutgoingHttpHeaders } from 'node:http2'
import { Http2Client, Http2TimeoutError } from './http2'

export type RequestInfo = string | URL

export interface RequestInit {
  method?: string
  headers?: OutgoingHttpHeaders
  body?: string | Buffer
  keepAlive?: boolean | number
  timeout?: number
}

export interface Response {
  readonly headers: IncomingHttpHeaders
  readonly ok: boolean
  readonly status: number
  readonly statusText: string
  readonly url: string

  readonly body: ClientHttp2Stream

  buffer(): Promise<Buffer>
  arrayBuffer(): Promise<ArrayBuffer>
  json<T = any>(): Promise<T>
  text(): Promise<string>

  close(): void
  destroy(): void
}

export { Http2TimeoutError }

export class FetchClient {
  http2Client: Http2Client

  constructor() {
    this.http2Client = new Http2Client()
  }

  async fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    // Parse input url
    const url = typeof input === 'string' ? new URL(input) : input

    // Send http request
    const res = await this.http2Client.request(url, {
      method: init?.method,
      headers: init?.headers,
      body: init?.body,
      keepAlive: init?.keepAlive,
      timeout: init?.timeout
    })

    // Auto close if keepAlive is false
    if (init?.keepAlive === false) {
      res.body.once('end', res.destroy)
    }

    // Build response
    return {
      headers: res.headers,
      status: res.status,
      statusText: res.statusText,
      ok: res.status >= 200 && res.status < 300,
      url: url.href,
      body: res.body,
      close: res.close,
      destroy: res.destroy,
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
}

const sharedClient = new FetchClient()

export async function fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  return sharedClient.fetch(input, init)
}
