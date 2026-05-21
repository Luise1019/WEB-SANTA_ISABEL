import { describe, expect, it } from 'vitest';

import { pageQuerySchema, paginate, toPrismaSkipTake } from './pagination';

describe('pageQuerySchema', () => {
  it('aplica defaults: page=1, limit=30, order=desc', () => {
    const r = pageQuerySchema.parse({});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(30);
    expect(r.order).toBe('desc');
    expect(r.sort).toBeUndefined();
  });

  it('coerce de string a número en page y limit', () => {
    const r = pageQuerySchema.parse({ page: '3', limit: '50' });
    expect(r.page).toBe(3);
    expect(r.limit).toBe(50);
  });

  it('rechaza limit > 200', () => {
    expect(() => pageQuerySchema.parse({ limit: 999 })).toThrow();
  });

  it('rechaza page negativa', () => {
    expect(() => pageQuerySchema.parse({ page: -1 })).toThrow();
  });

  it('rechaza order distinto de asc | desc', () => {
    expect(() => pageQuerySchema.parse({ order: 'random' })).toThrow();
  });
});

describe('paginate()', () => {
  it('construye un Page<T> con pages calculado correctamente', () => {
    const r = paginate(['a', 'b'], 47, { page: 2, limit: 10, order: 'desc' });
    expect(r.data).toEqual(['a', 'b']);
    expect(r.total).toBe(47);
    expect(r.page).toBe(2);
    expect(r.pages).toBe(5);
    expect(r.limit).toBe(10);
  });

  it('pages mínimo 1 incluso con total 0', () => {
    const r = paginate([], 0, { page: 1, limit: 30, order: 'desc' });
    expect(r.pages).toBe(1);
  });
});

describe('toPrismaSkipTake()', () => {
  it('calcula skip = (page-1) * limit y take = limit', () => {
    expect(toPrismaSkipTake({ page: 1, limit: 30, order: 'desc' })).toEqual({ skip: 0, take: 30 });
    expect(toPrismaSkipTake({ page: 3, limit: 50, order: 'desc' })).toEqual({ skip: 100, take: 50 });
  });
});
