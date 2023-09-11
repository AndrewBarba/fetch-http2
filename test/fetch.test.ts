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
})
