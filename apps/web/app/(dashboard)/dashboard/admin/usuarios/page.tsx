'use client';

import {
  CheckCircle2,
  ChevronDown,
  FolderOpen,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldOff,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type User = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  _count?: { memberships: number };
};

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES: Record<string, { label: string; color: string }> = {
  GERENTE:        { label: 'Administrador',     color: 'bg-slate-800 text-white' },
  DIRECTOR_OBRA:  { label: 'Director',          color: 'bg-blue-100 text-blue-800' },
  RESIDENTE_OBRA: { label: 'Residente',         color: 'bg-emerald-100 text-emerald-800' },
  CONTADOR:       { label: 'Contador',          color: 'bg-violet-100 text-violet-800' },
  COMERCIAL:      { label: 'Comercial',         color: 'bg-orange-100 text-orange-800' },
  AUDITOR:        { label: 'Solo lectura',      color: 'bg-slate-100 text-slate-600' },
};

// ── RoleBadge ─────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLES[role] ?? { label: role, color: 'bg-gray-100 text-gray-700' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', cfg.color)}>
      {cfg.label}
    </span>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-teal-500','bg-blue-500','bg-violet-500','bg-rose-500',
  'bg-amber-500','bg-emerald-500','bg-sky-500','bg-orange-500',
];
function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return (
    <div className={cn(
      'flex shrink-0 items-center justify-center rounded-full font-bold text-white',
      size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base',
      AVATAR_COLORS[idx],
    )}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── UserModal ─────────────────────────────────────────────────────────────────

type UserModalProps = {
  user: User | null; // null = crear nuevo
  onClose: () => void;
  onSaved: () => void;
};

function UserModal({ user, onClose, onSaved }: UserModalProps) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    email:    user?.email    ?? '',
    role:     user?.role     ?? 'RESIDENTE_OBRA',
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateAdminUser(user.id, { fullName: form.fullName, role: form.role });
        toast.success('Usuario actualizado');
        onSaved();
        onClose();
      } else {
        const res = await api.createAdminUser({
          fullName: form.fullName,
          email:    form.email,
          role:     form.role,
          ...(form.password ? { password: form.password } : {}),
        }) as Record<string, unknown>;
        if (res.tempPassword) {
          setTempPassword(res.tempPassword as string);
        } else {
          toast.success('Usuario creado');
          onSaved();
          onClose();
        }
      }
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  // Pantalla de contraseña temporal
  if (tempPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Usuario creado</h3>
              <p className="text-sm text-slate-500">Guarda esta contraseña temporal</p>
            </div>
          </div>
          <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4 mb-4">
            <p className="text-xs text-amber-700 mb-1 font-medium">Contraseña temporal (una sola vez)</p>
            <p className="font-mono text-lg font-bold text-amber-900 tracking-wider">{tempPassword}</p>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            El usuario deberá cambiarla al iniciar sesión por primera vez. Esta contraseña no se mostrará de nuevo.
          </p>
          <button
            onClick={() => { onSaved(); onClose(); }}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Entendido, cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="font-bold text-slate-900">{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Nombre completo</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="Ej: Juan Pérez Rodríguez"
            />
          </div>
          {!isEdit && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Correo electrónico</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="usuario@empresa.com"
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            >
              {Object.entries(ROLES).map(([val, { label }]) => (
                <option key={val} value={val}>{label} ({val})</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              {form.role === 'GERENTE' && 'Acceso total al sistema, incluyendo administración'}
              {form.role === 'DIRECTOR_OBRA' && 'Acceso completo a todos los módulos del proyecto'}
              {form.role === 'RESIDENTE_OBRA' && 'Bitácora, calidad y SST; lectura de presupuesto y cronograma'}
              {form.role === 'CONTADOR' && 'Presupuesto, flujo de caja, contratos y reportes financieros'}
              {form.role === 'COMERCIAL' && 'Módulo de ventas y prefactibilidad'}
              {form.role === 'AUDITOR' && 'Solo lectura en todos los módulos'}
            </p>
          </div>
          {!isEdit && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Contraseña <span className="text-slate-400 font-normal">(opcional — se genera automáticamente)</span>
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ResetPasswordModal ────────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.resetAdminPassword(user.id, { newPassword: password });
      toast.success(`Contraseña de ${user.fullName} restablecida`);
      onClose();
    } catch {
      toast.error('Error al restablecer la contraseña');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
            <KeyRound className="h-4.5 w-4.5 text-amber-700" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Restablecer contraseña</h3>
            <p className="text-xs text-slate-500">{user.fullName}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            placeholder="Nueva contraseña (mín. 8 caracteres)"
          />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving || password.length < 8} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Restablecer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ActionsMenu ───────────────────────────────────────────────────────────────

function ActionsMenu({ user, onEdit, onToggle, onResetPass }: {
  user: User;
  onEdit: () => void;
  onToggle: () => void;
  onResetPass: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button onClick={() => { onEdit(); setOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <Pencil className="h-3.5 w-3.5 text-slate-400" />Editar
          </button>
          <button onClick={() => { onResetPass(); setOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <KeyRound className="h-3.5 w-3.5 text-slate-400" />Restablecer contraseña
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button onClick={() => { onToggle(); setOpen(false); }} className={cn(
            'flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50',
            user.isActive ? 'text-red-600' : 'text-emerald-600',
          )}>
            {user.isActive
              ? <><UserX className="h-3.5 w-3.5" />Desactivar usuario</>
              : <><UserCheck className="h-3.5 w-3.5" />Activar usuario</>
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const [users, setUsers]     = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modal, setModal]     = useState<'create' | User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listAdminUsers() as User[];
      setUsers(data);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(user: User) {
    try {
      await api.updateAdminUser(user.id, { isActive: !user.isActive });
      toast.success(user.isActive ? `${user.fullName} desactivado` : `${user.fullName} activado`);
      load();
    } catch { toast.error('Error al cambiar estado'); }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total:   users.length,
    active:  users.filter((u) => u.isActive).length,
    admins:  users.filter((u) => u.role === 'GERENTE').length,
  };

  return (
    <>
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Usuarios totales', value: stats.total,  color: 'text-slate-900' },
          { label: 'Activos',          value: stats.active, color: 'text-emerald-600' },
          { label: 'Administradores',  value: stats.admins, color: 'text-slate-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        >
          <option value="">Todos los roles</option>
          {Object.entries(ROLES).map(([val, { label }]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
        >
          <Plus className="h-4 w-4" />Nuevo usuario
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <ShieldOff className="h-8 w-8 mb-2" />
            <p className="text-sm">No se encontraron usuarios</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Usuario</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Rol</th>
                <th className="hidden md:table-cell px-4 py-3 text-xs font-semibold text-slate-500">Proyectos</th>
                <th className="hidden lg:table-cell px-4 py-3 text-xs font-semibold text-slate-500">Último acceso</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">Estado</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.fullName} />
                      <div>
                        <p className="font-semibold text-slate-900">{user.fullName}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-slate-500 text-xs">
                    <div className="flex items-center gap-1">
                      <FolderOpen className="h-3.5 w-3.5" />
                      {user._count?.memberships ?? 0} proyecto{user._count?.memberships !== 1 ? 's' : ''}
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-xs text-slate-500">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'Nunca'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      user.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500',
                    )}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', user.isActive ? 'bg-emerald-500' : 'bg-slate-400')} />
                      {user.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ActionsMenu
                      user={user}
                      onEdit={() => setModal(user)}
                      onToggle={() => toggleActive(user)}
                      onResetPass={() => setResetUser(user)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      )}
    </>
  );
}
