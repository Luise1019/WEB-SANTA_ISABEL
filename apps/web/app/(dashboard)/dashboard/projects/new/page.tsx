'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import {
  HousingTypeSchema,
  ProjectStatusSchema,
  ProjectInputSchema,
  type HousingType,
  type ProjectStatus,
} from '@santaisabel/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api-client';

const HOUSING_OPTIONS: Array<{ value: HousingType; label: string }> = [
  { value: 'VIS', label: 'VIS — Vivienda de Interés Social' },
  { value: 'VIP', label: 'VIP — Vivienda de Interés Prioritario' },
  { value: 'NO_VIS', label: 'NO VIS' },
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'MIXTO', label: 'Mixto' },
];

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'PREFACTIBILIDAD', label: 'Prefactibilidad' },
  { value: 'FACTIBILIDAD', label: 'Factibilidad' },
  { value: 'EJECUCION', label: 'Ejecución' },
];

type FormValues = {
  code: string;
  name: string;
  housingType: HousingType;
  status: ProjectStatus;
  city: string;
  department: string;
  startDate: string;
  expectedEndDate: string;
  description: string;
};

export default function NewProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(
      ProjectInputSchema.extend({
        startDate: ProjectInputSchema.shape.startDate,
        expectedEndDate: ProjectInputSchema.shape.expectedEndDate,
        description: ProjectInputSchema.shape.description.unwrap().default(''),
      }) as never,
    ),
    defaultValues: {
      code: '',
      name: '',
      housingType: 'NO_VIS',
      status: 'PREFACTIBILIDAD',
      city: '',
      department: '',
      startDate: '',
      expectedEndDate: '',
      description: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: api.createProject,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push('/dashboard/projects');
    },
  });

  const error = createMutation.error as ApiError | null;

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate({
      code: values.code,
      name: values.name,
      housingType: values.housingType,
      status: values.status,
      city: values.city,
      department: values.department,
      startDate: new Date(values.startDate),
      expectedEndDate: new Date(values.expectedEndDate),
      description: values.description || undefined,
    });
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo proyecto</h1>
        <p className="text-muted-foreground">
          Al crear el proyecto se generan los 20 capítulos estándar (urbanismo, estructura, acabados,
          AIU, etc.) automáticamente.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Datos del proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input id="code" placeholder="SI-001" {...form.register('code')} />
                {form.formState.errors.code && (
                  <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
                )}
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" placeholder="Conjunto Santa Isabel" {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="housingType">Tipo</Label>
                <Select id="housingType" {...form.register('housingType')}>
                  {HOUSING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado inicial</Label>
                <Select id="status" {...form.register('status')}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input id="city" placeholder="Bogotá" {...form.register('city')} />
                {form.formState.errors.city && (
                  <p className="text-xs text-destructive">{form.formState.errors.city.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Departamento</Label>
                <Input id="department" placeholder="Cundinamarca" {...form.register('department')} />
                {form.formState.errors.department && (
                  <p className="text-xs text-destructive">{form.formState.errors.department.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Inicio</Label>
                <Input id="startDate" type="date" {...form.register('startDate')} />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedEndDate">Fin esperado</Label>
                <Input id="expectedEndDate" type="date" {...form.register('expectedEndDate')} />
                {form.formState.errors.expectedEndDate && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.expectedEndDate.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Detalles del proyecto, lote, programa…"
                {...form.register('description')}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">No se pudo crear el proyecto: {error.message}</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creando…' : 'Crear proyecto'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Para garantizar que HousingTypeSchema/ProjectStatusSchema queden importados (treeshake-safe)
void HousingTypeSchema;
void ProjectStatusSchema;
