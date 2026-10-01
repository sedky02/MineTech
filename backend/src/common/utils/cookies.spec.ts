import { readCookie } from './cookies.js';

describe('readCookie', () => {
  it('finds a cookie among others', () => {
    expect(readCookie('a=1; mt_auth=abc.def; b=2', 'mt_auth')).toBe('abc.def');
  });

  it('decodes values and ignores malformed parts', () => {
    expect(readCookie('junk; mt_auth=a%3Db', 'mt_auth')).toBe('a=b');
  });

  it('returns undefined when missing', () => {
    expect(readCookie(undefined, 'mt_auth')).toBeUndefined();
    expect(readCookie('mt_authx=1', 'mt_auth')).toBeUndefined();
  });
});
