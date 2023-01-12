# fetch-http2

Native http2 `fetch` implementation for Node.js

```typescript
import { fetch } from 'fetch-http2'

const res = await fetch('https://httpbin.org/json')
const json = await res.json()
```
