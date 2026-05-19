import argon2 from 'argon2';
import Decimal from 'decimal.js';
import { STANDARD_CHAPTERS } from '@santaisabel/shared';

import { prisma } from './client';
import { colombianHolidaysRange } from './holidays';

// ── Insumos colombianos 2025 ────────────────────────────────────────────────
type ResourceType = 'MANO_OBRA' | 'MATERIAL' | 'EQUIPO' | 'SUBCONTRATO';
const COLOMBIAN_RESOURCES: Array<{ type: ResourceType; code: string; name: string; unit: string; unitCost: number }> = [
  // MANO DE OBRA (salario base diario, sin factor prestacional 52%)
  { type: 'MANO_OBRA', code: 'MO-001', name: 'Maestro de obra',                  unit: 'día',   unitCost:  90_000 },
  { type: 'MANO_OBRA', code: 'MO-002', name: 'Oficial de construcción',           unit: 'día',   unitCost:  75_000 },
  { type: 'MANO_OBRA', code: 'MO-003', name: 'Ayudante / Laborante',              unit: 'día',   unitCost:  55_000 },
  { type: 'MANO_OBRA', code: 'MO-004', name: 'Electricista oficial',              unit: 'día',   unitCost:  82_000 },
  { type: 'MANO_OBRA', code: 'MO-005', name: 'Plomero / Fontanero oficial',       unit: 'día',   unitCost:  82_000 },
  { type: 'MANO_OBRA', code: 'MO-006', name: 'Carpintero oficial (formaletería)', unit: 'día',   unitCost:  78_000 },
  { type: 'MANO_OBRA', code: 'MO-007', name: 'Ferreiro / Armador de acero',       unit: 'día',   unitCost:  80_000 },
  { type: 'MANO_OBRA', code: 'MO-008', name: 'Topógrafo',                         unit: 'día',   unitCost: 130_000 },
  { type: 'MANO_OBRA', code: 'MO-009', name: 'Cadenero / Auxiliar topografía',    unit: 'día',   unitCost:  65_000 },
  { type: 'MANO_OBRA', code: 'MO-010', name: 'Pintor oficial',                    unit: 'día',   unitCost:  75_000 },
  { type: 'MANO_OBRA', code: 'MO-011', name: 'Estucador / Pañetador',             unit: 'día',   unitCost:  78_000 },
  { type: 'MANO_OBRA', code: 'MO-012', name: 'Enchapador de pisos y paredes',     unit: 'día',   unitCost:  80_000 },
  { type: 'MANO_OBRA', code: 'MO-013', name: 'Soldador',                          unit: 'día',   unitCost:  90_000 },
  { type: 'MANO_OBRA', code: 'MO-014', name: 'Operador de maquinaria pesada',     unit: 'día',   unitCost: 110_000 },
  { type: 'MANO_OBRA', code: 'MO-015', name: 'Inspector / Residente de obra',     unit: 'día',   unitCost: 160_000 },
  // MATERIALES
  { type: 'MATERIAL', code: 'MAT-001', name: 'Cemento Portland gris tipo I (bto 50 kg)',        unit: 'bto',   unitCost:  28_500 },
  { type: 'MATERIAL', code: 'MAT-002', name: 'Cal hidratada (bto 25 kg)',                       unit: 'bto',   unitCost:  18_000 },
  { type: 'MATERIAL', code: 'MAT-003', name: 'Yeso blanco (bto 25 kg)',                         unit: 'bto',   unitCost:  15_000 },
  { type: 'MATERIAL', code: 'MAT-010', name: 'Arena de río lavada',                             unit: 'm³',    unitCost:  65_000 },
  { type: 'MATERIAL', code: 'MAT-011', name: 'Arena de peña / quebrada',                        unit: 'm³',    unitCost:  55_000 },
  { type: 'MATERIAL', code: 'MAT-012', name: 'Grava triturada 3/4"',                            unit: 'm³',    unitCost:  72_000 },
  { type: 'MATERIAL', code: 'MAT-013', name: 'Gravilla 1/2"',                                   unit: 'm³',    unitCost:  68_000 },
  { type: 'MATERIAL', code: 'MAT-014', name: 'Recebo compactación (material seleccionado)',     unit: 'm³',    unitCost:  45_000 },
  { type: 'MATERIAL', code: 'MAT-020', name: 'Ladrillo macizo tolete (21x10x5.5 cm)',           unit: 'und',   unitCost:     750 },
  { type: 'MATERIAL', code: 'MAT-021', name: 'Ladrillo farol / rajuela (29x14x9 cm)',           unit: 'und',   unitCost:   1_200 },
  { type: 'MATERIAL', code: 'MAT-022', name: 'Bloque No.4 (10x20x40 cm)',                       unit: 'und',   unitCost:   1_800 },
  { type: 'MATERIAL', code: 'MAT-023', name: 'Bloque No.5 (15x20x40 cm)',                       unit: 'und',   unitCost:   2_200 },
  { type: 'MATERIAL', code: 'MAT-024', name: 'Bloque No.6 (20x20x40 cm)',                       unit: 'und',   unitCost:   2_800 },
  { type: 'MATERIAL', code: 'MAT-025', name: 'Bloque de concreto (20x20x40 cm)',                unit: 'und',   unitCost:   3_200 },
  { type: 'MATERIAL', code: 'MAT-030', name: 'Varilla corrugada 3/8" (9.5 mm) x 6 m',         unit: 'barra', unitCost:  16_500 },
  { type: 'MATERIAL', code: 'MAT-031', name: 'Varilla corrugada 1/2" (12.7 mm) x 6 m',        unit: 'barra', unitCost:  28_500 },
  { type: 'MATERIAL', code: 'MAT-032', name: 'Varilla corrugada 5/8" (15.9 mm) x 6 m',        unit: 'barra', unitCost:  45_000 },
  { type: 'MATERIAL', code: 'MAT-033', name: 'Varilla corrugada 3/4" (19 mm) x 6 m',          unit: 'barra', unitCost:  65_000 },
  { type: 'MATERIAL', code: 'MAT-034', name: 'Varilla corrugada 1" (25.4 mm) x 6 m',          unit: 'barra', unitCost: 115_000 },
  { type: 'MATERIAL', code: 'MAT-035', name: 'Malla electrosoldada 15x15x4 mm (m²)',           unit: 'm²',    unitCost:  18_000 },
  { type: 'MATERIAL', code: 'MAT-036', name: 'Alambre negro calibre 18 (amarre)',               unit: 'kg',    unitCost:   3_500 },
  { type: 'MATERIAL', code: 'MAT-040', name: "Concreto premezclado f'c=17.5 MPa (2500 psi)",  unit: 'm³',    unitCost: 380_000 },
  { type: 'MATERIAL', code: 'MAT-041', name: "Concreto premezclado f'c=21 MPa (3000 psi)",    unit: 'm³',    unitCost: 420_000 },
  { type: 'MATERIAL', code: 'MAT-042', name: "Concreto premezclado f'c=28 MPa (4000 psi)",    unit: 'm³',    unitCost: 480_000 },
  { type: 'MATERIAL', code: 'MAT-050', name: 'Tabla de encofrado (0.30 x 2.50 m)',             unit: 'und',   unitCost:  12_000 },
  { type: 'MATERIAL', code: 'MAT-051', name: 'Madera rolliza / costanera (ml)',                 unit: 'ml',    unitCost:   3_200 },
  { type: 'MATERIAL', code: 'MAT-052', name: 'Clavo 2" (cabeza redonda)',                       unit: 'kg',    unitCost:   3_200 },
  { type: 'MATERIAL', code: 'MAT-053', name: 'Clavo 2.5"',                                      unit: 'kg',    unitCost:   3_200 },
  { type: 'MATERIAL', code: 'MAT-054', name: 'Clavo 3"',                                        unit: 'kg',    unitCost:   3_200 },
  { type: 'MATERIAL', code: 'MAT-060', name: 'Impermeabilizante cementicio (kg)',               unit: 'kg',    unitCost:   8_500 },
  { type: 'MATERIAL', code: 'MAT-061', name: 'Manto asfáltico impermeabilizante 4 mm',         unit: 'm²',    unitCost:  45_000 },
  { type: 'MATERIAL', code: 'MAT-062', name: 'Teja de barro tipo española No.20',              unit: 'und',   unitCost:   2_800 },
  { type: 'MATERIAL', code: 'MAT-063', name: 'Teja ondulada zinc Cal 26 (m²)',                 unit: 'm²',    unitCost:  38_000 },
  { type: 'MATERIAL', code: 'MAT-064', name: 'Sikaflex-1A (cartucho 300 ml)',                  unit: 'und',   unitCost:  18_500 },
  { type: 'MATERIAL', code: 'MAT-070', name: 'Tubería PVC sanitaria 2" (ml)',                  unit: 'ml',    unitCost:   9_800 },
  { type: 'MATERIAL', code: 'MAT-071', name: 'Tubería PVC sanitaria 3" (ml)',                  unit: 'ml',    unitCost:  13_500 },
  { type: 'MATERIAL', code: 'MAT-072', name: 'Tubería PVC sanitaria 4" (ml)',                  unit: 'ml',    unitCost:  18_500 },
  { type: 'MATERIAL', code: 'MAT-073', name: 'Tubería PVC presión 1/2" RDE-13.5',             unit: 'ml',    unitCost:   3_200 },
  { type: 'MATERIAL', code: 'MAT-074', name: 'Tubería PVC presión 3/4" RDE-13.5',             unit: 'ml',    unitCost:   4_800 },
  { type: 'MATERIAL', code: 'MAT-075', name: 'Tubería HG (hierro galvanizado) 1/2"',           unit: 'ml',    unitCost:  12_500 },
  { type: 'MATERIAL', code: 'MAT-076', name: 'Tubería HG 3/4"',                                unit: 'ml',    unitCost:  16_800 },
  { type: 'MATERIAL', code: 'MAT-077', name: 'Sanitario completo (inodoro + tanque)',           unit: 'und',   unitCost: 280_000 },
  { type: 'MATERIAL', code: 'MAT-078', name: 'Lavamanos de sobreponer',                        unit: 'und',   unitCost: 180_000 },
  { type: 'MATERIAL', code: 'MAT-079', name: 'Lavaplatos doble pozeta acero inox',             unit: 'und',   unitCost: 320_000 },
  { type: 'MATERIAL', code: 'MAT-080', name: 'Ducha sencilla (set)',                           unit: 'und',   unitCost: 120_000 },
  { type: 'MATERIAL', code: 'MAT-090', name: 'Cable eléctrico THHN #14 AWG',                  unit: 'ml',    unitCost:   1_800 },
  { type: 'MATERIAL', code: 'MAT-091', name: 'Cable eléctrico THHN #12 AWG',                  unit: 'ml',    unitCost:   2_800 },
  { type: 'MATERIAL', code: 'MAT-092', name: 'Cable eléctrico THHN #10 AWG',                  unit: 'ml',    unitCost:   4_200 },
  { type: 'MATERIAL', code: 'MAT-093', name: 'Tubería conduit PVC 3/4" (ml)',                 unit: 'ml',    unitCost:   2_400 },
  { type: 'MATERIAL', code: 'MAT-094', name: 'Tubería conduit PVC 1" (ml)',                   unit: 'ml',    unitCost:   3_800 },
  { type: 'MATERIAL', code: 'MAT-095', name: 'Tomacorriente doble polarizado',                 unit: 'und',   unitCost:  12_000 },
  { type: 'MATERIAL', code: 'MAT-096', name: 'Interruptor sencillo',                           unit: 'und',   unitCost:   8_500 },
  { type: 'MATERIAL', code: 'MAT-097', name: 'Breaker 1P 20A',                                unit: 'und',   unitCost:  28_000 },
  { type: 'MATERIAL', code: 'MAT-100', name: 'Baldosa cerámica piso 30x30 cm',                unit: 'm²',    unitCost:  28_000 },
  { type: 'MATERIAL', code: 'MAT-101', name: 'Porcelanato 60x60 cm',                          unit: 'm²',    unitCost:  65_000 },
  { type: 'MATERIAL', code: 'MAT-102', name: 'Porcelanato 30x60 cm (pared)',                  unit: 'm²',    unitCost:  55_000 },
  { type: 'MATERIAL', code: 'MAT-103', name: 'Adoquín gris 10x20x6 cm',                       unit: 'und',   unitCost:   1_200 },
  { type: 'MATERIAL', code: 'MAT-104', name: 'Pintura vinilo tipo 1 (galón)',                  unit: 'gal',   unitCost:  35_000 },
  { type: 'MATERIAL', code: 'MAT-105', name: 'Pintura vinilo tipo 2 lavable (galón)',          unit: 'gal',   unitCost:  48_000 },
  { type: 'MATERIAL', code: 'MAT-106', name: 'Pintura esmalte sintético (galón)',              unit: 'gal',   unitCost:  52_000 },
  { type: 'MATERIAL', code: 'MAT-107', name: 'Estuco plástico (galón)',                        unit: 'gal',   unitCost:  22_000 },
  { type: 'MATERIAL', code: 'MAT-108', name: 'Pegante para cerámica BONCERA (bto 25 kg)',     unit: 'bto',   unitCost:  28_000 },
  { type: 'MATERIAL', code: 'MAT-109', name: 'Boquilla / fragua (kg)',                         unit: 'kg',    unitCost:   5_500 },
  { type: 'MATERIAL', code: 'MAT-110', name: 'Puerta madera sólida maciza 0.90x2.10 m',       unit: 'und',   unitCost: 420_000 },
  { type: 'MATERIAL', code: 'MAT-111', name: 'Puerta metálica galvanizada 0.90x2.10 m',       unit: 'und',   unitCost: 380_000 },
  { type: 'MATERIAL', code: 'MAT-112', name: 'Ventana aluminio/vidrio 4mm (m²)',               unit: 'm²',    unitCost: 180_000 },
  { type: 'MATERIAL', code: 'MAT-113', name: 'Vidrio plano 4 mm (m²)',                        unit: 'm²',    unitCost:  55_000 },
  { type: 'MATERIAL', code: 'MAT-120', name: 'Agua (suministro)',                              unit: 'm³',    unitCost:   4_500 },
  { type: 'MATERIAL', code: 'MAT-121', name: 'ACPM (diesel)',                                  unit: 'gal',   unitCost:  10_200 },
  { type: 'MATERIAL', code: 'MAT-122', name: 'Gasolina corriente',                             unit: 'gal',   unitCost:  11_000 },
  // EQUIPOS
  { type: 'EQUIPO', code: 'EQ-001', name: 'Mezcladora de concreto 1 saco (350 l)',             unit: 'día',   unitCost:  85_000 },
  { type: 'EQUIPO', code: 'EQ-002', name: 'Vibrador de concreto (chicote 2")',                 unit: 'día',   unitCost:  60_000 },
  { type: 'EQUIPO', code: 'EQ-003', name: 'Retroexcavadora sobre llantas',                     unit: 'hora',  unitCost: 350_000 },
  { type: 'EQUIPO', code: 'EQ-004', name: 'Retroexcavadora sobre orugas',                      unit: 'hora',  unitCost: 380_000 },
  { type: 'EQUIPO', code: 'EQ-005', name: 'Compactador de suelos vibratorio (placa)',          unit: 'día',   unitCost: 120_000 },
  { type: 'EQUIPO', code: 'EQ-006', name: 'Compactador tipo rana',                             unit: 'día',   unitCost:  85_000 },
  { type: 'EQUIPO', code: 'EQ-007', name: 'Andamio tubular (módulo/día)',                      unit: 'día',   unitCost:   8_500 },
  { type: 'EQUIPO', code: 'EQ-008', name: 'Formaleta metálica (m²/día)',                       unit: 'm²',    unitCost:   4_500 },
  { type: 'EQUIPO', code: 'EQ-009', name: 'Compresor de aire 185 CFM',                        unit: 'día',   unitCost: 180_000 },
  { type: 'EQUIPO', code: 'EQ-010', name: 'Cargador frontal',                                  unit: 'hora',  unitCost: 280_000 },
  { type: 'EQUIPO', code: 'EQ-011', name: 'Bulldozer D6',                                     unit: 'hora',  unitCost: 420_000 },
  { type: 'EQUIPO', code: 'EQ-012', name: 'Volqueta de 6 m³ (viaje)',                         unit: 'viaje', unitCost: 180_000 },
  { type: 'EQUIPO', code: 'EQ-013', name: 'Pluma de construcción 3 ton',                       unit: 'día',   unitCost: 120_000 },
  { type: 'EQUIPO', code: 'EQ-014', name: 'Taladro percutor eléctrico',                        unit: 'día',   unitCost:  25_000 },
  { type: 'EQUIPO', code: 'EQ-015', name: 'Pulidora angular 7"',                               unit: 'día',   unitCost:  20_000 },
  { type: 'EQUIPO', code: 'EQ-016', name: 'Cortadora de cerámica (mesa)',                      unit: 'día',   unitCost:  35_000 },
  { type: 'EQUIPO', code: 'EQ-017', name: 'Equipo de soldadura eléctrica 200A',                unit: 'día',   unitCost:  45_000 },
  { type: 'EQUIPO', code: 'EQ-018', name: 'Nivel láser rotativo',                              unit: 'día',   unitCost:  35_000 },
  { type: 'EQUIPO', code: 'EQ-019', name: 'Estación total topografía',                         unit: 'día',   unitCost: 150_000 },
  { type: 'EQUIPO', code: 'EQ-020', name: 'Bomba de concreto (m³)',                            unit: 'm³',    unitCost:  25_000 },
  { type: 'EQUIPO', code: 'EQ-021', name: 'Planta eléctrica 15 kVA (día)',                     unit: 'día',   unitCost:  90_000 },
  { type: 'EQUIPO', code: 'EQ-022', name: 'Camión pluma (alquiler/hora)',                       unit: 'hora',  unitCost: 200_000 },
  // SUBCONTRATOS
  { type: 'SUBCONTRATO', code: 'SUB-001', name: 'Subcontrato instalación redes eléctricas (m²)', unit: 'm²', unitCost:  45_000 },
  { type: 'SUBCONTRATO', code: 'SUB-002', name: 'Subcontrato instalación hidrosanitaria (m²)',  unit: 'm²', unitCost:  38_000 },
  { type: 'SUBCONTRATO', code: 'SUB-003', name: 'Subcontrato instalación cubierta teja (m²)',   unit: 'm²', unitCost:  55_000 },
  { type: 'SUBCONTRATO', code: 'SUB-004', name: 'Subcontrato pintura interior (m²)',             unit: 'm²', unitCost:  22_000 },
  { type: 'SUBCONTRATO', code: 'SUB-005', name: 'Subcontrato enchapado de pisos (m²)',           unit: 'm²', unitCost:  55_000 },
  { type: 'SUBCONTRATO', code: 'SUB-006', name: 'Subcontrato vidriería y aluminio (m²)',         unit: 'm²', unitCost: 180_000 },
  { type: 'SUBCONTRATO', code: 'SUB-007', name: 'Subcontrato impermeabilización (m²)',           unit: 'm²', unitCost:  85_000 },
];

async function main() {
  console.log('🌱 Seeding database...');

  // 1) Organización por defecto
  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Consorcio Santa Isabel',
    },
  });
  console.log(`  ✓ Organización: ${org.name}`);

  // 2) Usuario admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@santaisabel.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345!';
  const passwordHash = await argon2.hash(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      organizationId: org.id,
      email: adminEmail,
      passwordHash,
      fullName: 'Administrador',
      role: 'GERENTE',
    },
  });
  console.log(`  ✓ Admin: ${admin.email} / ${adminPassword}`);

  // 3) Festivos Colombia 2020-2040
  const startYear = 2020;
  const endYear = 2040;
  const existingCount = await prisma.holiday.count();
  if (existingCount === 0) {
    const holidays = colombianHolidaysRange(startYear, endYear);
    await prisma.holiday.createMany({
      data: holidays.map((h) => ({ date: h.date, name: h.name, emiliani: h.emiliani })),
      skipDuplicates: true,
    });
    console.log(`  ✓ Festivos Colombia ${startYear}-${endYear}: ${holidays.length} insertados`);
  } else {
    console.log(`  • Festivos ya cargados (${existingCount}), skip`);
  }

  // 4) Plantillas de reportes (placeholders mínimos)
  const templateKinds: Array<{
    id: string;
    kind:
      | 'PREFACTIBILIDAD'
      | 'EJECUCION_PRESUPUESTAL'
      | 'FLUJO_CAJA'
      | 'ACTA_COMITE'
      | 'RENTABILIDAD'
      | 'SECOP_II';
    name: string;
  }> = [
    { id: '10000000-0000-0000-0000-000000000001', kind: 'PREFACTIBILIDAD', name: 'Prefactibilidad estándar' },
    { id: '10000000-0000-0000-0000-000000000002', kind: 'EJECUCION_PRESUPUESTAL', name: 'Ejecución presupuestal' },
    { id: '10000000-0000-0000-0000-000000000003', kind: 'FLUJO_CAJA', name: 'Flujo de caja' },
    { id: '10000000-0000-0000-0000-000000000004', kind: 'ACTA_COMITE', name: 'Acta de comité' },
    { id: '10000000-0000-0000-0000-000000000005', kind: 'RENTABILIDAD', name: 'Rentabilidad' },
    { id: '10000000-0000-0000-0000-000000000006', kind: 'SECOP_II', name: 'Formato SECOP II' },
  ];
  for (const t of templateKinds) {
    await prisma.reportTemplate.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        kind: t.kind,
        name: t.name,
        htmlSource: `<h1>{{project.name}}</h1><p>Plantilla ${t.name} (placeholder).</p>`,
        cssSource: 'body { font-family: sans-serif; }',
        isDefault: true,
      },
    });
  }
  console.log(`  ✓ Plantillas de reportes: ${templateKinds.length}`);

  console.log('✓ Capítulos estándar disponibles vía STANDARD_CHAPTERS para auto-creación al crear proyectos.');
  console.log(`  (Cantidad: ${STANDARD_CHAPTERS.length})`);

  // 5) Insumos colombianos 2025
  const EFFECTIVE_DATE = new Date('2025-01-01');
  let resCreated = 0;
  let resSkipped = 0;
  for (const r of COLOMBIAN_RESOURCES) {
    const existing = await prisma.resource.findUnique({ where: { code: r.code } });
    if (!existing) {
      await prisma.resource.create({
        data: {
          type: r.type,
          code: r.code,
          name: r.name,
          unit: r.unit,
          rates: { create: { effectiveDate: EFFECTIVE_DATE, unitCost: new Decimal(r.unitCost) } },
        },
      });
      resCreated++;
    } else {
      resSkipped++;
    }
  }
  console.log(`  ✓ Insumos colombianos 2025: ${resCreated} creados, ${resSkipped} ya existían`);

  console.log('✅ Seed completado.');
}

main()
  .catch((err) => {
    console.error('❌ Seed falló:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
