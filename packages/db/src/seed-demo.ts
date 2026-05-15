/**
 * seed-demo.ts — Datos demostrativos para el proyecto Santa Isabel (NO_VIS)
 *
 * Ejecutar con:
 *   cd C:\Users\resid\OneDrive\Documentos\CLAUDE\packages\db
 *   npx tsx src/seed-demo.ts
 */

import Decimal from 'decimal.js';
import { prisma } from './client';

async function main() {
  console.log('🌱 seed-demo: Iniciando carga de datos demostrativos...\n');

  // ============================================================
  // 1. Buscar el proyecto SI-001
  // ============================================================
  console.log('1. Buscando proyecto SI-001...');
  const project = await prisma.project.findFirst({
    where: { code: 'SI-001' },
  });
  if (!project) {
    console.error('❌ Proyecto SI-001 no encontrado. Crea primero el proyecto vía API o seed base.');
    process.exit(1);
  }
  const projectId = project.id;
  console.log(`   ✓ Proyecto: "${project.name}" (id=${projectId})\n`);

  // ============================================================
  // 2. Obtener admin user
  // ============================================================
  console.log('2. Buscando usuario admin...');
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@santaisabel.local' },
  });
  if (!admin) {
    console.error('❌ Usuario admin@santaisabel.local no encontrado.');
    process.exit(1);
  }
  const adminId = admin.id;
  console.log(`   ✓ Admin: ${admin.email} (id=${adminId})\n`);

  // ============================================================
  // 3. Crear/actualizar AIUConfig
  // ============================================================
  console.log('3. Configurando AIU...');
  const aiu = await prisma.aIUConfig.upsert({
    where: { projectId },
    update: {
      administracionPct: new Decimal(8),
      imprevistosPct: new Decimal(3),
      utilidadPct: new Decimal(10),
      ivaUtilidadPct: new Decimal(19),
    },
    create: {
      projectId,
      administracionPct: new Decimal(8),
      imprevistosPct: new Decimal(3),
      utilidadPct: new Decimal(10),
      ivaUtilidadPct: new Decimal(19),
    },
  });
  console.log(`   ✓ AIU: A=${aiu.administracionPct}% I=${aiu.imprevistosPct}% U=${aiu.utilidadPct}% IVA=${aiu.ivaUtilidadPct}%\n`);

  // ============================================================
  // 4. Crear ítems de presupuesto
  // ============================================================
  console.log('4. Creando ítems de presupuesto...');

  // Verificar si ya existen subchapters para evitar duplicados
  const existingSubchapters = await prisma.subchapter.count({
    where: { chapter: { projectId } },
  });

  if (existingSubchapters > 0) {
    console.log(`   • Subchapters ya existen (${existingSubchapters}), saltando creación de ítems de presupuesto.`);
  } else {
    // Cargar capítulos del proyecto
    const chapters = await prisma.chapter.findMany({
      where: { projectId },
    });
    console.log(`   → Capítulos encontrados: ${chapters.length}`);

    // Helper para encontrar capítulo por prefijo numérico en el código
    const findChapter = (codePrefix: string) =>
      chapters.find((c) => c.code === codePrefix);

    // ---- CAPÍTULO 04: Actividades preliminares ----
    const ch04 = findChapter('04');
    if (ch04) {
      const sub04 = await prisma.subchapter.create({
        data: {
          chapterId: ch04.id,
          code: '04-01',
          name: 'Actividades previas',
          order: 1,
        },
      });
      await prisma.budgetItem.createMany({
        data: [
          {
            subchapterId: sub04.id,
            code: '04-01-01',
            description: 'Cerramiento provisional',
            unit: 'glb',
            quantity: new Decimal(1),
            unitCost: new Decimal(8500000),
            totalCost: new Decimal(1).times(8500000),
            order: 1,
          },
          {
            subchapterId: sub04.id,
            code: '04-01-02',
            description: 'Localización y replanteo',
            unit: 'm2',
            quantity: new Decimal(2500),
            unitCost: new Decimal(1200),
            totalCost: new Decimal(2500).times(1200),
            order: 2,
          },
          {
            subchapterId: sub04.id,
            code: '04-01-03',
            description: 'Descapote manual',
            unit: 'm2',
            quantity: new Decimal(2500),
            unitCost: new Decimal(3500),
            totalCost: new Decimal(2500).times(3500),
            order: 3,
          },
        ],
        skipDuplicates: true,
      });
      console.log(`   ✓ Cap 04 Preliminares: 3 ítems creados`);
    } else {
      console.log(`   ⚠ Capítulo 04 no encontrado`);
    }

    // ---- CAPÍTULO 05: Cimentación ----
    const ch05 = findChapter('05');
    if (ch05) {
      const sub05 = await prisma.subchapter.create({
        data: {
          chapterId: ch05.id,
          code: '05-01',
          name: 'Pilotaje y zapatas',
          order: 1,
        },
      });
      await prisma.budgetItem.createMany({
        data: [
          {
            subchapterId: sub05.id,
            code: '05-01-01',
            description: 'Pilotes D=30cm L=12m',
            unit: 'und',
            quantity: new Decimal(48),
            unitCost: new Decimal(2800000),
            totalCost: new Decimal(48).times(2800000),
            order: 1,
          },
          {
            subchapterId: sub05.id,
            code: '05-01-02',
            description: 'Viga de amarre 30x40',
            unit: 'ml',
            quantity: new Decimal(280),
            unitCost: new Decimal(185000),
            totalCost: new Decimal(280).times(185000),
            order: 2,
          },
          {
            subchapterId: sub05.id,
            code: '05-01-03',
            description: 'Excavación mecánica',
            unit: 'm3',
            quantity: new Decimal(1200),
            unitCost: new Decimal(45000),
            totalCost: new Decimal(1200).times(45000),
            order: 3,
          },
        ],
        skipDuplicates: true,
      });
      console.log(`   ✓ Cap 05 Cimentación: 3 ítems creados`);
    } else {
      console.log(`   ⚠ Capítulo 05 no encontrado`);
    }

    // ---- CAPÍTULO 06: Estructura ----
    const ch06 = findChapter('06');
    if (ch06) {
      const sub06 = await prisma.subchapter.create({
        data: {
          chapterId: ch06.id,
          code: '06-01',
          name: 'Estructura en concreto',
          order: 1,
        },
      });
      await prisma.budgetItem.createMany({
        data: [
          {
            subchapterId: sub06.id,
            code: '06-01-01',
            description: "Concreto columnas f'c=28MPa",
            unit: 'm3',
            quantity: new Decimal(185),
            unitCost: new Decimal(620000),
            totalCost: new Decimal(185).times(620000),
            order: 1,
          },
          {
            subchapterId: sub06.id,
            code: '06-01-02',
            description: "Concreto vigas f'c=28MPa",
            unit: 'm3',
            quantity: new Decimal(210),
            unitCost: new Decimal(590000),
            totalCost: new Decimal(210).times(590000),
            order: 2,
          },
          {
            subchapterId: sub06.id,
            code: '06-01-03',
            description: 'Concreto losa maciza e=25cm',
            unit: 'm3',
            quantity: new Decimal(320),
            unitCost: new Decimal(580000),
            totalCost: new Decimal(320).times(580000),
            order: 3,
          },
          {
            subchapterId: sub06.id,
            code: '06-01-04',
            description: 'Acero de refuerzo fy=420MPa',
            unit: 'kg',
            quantity: new Decimal(42000),
            unitCost: new Decimal(3800),
            totalCost: new Decimal(42000).times(3800),
            order: 4,
          },
        ],
        skipDuplicates: true,
      });
      console.log(`   ✓ Cap 06 Estructura: 4 ítems creados`);
    } else {
      console.log(`   ⚠ Capítulo 06 no encontrado`);
    }

    // ---- CAPÍTULO 07: Mampostería ----
    const ch07 = findChapter('07');
    if (ch07) {
      const sub07 = await prisma.subchapter.create({
        data: {
          chapterId: ch07.id,
          code: '07-01',
          name: 'Muros y divisiones',
          order: 1,
        },
      });
      await prisma.budgetItem.createMany({
        data: [
          {
            subchapterId: sub07.id,
            code: '07-01-01',
            description: 'Muro bloque No.4 e=12cm',
            unit: 'm2',
            quantity: new Decimal(3200),
            unitCost: new Decimal(42000),
            totalCost: new Decimal(3200).times(42000),
            order: 1,
          },
          {
            subchapterId: sub07.id,
            code: '07-01-02',
            description: 'Muro bloque No.5 e=15cm',
            unit: 'm2',
            quantity: new Decimal(1800),
            unitCost: new Decimal(52000),
            totalCost: new Decimal(1800).times(52000),
            order: 2,
          },
        ],
        skipDuplicates: true,
      });
      console.log(`   ✓ Cap 07 Mampostería: 2 ítems creados`);
    } else {
      console.log(`   ⚠ Capítulo 07 no encontrado`);
    }

    // ---- CAPÍTULO 08: Cubierta ----
    const ch08 = findChapter('08');
    if (ch08) {
      const sub08 = await prisma.subchapter.create({
        data: {
          chapterId: ch08.id,
          code: '08-01',
          name: 'Cubierta e impermeabilización',
          order: 1,
        },
      });
      await prisma.budgetItem.createMany({
        data: [
          {
            subchapterId: sub08.id,
            code: '08-01-01',
            description: 'Impermeabilización cubierta',
            unit: 'm2',
            quantity: new Decimal(450),
            unitCost: new Decimal(85000),
            totalCost: new Decimal(450).times(85000),
            order: 1,
          },
          {
            subchapterId: sub08.id,
            code: '08-01-02',
            description: 'Teja termoacústica',
            unit: 'm2',
            quantity: new Decimal(380),
            unitCost: new Decimal(95000),
            totalCost: new Decimal(380).times(95000),
            order: 2,
          },
        ],
        skipDuplicates: true,
      });
      console.log(`   ✓ Cap 08 Cubierta: 2 ítems creados`);
    } else {
      console.log(`   ⚠ Capítulo 08 no encontrado`);
    }

    // ---- CAPÍTULO 12: Pañetes y acabados ----
    const ch12 = findChapter('12');
    if (ch12) {
      const sub12 = await prisma.subchapter.create({
        data: {
          chapterId: ch12.id,
          code: '12-01',
          name: 'Pisos y enchapes',
          order: 1,
        },
      });
      await prisma.budgetItem.createMany({
        data: [
          {
            subchapterId: sub12.id,
            code: '12-01-01',
            description: 'Piso porcelanato 60x60',
            unit: 'm2',
            quantity: new Decimal(2800),
            unitCost: new Decimal(125000),
            totalCost: new Decimal(2800).times(125000),
            order: 1,
          },
          {
            subchapterId: sub12.id,
            code: '12-01-02',
            description: 'Enchape baño piso-pared',
            unit: 'm2',
            quantity: new Decimal(480),
            unitCost: new Decimal(145000),
            totalCost: new Decimal(480).times(145000),
            order: 2,
          },
          {
            subchapterId: sub12.id,
            code: '12-01-03',
            description: 'Pintura vinilo tipo 1 dos manos',
            unit: 'm2',
            quantity: new Decimal(8500),
            unitCost: new Decimal(18500),
            totalCost: new Decimal(8500).times(18500),
            order: 3,
          },
        ],
        skipDuplicates: true,
      });
      console.log(`   ✓ Cap 12 Acabados: 3 ítems creados`);
    } else {
      console.log(`   ⚠ Capítulo 12 no encontrado`);
    }
  }
  console.log();

  // ============================================================
  // 5. Crear tareas (cronograma)
  // ============================================================
  console.log('5. Creando tareas de cronograma...');
  const existingTasks = await prisma.task.count({ where: { projectId } });

  if (existingTasks > 0) {
    console.log(`   • Tareas ya existen (${existingTasks}), saltando.\n`);
  } else {
    const tasksData = [
      { code: 'P-01', name: 'Cerramiento y localización',      plannedStart: '2024-01-15', plannedEnd: '2024-01-29', durationDays: 15, progress: 100, order: 1 },
      { code: 'P-02', name: 'Descapote y excavación',           plannedStart: '2024-01-22', plannedEnd: '2024-02-09', durationDays: 19, progress: 100, order: 2 },
      { code: 'P-03', name: 'Pilotaje',                         plannedStart: '2024-02-05', plannedEnd: '2024-03-01', durationDays: 25, progress: 100, order: 3 },
      { code: 'P-04', name: 'Vigas de amarre y losa de piso',   plannedStart: '2024-02-26', plannedEnd: '2024-03-22', durationDays: 25, progress: 100, order: 4 },
      { code: 'E-01', name: 'Columnas piso 1',                  plannedStart: '2024-03-18', plannedEnd: '2024-04-05', durationDays: 19, progress: 100, order: 5 },
      { code: 'E-02', name: 'Vigas y losa piso 1',              plannedStart: '2024-04-01', plannedEnd: '2024-04-26', durationDays: 26, progress: 90,  order: 6 },
      { code: 'E-03', name: 'Columnas piso 2',                  plannedStart: '2024-04-22', plannedEnd: '2024-05-10', durationDays: 19, progress: 85,  order: 7 },
      { code: 'E-04', name: 'Vigas y losa piso 2',              plannedStart: '2024-05-06', plannedEnd: '2024-05-31', durationDays: 26, progress: 75,  order: 8 },
      { code: 'E-05', name: 'Columnas piso 3',                  plannedStart: '2024-05-27', plannedEnd: '2024-06-14', durationDays: 19, progress: 60,  order: 9 },
      { code: 'E-06', name: 'Vigas y losa piso 3',              plannedStart: '2024-06-10', plannedEnd: '2024-07-05', durationDays: 26, progress: 30,  order: 10 },
      { code: 'E-07', name: 'Columnas piso 4-8',                plannedStart: '2024-07-01', plannedEnd: '2024-09-30', durationDays: 91, progress: 0,   order: 11 },
      { code: 'M-01', name: 'Mampostería piso 1-2',             plannedStart: '2024-05-01', plannedEnd: '2024-06-28', durationDays: 58, progress: 40,  order: 12 },
      { code: 'M-02', name: 'Mampostería piso 3-8',             plannedStart: '2024-07-15', plannedEnd: '2024-10-31', durationDays: 108, progress: 0, order: 13 },
      { code: 'A-01', name: 'Cubierta e impermeabilización',    plannedStart: '2024-10-01', plannedEnd: '2024-10-31', durationDays: 31, progress: 0,   order: 14 },
      { code: 'A-02', name: 'Pisos y enchapes',                 plannedStart: '2024-10-15', plannedEnd: '2025-01-31', durationDays: 108, progress: 0, order: 15 },
      { code: 'A-03', name: 'Pintura y acabados finales',       plannedStart: '2025-01-15', plannedEnd: '2025-03-31', durationDays: 75, progress: 0,   order: 16 },
      { code: 'I-01', name: 'Instalaciones hidráulicas',        plannedStart: '2024-04-01', plannedEnd: '2024-11-30', durationDays: 243, progress: 35, order: 17 },
      { code: 'I-02', name: 'Instalaciones eléctricas',         plannedStart: '2024-04-15', plannedEnd: '2024-12-15', durationDays: 243, progress: 25, order: 18 },
      { code: 'EN-01', name: 'Entrega y dotación',              plannedStart: '2025-03-01', plannedEnd: '2025-06-30', durationDays: 121, progress: 0, order: 19 },
    ];

    await prisma.task.createMany({
      data: tasksData.map((t) => ({
        projectId,
        code: t.code,
        name: t.name,
        kind: 'TASK' as const,
        plannedStart: new Date(t.plannedStart),
        plannedEnd: new Date(t.plannedEnd),
        durationDays: t.durationDays,
        // progress stored as fraction 0.0000–1.0000 (Decimal(6,4))
        progress: new Decimal(t.progress).dividedBy(100),
        order: t.order,
        isCritical: false,
        totalFloat: 0,
      })),
      skipDuplicates: true,
    });
    console.log(`   ✓ ${tasksData.length} tareas creadas.\n`);
  }

  // ============================================================
  // 6. Crear Torre y Unidades
  // ============================================================
  console.log('6. Creando Torre Única y 32 unidades...');
  const existingTower = await prisma.tower.findFirst({ where: { projectId } });

  let towerId: string;
  if (existingTower) {
    towerId = existingTower.id;
    console.log(`   • Torre ya existe (id=${towerId}), verificando unidades...`);
  } else {
    const tower = await prisma.tower.create({
      data: {
        projectId,
        code: 'TU-01',
        name: 'Torre Única',
        floors: 8,
      },
    });
    towerId = tower.id;
    console.log(`   ✓ Torre creada: "${tower.name}" (id=${towerId})`);
  }

  const existingUnits = await prisma.unit.count({ where: { projectId, towerId } });
  if (existingUnits > 0) {
    console.log(`   • Unidades ya existen (${existingUnits}), saltando creación de unidades y ventas.\n`);
  } else {
    const buyers = [
      { name: 'Carlos Rodríguez',   doc: '79512345' },
      { name: 'María González',      doc: '52634891' },
      { name: 'Juan Martínez',       doc: '80234567' },
      { name: 'Ana López',           doc: '51789456' },
      { name: 'Pedro Sánchez',       doc: '71345678' },
      { name: 'Lucía Hernández',     doc: '43567890' },
      { name: 'Diego Ramírez',       doc: '80987654' },
      { name: 'Sofía Torres',        doc: '52109876' },
    ];

    let buyerIdx = 0;
    let unitOrder = 0;

    for (let floor = 1; floor <= 8; floor++) {
      for (let apt = 1; apt <= 4; apt++) {
        unitOrder++;
        const unitCode = `${String(floor).padStart(2, '0')}-${String(apt).padStart(2, '0')}`;

        let tipo: string;
        let saleableAreaM2: Decimal;
        let terraceAreaM2: Decimal;
        let listPrice: Decimal;
        let status: 'DISPONIBLE' | 'RESERVADA' | 'VENDIDA';

        if (floor <= 2) {
          // Piso 1-2: APT-60 - VENDIDA (8 units)
          tipo = 'APT-60';
          saleableAreaM2 = new Decimal('62.5');
          terraceAreaM2 = new Decimal(0);
          listPrice = new Decimal(285000000);
          status = 'VENDIDA';
        } else if (floor <= 5) {
          // Piso 3-5: APT-65 - DISPONIBLE excepto 2 RESERVADA
          tipo = 'APT-65';
          saleableAreaM2 = new Decimal('67.8');
          terraceAreaM2 = new Decimal(0);
          listPrice = new Decimal(320000000);
          // Units 1 y 2 del piso 3 serán RESERVADA
          if (floor === 3 && apt <= 2) {
            status = 'RESERVADA';
          } else {
            status = 'DISPONIBLE';
          }
        } else {
          // Piso 6-8: APT-70-PH - DISPONIBLE excepto 1 RESERVADA
          tipo = 'APT-70-PH';
          saleableAreaM2 = new Decimal('72.3');
          terraceAreaM2 = new Decimal('18.5');
          listPrice = new Decimal(380000000);
          // 1 unidad RESERVADA (piso 6, apt 1)
          if (floor === 6 && apt === 1) {
            status = 'RESERVADA';
          } else {
            status = 'DISPONIBLE';
          }
        }

        const unit = await prisma.unit.create({
          data: {
            projectId,
            towerId,
            code: unitCode,
            kind: 'APARTAMENTO',
            floor,
            privateAreaM2: saleableAreaM2,
            commonAreaM2: terraceAreaM2,
            saleableAreaM2,
            listPrice,
            status,
          },
        });

        // Crear venta para unidades VENDIDA
        if (status === 'VENDIDA') {
          const buyer = buyers[buyerIdx % buyers.length];
          buyerIdx++;
          const salePrice = listPrice.times('1.02').toDecimalPlaces(2);
          // Fechas de venta en 2024 Q1
          const saleDates = ['2024-01-20', '2024-01-25', '2024-02-05', '2024-02-12',
                             '2024-02-20', '2024-03-01', '2024-03-10', '2024-03-18'];
          const saleDateStr = saleDates[(buyerIdx - 1) % saleDates.length];

          await prisma.sale.create({
            data: {
              unitId: unit.id,
              buyerName: buyer.name,
              buyerDocument: buyer.doc,
              salePrice,
              reservationDate: new Date(saleDateStr),
              isActive: true,
            },
          });
        }
      }
    }
    console.log(`   ✓ 32 unidades creadas (8 VENDIDA, 3 RESERVADA, 21 DISPONIBLE)`);
    console.log(`   ✓ 8 registros de venta creados\n`);
  }

  // ============================================================
  // 7. Crear entradas de flujo de caja
  // ============================================================
  console.log('7. Creando entradas de flujo de caja...');
  const existingCashEntries = await prisma.cashFlowEntry.count({ where: { projectId } });

  if (existingCashEntries > 0) {
    console.log(`   • Entradas ya existen (${existingCashEntries}), saltando.\n`);
  } else {
    const egresosConstr: Array<{ date: string; amount: number; description: string }> = [
      { date: '2024-01-31', amount: 45000000,  description: 'Preliminares y descapote' },
      { date: '2024-02-29', amount: 85000000,  description: 'Pilotaje y cimentación' },
      { date: '2024-03-31', amount: 120000000, description: 'Estructura piso 1-2' },
      { date: '2024-04-30', amount: 135000000, description: 'Estructura piso 2-3' },
      { date: '2024-05-31', amount: 118000000, description: 'Estructura + mampostería' },
      { date: '2024-06-30', amount: 95000000,  description: 'Mampostería y estructura' },
      { date: '2024-07-31', amount: 88000000,  description: 'Mampostería pisos altos' },
      { date: '2024-08-31', amount: 72000000,  description: 'Continuación mampostería' },
      { date: '2024-09-30', amount: 65000000,  description: 'Instalaciones hidráulicas' },
      { date: '2024-10-31', amount: 58000000,  description: 'Instalaciones eléctricas' },
      { date: '2024-11-30', amount: 42000000,  description: 'Cubierta' },
    ];

    const ingresosVentas: Array<{ date: string; amount: number; description: string }> = [
      { date: '2024-01-31', amount: 100000000, description: 'Cuotas iniciales apartamentos piso 1' },
      { date: '2024-03-31', amount: 150000000, description: 'Cuotas apartamentos piso 1-2' },
      { date: '2024-05-31', amount: 180000000, description: 'Cuotas progresivas vendidos' },
      { date: '2024-07-31', amount: 95000000,  description: 'Pagos cuotas mensuales' },
      { date: '2024-09-30', amount: 85000000,  description: 'Cuotas mensuales' },
      { date: '2024-11-30', amount: 75000000,  description: 'Cuotas diciembre' },
    ];

    const cashEntries = [
      // Egresos construcción
      ...egresosConstr.map((e) => ({
        projectId,
        date: new Date(e.date),
        kind: 'EGRESO' as const,
        category: 'EGRESO_CAPITULO' as const,
        description: e.description,
        amount: new Decimal(e.amount),
      })),
      // Ingresos ventas
      ...ingresosVentas.map((e) => ({
        projectId,
        date: new Date(e.date),
        kind: 'INGRESO' as const,
        category: 'VENTA_CUOTA_INICIAL' as const,
        description: e.description,
        amount: new Decimal(e.amount),
      })),
      // Egreso gerencia
      {
        projectId,
        date: new Date('2024-06-30'),
        kind: 'EGRESO' as const,
        category: 'OTRO' as const,
        description: 'Honorarios gerencia proyecto',
        amount: new Decimal(28000000),
      },
    ];

    await prisma.cashFlowEntry.createMany({
      data: cashEntries,
      skipDuplicates: true,
    });
    console.log(`   ✓ ${cashEntries.length} entradas de flujo de caja creadas.\n`);
  }

  // ============================================================
  // 8. Crear órdenes de cambio
  // ============================================================
  console.log('8. Creando órdenes de cambio...');
  const existingCOs = await prisma.changeOrder.count({ where: { projectId } });

  if (existingCOs > 0) {
    console.log(`   • Órdenes de cambio ya existen (${existingCOs}), saltando.\n`);
  } else {
    // OC-001: APLICADA
    const oc001 = await prisma.changeOrder.create({
      data: {
        projectId,
        code: 'OC-001',
        title: 'Cambio especificaciones piso porcelanato',
        justification: 'Cliente solicita porcelanato importado 80x80 en zonas comunes',
        estimatedCostImpact: new Decimal(18500000),
        estimatedScheduleImpactDays: 5,
        status: 'APLICADA',
        createdById: adminId,
        appliedAt: new Date('2024-04-15'),
      },
    });

    // Approval para OC-001
    await prisma.approval.create({
      data: {
        changeOrderId: oc001.id,
        approverId: adminId,
        decision: 'APROBADO',
        comments: 'Aprobado por gerencia. Impacto en costo y tiempo aceptable.',
        decidedAt: new Date('2024-04-10'),
      },
    });

    // BudgetBaseline para OC-001
    await prisma.budgetBaseline.create({
      data: {
        projectId,
        version: 1,
        label: 'OC-001 — Cambio especificaciones piso porcelanato',
        frozenAt: new Date('2024-04-15'),
        snapshot: {},
        createdById: adminId,
      },
    });

    console.log(`   ✓ OC-001 creada (APLICADA) + aprobación + baseline`);

    // OC-002: EN_REVISION
    await prisma.changeOrder.create({
      data: {
        projectId,
        code: 'OC-002',
        title: 'Refuerzo adicional columnas por cambio NSR',
        justification: 'Actualización NSR-10 requiere refuerzo adicional en columnas perimetrales',
        estimatedCostImpact: new Decimal(32000000),
        estimatedScheduleImpactDays: 8,
        status: 'EN_REVISION',
        createdById: adminId,
      },
    });
    console.log(`   ✓ OC-002 creada (EN_REVISION)\n`);
  }

  console.log('✅ seed-demo completado exitosamente.');
  console.log('\n📊 Resumen:');
  console.log(`   Proyecto: ${project.name} (${project.code})`);
  console.log(`   AIU: A=8% I=3% U=10% IVA=19%`);
  console.log(`   Capítulos con ítems: 6 (04, 05, 06, 07, 08, 12)`);
  console.log(`   Tareas de cronograma: 19`);
  console.log(`   Torre: Torre Única — 8 pisos x 4 aptos = 32 unidades`);
  console.log(`   Ventas creadas: 8`);
  console.log(`   Entradas flujo de caja: 18`);
  console.log(`   Órdenes de cambio: 2 (OC-001 APLICADA, OC-002 EN_REVISION)`);
}

main()
  .catch((err) => {
    console.error('❌ seed-demo falló:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
