import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLogbookEntryDto, UpdateLogbookEntryDto, ListLogbookDto } from './logbook.dto';

const ENTRY_INCLUDE = {
  photos:         { orderBy: { order: 'asc' as const } },
  documents:      true,
  personnel:      true,
  equipment:      true,
  materials:      true,
  activities:     { orderBy: { order: 'asc' as const } },
  technicalVisits: true,
  delays:         true,
} as const;

@Injectable()
export class LogbookService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List entries ──────────────────────────────────────────────────────────

  async list(projectId: string, dto: ListLogbookDto) {
    const where: Record<string, unknown> = { projectId };

    if (dto.dateFrom || dto.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dto.dateFrom) dateFilter.gte = new Date(dto.dateFrom);
      if (dto.dateTo)   dateFilter.lte = new Date(dto.dateTo + 'T23:59:59');
      where.date = dateFilter;
    }

    if (dto.status !== 'ALL') where.status = dto.status;

    if (dto.search?.trim()) {
      const s = dto.search.trim();
      where.OR = [
        { generalNotes:  { contains: s, mode: 'insensitive' } },
        { safetyNotes:   { contains: s, mode: 'insensitive' } },
        { qualityNotes:  { contains: s, mode: 'insensitive' } },
        { authorName:    { contains: s, mode: 'insensitive' } },
        { activities:    { some: { description: { contains: s, mode: 'insensitive' } } } },
        { technicalVisits: { some: { specialistName: { contains: s, mode: 'insensitive' } } } },
      ];
    }

    const skip = (dto.page - 1) * dto.limit;

    const [total, entries] = await this.prisma.$transaction([
      this.prisma.logbookEntry.count({ where }),
      this.prisma.logbookEntry.findMany({
        where,
        include: {
          photos:          { take: 3, orderBy: { order: 'asc' } },
          personnel:       true,
          activities:      { take: 3 },
          technicalVisits: { take: 2 },
          delays:          { take: 2 },
          _count: { select: { photos: true, activities: true, technicalVisits: true, delays: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: dto.limit,
      }),
    ]);

    return {
      data:  entries,
      total,
      page:  dto.page,
      limit: dto.limit,
      pages: Math.ceil(total / dto.limit),
    };
  }

  // ── Get single entry ──────────────────────────────────────────────────────

  async findOne(projectId: string, id: string) {
    const entry = await this.prisma.logbookEntry.findFirst({
      where: { id, projectId },
      include: ENTRY_INCLUDE,
    });
    if (!entry) throw new NotFoundException('Entrada de bitácora no encontrada');
    return entry;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(projectId: string, dto: CreateLogbookEntryDto) {
    const { photos, personnel, equipment, materials, activities, technicalVisits, delays, ...header } = dto;

    return this.prisma.logbookEntry.create({
      data: {
        projectId,
        date:         new Date(dto.date),
        status:       header.status,
        weather:      header.weather,
        weatherDesc:  header.weatherDesc,
        temperatureC: header.temperatureC != null ? String(header.temperatureC) : null,
        humidity:     header.humidity,
        windSpeedKmh: header.windSpeedKmh != null ? String(header.windSpeedKmh) : null,
        shift:        header.shift,
        generalNotes: header.generalNotes,
        safetyNotes:  header.safetyNotes,
        qualityNotes: header.qualityNotes,
        authorName:   header.authorName,
        authorRole:   header.authorRole,
        photos:          { create: photos.map((p) => ({
          url:       p.url,
          dataUrl:   p.dataUrl,
          caption:   p.caption,
          takenAt:   p.takenAt ? new Date(p.takenAt) : null,
          lat:       p.lat != null ? String(p.lat) : null,
          lng:       p.lng != null ? String(p.lng) : null,
          sizeBytes: p.sizeBytes,
          mimeType:  p.mimeType,
          order:     p.order,
        })) },
        personnel:       { create: personnel.map((p) => ({
          role:         p.role,
          name:         p.name,
          count:        p.count,
          hoursWorked:  String(p.hoursWorked),
          company:      p.company,
          observations: p.observations,
        })) },
        equipment:       { create: equipment.map((e) => ({
          type:           e.type,
          quantity:       e.quantity,
          hoursOperated:  String(e.hoursOperated),
          operator:       e.operator,
          observations:   e.observations,
        })) },
        materials:       { create: materials.map((m) => ({
          name:     m.name,
          quantity: String(m.quantity),
          unit:     m.unit,
          supplier: m.supplier,
          notes:    m.notes,
        })) },
        activities:      { create: activities.map((a) => ({
          description:  a.description,
          progressPct:  a.progressPct != null ? String(a.progressPct) : null,
          crew:         a.crew,
          location:     a.location,
          observations: a.observations,
          order:        a.order,
        })) },
        technicalVisits: { create: technicalVisits.map((v) => ({
          specialistName: v.specialistName,
          company:        v.company,
          specialty:      v.specialty,
          visitReason:    v.visitReason,
          findings:       v.findings,
          instructions:   v.instructions,
          nextVisitDate:  v.nextVisitDate ? new Date(v.nextVisitDate) : null,
        })) },
        delays: { create: delays.map((d) => ({
          type:        d.type,
          description: d.description,
          actionTaken: d.actionTaken,
          impactDays:  d.impactDays != null ? String(d.impactDays) : null,
          responsible: d.responsible,
        })) },
      },
      include: ENTRY_INCLUDE,
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(projectId: string, id: string, dto: UpdateLogbookEntryDto) {
    await this.findOne(projectId, id);

    const { photos, personnel, equipment, materials, activities, technicalVisits, delays, ...header } = dto;

    // Delete and recreate related rows for simplicity
    const deletes = [];
    if (photos)          deletes.push(this.prisma.logbookPhoto.deleteMany({ where: { entryId: id } }));
    if (personnel)       deletes.push(this.prisma.logbookPersonnel.deleteMany({ where: { entryId: id } }));
    if (equipment)       deletes.push(this.prisma.logbookEquipment.deleteMany({ where: { entryId: id } }));
    if (materials)       deletes.push(this.prisma.logbookMaterial.deleteMany({ where: { entryId: id } }));
    if (activities)      deletes.push(this.prisma.logbookActivity.deleteMany({ where: { entryId: id } }));
    if (technicalVisits) deletes.push(this.prisma.logbookTechnicalVisit.deleteMany({ where: { entryId: id } }));
    if (delays)          deletes.push(this.prisma.logbookDelay.deleteMany({ where: { entryId: id } }));
    if (deletes.length)  await this.prisma.$transaction(deletes);

    return this.prisma.logbookEntry.update({
      where: { id },
      data: {
        ...(header.date         && { date: new Date(header.date) }),
        ...(header.status       && { status: header.status }),
        ...(header.weather      && { weather: header.weather }),
        ...(header.weatherDesc  !== undefined && { weatherDesc: header.weatherDesc }),
        ...(header.temperatureC !== undefined && { temperatureC: header.temperatureC != null ? String(header.temperatureC) : null }),
        ...(header.humidity     !== undefined && { humidity: header.humidity }),
        ...(header.windSpeedKmh !== undefined && { windSpeedKmh: header.windSpeedKmh != null ? String(header.windSpeedKmh) : null }),
        ...(header.shift        && { shift: header.shift }),
        ...(header.generalNotes && { generalNotes: header.generalNotes }),
        ...(header.safetyNotes  !== undefined && { safetyNotes: header.safetyNotes }),
        ...(header.qualityNotes !== undefined && { qualityNotes: header.qualityNotes }),
        ...(header.authorName   && { authorName: header.authorName }),
        ...(header.authorRole   && { authorRole: header.authorRole }),
        ...(photos && { photos: { create: photos.map((p) => ({
          url: p.url, dataUrl: p.dataUrl, caption: p.caption,
          takenAt: p.takenAt ? new Date(p.takenAt) : null,
          lat: p.lat != null ? String(p.lat) : null,
          lng: p.lng != null ? String(p.lng) : null,
          sizeBytes: p.sizeBytes, mimeType: p.mimeType, order: p.order,
        })) } }),
        ...(personnel && { personnel: { create: personnel.map((p) => ({
          role: p.role, name: p.name, count: p.count, hoursWorked: String(p.hoursWorked),
          company: p.company, observations: p.observations,
        })) } }),
        ...(equipment && { equipment: { create: equipment.map((e) => ({
          type: e.type, quantity: e.quantity, hoursOperated: String(e.hoursOperated),
          operator: e.operator, observations: e.observations,
        })) } }),
        ...(materials && { materials: { create: materials.map((m) => ({
          name: m.name, quantity: String(m.quantity), unit: m.unit,
          supplier: m.supplier, notes: m.notes,
        })) } }),
        ...(activities && { activities: { create: activities.map((a) => ({
          description: a.description, progressPct: a.progressPct != null ? String(a.progressPct) : null,
          crew: a.crew, location: a.location, observations: a.observations, order: a.order,
        })) } }),
        ...(technicalVisits && { technicalVisits: { create: technicalVisits.map((v) => ({
          specialistName: v.specialistName, company: v.company, specialty: v.specialty,
          visitReason: v.visitReason, findings: v.findings, instructions: v.instructions,
          nextVisitDate: v.nextVisitDate ? new Date(v.nextVisitDate) : null,
        })) } }),
        ...(delays && { delays: { create: delays.map((d) => ({
          type: d.type, description: d.description, actionTaken: d.actionTaken,
          impactDays: d.impactDays != null ? String(d.impactDays) : null, responsible: d.responsible,
        })) } }),
      },
      include: ENTRY_INCLUDE,
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async remove(projectId: string, id: string) {
    await this.findOne(projectId, id);
    await this.prisma.logbookEntry.delete({ where: { id } });
    return { ok: true };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async stats(projectId: string) {
    const [total, drafts, finals, lastEntry] = await this.prisma.$transaction([
      this.prisma.logbookEntry.count({ where: { projectId } }),
      this.prisma.logbookEntry.count({ where: { projectId, status: 'DRAFT' } }),
      this.prisma.logbookEntry.count({ where: { projectId, status: 'FINAL' } }),
      this.prisma.logbookEntry.findFirst({
        where: { projectId },
        orderBy: { date: 'desc' },
        select: { date: true, weather: true, authorName: true },
      }),
    ]);
    return { total, drafts, finals, lastEntry };
  }
}
