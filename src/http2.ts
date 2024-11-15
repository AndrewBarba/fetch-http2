import {
  constants,
  type ClientHttp2Session,
  type ClientHttp2Stream,
  type IncomingHttpHeaders,
  type OutgoingHttpHeaders,
  connect
} from 'node:http2'
import { clearInterval, setInterval } from 'node:timers'

interface Http2FetchResponse {
  status: number
  statusText: string
  headers: IncomingHttpHeaders
  body: ClientHttp2Stream
  buffer: () => Promise<Buffer>
  close: () => void
  destroy: () => void
}

interface Http2FetchOptions {
  method?: string
  headers?: OutgoingHttpHeaders
  body?: string | Buffer
  timeout?: number
  keepAlive?: number | boolean
}

const defaultPingInterval = 20_000

export class Http2TimeoutError extends Error {
  code: string | number
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
    this.code = constants.NGHTTP2_CANCEL
  }
}

export class Http2Client {
  clientCache: Record<string, ClientHttp2Session | undefined> = {}

  async request(url: URL, options?: Http2FetchOptions): Promise<Http2FetchResponse> {
    // Construct url
    const { origin, pathname, search } = url

    // Find or create http client
    const client = this.httpClient(origin, {
      keepAlive: options?.keepAlive !== false,
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
    const { headers, status } = await sendRequest(req, options)

    // Get status text
    const statusText = getStatusText(status)

    return {
      status,
      statusText,
      headers,
      body: req,
      buffer: () => responseBuffer(req),
      close: () => {
        if (req.closed !== true) {
          req.close()
        }
      },
      destroy: () => {
        if (req.destroyed !== true) {
          req.destroy()
        }
        this.destroy(client, origin)
      }
    }
  }

  private httpClient(
    origin: string,
    options: { keepAlive: boolean; pingInterval: number }
  ): ClientHttp2Session {
    // Look for cached client
    const cachedClient = this.clientCache[origin]

    // Return cached client if we have one
    if (cachedClient) {
      return cachedClient
    }

    // Create a new client
    const client = connect(origin)

    // Set client cache
    if (options.keepAlive) {
      this.clientCache[origin] = client
    }

    // Setup keep alive
    let timer: NodeJS.Timeout | undefined

    // Send a ping every to keep client alive
    if (options.keepAlive && options.pingInterval > 0) {
      timer = setInterval(() => client.ping(noop), options.pingInterval).unref()
    }

    // Create function to destroy client
    const closeClient = () => {
      clearInterval(timer)
      this.destroy(client, origin)
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

  destroy(client: ClientHttp2Session, origin: string) {
    // Remove the client from cache
    this.clientCache[origin] = undefined

    // Close the client
    if (client.closed !== true) {
      client.close()
    }
  }
}

function sendRequest(
  req: ClientHttp2Stream,
  options?: Http2FetchOptions
): Promise<{ status: number; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    // Write request body if needed
    if (options?.body) {
      req.write(options.body)
    }

    // Apply optional timeout
    if (typeof options?.timeout === 'number') {
      req.setTimeout(options.timeout, () => {
        req.close(constants.NGHTTP2_CANCEL)
        reject(new Http2TimeoutError(`Request timed out after ${options.timeout}ms`))
      })
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

function responseBuffer(req: ClientHttp2Stream): Promise<Buffer> {
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
