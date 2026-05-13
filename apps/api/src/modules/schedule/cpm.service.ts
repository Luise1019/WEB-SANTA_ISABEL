import { Injectable } from '@nestjs/common';

/**
 * Critical Path Method — forward/backward pass.
 *
 * Implementación completa: hito M6 del roadmap.
 * Soporta dependencias FS/SS/FF/SF con lag (positivo o negativo).
 *
 * Algoritmo:
 *   - Forward pass: para cada tarea en orden topológico, calcular ES y EF.
 *     ES = max sobre cada predecesor según tipo de dependencia.
 *     EF = ES + duration.
 *   - Backward pass: para cada tarea en orden inverso, calcular LS y LF.
 *     LF = min sobre cada sucesor.
 *     LS = LF - duration.
 *   - Total float = LS - ES. isCritical = (totalFloat == 0).
 *
 * Validación: comparar contra fixtures de MS Project en cpm.service.test.ts.
 */
@Injectable()
export class CpmService {
  // TODO M6: implementar forwardPass, backwardPass, computeCriticalPath.
}
