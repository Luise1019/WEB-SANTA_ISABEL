import type { LogbookEntry } from './types';
import { WEATHER_META, SHIFT_META, DELAY_META, fmtDate, totalPersonnel, totalPersonHours } from './types';

// ── CSS compartido ────────────────────────────────────────────────────────────

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#1e293b;font-size:13px;line-height:1.5}
.page{max-width:900px;margin:0 auto;background:#fff;padding:40px;box-shadow:0 0 30px rgba(0,0,0,.08)}
.cover{background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#0ea5e9 100%);color:#fff;border-radius:12px;padding:36px 40px;margin-bottom:32px}
.cover h1{font-size:26px;font-weight:700;margin-bottom:6px}
.cover p{opacity:.85;font-size:13px;margin-top:4px}
.cover .badges{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(255,255,255,.2);color:#fff}
h2{font-size:14px;font-weight:700;color:#1e3a8a;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #dbeafe;letter-spacing:.03em;text-transform:uppercase}
h3{font-size:12px;font-weight:600;color:#334155;margin:12px 0 6px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
th{background:#1e3a8a;color:#fff;padding:8px 12px;text-align:left;font-weight:600;font-size:11px;letter-spacing:.03em}
td{padding:7px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top}
tr:nth-child(even) td{background:#f8fafc}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.kpi{background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;text-align:center}
.kpi .val{font-size:24px;font-weight:700;color:#0369a1}
.kpi .lbl{font-size:10px;color:#64748b;margin-top:3px;text-transform:uppercase;letter-spacing:.05em}
.notes{background:#f8fafc;border-left:4px solid #1d4ed8;border-radius:0 8px 8px 0;padding:12px 16px;font-size:12px;line-height:1.7;white-space:pre-wrap;margin-bottom:16px}
.notes.safety{border-left-color:#16a34a}
.notes.quality{border-left-color:#d97706}
.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.photo-item img{width:100%;border-radius:6px;object-fit:cover;aspect-ratio:4/3;display:block}
.photo-item p{font-size:10px;color:#64748b;margin-top:4px;text-align:center}
.visit-card{border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:10px;background:#fafafa}
.visit-card .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
.visit-card .name{font-weight:700;font-size:13px}
.visit-card .specialty{font-size:11px;color:#6366f1;background:#eef2ff;padding:2px 8px;border-radius:10px}
.delay-card{border-left:4px solid #ef4444;background:#fef2f2;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:8px}
.delay-card.weather{border-left-color:#3b82f6;background:#eff6ff}
.delay-card.materials{border-left-color:#f59e0b;background:#fffbeb}
.section{margin-bottom:28px}
.footer{text-align:center;font-size:10px;color:#94a3b8;margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0}
.pill{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
.pill-green{background:#dcfce7;color:#15803d}
.pill-blue{background:#dbeafe;color:#1d4ed8}
.pill-red{background:#fee2e2;color:#b91c1c}
.pill-yellow{background:#fef9c3;color:#a16207}
.pill-gray{background:#f1f5f9;color:#475569}
@media print{body{background:#fff}.page{padding:20px;box-shadow:none}h2{page-break-after:avoid}.photo-grid{grid-template-columns:repeat(2,1fr)}}
`;

// ── Reporte individual ────────────────────────────────────────────────────────

export function buildEntryReport(entry: LogbookEntry, projectName: string): string {
  const wm     = WEATHER_META[entry.weather];
  const sm     = SHIFT_META[entry.shift];
  const now    = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  const totPax = totalPersonnel(entry.personnel);
  const totHrs = totalPersonHours(entry.personnel);

  const statusBadge = entry.status === 'FINAL'
    ? '<span class="pill pill-green">✓ Finalizado</span>'
    : '<span class="pill pill-yellow">✏ Borrador</span>';

  // Photos
  const photosHtml = entry.photos.length > 0
    ? `<div class="section"><h2>📷 Registro fotográfico (${entry.photos.length})</h2>
       <div class="photo-grid">${entry.photos.map((p) =>
         `<div class="photo-item">
            <img src="${p.dataUrl ?? p.url}" alt="${p.caption ?? ''}">
            <p>${p.caption ?? ''}${p.takenAt ? ` · ${new Date(p.takenAt).toLocaleTimeString('es-CO')}` : ''}</p>
          </div>`
       ).join('')}</div></div>`
    : '';

  // Personnel
  const personnelHtml = entry.personnel.length > 0
    ? `<div class="section"><h2>👷 Personal en obra</h2>
       <table><thead><tr><th>Rol / Cargo</th><th>Nombre</th><th>Empresa</th><th>Cantidad</th><th>Horas trabajadas</th><th>Total horas</th></tr></thead>
       <tbody>${entry.personnel.map((p) =>
         `<tr><td>${p.role}</td><td>${p.name ?? '—'}</td><td>${p.company ?? '—'}</td>
          <td style="text-align:center">${p.count}</td>
          <td style="text-align:center">${p.hoursWorked}h</td>
          <td style="text-align:center;font-weight:600">${(p.count * p.hoursWorked).toFixed(1)}h</td></tr>`
       ).join('')}
       <tr style="background:#dbeafe"><td colspan="3"><strong>TOTAL</strong></td>
       <td style="text-align:center;font-weight:700">${totPax}</td>
       <td></td><td style="text-align:center;font-weight:700">${totHrs.toFixed(1)}h</td></tr>
       </tbody></table></div>`
    : '';

  // Equipment
  const equipmentHtml = entry.equipment.length > 0
    ? `<div class="section"><h2>🏗️ Equipos y maquinaria</h2>
       <table><thead><tr><th>Equipo / Maquinaria</th><th>Cantidad</th><th>Operador</th><th>Horas operación</th><th>Observaciones</th></tr></thead>
       <tbody>${entry.equipment.map((e) =>
         `<tr><td>${e.type}</td><td style="text-align:center">${e.quantity}</td>
          <td>${e.operator ?? '—'}</td><td style="text-align:center">${e.hoursOperated}h</td>
          <td>${e.observations ?? '—'}</td></tr>`
       ).join('')}</tbody></table></div>`
    : '';

  // Materials
  const materialsHtml = entry.materials.length > 0
    ? `<div class="section"><h2>📦 Materiales utilizados</h2>
       <table><thead><tr><th>Material</th><th>Cantidad</th><th>Unidad</th><th>Proveedor</th><th>Notas</th></tr></thead>
       <tbody>${entry.materials.map((m) =>
         `<tr><td>${m.name}</td><td style="text-align:right;font-weight:600">${Number(m.quantity).toLocaleString('es-CO')}</td>
          <td>${m.unit}</td><td>${m.supplier ?? '—'}</td><td>${m.notes ?? '—'}</td></tr>`
       ).join('')}</tbody></table></div>`
    : '';

  // Activities
  const activitiesHtml = entry.activities.length > 0
    ? `<div class="section"><h2>⚡ Actividades ejecutadas</h2>
       <table><thead><tr><th>#</th><th>Descripción</th><th>Ubicación</th><th>Cuadrilla</th><th>% Avance</th><th>Observaciones</th></tr></thead>
       <tbody>${entry.activities.map((a, i) =>
         `<tr><td style="text-align:center;color:#64748b">${i + 1}</td>
          <td>${a.description}</td><td>${a.location ?? '—'}</td><td>${a.crew ?? '—'}</td>
          <td style="text-align:center">${a.progressPct != null ? `<strong>${a.progressPct}%</strong>` : '—'}</td>
          <td>${a.observations ?? '—'}</td></tr>`
       ).join('')}</tbody></table></div>`
    : '';

  // Technical visits
  const visitsHtml = entry.technicalVisits.length > 0
    ? `<div class="section"><h2>🔍 Visitas técnicas (${entry.technicalVisits.length})</h2>
       ${entry.technicalVisits.map((v) =>
         `<div class="visit-card">
            <div class="header">
              <div>
                <div class="name">${v.specialistName}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px">${v.company ?? ''}</div>
              </div>
              <span class="specialty">${v.specialty}</span>
            </div>
            <p style="margin-bottom:6px"><strong>Motivo:</strong> ${v.visitReason}</p>
            ${v.findings ? `<p style="margin-bottom:6px"><strong>Hallazgos:</strong> ${v.findings}</p>` : ''}
            ${v.instructions ? `<p style="margin-bottom:6px"><strong>Instrucciones:</strong> ${v.instructions}</p>` : ''}
            ${v.nextVisitDate ? `<p><strong>Próxima visita:</strong> ${new Date(v.nextVisitDate).toLocaleDateString('es-CO')}</p>` : ''}
          </div>`
       ).join('')}</div>`
    : '';

  // Delays
  const delaysHtml = entry.delays.length > 0
    ? `<div class="section"><h2>⚠️ Retrasos e inconvenientes</h2>
       ${entry.delays.map((d) => {
         const dm = DELAY_META[d.type];
         const cls = d.type === 'WEATHER' ? 'weather' : d.type === 'MATERIALS' ? 'materials' : '';
         return `<div class="delay-card ${cls}">
           <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
             <strong>${d.description}</strong>
             <span class="pill" style="background:${dm.color.includes('blue') ? '#dbeafe' : '#fee2e2'};color:inherit;font-size:10px">${dm.label}</span>
           </div>
           ${d.actionTaken ? `<p style="font-size:12px;margin-bottom:4px"><strong>Acción tomada:</strong> ${d.actionTaken}</p>` : ''}
           ${d.impactDays != null ? `<p style="font-size:12px"><strong>Impacto estimado:</strong> ${d.impactDays} día(s)</p>` : ''}
           ${d.responsible ? `<p style="font-size:12px"><strong>Responsable:</strong> ${d.responsible}</p>` : ''}
         </div>`;
       }).join('')}</div>`
    : '';

  const safetySection = entry.safetyNotes
    ? `<div class="section"><h2>🦺 Notas de seguridad (SST)</h2><div class="notes safety">${entry.safetyNotes}</div></div>`
    : '';

  const qualitySection = entry.qualityNotes
    ? `<div class="section"><h2>✅ Control de calidad</h2><div class="notes quality">${entry.qualityNotes}</div></div>`
    : '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Bitácora — ${fmtDate(entry.date)}</title>
<style>${CSS}</style></head><body>
<div class="page">
  <div class="cover">
    <h1>📋 Bitácora de Obra</h1>
    <p>${projectName}</p>
    <p>${fmtDate(entry.date)} &nbsp;·&nbsp; ${wm.emoji} ${wm.label} &nbsp;·&nbsp; ${sm.label}</p>
    <div class="badges">
      ${statusBadge.replace(/class="pill/g, 'class="badge')}
      <span class="badge">${entry.authorRole}: ${entry.authorName}</span>
      ${entry.temperatureC != null ? `<span class="badge">🌡 ${entry.temperatureC}°C</span>` : ''}
      ${entry.humidity != null ? `<span class="badge">💧 ${entry.humidity}% HR</span>` : ''}
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="val">${totPax}</div><div class="lbl">Personal</div></div>
    <div class="kpi"><div class="val">${totHrs.toFixed(0)}</div><div class="lbl">Horas-hombre</div></div>
    <div class="kpi"><div class="val">${entry.activities.length}</div><div class="lbl">Actividades</div></div>
    <div class="kpi"><div class="val">${entry.technicalVisits.length}</div><div class="lbl">Visitas técnicas</div></div>
  </div>

  <div class="section">
    <h2>📝 Anotaciones generales</h2>
    <div class="notes">${entry.generalNotes}</div>
  </div>

  ${activitiesHtml}${personnelHtml}${equipmentHtml}${materialsHtml}
  ${visitsHtml}${delaysHtml}${safetySection}${qualitySection}${photosHtml}

  <div class="footer">
    Bitácora de Obra — ${projectName} · ${fmtDate(entry.date)}<br>
    Registrado por: ${entry.authorName} (${entry.authorRole}) · Generado: ${now}
  </div>
</div>
</body></html>`;
}

// ── Reporte de rango de fechas ────────────────────────────────────────────────

export function buildRangeReport(entries: LogbookEntry[], projectName: string, dateFrom: string, dateTo: string): string {
  const now = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  const totPersonnel = entries.reduce((s, e) => s + totalPersonnel(e.personnel), 0);
  const totHrs       = entries.reduce((s, e) => s + totalPersonHours(e.personnel), 0);
  const totVisits    = entries.reduce((s, e) => s + e.technicalVisits.length, 0);
  const totDelays    = entries.reduce((s, e) => s + e.delays.length, 0);
  const totPhotos    = entries.reduce((s, e) => s + e.photos.length, 0);

  const rows = entries.map((e) => {
    const wm = WEATHER_META[e.weather];
    return `<tr>
      <td>${new Date(e.date).toLocaleDateString('es-CO', { day:'2-digit', month:'short' })}</td>
      <td>${wm.emoji} ${wm.label}</td>
      <td>${SHIFT_META[e.shift].label}</td>
      <td style="text-align:center">${totalPersonnel(e.personnel)}</td>
      <td style="text-align:center">${totalPersonHours(e.personnel).toFixed(0)}h</td>
      <td style="text-align:center">${e.activities.length}</td>
      <td style="text-align:center">${e.technicalVisits.length}</td>
      <td style="text-align:center">${e.delays.length}</td>
      <td style="text-align:center">${e.photos.length}</td>
      <td>${e.authorName}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte Bitácora — ${projectName}</title>
<style>${CSS}</style></head><body>
<div class="page">
  <div class="cover">
    <h1>📋 Reporte de Bitácora de Obra</h1>
    <p>${projectName}</p>
    <p>Período: ${new Date(dateFrom + 'T12:00:00').toLocaleDateString('es-CO')} — ${new Date(dateTo + 'T12:00:00').toLocaleDateString('es-CO')}</p>
    <div class="badges">
      <span class="badge">${entries.length} entradas</span>
      <span class="badge">${totPhotos} fotos</span>
      <span class="badge">${totVisits} visitas técnicas</span>
    </div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="val">${entries.length}</div><div class="lbl">Jornadas</div></div>
    <div class="kpi"><div class="val">${totPersonnel}</div><div class="lbl">Personal total</div></div>
    <div class="kpi"><div class="val">${totHrs.toFixed(0)}</div><div class="lbl">Horas-hombre</div></div>
    <div class="kpi"><div class="val">${totDelays}</div><div class="lbl">Retrasos</div></div>
  </div>
  <h2>Resumen diario</h2>
  <table>
    <thead><tr>
      <th>Fecha</th><th>Clima</th><th>Turno</th><th>Personal</th>
      <th>H-H</th><th>Actividades</th><th>Visitas</th><th>Retrasos</th><th>Fotos</th><th>Residente</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${entries.map((e) => `
  <div class="section" style="border-top:2px solid #dbeafe;padding-top:16px">
    <h3>${new Date(e.date).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})} — ${WEATHER_META[e.weather].emoji}</h3>
    <div class="notes" style="font-size:12px">${e.generalNotes}</div>
    ${e.photos.length > 0 ? `<div class="photo-grid" style="grid-template-columns:repeat(4,1fr)">${e.photos.slice(0, 4).map((p) =>
      `<div class="photo-item"><img src="${p.dataUrl ?? p.url}" alt="${p.caption ?? ''}"><p>${p.caption ?? ''}</p></div>`
    ).join('')}</div>` : ''}
  </div>`).join('')}

  <div class="footer">Reporte Bitácora — ${projectName} · Generado: ${now}</div>
</div></body></html>`;
}

// ── Reporte de visitas técnicas ───────────────────────────────────────────────

export function buildVisitsReport(entries: LogbookEntry[], projectName: string): string {
  const now = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  const allVisits = entries.flatMap((e) =>
    e.technicalVisits.map((v) => ({ ...v, entryDate: e.date }))
  );

  const rows = allVisits.map((v) =>
    `<tr>
      <td>${new Date(v.entryDate).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}</td>
      <td><strong>${v.specialistName}</strong><br><small style="color:#64748b">${v.company ?? ''}</small></td>
      <td>${v.specialty}</td>
      <td>${v.visitReason}</td>
      <td>${v.findings ?? '—'}</td>
      <td>${v.instructions ?? '—'}</td>
      <td>${v.nextVisitDate ? new Date(v.nextVisitDate).toLocaleDateString('es-CO') : '—'}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Visitas Técnicas — ${projectName}</title>
<style>${CSS}</style></head><body>
<div class="page">
  <div class="cover">
    <h1>🔍 Reporte de Visitas Técnicas</h1>
    <p>${projectName}</p>
    <div class="badges"><span class="badge">${allVisits.length} visitas registradas</span></div>
  </div>
  <table>
    <thead><tr><th>Fecha</th><th>Especialista</th><th>Especialidad</th><th>Motivo</th><th>Hallazgos</th><th>Instrucciones</th><th>Próxima visita</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Visitas Técnicas — ${projectName} · Generado: ${now}</div>
</div></body></html>`;
}

export function openReport(html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
