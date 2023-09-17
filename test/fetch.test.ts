import { describe, it } from 'vitest'
import { assert } from 'chai'
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
    assert.equal(error.message, 'Request Timeout')
  })
})
