import { constants } from 'node:http2'
import { assert } from 'chai'
import { describe, it } from 'vitest'
import { fetch } from '../src/fetch'

describe('fetch', () => {
  it('should fetch a json response', async () => {
    const res = await fetch('https://httpbin.org/json')
    const json = await res.json()
    assert.exists(json.slideshow)
    assert.equal(json.slideshow.title, 'Sample Slide Show')
  })

  it('should timeout', async () => {
    let error
    try {
      await fetch('https://httpbin.org/json', {
        timeout: 1
      })
    } catch (_error) {
      error = _error
    }
    assert.exists(error)
    assert.equal(error.name, 'TimeoutError')
    assert.equal(error.code, constants.NGHTTP2_CANCEL)
  })

  it('should fetch and close', async () => {
    const res = await fetch('https://httpbin.org/json')
    res.close()
    assert.isTrue(res.body.closed)
    assert.isFalse(res.body.destroyed)
  })

  it('should fetch and destroy', async () => {
    const res = await fetch('https://httpbin.org/json')
    res.destroy()
    assert.isTrue(res.body.closed)
    assert.isTrue(res.body.destroyed)
  })

  it('should fetch without keepAlive', async () => {
    const res = await fetch('https://httpbin.org/json', { keepAlive: false })
    await res.json()
    assert.isTrue(res.body.closed)
    assert.isTrue(res.body.destroyed)
  })

  it('should fetch with keepAlive', async () => {
    const res = await fetch('https://httpbin.org/json', { keepAlive: true })
    await res.json()
    assert.isFalse(res.body.closed)
    assert.isFalse(res.body.destroyed)
  })

  it('should fetch concurrently', async () => {
    const url = 'https://whoami.app.swift.cloud'
    const promises: any[] = []
    for (let i = 0; i < 100; i++) {
      promises.push(fetch(url).then((res) => res.json()))
    }
    const bodies = await Promise.all(promises)
    for (const body of bodies) {
      assert.equal(body.httpVersion, '2')
    }
  })
})
