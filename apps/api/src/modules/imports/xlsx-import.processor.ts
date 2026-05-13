/**
 * Procesador BullMQ para importación XLSX. Hito M5.
 *
 * Implementación pendiente — se conectará en M5 con la cola 'xlsx-import' y
 * usará ExcelJS para leer las hojas conocidas del proyecto Santa Isabel.
 *
 * Estrategia (M5):
 *   1. Descargar archivo de R2 usando ImportJob.fileAssetId.
 *   2. Detectar tipo de archivo según nombre de hojas.
 *   3. Para cada hoja conocida, parsear filas con un mapper específico.
 *   4. Validar montos con MoneySchema/PositiveMoneySchema antes de generar preview.
 *   5. Persistir previewJson en ImportJob. NO escribir aún en tablas finales.
 *   6. Esperar confirmación del usuario → segundo job hace commit transaccional.
 */
export {}; // placeholder file
