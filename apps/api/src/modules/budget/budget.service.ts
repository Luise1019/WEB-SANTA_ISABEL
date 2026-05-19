import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import type {
  ChapterInput,
  APUInput,
  BudgetItemInput,
  AIUConfigInput,
  ResourceInput,
} from '@santaisabel/shared';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Chapters ────────────────────────────────────────────────
  async createChapter(projectId: string, input: ChapterInput) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Proyecto ${projectId} no existe`);
    const count = await this.prisma.chapter.count({ where: { projectId } });
    return this.prisma.chapter.create({
      data: {
        projectId,
        code: input.code,
        name: input.name,
        order: count,
      },
    });
  }

  listChapters(projectId: string) {
    return this.prisma.chapter.findMany({
      where: { projectId },
      include: {
        subchapters: {
          include: {
            items: {
              include: {
                apu: {
                  include: {
                    components: {
                      include: {
                        resource: { include: { rates: { orderBy: { effectiveDate: 'desc' }, take: 1 } } },
                      },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  async createSubchapter(projectId: string, chapterId: string, input: ChapterInput) {
    const chapter = await this.prisma.chapter.findFirst({ where: { id: chapterId, projectId } });
    if (!chapter) throw new NotFoundException(`Capítulo ${chapterId} no existe en este proyecto`);
    const count = await this.prisma.subchapter.count({ where: { chapterId } });
    return this.prisma.subchapter.create({
      data: { chapterId, code: input.code, name: input.name, order: count },
    });
  }

  // ─── Resources (global library) ───────────────────────────────
  listResources() {
    return this.prisma.resource.findMany({
      include: { rates: { orderBy: { effectiveDate: 'desc' }, take: 1 } },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
  }

  createResource(input: ResourceInput) {
    return this.prisma.resource.create({
      data: {
        type: input.type,
        code: input.code,
        name: input.name,
        unit: input.unit,
        rates: {
          create: { effectiveDate: new Date(), unitCost: new Decimal(input.unitCost) },
        },
      },
      include: { rates: true },
    });
  }

  async addResourceRate(resourceId: string, unitCost: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource) throw new NotFoundException(`Recurso ${resourceId} no existe`);
    return this.prisma.resourceRate.create({
      data: { resourceId, effectiveDate: new Date(), unitCost: new Decimal(unitCost) },
    });
  }

  /**
   * Carga la base de datos de insumos colombianos típicos de construcción.
   * Precios referencia 2025 (Colombia, mercado nacional).
   * Usa upsert por código — idempotente; si el recurso ya existe solo actualiza la tarifa.
   */
  async seedColombianResources(): Promise<{ created: number; updated: number; total: number }> {
    const EFFECTIVE_DATE = new Date('2025-01-01');

    const RESOURCES: Array<{
      type: 'MANO_OBRA' | 'MATERIAL' | 'EQUIPO' | 'SUBCONTRATO';
      code: string;
      name: string;
      unit: string;
      unitCost: number; // COP 2025 — para MO es salario base diario (sin prestacional)
    }> = [
      // ── MANO DE OBRA (salario base diario, sin factor prestacional) ──────────
      { type: 'MANO_OBRA', code: 'MO-001', name: 'Maestro de obra',                  unit: 'día', unitCost:  90_000 },
      { type: 'MANO_OBRA', code: 'MO-002', name: 'Oficial de construcción',           unit: 'día', unitCost:  75_000 },
      { type: 'MANO_OBRA', code: 'MO-003', name: 'Ayudante / Laborante',              unit: 'día', unitCost:  55_000 },
      { type: 'MANO_OBRA', code: 'MO-004', name: 'Electricista oficial',              unit: 'día', unitCost:  82_000 },
      { type: 'MANO_OBRA', code: 'MO-005', name: 'Plomero / Fontanero oficial',       unit: 'día', unitCost:  82_000 },
      { type: 'MANO_OBRA', code: 'MO-006', name: 'Carpintero oficial (formaletería)', unit: 'día', unitCost:  78_000 },
      { type: 'MANO_OBRA', code: 'MO-007', name: 'Ferreiro / Armador de acero',       unit: 'día', unitCost:  80_000 },
      { type: 'MANO_OBRA', code: 'MO-008', name: 'Topógrafo',                         unit: 'día', unitCost: 130_000 },
      { type: 'MANO_OBRA', code: 'MO-009', name: 'Cadenero / Auxiliar topografía',    unit: 'día', unitCost:  65_000 },
      { type: 'MANO_OBRA', code: 'MO-010', name: 'Pintor oficial',                    unit: 'día', unitCost:  75_000 },
      { type: 'MANO_OBRA', code: 'MO-011', name: 'Estucador / Pañetador',             unit: 'día', unitCost:  78_000 },
      { type: 'MANO_OBRA', code: 'MO-012', name: 'Enchapador de pisos y paredes',     unit: 'día', unitCost:  80_000 },
      { type: 'MANO_OBRA', code: 'MO-013', name: 'Soldador',                          unit: 'día', unitCost:  90_000 },
      { type: 'MANO_OBRA', code: 'MO-014', name: 'Operador de maquinaria pesada',     unit: 'día', unitCost: 110_000 },
      { type: 'MANO_OBRA', code: 'MO-015', name: 'Inspector / Residente de obra',     unit: 'día', unitCost: 160_000 },

      // ── MATERIALES ───────────────────────────────────────────────────────────
      // Cementos y aglomerantes
      { type: 'MATERIAL', code: 'MAT-001', name: 'Cemento Portland gris tipo I (bto 50 kg)',   unit: 'bto',  unitCost:  28_500 },
      { type: 'MATERIAL', code: 'MAT-002', name: 'Cal hidratada (bto 25 kg)',                  unit: 'bto',  unitCost:  18_000 },
      { type: 'MATERIAL', code: 'MAT-003', name: 'Yeso blanco (bto 25 kg)',                    unit: 'bto',  unitCost:  15_000 },
      // Áridos
      { type: 'MATERIAL', code: 'MAT-010', name: 'Arena de río lavada',                        unit: 'm³',   unitCost:  65_000 },
      { type: 'MATERIAL', code: 'MAT-011', name: 'Arena de peña / quebrada',                   unit: 'm³',   unitCost:  55_000 },
      { type: 'MATERIAL', code: 'MAT-012', name: 'Grava triturada 3/4"',                       unit: 'm³',   unitCost:  72_000 },
      { type: 'MATERIAL', code: 'MAT-013', name: 'Gravilla 1/2"',                              unit: 'm³',   unitCost:  68_000 },
      { type: 'MATERIAL', code: 'MAT-014', name: 'Recebo compactación (material seleccionado)',unit: 'm³',   unitCost:  45_000 },
      // Mampostería
      { type: 'MATERIAL', code: 'MAT-020', name: 'Ladrillo macizo tolete (21x10x5.5 cm)',      unit: 'und',  unitCost:     750 },
      { type: 'MATERIAL', code: 'MAT-021', name: 'Ladrillo farol / rajuela (29x14x9 cm)',      unit: 'und',  unitCost:   1_200 },
      { type: 'MATERIAL', code: 'MAT-022', name: 'Bloque No.4 (10x20x40 cm)',                  unit: 'und',  unitCost:   1_800 },
      { type: 'MATERIAL', code: 'MAT-023', name: 'Bloque No.5 (15x20x40 cm)',                  unit: 'und',  unitCost:   2_200 },
      { type: 'MATERIAL', code: 'MAT-024', name: 'Bloque No.6 (20x20x40 cm)',                  unit: 'und',  unitCost:   2_800 },
      { type: 'MATERIAL', code: 'MAT-025', name: 'Bloque de concreto (20x20x40 cm)',           unit: 'und',  unitCost:   3_200 },
      // Acero de refuerzo
      { type: 'MATERIAL', code: 'MAT-030', name: 'Varilla corrugada 3/8" (9.5 mm) x 6 m',    unit: 'barra', unitCost: 16_500 },
      { type: 'MATERIAL', code: 'MAT-031', name: 'Varilla corrugada 1/2" (12.7 mm) x 6 m',   unit: 'barra', unitCost: 28_500 },
      { type: 'MATERIAL', code: 'MAT-032', name: 'Varilla corrugada 5/8" (15.9 mm) x 6 m',   unit: 'barra', unitCost: 45_000 },
      { type: 'MATERIAL', code: 'MAT-033', name: 'Varilla corrugada 3/4" (19 mm) x 6 m',     unit: 'barra', unitCost: 65_000 },
      { type: 'MATERIAL', code: 'MAT-034', name: 'Varilla corrugada 1" (25.4 mm) x 6 m',     unit: 'barra', unitCost: 115_000 },
      { type: 'MATERIAL', code: 'MAT-035', name: 'Malla electrosoldada 15x15x4 mm (m²)',      unit: 'm²',    unitCost:  18_000 },
      { type: 'MATERIAL', code: 'MAT-036', name: 'Alambre negro calibre 18 (amarre)',          unit: 'kg',    unitCost:   3_500 },
      // Concreto premezclado
      { type: 'MATERIAL', code: 'MAT-040', name: 'Concreto premezclado f\'c=17.5 MPa (2500 psi)', unit: 'm³', unitCost: 380_000 },
      { type: 'MATERIAL', code: 'MAT-041', name: 'Concreto premezclado f\'c=21 MPa (3000 psi)',   unit: 'm³', unitCost: 420_000 },
      { type: 'MATERIAL', code: 'MAT-042', name: 'Concreto premezclado f\'c=28 MPa (4000 psi)',   unit: 'm³', unitCost: 480_000 },
      // Formaletería y apuntalamiento
      { type: 'MATERIAL', code: 'MAT-050', name: 'Tabla de encofrado (0.30 x 2.50 m)',         unit: 'und',  unitCost:  12_000 },
      { type: 'MATERIAL', code: 'MAT-051', name: 'Madera rolliza / costanera (ml)',             unit: 'ml',   unitCost:   3_200 },
      { type: 'MATERIAL', code: 'MAT-052', name: 'Clavo 2" (cabeza redonda)',                   unit: 'kg',   unitCost:   3_200 },
      { type: 'MATERIAL', code: 'MAT-053', name: 'Clavo 2.5"',                                  unit: 'kg',   unitCost:   3_200 },
      { type: 'MATERIAL', code: 'MAT-054', name: 'Clavo 3"',                                    unit: 'kg',   unitCost:   3_200 },
      // Impermeabilización y cubiertas
      { type: 'MATERIAL', code: 'MAT-060', name: 'Impermeabilizante cementicio (kg)',           unit: 'kg',   unitCost:   8_500 },
      { type: 'MATERIAL', code: 'MAT-061', name: 'Manto asfáltico impermeabilizante 4 mm',     unit: 'm²',   unitCost:  45_000 },
      { type: 'MATERIAL', code: 'MAT-062', name: 'Teja de barro tipo española No.20',          unit: 'und',  unitCost:   2_800 },
      { type: 'MATERIAL', code: 'MAT-063', name: 'Teja ondulada zinc Cal 26 (m²)',             unit: 'm²',   unitCost:  38_000 },
      { type: 'MATERIAL', code: 'MAT-064', name: 'Sikaflex-1A (cartucho 300 ml)',              unit: 'und',  unitCost:  18_500 },
      // Redes hidrosanitarias
      { type: 'MATERIAL', code: 'MAT-070', name: 'Tubería PVC sanitaria 2" (ml)',              unit: 'ml',   unitCost:   9_800 },
      { type: 'MATERIAL', code: 'MAT-071', name: 'Tubería PVC sanitaria 3" (ml)',              unit: 'ml',   unitCost:  13_500 },
      { type: 'MATERIAL', code: 'MAT-072', name: 'Tubería PVC sanitaria 4" (ml)',              unit: 'ml',   unitCost:  18_500 },
      { type: 'MATERIAL', code: 'MAT-073', name: 'Tubería PVC presión 1/2" RDE-13.5',         unit: 'ml',   unitCost:   3_200 },
      { type: 'MATERIAL', code: 'MAT-074', name: 'Tubería PVC presión 3/4" RDE-13.5',         unit: 'ml',   unitCost:   4_800 },
      { type: 'MATERIAL', code: 'MAT-075', name: 'Tubería HG (hierro galvanizado) 1/2"',       unit: 'ml',   unitCost:  12_500 },
      { type: 'MATERIAL', code: 'MAT-076', name: 'Tubería HG 3/4"',                            unit: 'ml',   unitCost:  16_800 },
      { type: 'MATERIAL', code: 'MAT-077', name: 'Sanitario completo (inodoro + tanque)',       unit: 'und',  unitCost: 280_000 },
      { type: 'MATERIAL', code: 'MAT-078', name: 'Lavamanos de sobreponer',                    unit: 'und',  unitCost: 180_000 },
      { type: 'MATERIAL', code: 'MAT-079', name: 'Lavaplatos doble pozeta acero inox',         unit: 'und',  unitCost: 320_000 },
      { type: 'MATERIAL', code: 'MAT-080', name: 'Ducha sencilla (set)',                       unit: 'und',  unitCost: 120_000 },
      // Redes eléctricas
      { type: 'MATERIAL', code: 'MAT-090', name: 'Cable eléctrico THHN #14 AWG',              unit: 'ml',   unitCost:   1_800 },
      { type: 'MATERIAL', code: 'MAT-091', name: 'Cable eléctrico THHN #12 AWG',              unit: 'ml',   unitCost:   2_800 },
      { type: 'MATERIAL', code: 'MAT-092', name: 'Cable eléctrico THHN #10 AWG',              unit: 'ml',   unitCost:   4_200 },
      { type: 'MATERIAL', code: 'MAT-093', name: 'Tubería conduit PVC 3/4" (ml)',             unit: 'ml',   unitCost:   2_400 },
      { type: 'MATERIAL', code: 'MAT-094', name: 'Tubería conduit PVC 1" (ml)',               unit: 'ml',   unitCost:   3_800 },
      { type: 'MATERIAL', code: 'MAT-095', name: 'Tomacorriente doble polarizado',             unit: 'und',  unitCost:  12_000 },
      { type: 'MATERIAL', code: 'MAT-096', name: 'Interruptor sencillo',                       unit: 'und',  unitCost:   8_500 },
      { type: 'MATERIAL', code: 'MAT-097', name: 'Breaker 1P 20A',                            unit: 'und',  unitCost:  28_000 },
      // Acabados y pintura
      { type: 'MATERIAL', code: 'MAT-100', name: 'Baldosa cerámica piso 30x30 cm',            unit: 'm²',   unitCost:  28_000 },
      { type: 'MATERIAL', code: 'MAT-101', name: 'Porcelanato 60x60 cm',                      unit: 'm²',   unitCost:  65_000 },
      { type: 'MATERIAL', code: 'MAT-102', name: 'Porcelanato 30x60 cm (pared)',              unit: 'm²',   unitCost:  55_000 },
      { type: 'MATERIAL', code: 'MAT-103', name: 'Adoquín gris 10x20x6 cm',                   unit: 'und',  unitCost:   1_200 },
      { type: 'MATERIAL', code: 'MAT-104', name: 'Pintura vinilo tipo 1 (galón)',              unit: 'gal',  unitCost:  35_000 },
      { type: 'MATERIAL', code: 'MAT-105', name: 'Pintura vinilo tipo 2 lavable (galón)',      unit: 'gal',  unitCost:  48_000 },
      { type: 'MATERIAL', code: 'MAT-106', name: 'Pintura esmalte sintético (galón)',          unit: 'gal',  unitCost:  52_000 },
      { type: 'MATERIAL', code: 'MAT-107', name: 'Estuco plástico (galón)',                    unit: 'gal',  unitCost:  22_000 },
      { type: 'MATERIAL', code: 'MAT-108', name: 'Pegante para cerámica BONCERA (bto 25 kg)', unit: 'bto',  unitCost:  28_000 },
      { type: 'MATERIAL', code: 'MAT-109', name: 'Boquilla / fragua (kg)',                     unit: 'kg',   unitCost:   5_500 },
      // Carpintería y puertas
      { type: 'MATERIAL', code: 'MAT-110', name: 'Puerta madera sólida maciza 0.90x2.10 m',   unit: 'und',  unitCost: 420_000 },
      { type: 'MATERIAL', code: 'MAT-111', name: 'Puerta metálica galvanizada 0.90x2.10 m',   unit: 'und',  unitCost: 380_000 },
      { type: 'MATERIAL', code: 'MAT-112', name: 'Ventana aluminio/vidrio 4mm (m²)',           unit: 'm²',   unitCost: 180_000 },
      { type: 'MATERIAL', code: 'MAT-113', name: 'Vidrio plano 4 mm (m²)',                    unit: 'm²',   unitCost:  55_000 },
      // Varios
      { type: 'MATERIAL', code: 'MAT-120', name: 'Agua (suministro)',                          unit: 'm³',   unitCost:   4_500 },
      { type: 'MATERIAL', code: 'MAT-121', name: 'ACPM (diesel)',                              unit: 'gal',  unitCost:  10_200 },
      { type: 'MATERIAL', code: 'MAT-122', name: 'Gasolina corriente',                         unit: 'gal',  unitCost:  11_000 },
      { type: 'MATERIAL', code: 'MAT-123', name: 'Grasa multiusos (kg)',                       unit: 'kg',   unitCost:  12_000 },

      // ── EQUIPO ───────────────────────────────────────────────────────────────
      { type: 'EQUIPO', code: 'EQ-001', name: 'Mezcladora de concreto 1 saco (350 l)',        unit: 'día',  unitCost:  85_000 },
      { type: 'EQUIPO', code: 'EQ-002', name: 'Vibrador de concreto (chicote 2")',             unit: 'día',  unitCost:  60_000 },
      { type: 'EQUIPO', code: 'EQ-003', name: 'Retroexcavadora sobre llantas',                unit: 'hora', unitCost: 350_000 },
      { type: 'EQUIPO', code: 'EQ-004', name: 'Retroexcavadora sobre orugas',                 unit: 'hora', unitCost: 380_000 },
      { type: 'EQUIPO', code: 'EQ-005', name: 'Compactador de suelos vibratorio (placa)',     unit: 'día',  unitCost: 120_000 },
      { type: 'EQUIPO', code: 'EQ-006', name: 'Compactador tipo rana',                        unit: 'día',  unitCost:  85_000 },
      { type: 'EQUIPO', code: 'EQ-007', name: 'Andamio tubular (módulo/día)',                 unit: 'día',  unitCost:   8_500 },
      { type: 'EQUIPO', code: 'EQ-008', name: 'Formaleta metálica (m²/día)',                  unit: 'm²',   unitCost:   4_500 },
      { type: 'EQUIPO', code: 'EQ-009', name: 'Compresor de aire 185 CFM',                   unit: 'día',  unitCost: 180_000 },
      { type: 'EQUIPO', code: 'EQ-010', name: 'Cargador frontal',                             unit: 'hora', unitCost: 280_000 },
      { type: 'EQUIPO', code: 'EQ-011', name: 'Bulldozer D6',                                unit: 'hora', unitCost: 420_000 },
      { type: 'EQUIPO', code: 'EQ-012', name: 'Volqueta de 6 m³ (viaje)',                    unit: 'viaje', unitCost: 180_000 },
      { type: 'EQUIPO', code: 'EQ-013', name: 'Pluma de construcción 3 ton',                  unit: 'día',  unitCost: 120_000 },
      { type: 'EQUIPO', code: 'EQ-014', name: 'Taladro percutor eléctrico',                   unit: 'día',  unitCost:  25_000 },
      { type: 'EQUIPO', code: 'EQ-015', name: 'Pulidora angular 7"',                          unit: 'día',  unitCost:  20_000 },
      { type: 'EQUIPO', code: 'EQ-016', name: 'Cortadora de cerámica (mesa)',                 unit: 'día',  unitCost:  35_000 },
      { type: 'EQUIPO', code: 'EQ-017', name: 'Equipo de soldadura eléctrica 200A',           unit: 'día',  unitCost:  45_000 },
      { type: 'EQUIPO', code: 'EQ-018', name: 'Nivel láser rotativo',                         unit: 'día',  unitCost:  35_000 },
      { type: 'EQUIPO', code: 'EQ-019', name: 'Estación total topografía',                    unit: 'día',  unitCost: 150_000 },
      { type: 'EQUIPO', code: 'EQ-020', name: 'Bomba de concreto (m³)',                       unit: 'm³',   unitCost:  25_000 },
      { type: 'EQUIPO', code: 'EQ-021', name: 'Planta eléctrica 15 kVA (día)',                unit: 'día',  unitCost:  90_000 },
      { type: 'EQUIPO', code: 'EQ-022', name: 'Camión pluma (alquiler/hora)',                  unit: 'hora', unitCost: 200_000 },

      // ── SUBCONTRATO ──────────────────────────────────────────────────────────
      { type: 'SUBCONTRATO', code: 'SUB-001', name: 'Subcontrato instalación redes eléctricas (m²)', unit: 'm²',   unitCost:  45_000 },
      { type: 'SUBCONTRATO', code: 'SUB-002', name: 'Subcontrato instalación hidrosanitaria (m²)',  unit: 'm²',   unitCost:  38_000 },
      { type: 'SUBCONTRATO', code: 'SUB-003', name: 'Subcontrato instalación cubierta teja (m²)',   unit: 'm²',   unitCost:  55_000 },
      { type: 'SUBCONTRATO', code: 'SUB-004', name: 'Subcontrato pintura interior (m²)',             unit: 'm²',   unitCost:  22_000 },
      { type: 'SUBCONTRATO', code: 'SUB-005', name: 'Subcontrato enchapadp de pisos (m²)',           unit: 'm²',   unitCost:  55_000 },
      { type: 'SUBCONTRATO', code: 'SUB-006', name: 'Subcontrato vidriería y aluminio (m²)',         unit: 'm²',   unitCost: 180_000 },
      { type: 'SUBCONTRATO', code: 'SUB-007', name: 'Subcontrato impermeabilización (m²)',           unit: 'm²',   unitCost:  85_000 },
    ];

    let created = 0;
    let updated = 0;

    for (const r of RESOURCES) {
      const existing = await this.prisma.resource.findUnique({ where: { code: r.code } });
      if (!existing) {
        await this.prisma.resource.create({
          data: {
            type: r.type,
            code: r.code,
            name: r.name,
            unit: r.unit,
            rates: { create: { effectiveDate: EFFECTIVE_DATE, unitCost: new Decimal(r.unitCost) } },
          },
        });
        created++;
      } else {
        // Update only if no rate exists for this date
        const existingRate = await this.prisma.resourceRate.findUnique({
          where: { resourceId_effectiveDate: { resourceId: existing.id, effectiveDate: EFFECTIVE_DATE } },
        });
        if (!existingRate) {
          await this.prisma.resourceRate.create({
            data: { resourceId: existing.id, effectiveDate: EFFECTIVE_DATE, unitCost: new Decimal(r.unitCost) },
          });
        }
        updated++;
      }
    }

    return { created, updated, total: RESOURCES.length };
  }

  // ─── APU (global library) ─────────────────────────────────────
  private static readonly FACTOR_PRESTACIONAL = new Decimal('0.52');

  /** Compute effective rate applying 52% prestacional factor to MANO_OBRA */
  private effectiveRate(unitCost: Decimal, resourceType: string): Decimal {
    if (resourceType === 'MANO_OBRA') {
      return unitCost.times(new Decimal(1).plus(BudgetService.FACTOR_PRESTACIONAL));
    }
    return unitCost;
  }

  listAPUs() {
    return this.prisma.aPU.findMany({
      include: {
        components: {
          include: { resource: { include: { rates: { orderBy: { effectiveDate: 'desc' }, take: 1 } } } },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getAPUCostBreakdown(apuId: string) {
    const apu = await this.prisma.aPU.findUnique({
      where: { id: apuId },
      include: {
        components: {
          include: { resource: { include: { rates: { orderBy: { effectiveDate: 'desc' }, take: 1 } } } },
        },
      },
    });
    if (!apu) throw new NotFoundException(`APU ${apuId} no existe`);

    let moSubtotal = new Decimal(0);
    let materialSubtotal = new Decimal(0);
    let equipoSubtotal = new Decimal(0);
    let subcontratoSubtotal = new Decimal(0);
    let prestacionalAmount = new Decimal(0);

    const components = apu.components.map((comp) => {
      const rawRate = new Decimal((comp.resource.rates?.[0]?.unitCost ?? new Decimal(0)).toString());
      const effRate = this.effectiveRate(rawRate, comp.resource.type);
      const qty = new Decimal(comp.quantity.toString());
      const wf = new Decimal(comp.wasteFactor.toString());
      const lineCost = effRate.times(qty).times(new Decimal(1).plus(wf));

      if (comp.resource.type === 'MANO_OBRA') {
        moSubtotal = moSubtotal.plus(lineCost);
        prestacionalAmount = prestacionalAmount.plus(
          rawRate.times(BudgetService.FACTOR_PRESTACIONAL).times(qty).times(new Decimal(1).plus(wf)),
        );
      } else if (comp.resource.type === 'MATERIAL') {
        materialSubtotal = materialSubtotal.plus(lineCost);
      } else if (comp.resource.type === 'EQUIPO') {
        equipoSubtotal = equipoSubtotal.plus(lineCost);
      } else {
        subcontratoSubtotal = subcontratoSubtotal.plus(lineCost);
      }

      return {
        resourceId: comp.resource.id,
        resourceName: comp.resource.name,
        resourceType: comp.resource.type,
        unit: comp.resource.unit,
        baseCost: rawRate.toFixed(2),
        prestacionalFactor: comp.resource.type === 'MANO_OBRA' ? 0.52 : 0,
        effectiveCost: effRate.toFixed(2),
        quantity: qty.toFixed(4),
        wasteFactor: wf.toFixed(4),
        totalLineCost: lineCost.toFixed(2),
      };
    });

    const unitCostTotal = moSubtotal.plus(materialSubtotal).plus(equipoSubtotal).plus(subcontratoSubtotal);

    return {
      apuId,
      unitCostTotal: unitCostTotal.toFixed(2),
      moSubtotal: moSubtotal.toFixed(2),
      materialSubtotal: materialSubtotal.toFixed(2),
      equipoSubtotal: equipoSubtotal.toFixed(2),
      subcontratoSubtotal: subcontratoSubtotal.toFixed(2),
      prestacionalAmount: prestacionalAmount.toFixed(2),
      components,
    };
  }

  async createAPU(input: APUInput) {
    return this.prisma.aPU.create({
      data: {
        code: input.code,
        name: input.name,
        unit: input.unit,
        version: 1,
        isLibrary: input.isLibrary ?? false,
        components: {
          create: input.components.map((c) => ({
            resourceId: c.resourceId,
            quantity: new Decimal(c.quantity),
            wasteFactor: new Decimal(c.wasteFactor ?? '0'),
            performance: c.performance ? new Decimal(c.performance) : null,
          })),
        },
      },
      include: {
        components: {
          include: { resource: { include: { rates: { orderBy: { effectiveDate: 'desc' }, take: 1 } } } },
        },
      },
    });
  }

  // ─── Budget Items ─────────────────────────────────────────────
  async listItems(projectId: string, chapterId?: string) {
    let subchapterIds: string[];

    if (chapterId) {
      const subs = await this.prisma.subchapter.findMany({
        where: { chapterId, chapter: { projectId } },
        select: { id: true },
      });
      subchapterIds = subs.map((s) => s.id);
    } else {
      const chapters = await this.prisma.chapter.findMany({
        where: { projectId },
        select: { subchapters: { select: { id: true } } },
      });
      subchapterIds = chapters.flatMap((c) => c.subchapters.map((s) => s.id));
    }

    return this.prisma.budgetItem.findMany({
      where: { subchapterId: { in: subchapterIds } },
      include: { apu: { include: { components: { include: { resource: true } } } } },
      orderBy: { order: 'asc' },
    });
  }

  async createItem(projectId: string, subchapterId: string, input: BudgetItemInput) {
    const sub = await this.prisma.subchapter.findFirst({
      where: { id: subchapterId, chapter: { projectId } },
    });
    if (!sub) throw new NotFoundException(`Subcapítulo ${subchapterId} no existe`);
    const count = await this.prisma.budgetItem.count({ where: { subchapterId } });
    const qty = new Decimal(input.quantity);
    const uc = new Decimal(input.unitCost);
    return this.prisma.budgetItem.create({
      data: {
        subchapterId,
        apuId: input.apuId ?? null,
        code: input.code,
        description: input.description,
        unit: input.unit,
        quantity: qty,
        unitCost: uc,
        totalCost: qty.times(uc),
        costType: input.costType ?? 'MATERIAL',
        customCategory: input.costType === 'OTRO' ? (input.customCategory ?? null) : null,
        order: count,
      },
      include: { apu: { include: { components: { include: { resource: true } } } } },
    });
  }

  async updateItem(itemId: string, input: Partial<BudgetItemInput>) {
    const item = await this.prisma.budgetItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Ítem ${itemId} no existe`);

    const qty = input.quantity ? new Decimal(input.quantity) : new Decimal(item.quantity.toString());
    const uc = input.unitCost ? new Decimal(input.unitCost) : new Decimal(item.unitCost.toString());

    return this.prisma.budgetItem.update({
      where: { id: itemId },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.quantity !== undefined ? { quantity: qty } : {}),
        ...(input.unitCost !== undefined ? { unitCost: uc } : {}),
        ...(input.apuId !== undefined ? { apuId: input.apuId } : {}),
        ...(input.costType !== undefined ? { costType: input.costType } : {}),
        ...(input.costType !== undefined
          ? { customCategory: input.costType === 'OTRO' ? (input.customCategory ?? null) : null }
          : {}),
        totalCost: qty.times(uc),
      },
    });
  }

  async deleteItem(itemId: string) {
    const item = await this.prisma.budgetItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Ítem ${itemId} no existe`);
    await this.prisma.budgetItem.delete({ where: { id: itemId } });
  }

  // ─── AIU Config ───────────────────────────────────────────────
  async getAIU(projectId: string) {
    const aiu = await this.prisma.aIUConfig.findUnique({ where: { projectId } });
    return (
      aiu ?? {
        projectId,
        administracionPct: '0',
        imprevistosPct: '0',
        utilidadPct: '0',
        ivaUtilidadPct: '19',
        appliesToIndirect: false,
      }
    );
  }

  async upsertAIU(projectId: string, input: AIUConfigInput) {
    return this.prisma.aIUConfig.upsert({
      where: { projectId },
      update: {
        administracionPct: new Decimal(input.administracionPct),
        imprevistosPct: new Decimal(input.imprevistosPct),
        utilidadPct: new Decimal(input.utilidadPct),
        ivaUtilidadPct: new Decimal(input.ivaUtilidadPct ?? '19'),
        appliesToIndirect: input.appliesToIndirect ?? false,
      },
      create: {
        projectId,
        administracionPct: new Decimal(input.administracionPct),
        imprevistosPct: new Decimal(input.imprevistosPct),
        utilidadPct: new Decimal(input.utilidadPct),
        ivaUtilidadPct: new Decimal(input.ivaUtilidadPct ?? '19'),
        appliesToIndirect: input.appliesToIndirect ?? false,
      },
    });
  }

  // ─── Budget Summary ───────────────────────────────────────────
  async getSummary(projectId: string) {
    const chapters = await this.listChapters(projectId);
    const aiu = await this.getAIU(projectId);

    let directCost = new Decimal(0);

    const chaptersWithTotals = chapters.map((ch) => {
      let chapterTotal = new Decimal(0);

      const subchapters = ch.subchapters.map((sub) => {
        let subTotal = new Decimal(0);

        const items = sub.items.map((item) => {
          let unitCostCalc = new Decimal(0);
          let moSubtotal = new Decimal(0);
          let materialSubtotal = new Decimal(0);
          let equipoSubtotal = new Decimal(0);
          let subcontratoSubtotal = new Decimal(0);

          if (item.apu && item.apu.components.length > 0) {
            for (const comp of item.apu.components) {
              const rawRate = new Decimal((comp.resource.rates?.[0]?.unitCost ?? new Decimal(0)).toString());
              const effRate = this.effectiveRate(rawRate, comp.resource.type);
              const lineCost = effRate
                .times(new Decimal(comp.quantity.toString()))
                .times(new Decimal(1).plus(new Decimal(comp.wasteFactor.toString())));
              unitCostCalc = unitCostCalc.plus(lineCost);
              if (comp.resource.type === 'MANO_OBRA') moSubtotal = moSubtotal.plus(lineCost);
              else if (comp.resource.type === 'MATERIAL') materialSubtotal = materialSubtotal.plus(lineCost);
              else if (comp.resource.type === 'EQUIPO') equipoSubtotal = equipoSubtotal.plus(lineCost);
              else subcontratoSubtotal = subcontratoSubtotal.plus(lineCost);
            }
          } else {
            unitCostCalc = new Decimal(item.unitCost.toString());
          }

          const qty = new Decimal(item.quantity.toString());
          const total = unitCostCalc.times(qty);
          subTotal = subTotal.plus(total);

          return {
            id: item.id,
            code: item.code,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitCostCalc: unitCostCalc.toFixed(2),
            totalCalc: total.toFixed(2),
            apuId: item.apuId,
            costType: item.costType ?? 'MATERIAL',
            customCategory: item.customCategory ?? null,
            costBreakdown: {
              mo: moSubtotal.toFixed(2),
              material: materialSubtotal.toFixed(2),
              equipo: equipoSubtotal.toFixed(2),
              subcontrato: subcontratoSubtotal.toFixed(2),
            },
          };
        });

        chapterTotal = chapterTotal.plus(subTotal);
        return { id: sub.id, code: sub.code, name: sub.name, items, subtotal: subTotal.toFixed(2) };
      });

      directCost = directCost.plus(chapterTotal);
      return { id: ch.id, code: ch.code, name: ch.name, subchapters, total: chapterTotal.toFixed(2) };
    });

    const aiuObj =
      typeof aiu.administracionPct === 'object'
        ? {
            adm: new Decimal((aiu.administracionPct as unknown as { toString(): string }).toString()),
            imp: new Decimal((aiu.imprevistosPct as unknown as { toString(): string }).toString()),
            uti: new Decimal((aiu.utilidadPct as unknown as { toString(): string }).toString()),
            iva: new Decimal((aiu.ivaUtilidadPct as unknown as { toString(): string }).toString()),
          }
        : {
            adm: new Decimal(String(aiu.administracionPct)),
            imp: new Decimal(String(aiu.imprevistosPct)),
            uti: new Decimal(String(aiu.utilidadPct)),
            iva: new Decimal(String(aiu.ivaUtilidadPct)),
          };

    const aiuPct = aiuObj.adm.plus(aiuObj.imp).plus(aiuObj.uti).div(100);
    const aiuAmount = directCost.times(aiuPct);
    const ivaAmount = aiuObj.uti.div(100).times(directCost).times(aiuObj.iva.div(100));
    const totalCost = directCost.plus(aiuAmount).plus(ivaAmount);

    // Cost breakdown by type (for other modules)
    const costByType: Record<string, string> = {
      MANO_OBRA: '0', MATERIAL: '0', EQUIPO: '0', FUNGIBLE: '0', OTRO: '0',
    };
    const customCategories: Record<string, string> = {};
    for (const ch of chaptersWithTotals) {
      for (const sub of ch.subchapters) {
        for (const item of sub.items) {
          const t = item.costType ?? 'MATERIAL';
          costByType[t] = new Decimal(costByType[t] ?? '0').plus(new Decimal(item.totalCalc)).toFixed(2);
          if (t === 'OTRO' && item.customCategory) {
            customCategories[item.customCategory] = new Decimal(customCategories[item.customCategory] ?? '0')
              .plus(new Decimal(item.totalCalc)).toFixed(2);
          }
        }
      }
    }

    return {
      chapters: chaptersWithTotals,
      directCost: directCost.toFixed(2),
      aiuAmount: aiuAmount.toFixed(2),
      ivaAmount: ivaAmount.toFixed(2),
      totalCost: totalCost.toFixed(2),
      aiuConfig: aiu,
      costByType,
      customCategories,
    };
  }

  // ─── Budget Control (Budget vs Actuals) ───────────────────────

  async getBudgetControl(projectId: string) {
    const chapters = await this.prisma.chapter.findMany({
      where: { projectId },
      include: {
        subchapters: {
          include: {
            items: {
              select: {
                id: true, code: true, description: true, unit: true,
                quantity: true, unitCost: true, totalCost: true,
                committedCost: true, actualCost: true, costType: true,
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    // Approved change orders impact
    const approvedCOs = await this.prisma.changeOrder.findMany({
      where: { projectId, status: 'APROBADA' },
      include: { impacts: true },
    });
    const coImpactByItem: Record<string, Decimal> = {};
    for (const co of approvedCOs) {
      for (const imp of co.impacts) {
        if (imp.budgetItemId) {
          coImpactByItem[imp.budgetItemId] = (coImpactByItem[imp.budgetItemId] ?? new Decimal(0))
            .plus(new Decimal(imp.newUnitCost ? String(imp.newUnitCost) : '0'));
        }
      }
    }

    let totalBudget = new Decimal(0);
    let totalCommitted = new Decimal(0);
    let totalActual = new Decimal(0);
    const alerts: { itemId: string; code: string; description: string; alertType: string; message: string }[] = [];

    const chaptersControl = chapters.map((ch) => {
      let chBudget = new Decimal(0), chCommitted = new Decimal(0), chActual = new Decimal(0);
      const subchapters = ch.subchapters.map((sub) => {
        let subBudget = new Decimal(0), subCommitted = new Decimal(0), subActual = new Decimal(0);
        const items = sub.items.map((item) => {
          const budget = new Decimal(String(item.totalCost));
          const committed = new Decimal(String(item.committedCost));
          const actual = new Decimal(String(item.actualCost));
          const coAdj = coImpactByItem[item.id] ?? new Decimal(0);
          const adjustedBudget = budget.plus(coAdj);
          const pctCommitted = adjustedBudget.gt(0) ? committed.div(adjustedBudget).times(100) : new Decimal(0);
          const pctActual = adjustedBudget.gt(0) ? actual.div(adjustedBudget).times(100) : new Decimal(0);
          const variance = adjustedBudget.minus(actual);

          if (pctActual.gte(100)) {
            alerts.push({ itemId: item.id, code: item.code, description: item.description, alertType: 'OVER_100_PCT', message: `Ítem ${item.code} superó el 100% del presupuesto` });
          } else if (pctActual.gte(90)) {
            alerts.push({ itemId: item.id, code: item.code, description: item.description, alertType: 'OVER_90_PCT', message: `Ítem ${item.code} al ${pctActual.toFixed(1)}% del presupuesto` });
          }
          if (committed.gt(adjustedBudget)) {
            alerts.push({ itemId: item.id, code: item.code, description: item.description, alertType: 'COMMITTED_EXCEEDS', message: `Comprometido de ${item.code} supera el presupuesto` });
          }

          subBudget = subBudget.plus(adjustedBudget);
          subCommitted = subCommitted.plus(committed);
          subActual = subActual.plus(actual);

          return {
            id: item.id, code: item.code, description: item.description,
            unit: item.unit, quantity: String(item.quantity), unitCost: String(item.unitCost),
            budget: adjustedBudget.toFixed(2),
            committed: committed.toFixed(2),
            actual: actual.toFixed(2),
            variance: variance.toFixed(2),
            pctCommitted: pctCommitted.toFixed(1),
            pctActual: pctActual.toFixed(1),
            costType: item.costType,
          };
        });
        chBudget = chBudget.plus(subBudget);
        chCommitted = chCommitted.plus(subCommitted);
        chActual = chActual.plus(subActual);
        return {
          id: sub.id, name: sub.name,
          budget: subBudget.toFixed(2), committed: subCommitted.toFixed(2), actual: subActual.toFixed(2),
          variance: subBudget.minus(subActual).toFixed(2),
          pctActual: subBudget.gt(0) ? subActual.div(subBudget).times(100).toFixed(1) : '0.0',
          items,
        };
      });
      totalBudget = totalBudget.plus(chBudget);
      totalCommitted = totalCommitted.plus(chCommitted);
      totalActual = totalActual.plus(chActual);
      return {
        id: ch.id, code: ch.code, name: ch.name,
        budget: chBudget.toFixed(2), committed: chCommitted.toFixed(2), actual: chActual.toFixed(2),
        variance: chBudget.minus(chActual).toFixed(2),
        pctActual: chBudget.gt(0) ? chActual.div(chBudget).times(100).toFixed(1) : '0.0',
        subchapters,
      };
    });

    const cpi = totalBudget.gt(0) ? totalActual.div(totalBudget) : new Decimal(1);
    const etc = totalBudget.minus(totalActual);

    return {
      chapters: chaptersControl,
      totals: {
        budget: totalBudget.toFixed(2),
        committed: totalCommitted.toFixed(2),
        actual: totalActual.toFixed(2),
        variance: totalBudget.minus(totalActual).toFixed(2),
        pctExecuted: totalBudget.gt(0) ? totalActual.div(totalBudget).times(100).toFixed(1) : '0.0',
        cpi: cpi.toFixed(3),
        eac: totalBudget.toFixed(2), // EAC = BAC / CPI simplified for budget context
        etc: etc.toFixed(2),
      },
      alerts,
      approvedChangeOrders: approvedCOs.length,
    };
  }

  async updateItemActuals(itemId: string, dto: { committedCost?: string; actualCost?: string }) {
    return this.prisma.budgetItem.update({
      where: { id: itemId },
      data: {
        ...(dto.committedCost !== undefined && { committedCost: new Decimal(dto.committedCost) }),
        ...(dto.actualCost !== undefined && { actualCost: new Decimal(dto.actualCost) }),
      },
      select: { id: true, committedCost: true, actualCost: true },
    });
  }
}
