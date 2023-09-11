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
  statusText: string
  headers: IncomingHttpHeaders
  body: ClientHttp2Stream
  buffer: () => Promise<Buffer>
}

interface _FetchOptions {
  method?: string
  headers?: OutgoingHttpHeaders
  body?: string | Buffer
  timeout?: number
  keepAlive?: number | boolean
}

const defaultPingInterval = 20_000

export async function _fetch(url: URL, options?: _FetchOptions): Promise<_FetchResponse> {
  // Construct url
  const { origin, pathname, search } = url

  // Find or create http client
  const client = _httpClient(origin, {
    pingInterval: parsePingInterval(options?.keepAlive)
  })

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

  // Fetch the headers
  const { headers, status } = await _sendRequest(req, options)

  // Get status text
  const statusText = getStatusText(status)

  return {
    status,
    statusText,
    headers,
    body: req,
    buffer: () => _responseBuffer(req)
  }
}

const _clientCache: Record<string, ClientHttp2Session | undefined> = {}

function _httpClient(origin: string, options: { pingInterval: number }): ClientHttp2Session {
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

  // Send a ping every to keep client alive
  if (options.pingInterval > 0) {
    timer = setInterval(() => client.ping(noop), options.pingInterval).unref()
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

function _sendRequest(
  req: ClientHttp2Stream,
  options?: _FetchOptions
): Promise<{ status: number; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    // Write request body if needed
    if (options && options.body) {
      req.write(options.body)
    }

    // Apply optional timeout
    if (options && typeof options.timeout === 'number') {
      req.setTimeout(options.timeout, reject)
    }

    // Add error handler
    req.on('error', reject)

    // Listen for response headers
    req.on('response', (headers) =>
      resolve({
        headers,
        status: Number(headers[constants.HTTP2_HEADER_STATUS])
      })
    )

    // Send the request
    req.end()
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

function parsePingInterval(keepAlive?: boolean | number): number {
  switch (typeof keepAlive) {
    case 'number':
      return keepAlive
    case 'boolean':
      return keepAlive ? defaultPingInterval : 0
    case 'undefined':
      return defaultPingInterval
  }
}

function getStatusText(statusCode: number): string {
  const httpStatuses: { [index: number]: string } = {
    100: 'Continue',
    101: 'Switching Protocols',
    102: 'Processing',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    207: 'Multi-Status',
    208: 'Already Reported',
    226: 'IM Used',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    308: 'Permanent Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Payload Too Large',
    414: 'URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Range Not Satisfiable',
    417: 'Expectation Failed',
    418: "I'm a teapot",
    421: 'Misdirected Request',
    422: 'Unprocessable Entity',
    423: 'Locked',
    424: 'Failed Dependency',
    425: 'Too Early',
    426: 'Upgrade Required',
    428: 'Precondition Required',
    429: 'Too Many Requests',
    431: 'Request Header Fields Too Large',
    451: 'Unavailable For Legal Reasons',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
    506: 'Variant Also Negotiates',
    507: 'Insufficient Storage',
    508: 'Loop Detected',
    510: 'Not Extended',
    511: 'Network Authentication Required'
  }
  return httpStatuses[statusCode] || 'Unknown'
}
