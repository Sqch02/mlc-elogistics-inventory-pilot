import { describe, it, expect } from 'vitest'
import { GET } from './route'

describe('GET /api/health', () => {
  it('should return status ok', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('ok')
  })

  it('should return a timestamp', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.timestamp).toBeDefined()
    expect(new Date(data.timestamp).getTime()).not.toBeNaN()
  })

  it('should return valid ISO timestamp', async () => {
    const before = new Date().toISOString()
    const response = await GET()
    const data = await response.json()
    const after = new Date().toISOString()

    expect(data.timestamp >= before).toBe(true)
    expect(data.timestamp <= after).toBe(true)
  })
})
