import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="container py-16">
      <div className="mx-auto max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">Santa Isabel</h1>
        <p className="text-xl text-muted-foreground">
          Plataforma de gestión de proyectos inmobiliarios VIS / VIP / NO VIS
        </p>
        <div className="flex justify-center gap-3 pt-4">
          <Button asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Ir al dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
