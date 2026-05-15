'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Lock, Loader2, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { LoginInputSchema, type LoginInput } from '@santaisabel/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const setTokens = useAuth((s) => s.setTokens);
  const accessToken = useAuth((s) => s.accessToken);

  useEffect(() => {
    if (accessToken) router.replace('/dashboard');
  }, [accessToken, router]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: { email: 'admin@santaisabel.local', password: '' },
  });

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (tokens) => {
      setTokens(tokens);
      router.replace('/dashboard');
    },
  });

  const error = loginMutation.error as ApiError | null;
  const errorMessage =
    error?.status === 401
      ? 'Credenciales inválidas.'
      : error
        ? `No se pudo iniciar sesión (${error.message}).`
        : null;

  const hasEmailError = !!form.formState.errors.email;
  const hasPasswordError = !!form.formState.errors.password;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 px-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mb-3 flex items-center justify-center">
            <span className="text-6xl" role="img" aria-label="Edificio">
              🏢
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Santa Isabel</h1>
          <p className="mt-1 text-sm text-slate-300">Gestión de Proyectos Inmobiliarios</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <h2 className="mb-6 text-xl font-semibold text-slate-800">Iniciar sesión</h2>

          <form
            onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))}
            className="space-y-5"
          >
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={cn(
                    'pl-9',
                    hasEmailError && 'border-red-500 focus-visible:ring-red-500',
                  )}
                  {...form.register('email')}
                />
              </div>
              {hasEmailError && (
                <p className="text-xs text-red-600">{form.formState.errors.email?.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className={cn(
                    'pl-9',
                    hasPasswordError && 'border-red-500 focus-visible:ring-red-500',
                  )}
                  {...form.register('password')}
                />
              </div>
              {hasPasswordError && (
                <p className="text-xs text-red-600">{form.formState.errors.password?.message}</p>
              )}
            </div>

            {/* API error */}
            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full bg-slate-800 hover:bg-slate-700"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando…
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400">Colombia · VIS / VIP / NO VIS</p>
      </div>
    </main>
  );
}
