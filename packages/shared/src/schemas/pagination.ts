import { z } from 'zod';

/**
 * Schema de query para paginación estándar en toda la API.
 *
 * Uso en controllers:
 *   @Get()
 *   list(@Query(new ZodValidationPipe(pageQuerySchema)) q: PageQuery) { ... }
 */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(30),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

/**
 * Forma estándar de respuesta paginada.
 *
 * Uso en services:
 *   return paginate(items, total, query);
 */
export type Page<T> = {
  data: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

export function paginate<T>(data: T[], total: number, query: PageQuery): Page<T> {
  return {
    data,
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    limit: query.limit,
  };
}

/**
 * Calcula skip/take para Prisma a partir de un PageQuery.
 */
export function toPrismaSkipTake(query: PageQuery): { skip: number; take: number } {
  return {
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  };
}
