import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import * as XLSX from 'xlsx';
import type { DependencyInput } from '@santaisabel/shared';

import { PrismaService } from '../prisma/prisma.service';
import { CpmService, type CpmTask } from './cpm.service';

type TaskCreateInput = {
  code: string;
  name: string;
  kind?: 'SUMMARY' | 'TASK' | 'MILESTONE';
  parentId?: string | null;
  plannedStart: string | Date;
  plannedEnd: string | Date;
  durationDays: number;
  progress?: number;
  order?: number;
};

type TaskUpdateInput = Partial<TaskCreateInput & { actualStart?: string | Date | null; actualEnd?: string | Date | null }>;

// ─── Santa Isabel WBS Definition ─────────────────────────────────────────────
type WbsDep = { pred: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number };
type WbsTask = {
  key: string;
  code: string;
  name: string;
  kind: 'SUMMARY' | 'TASK' | 'MILESTONE';
  parentKey: string | null;
  startOffset: number; // days from project start
  duration: number;    // calendar days
  deps: WbsDep[];
};

/** Build the WBS definition. All startOffset values are relative to April 1 2026 (day 0). */
function buildWbs(): WbsTask[] {
  return [
    // ── CAP 1: PRELIMINARES ──────────────────────────────────────────────
    { key: 'CAP1', code: '1', name: 'PRELIMINARES', kind: 'SUMMARY', parentKey: null, startOffset: 0, duration: 30, deps: [] },
    { key: '1.1', code: '1.1', name: 'Cerramiento provisional y señalización de obra', kind: 'TASK', parentKey: 'CAP1', startOffset: 0, duration: 10, deps: [] },
    { key: '1.2', code: '1.2', name: 'Instalación campamento provisional y servicios temporales', kind: 'TASK', parentKey: 'CAP1', startOffset: 0, duration: 15, deps: [] },
    { key: '1.3', code: '1.3', name: 'Localización, replanteo y topografía', kind: 'TASK', parentKey: 'CAP1', startOffset: 10, duration: 10, deps: [{ pred: '1.1', type: 'FS', lag: 0 }] },

    // ── CAP 2: CIMENTACIÓN ───────────────────────────────────────────────
    { key: 'CAP2', code: '2', name: 'CIMENTACIÓN', kind: 'SUMMARY', parentKey: null, startOffset: 30, duration: 92, deps: [{ pred: 'CAP1', type: 'FS', lag: 0 }] },
    { key: '2.1', code: '2.1', name: 'Excavación general y descapote', kind: 'TASK', parentKey: 'CAP2', startOffset: 30, duration: 20, deps: [{ pred: 'CAP1', type: 'FS', lag: 0 }] },
    { key: '2.2', code: '2.2', name: 'Pilotes de cimentación en concreto reforzado', kind: 'TASK', parentKey: 'CAP2', startOffset: 50, duration: 40, deps: [{ pred: '2.1', type: 'FS', lag: 0 }] },
    { key: '2.3', code: '2.3', name: 'Vigas de amarre y viga de cimentación', kind: 'TASK', parentKey: 'CAP2', startOffset: 90, duration: 25, deps: [{ pred: '2.2', type: 'FS', lag: 0 }] },
    { key: '2.4', code: '2.4', name: 'Muros de contención sótano y parqueadero interno', kind: 'TASK', parentKey: 'CAP2', startOffset: 95, duration: 27, deps: [{ pred: '2.2', type: 'FS', lag: 5 }] },

    // ── CAP 3: ESTRUCTURA ────────────────────────────────────────────────
    { key: 'CAP3', code: '3', name: 'ESTRUCTURA EN MUROS DE CONCRETO', kind: 'SUMMARY', parentKey: null, startOffset: 122, duration: 220, deps: [{ pred: 'CAP2', type: 'FS', lag: 0 }] },
    { key: '3.1', code: '3.1', name: 'Losa piso 1 — Locales comerciales y parqueo cubierto', kind: 'TASK', parentKey: 'CAP3', startOffset: 122, duration: 20, deps: [{ pred: '2.3', type: 'FS', lag: 0 }] },
    { key: '3.2', code: '3.2', name: 'Losa piso 2 — Casas nivel 1', kind: 'TASK', parentKey: 'CAP3', startOffset: 142, duration: 18, deps: [{ pred: '3.1', type: 'FS', lag: 0 }] },
    { key: '3.3', code: '3.3', name: 'Losa piso 3 — Casas nivel 2', kind: 'TASK', parentKey: 'CAP3', startOffset: 160, duration: 18, deps: [{ pred: '3.2', type: 'FS', lag: 0 }] },
    { key: '3.4', code: '3.4', name: 'Losa pisos 4-6 — Apartamentos (3 pisos × 17d)', kind: 'TASK', parentKey: 'CAP3', startOffset: 178, duration: 51, deps: [{ pred: '3.3', type: 'FS', lag: 0 }] },
    { key: '3.5', code: '3.5', name: 'Losa pisos 7-9 — Apartamentos (3 pisos × 17d)', kind: 'TASK', parentKey: 'CAP3', startOffset: 229, duration: 51, deps: [{ pred: '3.4', type: 'FS', lag: 0 }] },
    { key: '3.6', code: '3.6', name: 'Losa pisos 10-12 — Apartamentos (3 pisos × 17d)', kind: 'TASK', parentKey: 'CAP3', startOffset: 280, duration: 51, deps: [{ pred: '3.5', type: 'FS', lag: 0 }] },
    { key: '3.7', code: '3.7', name: 'Losa de cubierta y penthouse técnico', kind: 'TASK', parentKey: 'CAP3', startOffset: 331, duration: 11, deps: [{ pred: '3.6', type: 'FS', lag: 0 }] },
    { key: '3.8', code: '3.8', name: 'Escaleras, pasamanos y muros de caja escalera', kind: 'TASK', parentKey: 'CAP3', startOffset: 122, duration: 220, deps: [{ pred: '3.1', type: 'SS', lag: 0 }] },

    // ── CAP 4: REDES HIDROSANITARIAS ──────────────────────────────────────
    { key: 'CAP4', code: '4', name: 'REDES HIDROSANITARIAS Y GAS', kind: 'SUMMARY', parentKey: null, startOffset: 122, duration: 280, deps: [{ pred: '3.1', type: 'SS', lag: 0 }] },
    { key: '4.1', code: '4.1', name: 'Redes de acueducto y suministro de agua (CPVC/PVC)', kind: 'TASK', parentKey: 'CAP4', startOffset: 122, duration: 120, deps: [{ pred: '3.1', type: 'SS', lag: 0 }] },
    { key: '4.2', code: '4.2', name: 'Redes sanitarias — aguas negras, residuales y pluviales', kind: 'TASK', parentKey: 'CAP4', startOffset: 122, duration: 120, deps: [{ pred: '3.1', type: 'SS', lag: 0 }] },
    { key: '4.3', code: '4.3', name: 'Red contra incendio (RCI) — gabinetes por piso', kind: 'TASK', parentKey: 'CAP4', startOffset: 160, duration: 90, deps: [{ pred: '3.3', type: 'FS', lag: 0 }] },
    { key: '4.4', code: '4.4', name: 'Gas domiciliario PE-AL-PE 1/2" (estufa y calentador)', kind: 'TASK', parentKey: 'CAP4', startOffset: 280, duration: 60, deps: [{ pred: '3.6', type: 'FS', lag: 0 }] },
    { key: '4.5', code: '4.5', name: 'Tanque de almacenamiento y sistema de bombeo', kind: 'TASK', parentKey: 'CAP4', startOffset: 242, duration: 30, deps: [{ pred: '4.2', type: 'FS', lag: 0 }] },

    // ── CAP 5: INSTALACIONES ELÉCTRICAS Y TELECOMUNICACIONES ──────────────
    { key: 'CAP5', code: '5', name: 'INSTALACIONES ELÉCTRICAS Y TELECOMUNICACIONES', kind: 'SUMMARY', parentKey: null, startOffset: 152, duration: 260, deps: [{ pred: '2.3', type: 'FS', lag: 0 }] },
    { key: '5.1', code: '5.1', name: 'Acometida en media tensión — transformadores y planta emergencia', kind: 'TASK', parentKey: 'CAP5', startOffset: 152, duration: 30, deps: [{ pred: '2.3', type: 'FS', lag: 0 }] },
    { key: '5.2', code: '5.2', name: 'Redes internas conduit PVC y ducterías', kind: 'TASK', parentKey: 'CAP5', startOffset: 178, duration: 150, deps: [{ pred: '3.1', type: 'SS', lag: 0 }] },
    { key: '5.3', code: '5.3', name: 'Tableros de distribución y medidores por apartamento', kind: 'TASK', parentKey: 'CAP5', startOffset: 332, duration: 60, deps: [{ pred: '5.2', type: 'FS', lag: 4 }] },
    { key: '5.4', code: '5.4', name: 'Telecomunicaciones — teléfono, TV cable y datos', kind: 'TASK', parentKey: 'CAP5', startOffset: 332, duration: 60, deps: [{ pred: '5.2', type: 'FS', lag: 4 }] },

    // ── CAP 6: CUBIERTA E IMPERMEABILIZACIÓN ──────────────────────────────
    { key: 'CAP6', code: '6', name: 'CUBIERTA E IMPERMEABILIZACIÓN', kind: 'SUMMARY', parentKey: null, startOffset: 342, duration: 50, deps: [{ pred: '3.7', type: 'FS', lag: 0 }] },
    { key: '6.1', code: '6.1', name: 'Pendientado en concreto impermeabilizado (fibra polipropileno)', kind: 'TASK', parentKey: 'CAP6', startOffset: 342, duration: 15, deps: [{ pred: '3.7', type: 'FS', lag: 0 }] },
    { key: '6.2', code: '6.2', name: 'Geotextil no tejido y geomembrana PVC termofusionada', kind: 'TASK', parentKey: 'CAP6', startOffset: 357, duration: 15, deps: [{ pred: '6.1', type: 'FS', lag: 0 }] },
    { key: '6.3', code: '6.3', name: 'Paneles solares — aptos 905, 1201, 1202, 1207, 1208', kind: 'TASK', parentKey: 'CAP6', startOffset: 372, duration: 10, deps: [{ pred: '6.2', type: 'FS', lag: 0 }] },
    { key: '6.4', code: '6.4', name: 'Cubierta panel sándwich poliuretano — aptos 1203, 1204', kind: 'TASK', parentKey: 'CAP6', startOffset: 372, duration: 10, deps: [{ pred: '6.2', type: 'FS', lag: 0 }] },

    // ── CAP 7: URBANISMO ──────────────────────────────────────────────────
    { key: 'CAP7', code: '7', name: 'OBRAS DE URBANISMO', kind: 'SUMMARY', parentKey: null, startOffset: 183, duration: 270, deps: [{ pred: '2.4', type: 'FS', lag: 0 }] },
    { key: '7.1', code: '7.1', name: 'Redes externas de urbanismo (acueducto, alcantarillado, gas)', kind: 'TASK', parentKey: 'CAP7', startOffset: 183, duration: 76, deps: [{ pred: '2.4', type: 'FS', lag: 0 }] },
    { key: '7.2', code: '7.2', name: 'Vías internas y parqueaderos (41 carros ext. + 11 motos)', kind: 'TASK', parentKey: 'CAP7', startOffset: 259, duration: 60, deps: [{ pred: '7.1', type: 'FS', lag: 0 }] },
    { key: '7.3', code: '7.3', name: 'Zonas verdes, circulaciones peatonales y jardinería', kind: 'TASK', parentKey: 'CAP7', startOffset: 319, duration: 61, deps: [{ pred: '7.2', type: 'FS', lag: 0 }] },
    { key: '7.4', code: '7.4', name: 'Portería — puerta vehicular metálica + puerta peatonal vidrio laminado 10mm', kind: 'TASK', parentKey: 'CAP7', startOffset: 380, duration: 30, deps: [{ pred: '7.3', type: 'FS', lag: 0 }] },
    { key: '7.5', code: '7.5', name: 'Cuarto de basuras general y ducto de basuras', kind: 'TASK', parentKey: 'CAP7', startOffset: 380, duration: 20, deps: [{ pred: '7.3', type: 'SS', lag: 0 }] },

    // ── CAP 8: ACABADOS ZONAS COMUNES ─────────────────────────────────────
    { key: 'CAP8', code: '8', name: 'ACABADOS ZONAS COMUNES', kind: 'SUMMARY', parentKey: null, startOffset: 396, duration: 125, deps: [{ pred: '3.4', type: 'FS', lag: 0 }] },
    { key: '8.1', code: '8.1', name: 'Piso hall acceso — Porcelánico Jasper Iron 60x120cm', kind: 'TASK', parentKey: 'CAP8', startOffset: 396, duration: 20, deps: [{ pred: '3.4', type: 'FS', lag: 0 }] },
    { key: '8.2', code: '8.2', name: 'Pisos circulaciones y punto fijo — Cerámico Itria Gris 60x60cm', kind: 'TASK', parentKey: 'CAP8', startOffset: 396, duration: 30, deps: [{ pred: '3.4', type: 'FS', lag: 0 }] },
    { key: '8.3', code: '8.3', name: 'Cielos — panel yeso y fibrocemento áreas comunes', kind: 'TASK', parentKey: 'CAP8', startOffset: 426, duration: 30, deps: [{ pred: '8.2', type: 'FS', lag: 0 }] },
    { key: '8.4', code: '8.4', name: 'Muros corredores — pañete, estuco y Graniplast', kind: 'TASK', parentKey: 'CAP8', startOffset: 426, duration: 46, deps: [{ pred: '8.2', type: 'FS', lag: 0 }] },
    { key: '8.5', code: '8.5', name: 'Salón social y terraza social — acabados completos', kind: 'TASK', parentKey: 'CAP8', startOffset: 456, duration: 30, deps: [{ pred: '8.3', type: 'FS', lag: 0 }] },
    { key: '8.6', code: '8.6', name: 'Instalación ascensor SCALA modelo KL-K 001 (inox, panorámico)', kind: 'TASK', parentKey: 'CAP8', startOffset: 426, duration: 45, deps: [{ pred: '3.6', type: 'FS', lag: 0 }] },

    // ── CAP 9: ACABADOS UNIDADES PRIVADAS ─────────────────────────────────
    { key: 'CAP9', code: '9', name: 'ACABADOS UNIDADES PRIVADAS', kind: 'SUMMARY', parentKey: null, startOffset: 427, duration: 135, deps: [{ pred: '3.6', type: 'FS', lag: 0 }] },
    { key: '9.1', code: '9.1', name: 'Pisos concreto a la vista — apartamentos VIS', kind: 'TASK', parentKey: 'CAP9', startOffset: 427, duration: 30, deps: [{ pred: '3.6', type: 'FS', lag: 0 }] },
    { key: '9.2', code: '9.2', name: 'Pisos porcelánico Cement Antracita 60x120 — aptos NO VIS', kind: 'TASK', parentKey: 'CAP9', startOffset: 427, duration: 30, deps: [{ pred: '3.6', type: 'FS', lag: 0 }] },
    { key: '9.3', code: '9.3', name: 'Enchapes cerámica baños y cocinas (Artisan Azul, Cubik)', kind: 'TASK', parentKey: 'CAP9', startOffset: 457, duration: 45, deps: [{ pred: '9.1', type: 'FS', lag: 0 }] },
    { key: '9.4', code: '9.4', name: 'Puertas y ventanas aluminio + vidrio 6mm', kind: 'TASK', parentKey: 'CAP9', startOffset: 457, duration: 40, deps: [{ pred: '9.1', type: 'FS', lag: 0 }] },
    { key: '9.5', code: '9.5', name: 'Barandas y pasamanos — acero inoxidable + vidrio laminado 10mm', kind: 'TASK', parentKey: 'CAP9', startOffset: 497, duration: 30, deps: [{ pred: '9.4', type: 'FS', lag: 0 }] },
    { key: '9.6', code: '9.6', name: 'Pintura fachada — argamasa + revestimiento plástico (Ceresita)', kind: 'TASK', parentKey: 'CAP9', startOffset: 457, duration: 60, deps: [{ pred: '8.4', type: 'FS', lag: 0 }] },

    // ── CAP 10: MUEBLES Y APARATOS ────────────────────────────────────────
    { key: 'CAP10', code: '10', name: 'MUEBLES, APARATOS Y EQUIPOS', kind: 'SUMMARY', parentKey: null, startOffset: 502, duration: 90, deps: [{ pred: '9.3', type: 'FS', lag: 0 }] },
    { key: '10.1', code: '10.1', name: 'Aparatos sanitarios — sanitarios, lavamanos, duchas (Grival)', kind: 'TASK', parentKey: 'CAP10', startOffset: 502, duration: 45, deps: [{ pred: '9.3', type: 'FS', lag: 0 }] },
    { key: '10.2', code: '10.2', name: 'Cocinas integrales Amalfi 1.50m + lavaplatos acero inoxidable', kind: 'TASK', parentKey: 'CAP10', startOffset: 502, duration: 45, deps: [{ pred: '9.3', type: 'FS', lag: 0 }] },
    { key: '10.3', code: '10.3', name: 'Lavaderos en concreto y puntos lavadora', kind: 'TASK', parentKey: 'CAP10', startOffset: 502, duration: 20, deps: [{ pred: '9.3', type: 'FS', lag: 0 }] },
    { key: '10.4', code: '10.4', name: 'Planta eléctrica emergencia zonas comunes', kind: 'TASK', parentKey: 'CAP10', startOffset: 520, duration: 30, deps: [{ pred: '5.3', type: 'FS', lag: 0 }] },

    // ── CAP 11: ENTREGA Y CIERRE ──────────────────────────────────────────
    { key: 'CAP11', code: '11', name: 'ENTREGA Y CIERRE DE OBRA', kind: 'SUMMARY', parentKey: null, startOffset: 547, duration: 76, deps: [{ pred: 'CAP10', type: 'FS', lag: 0 }] },
    { key: '11.1', code: '11.1', name: 'Pruebas hidráulicas presión (RAS 2000 / NTC 1500)', kind: 'TASK', parentKey: 'CAP11', startOffset: 547, duration: 20, deps: [{ pred: 'CAP10', type: 'FS', lag: 0 }] },
    { key: '11.2', code: '11.2', name: 'Inspección y certificación RETIE eléctrico (ONAC)', kind: 'TASK', parentKey: 'CAP11', startOffset: 547, duration: 15, deps: [{ pred: '10.4', type: 'FS', lag: 0 }] },
    { key: '11.3', code: '11.3', name: 'Certificación NSR-10 — carta de estabilidad estructural', kind: 'TASK', parentKey: 'CAP11', startOffset: 547, duration: 15, deps: [{ pred: 'CAP10', type: 'FS', lag: 0 }] },
    { key: '11.4', code: '11.4', name: 'Carpeta de garantías, manuales y planos récord', kind: 'TASK', parentKey: 'CAP11', startOffset: 567, duration: 20, deps: [{ pred: '11.1', type: 'FS', lag: 0 }] },
    { key: '11.5', code: '11.5', name: 'Entrega a copropiedad — administración, llaves y pólizas', kind: 'TASK', parentKey: 'CAP11', startOffset: 587, duration: 15, deps: [{ pred: '11.4', type: 'FS', lag: 0 }] },
    { key: 'HITO_ENTREGA', code: 'H-01', name: 'ENTREGA FINAL PROYECTO SANTA ISABEL', kind: 'MILESTONE', parentKey: null, startOffset: 602, duration: 0, deps: [{ pred: '11.5', type: 'FS', lag: 0 }] },
  ];
}

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cpm: CpmService,
  ) {}

  // ─── Tasks ────────────────────────────────────────────────────
  async listTasks(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId },
      include: {
        predecessors: true,
        successors: true,
        assignments: { include: { resource: true } },
      },
      orderBy: { order: 'asc' },
    });
  }

  async createTask(projectId: string, input: TaskCreateInput) {
    const count = await this.prisma.task.count({ where: { projectId } });
    return this.prisma.task.create({
      data: {
        projectId,
        parentId: input.parentId ?? null,
        code: input.code,
        name: input.name,
        kind: (input.kind ?? 'TASK') as 'SUMMARY' | 'TASK' | 'MILESTONE',
        plannedStart: new Date(input.plannedStart),
        plannedEnd: new Date(input.plannedEnd),
        durationDays: input.durationDays,
        progress: new Decimal(input.progress ?? 0),
        order: input.order ?? count,
      },
    });
  }

  async updateTask(taskId: string, input: TaskUpdateInput) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Tarea ${taskId} no existe`);
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
        ...(input.progress !== undefined ? { progress: new Decimal(input.progress) } : {}),
        ...(input.plannedStart !== undefined ? { plannedStart: new Date(input.plannedStart) } : {}),
        ...(input.plannedEnd !== undefined ? { plannedEnd: new Date(input.plannedEnd) } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.actualStart !== undefined
          ? { actualStart: input.actualStart ? new Date(input.actualStart) : null }
          : {}),
        ...(input.actualEnd !== undefined
          ? { actualEnd: input.actualEnd ? new Date(input.actualEnd) : null }
          : {}),
      },
    });
  }

  async deleteTask(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Tarea ${taskId} no existe`);
    await this.prisma.task.delete({ where: { id: taskId } });
  }

  // ─── Dependencies ─────────────────────────────────────────────
  async createDependency(input: DependencyInput) {
    return this.prisma.dependency.create({
      data: {
        predecessorId: input.predecessorId,
        successorId: input.successorId,
        type: (input.type ?? 'FS') as 'FS' | 'SS' | 'FF' | 'SF',
        lagDays: input.lagDays ?? 0,
      },
    });
  }

  async deleteDependency(dependencyId: string) {
    await this.prisma.dependency.delete({ where: { id: dependencyId } });
  }

  // ─── Progress update ──────────────────────────────────────────
  async updateProgress(taskId: string, progress: number) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Tarea ${taskId} no existe`);
    return this.prisma.task.update({
      where: { id: taskId },
      data: { progress: new Decimal(Math.max(0, Math.min(100, progress))) },
    });
  }

  // ─── CPM ──────────────────────────────────────────────────────
  async computeCPM(projectId: string) {
    const tasks = await this.listTasks(projectId);

    const cpmInput: CpmTask[] = tasks.map((t) => ({
      id: t.id,
      duration: t.durationDays,
      predecessors: t.predecessors.map((d) => ({
        predecessorId: d.predecessorId,
        type: d.type as 'FS' | 'SS' | 'FF' | 'SF',
        lag: d.lagDays,
      })),
      successors: t.successors.map((d) => ({
        successorId: d.successorId,
        type: d.type as 'FS' | 'SS' | 'FF' | 'SF',
        lag: d.lagDays,
      })),
    }));

    const cpmResults = this.cpm.compute(cpmInput);

    const updates = tasks.map((t) => {
      const cpm = cpmResults.get(t.id);
      if (!cpm) return null;
      return this.prisma.task
        .update({
          where: { id: t.id },
          data: { isCritical: cpm.isCritical, totalFloat: cpm.totalFloat },
        })
        .catch(() => null);
    });
    void Promise.allSettled(updates.filter(Boolean));

    return tasks.map((t) => ({
      ...t,
      cpm: cpmResults.get(t.id) ?? null,
    }));
  }

  // ─── Seed Santa Isabel WBS ────────────────────────────────────
  async seedSantaIsabelSchedule(projectId: string) {
    // Check if tasks already exist
    const existing = await this.prisma.task.count({ where: { projectId } });
    if (existing > 0) {
      return {
        message: 'El cronograma ya tiene tareas. Elimínelas primero si desea re-cargar la plantilla.',
        tasksCreated: 0,
        depsCreated: 0,
      };
    }

    const wbs = buildWbs();
    const projectStart = new Date('2026-04-01');
    const addDays = (base: Date, days: number): Date => {
      const d = new Date(base);
      d.setDate(d.getDate() + days);
      return d;
    };

    // Map tempKey → DB id
    const keyToId = new Map<string, string>();

    // Create tasks in order (parents before children due to foreignKey)
    for (let i = 0; i < wbs.length; i++) {
      const w = wbs[i]!;
      const parentId = w.parentKey ? (keyToId.get(w.parentKey) ?? null) : null;
      const start = addDays(projectStart, w.startOffset);
      const end = w.duration === 0 ? start : addDays(projectStart, w.startOffset + w.duration);

      const created = await this.prisma.task.create({
        data: {
          projectId,
          parentId,
          code: w.code,
          name: w.name,
          kind: w.kind,
          plannedStart: start,
          plannedEnd: end,
          durationDays: w.duration,
          progress: new Decimal(0),
          order: i,
        },
      });
      keyToId.set(w.key, created.id);
    }

    // Create dependencies in a second pass
    let depsCreated = 0;
    for (const w of wbs) {
      const successorId = keyToId.get(w.key);
      if (!successorId) continue;
      for (const dep of w.deps) {
        const predecessorId = keyToId.get(dep.pred);
        if (!predecessorId) continue;
        await this.prisma.dependency.create({
          data: {
            predecessorId,
            successorId,
            type: dep.type,
            lagDays: dep.lag,
          },
        });
        depsCreated++;
      }
    }

    // Compute CPM immediately
    void this.computeCPM(projectId).catch(() => null);

    return {
      message: `Plantilla Santa Isabel cargada: ${keyToId.size} tareas, ${depsCreated} dependencias`,
      tasksCreated: keyToId.size,
      depsCreated,
    };
  }

  // ─── Clear all tasks ──────────────────────────────────────────
  async clearSchedule(projectId: string) {
    await this.prisma.task.deleteMany({ where: { projectId } });
    return { deleted: true };
  }

  // ─── Milestones ───────────────────────────────────────────────
  async listMilestones(projectId: string) {
    return this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { plannedDate: 'asc' },
    });
  }

  async createMilestone(
    projectId: string,
    data: { code: string; name: string; plannedDate: string; isContractual?: boolean },
  ) {
    return this.prisma.milestone.create({
      data: {
        projectId,
        code: data.code,
        name: data.name,
        plannedDate: new Date(data.plannedDate),
        isContractual: data.isContractual ?? false,
      },
    });
  }

  async updateMilestone(
    milestoneId: string,
    data: { name?: string; plannedDate?: string; actualDate?: string | null; isContractual?: boolean },
  ) {
    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.plannedDate !== undefined ? { plannedDate: new Date(data.plannedDate) } : {}),
        ...(data.actualDate !== undefined
          ? { actualDate: data.actualDate ? new Date(data.actualDate) : null }
          : {}),
        ...(data.isContractual !== undefined ? { isContractual: data.isContractual } : {}),
      },
    });
  }

  async deleteMilestone(milestoneId: string) {
    await this.prisma.milestone.delete({ where: { id: milestoneId } });
  }

  // ─── Baselines ────────────────────────────────────────────────
  async listBaselines(projectId: string) {
    return this.prisma.scheduleBaseline.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, label: true, frozenAt: true },
    });
  }

  async createBaseline(projectId: string, label: string) {
    const tasks = await this.listTasks(projectId);
    const lastVersion = await this.prisma.scheduleBaseline.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (lastVersion?.version ?? 0) + 1;
    return this.prisma.scheduleBaseline.create({
      data: {
        projectId,
        version,
        label,
        snapshot: tasks as unknown as Parameters<typeof this.prisma.scheduleBaseline.create>[0]['data']['snapshot'],
      },
    });
  }

  async getBaseline(projectId: string, version: number) {
    const bl = await this.prisma.scheduleBaseline.findUnique({
      where: { projectId_version: { projectId, version } },
    });
    if (!bl) throw new NotFoundException(`Línea base v${version} no encontrada`);
    return bl;
  }

  // ─── Export to Excel ──────────────────────────────────────────
  async exportToExcel(projectId: string): Promise<Buffer> {
    const [tasks, milestones, baselines] = await Promise.all([
      this.listTasks(projectId),
      this.listMilestones(projectId),
      this.listBaselines(projectId),
    ]);

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Cronograma ──
    const fmtDate = (d: Date | null | undefined) =>
      d ? new Date(d).toLocaleDateString('es-CO') : '';
    const fmtPct = (p: unknown) => `${Math.round(Number(p) * 100)}%`;

    const headers = [
      'Código', 'Nombre', 'Tipo', 'Inicio Planif.', 'Fin Planif.',
      'Inicio Real', 'Fin Real', 'Duración (d)', 'Avance %',
      'Ruta Crítica', 'Float Total (d)',
    ];
    const rows = tasks.map((t) => [
      t.code,
      t.name,
      t.kind === 'SUMMARY' ? 'Resumen' : t.kind === 'MILESTONE' ? 'Hito' : 'Tarea',
      fmtDate(t.plannedStart),
      fmtDate(t.plannedEnd),
      fmtDate(t.actualStart),
      fmtDate(t.actualEnd),
      t.durationDays,
      fmtPct(t.progress),
      t.isCritical ? 'SÍ' : 'No',
      t.totalFloat ?? '',
    ]);

    const ws1 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws1['!cols'] = [8, 45, 10, 14, 14, 14, 14, 12, 10, 12, 12].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, 'Cronograma');

    // ── Sheet 2: Hitos ──
    if (milestones.length > 0) {
      const mHeaders = ['Código', 'Nombre', 'Fecha Planif.', 'Fecha Real', 'Contractual'];
      const mRows = milestones.map((m) => [
        m.code, m.name,
        fmtDate(m.plannedDate), fmtDate(m.actualDate ?? null),
        m.isContractual ? 'SÍ' : 'No',
      ]);
      const ws2 = XLSX.utils.aoa_to_sheet([mHeaders, ...mRows]);
      ws2['!cols'] = [8, 40, 14, 14, 12].map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws2, 'Hitos');
    }

    // ── Sheet 3: Líneas Base ──
    if (baselines.length > 0) {
      const bHeaders = ['Versión', 'Etiqueta', 'Congelada el'];
      const bRows = baselines.map((b) => [b.version, b.label, fmtDate(b.frozenAt)]);
      const ws3 = XLSX.utils.aoa_to_sheet([bHeaders, ...bRows]);
      ws3['!cols'] = [8, 30, 16].map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws3, 'Líneas Base');
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
