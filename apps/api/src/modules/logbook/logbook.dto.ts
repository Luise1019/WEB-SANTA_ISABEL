import { z } from 'zod';

export const PersonnelDto = z.object({
  role:         z.string().min(1),
  name:         z.string().optional(),
  count:        z.number().int().min(1).default(1),
  hoursWorked:  z.number().min(0).max(24).default(8),
  company:      z.string().optional(),
  observations: z.string().optional(),
});

export const EquipmentDto = z.object({
  type:           z.string().min(1),
  quantity:       z.number().int().min(1).default(1),
  hoursOperated:  z.number().min(0).max(24).default(8),
  operator:       z.string().optional(),
  observations:   z.string().optional(),
});

export const MaterialDto = z.object({
  name:     z.string().min(1),
  quantity: z.number().positive(),
  unit:     z.string().min(1),
  supplier: z.string().optional(),
  notes:    z.string().optional(),
});

export const ActivityDto = z.object({
  description:  z.string().min(1),
  progressPct:  z.number().min(0).max(100).optional(),
  crew:         z.string().optional(),
  location:     z.string().optional(),
  observations: z.string().optional(),
  order:        z.number().int().default(0),
});

export const TechnicalVisitDto = z.object({
  specialistName: z.string().min(1),
  company:        z.string().optional(),
  specialty:      z.string().min(1),
  visitReason:    z.string().min(1),
  findings:       z.string().optional(),
  instructions:   z.string().optional(),
  nextVisitDate:  z.string().optional(),
});

export const DelayDto = z.object({
  type:        z.enum(['WEATHER', 'MATERIALS', 'EQUIPMENT', 'LABOR', 'ADMINISTRATIVE', 'OTHER']),
  description: z.string().min(1),
  actionTaken: z.string().optional(),
  impactDays:  z.number().min(0).optional(),
  responsible: z.string().optional(),
});

export const PhotoDto = z.object({
  url:      z.string(),
  dataUrl:  z.string().optional(),
  caption:  z.string().optional(),
  takenAt:  z.string().optional(),
  lat:      z.number().optional(),
  lng:      z.number().optional(),
  sizeBytes: z.number().int().optional(),
  mimeType: z.string().default('image/jpeg'),
  order:    z.number().int().default(0),
});

export const CreateLogbookEntryDto = z.object({
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status:         z.enum(['DRAFT', 'FINAL']).default('DRAFT'),
  weather:        z.enum(['SUNNY','PARTLY_CLOUDY','CLOUDY','RAINY','STORM','WINDY','FOGGY']).default('SUNNY'),
  weatherDesc:    z.string().optional(),
  temperatureC:   z.number().optional(),
  humidity:       z.number().int().min(0).max(100).optional(),
  windSpeedKmh:   z.number().min(0).optional(),
  shift:          z.enum(['MORNING','AFTERNOON','FULL']).default('FULL'),
  generalNotes:   z.string().min(1),
  safetyNotes:    z.string().optional(),
  qualityNotes:   z.string().optional(),
  authorName:     z.string().min(1),
  authorRole:     z.string().default('Residente de obra'),
  photos:         z.array(PhotoDto).default([]),
  personnel:      z.array(PersonnelDto).default([]),
  equipment:      z.array(EquipmentDto).default([]),
  materials:      z.array(MaterialDto).default([]),
  activities:     z.array(ActivityDto).default([]),
  technicalVisits: z.array(TechnicalVisitDto).default([]),
  delays:         z.array(DelayDto).default([]),
});

export const UpdateLogbookEntryDto = CreateLogbookEntryDto.partial();

export const ListLogbookDto = z.object({
  dateFrom:   z.string().optional(),
  dateTo:     z.string().optional(),
  search:     z.string().optional(),
  status:     z.enum(['DRAFT', 'FINAL', 'ALL']).default('ALL'),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(30),
});

export type CreateLogbookEntryDto = z.infer<typeof CreateLogbookEntryDto>;
export type UpdateLogbookEntryDto = z.infer<typeof UpdateLogbookEntryDto>;
export type ListLogbookDto        = z.infer<typeof ListLogbookDto>;
