/**
 * Capítulos estándar para proyectos inmobiliarios en Colombia.
 * Base para auto-creación de capítulos al inicializar un proyecto.
 */
export const STANDARD_CHAPTERS = [
  { code: '01', name: 'Lote' },
  { code: '02', name: 'Estudios y diseños' },
  { code: '03', name: 'Urbanismo' },
  { code: '04', name: 'Actividades preliminares' },
  { code: '05', name: 'Cimentación' },
  { code: '06', name: 'Estructura' },
  { code: '07', name: 'Mampostería' },
  { code: '08', name: 'Cubierta' },
  { code: '09', name: 'Instalaciones hidrosanitarias' },
  { code: '10', name: 'Instalaciones eléctricas' },
  { code: '11', name: 'Instalaciones de gas' },
  { code: '12', name: 'Pañetes y acabados' },
  { code: '13', name: 'Carpintería' },
  { code: '14', name: 'Aparatos sanitarios' },
  { code: '15', name: 'Zonas comunes y exteriores' },
  { code: '16', name: 'Gastos administrativos' },
  { code: '17', name: 'Gastos financieros' },
  { code: '18', name: 'Comercialización y ventas' },
  { code: '19', name: 'Impuestos y licencias' },
  { code: '20', name: 'Utilidad e imprevistos' },
] as const;

export type StandardChapter = (typeof STANDARD_CHAPTERS)[number];
