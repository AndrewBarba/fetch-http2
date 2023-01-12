# fetch-http2

Native http2 `fetch` implementation for Node.js

> This module does not attempt to make any http1.1 connections. You need to know ahead of time that the endpoint you're requesting supports http2

```typescript
import { fetch } from 'fetch-http2'

const res = await fetch('https://httpbin.org/json')
const json = await res.json()
```
