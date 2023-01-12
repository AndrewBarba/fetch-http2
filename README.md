# fetch-http2

[![npm version](https://badge.fury.io/js/fetch-http2.svg)](https://badge.fury.io/js/fetch-http2)
[![Twitter](https://img.shields.io/badge/twitter-@andrew_barba-blue.svg?style=flat)](http://twitter.com/andrew_barba)

Native http2 `fetch` implementation for Node.js

> This module does not attempt to make any http1.1 connections. You need to know ahead of time that the endpoint you're requesting supports http2

```typescript
import { fetch } from 'fetch-http2'

const res = await fetch('https://httpbin.org/json')
const json = await res.json()
```
