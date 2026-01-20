import { describe, it, expect } from 'vitest'
import {
  sanitizeSearchInput,
  sanitizeExactMatch,
  escapePercentForLike,
} from './sanitize'

describe('sanitizeSearchInput', () => {
  describe('basic functionality', () => {
    it('should return empty string for empty input', () => {
      expect(sanitizeSearchInput('')).toBe('')
    })

    it('should return empty string for null-like input', () => {
      expect(sanitizeSearchInput(null as unknown as string)).toBe('')
      expect(sanitizeSearchInput(undefined as unknown as string)).toBe('')
    })

    it('should preserve normal text', () => {
      expect(sanitizeSearchInput('hello world')).toBe('hello world')
      expect(sanitizeSearchInput('test123')).toBe('test123')
    })

    it('should preserve accented characters', () => {
      expect(sanitizeSearchInput('café résumé')).toBe('café résumé')
      expect(sanitizeSearchInput('Ménopause')).toBe('Ménopause')
    })
  })

  describe('dangerous character removal', () => {
    it('should remove backslashes', () => {
      expect(sanitizeSearchInput('test\\injection')).toBe('testinjection')
      expect(sanitizeSearchInput('path\\to\\file')).toBe('pathtofile')
    })

    it('should remove commas', () => {
      expect(sanitizeSearchInput('value1,value2')).toBe('value1value2')
      expect(sanitizeSearchInput('a,b,c,d')).toBe('abcd')
    })

    it('should remove parentheses', () => {
      expect(sanitizeSearchInput('test(injection)')).toBe('testinjection')
      expect(sanitizeSearchInput('(malicious)')).toBe('malicious')
    })

    it('should trim whitespace', () => {
      expect(sanitizeSearchInput('  hello  ')).toBe('hello')
      expect(sanitizeSearchInput('\t\ntest\t\n')).toBe('test')
    })
  })

  describe('PostgREST operator injection prevention', () => {
    it('should remove .eq. operator', () => {
      expect(sanitizeSearchInput('value.eq.injection')).toBe('value injection')
    })

    it('should remove .ilike. operator', () => {
      expect(sanitizeSearchInput('value.ilike.%hack%')).toBe('value %hack%')
    })

    it('should remove .neq. operator', () => {
      expect(sanitizeSearchInput('test.neq.value')).toBe('test value')
    })

    it('should remove .gt. and .gte. operators', () => {
      expect(sanitizeSearchInput('num.gt.100')).toBe('num 100')
      expect(sanitizeSearchInput('num.gte.100')).toBe('num 100')
    })

    it('should remove .lt. and .lte. operators', () => {
      expect(sanitizeSearchInput('num.lt.100')).toBe('num 100')
      expect(sanitizeSearchInput('num.lte.100')).toBe('num 100')
    })

    it('should remove .like. operator', () => {
      expect(sanitizeSearchInput('col.like.%pattern%')).toBe('col %pattern%')
    })

    it('should remove .is. operator', () => {
      expect(sanitizeSearchInput('col.is.null')).toBe('col null')
    })

    it('should remove .in. operator', () => {
      expect(sanitizeSearchInput('col.in.value')).toBe('col value')
    })

    it('should remove .not. operator', () => {
      expect(sanitizeSearchInput('col.not.value')).toBe('col value')
    })

    it('should remove .or. and .and. operators', () => {
      expect(sanitizeSearchInput('a.or.b')).toBe('a b')
      expect(sanitizeSearchInput('a.and.b')).toBe('a b')
    })

    it('should be case insensitive for operators', () => {
      expect(sanitizeSearchInput('value.EQ.injection')).toBe('value injection')
      expect(sanitizeSearchInput('value.ILIKE.test')).toBe('value test')
    })
  })

  describe('preserving safe periods', () => {
    it('should preserve periods in email addresses', () => {
      expect(sanitizeSearchInput('user.name@email.com')).toBe('user.name@email.com')
    })

    it('should preserve periods in file names', () => {
      expect(sanitizeSearchInput('document.pdf')).toBe('document.pdf')
    })

    it('should preserve periods in normal text', () => {
      expect(sanitizeSearchInput('Mr. Smith')).toBe('Mr. Smith')
    })
  })

  describe('complex injection attempts', () => {
    it('should handle multiple injection patterns', () => {
      const malicious = 'value.eq.hack,other.ilike.%test%'
      const result = sanitizeSearchInput(malicious)
      expect(result).not.toContain(',')
      expect(result).not.toContain('.eq.')
      expect(result).not.toContain('.ilike.')
    })

    it('should handle nested parentheses', () => {
      expect(sanitizeSearchInput('((nested))')).toBe('nested')
    })

    it('should handle combined dangerous characters', () => {
      const input = '\\(test,value.eq.hack\\)'
      const result = sanitizeSearchInput(input)
      expect(result).not.toContain('\\')
      expect(result).not.toContain(',')
      expect(result).not.toContain('(')
      expect(result).not.toContain(')')
    })
  })
})

describe('sanitizeExactMatch', () => {
  describe('basic functionality', () => {
    it('should return empty string for empty input', () => {
      expect(sanitizeExactMatch('')).toBe('')
    })

    it('should return empty string for null-like input', () => {
      expect(sanitizeExactMatch(null as unknown as string)).toBe('')
      expect(sanitizeExactMatch(undefined as unknown as string)).toBe('')
    })

    it('should preserve alphanumeric characters', () => {
      expect(sanitizeExactMatch('abc123')).toBe('abc123')
      expect(sanitizeExactMatch('TEST')).toBe('TEST')
    })

    it('should preserve spaces', () => {
      expect(sanitizeExactMatch('hello world')).toBe('hello world')
    })

    it('should trim whitespace', () => {
      expect(sanitizeExactMatch('  hello  ')).toBe('hello')
    })
  })

  describe('allowed special characters', () => {
    it('should preserve hyphens', () => {
      expect(sanitizeExactMatch('order-123')).toBe('order-123')
      expect(sanitizeExactMatch('FLRN-PPOIDS-FBCG')).toBe('FLRN-PPOIDS-FBCG')
    })

    it('should preserve underscores', () => {
      expect(sanitizeExactMatch('order_ref')).toBe('order_ref')
    })

    it('should preserve hash for order refs', () => {
      expect(sanitizeExactMatch('#123456')).toBe('#123456')
      expect(sanitizeExactMatch('##424419')).toBe('##424419')
    })

    it('should preserve @ for emails', () => {
      expect(sanitizeExactMatch('user@email')).toBe('user@email')
    })

    it('should preserve periods', () => {
      expect(sanitizeExactMatch('user.name')).toBe('user.name')
      expect(sanitizeExactMatch('file.txt')).toBe('file.txt')
    })
  })

  describe('dangerous character removal', () => {
    it('should remove commas', () => {
      expect(sanitizeExactMatch('a,b,c')).toBe('abc')
    })

    it('should remove parentheses', () => {
      expect(sanitizeExactMatch('test(value)')).toBe('testvalue')
    })

    it('should remove backslashes', () => {
      expect(sanitizeExactMatch('path\\file')).toBe('pathfile')
    })

    it('should remove quotes', () => {
      expect(sanitizeExactMatch('"quoted"')).toBe('quoted')
      expect(sanitizeExactMatch("'single'")).toBe('single')
    })

    it('should remove semicolons', () => {
      expect(sanitizeExactMatch('value;injection')).toBe('valueinjection')
    })

    it('should remove special SQL characters', () => {
      expect(sanitizeExactMatch('value%like')).toBe('valuelike')
      expect(sanitizeExactMatch('value*star')).toBe('valuestar')
    })
  })

  describe('real-world order references', () => {
    it('should handle typical order refs', () => {
      expect(sanitizeExactMatch('#436878')).toBe('#436878')
      expect(sanitizeExactMatch('##424419')).toBe('##424419')
      expect(sanitizeExactMatch('ORD-2024-001')).toBe('ORD-2024-001')
    })

    it('should handle sendcloud IDs', () => {
      expect(sanitizeExactMatch('590101105')).toBe('590101105')
    })
  })
})

describe('escapePercentForLike', () => {
  describe('basic functionality', () => {
    it('should return empty string for empty input', () => {
      expect(escapePercentForLike('')).toBe('')
    })

    it('should return empty string for null-like input', () => {
      expect(escapePercentForLike(null as unknown as string)).toBe('')
      expect(escapePercentForLike(undefined as unknown as string)).toBe('')
    })

    it('should preserve text without percent signs', () => {
      expect(escapePercentForLike('hello world')).toBe('hello world')
      expect(escapePercentForLike('test123')).toBe('test123')
    })
  })

  describe('percent escaping', () => {
    it('should escape single percent sign', () => {
      expect(escapePercentForLike('100%')).toBe('100\\%')
    })

    it('should escape multiple percent signs', () => {
      expect(escapePercentForLike('50% off, 25% more')).toBe('50\\% off, 25\\% more')
    })

    it('should escape percent at start', () => {
      expect(escapePercentForLike('%value')).toBe('\\%value')
    })

    it('should escape percent at end', () => {
      expect(escapePercentForLike('value%')).toBe('value\\%')
    })

    it('should escape consecutive percent signs', () => {
      expect(escapePercentForLike('%%')).toBe('\\%\\%')
    })
  })

  describe('mixed content', () => {
    it('should handle text with various special chars and percent', () => {
      expect(escapePercentForLike('test@email.com 100%')).toBe('test@email.com 100\\%')
    })

    it('should preserve other escape sequences', () => {
      expect(escapePercentForLike('line\\nbreak%')).toBe('line\\nbreak\\%')
    })
  })
})
