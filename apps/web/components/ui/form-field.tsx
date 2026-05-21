'use client';

import { useId } from 'react';

import { cn } from '@/lib/utils';

/**
 * Wrapper consistente para campos de formulario: label + control + hint + error.
 *
 * Uso:
 *   <FormField label="Nombre" required hint="Razón social completa" error={errors.name}>
 *     <Input value={name} onChange={...} />
 *   </FormField>
 */
export function FormField({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  // Inyectamos id + aria-describedby al hijo si es un elemento de formulario
  const child = injectFieldProps(children, id, hint || error ? `${id}-help` : undefined, !!error);

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-xs font-semibold text-foreground">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {child}
      {(hint || error) && (
        <p
          id={`${id}-help`}
          className={cn('text-[11px]', error ? 'text-danger' : 'text-muted-foreground')}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

function injectFieldProps(
  node: React.ReactNode,
  id: string,
  describedBy: string | undefined,
  hasError: boolean,
): React.ReactNode {
  if (!node || typeof node !== 'object' || !('props' in node)) return node;
  const el = node as React.ReactElement<Record<string, unknown>>;
  return {
    ...el,
    props: {
      ...el.props,
      id: el.props.id ?? id,
      'aria-describedby': describedBy,
      'aria-invalid': hasError || undefined,
    },
  } as React.ReactElement;
}
