import argon2 from 'argon2';
import { STANDARD_CHAPTERS } from '@santaisabel/shared';

import { prisma } from './client';
import { colombianHolidaysRange } from './holidays';

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
