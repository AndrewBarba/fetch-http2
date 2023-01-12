import { setInterval, clearInterval } from 'node:timers'
import {
  connect,
  constants,
  ClientHttp2Session,
  IncomingHttpHeaders,
  OutgoingHttpHeaders,
  ClientHttp2Stream
} from 'node:http2'

interface _FetchResponse {
  status: number
  headers: IncomingHttpHeaders
  body: ClientHttp2Stream
  buffer: () => Promise<Buffer>
}

interface _FetchOptions {
  method?: string
  headers?: OutgoingHttpHeaders
  body?: string | Buffer
  timeout?: number
  keepAlive?: number
}

export async function _fetch(url: URL, options?: _FetchOptions): Promise<_FetchResponse> {
  // Construct url
  const { origin, pathname, search } = url

  // Find or create http client
  const client = _httpClient(origin, { keepAlive: options?.keepAlive })

  // Build http request
  const req = client.request(
    {
      ...options?.headers,
      [constants.HTTP2_HEADER_METHOD]: options?.method ?? 'GET',
      [constants.HTTP2_HEADER_PATH]: pathname + search
    },
    {
      endStream: !options?.body
    }
  )

  // Write request body if needed
  if (options?.body) {
    req.write(options.body)
  }

  // Send the request
  req.end()

  // Fetch the headers
  const { headers, status } = await _responseHeaders(req, options)

  return {
    status,
    headers,
    body: req,
    buffer: () => _responseBuffer(req)
  }
}

const _clientCache: Record<string, ClientHttp2Session | undefined> = {}

function _httpClient(origin: string, options?: { keepAlive?: number }): ClientHttp2Session {
  // Look for cached client
  const cachedClient = _clientCache[origin]

  // Return cached client if we have one
  if (cachedClient) {
    return cachedClient
  }

  // Create a new client
  const client = connect(origin)

  // Set client cache
  _clientCache[origin] = client

  // Setup keep alive
  let timer: NodeJS.Timer | undefined

  // Send a ping every 5s to keep client alive
  if (options?.keepAlive) {
    timer = setInterval(() => client.ping(noop), options.keepAlive)
  }

  // Create function to destroy client
  const closeClient = () => {
    clearInterval(timer)
    _destroyClient(client, origin)
  }

  // Handle client errors
  client.on('close', closeClient)
  client.on('goaway', closeClient)
  client.on('error', closeClient)
  client.on('frameError', closeClient)
  client.on('timeout', closeClient)

  // Return the client
  return client
}

function _destroyClient(client: ClientHttp2Session, origin: string) {
  // Remove the client from cache
  _clientCache[origin] = undefined

  // Close the client
  if (client.closed !== true) {
    client.close()
  }
}

function _responseHeaders(
  req: ClientHttp2Stream,
  options?: { timeout?: number }
): Promise<{ status: number; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    if (options?.timeout) {
      req.setTimeout(options.timeout, reject)
    }
    req.on('error', reject)
    req.on('response', (headers) =>
      resolve({
        headers,
        status: Number(headers[constants.HTTP2_HEADER_STATUS])
      })
    )
  })
}

function _responseBuffer(req: ClientHttp2Stream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('error', reject)
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

function noop() {
  // ignore
}
