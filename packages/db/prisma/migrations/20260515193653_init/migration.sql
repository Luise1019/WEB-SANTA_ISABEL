-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('GERENTE', 'DIRECTOR_OBRA', 'CONTADOR', 'COMERCIAL', 'AUDITOR');

-- CreateEnum
CREATE TYPE "HousingType" AS ENUM ('VIS', 'VIP', 'NO_VIS', 'COMERCIAL', 'MIXTO');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PREFACTIBILIDAD', 'FACTIBILIDAD', 'EJECUCION', 'CIERRE', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('MANO_OBRA', 'MATERIAL', 'EQUIPO', 'SUBCONTRATO');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('SUMMARY', 'TASK', 'MILESTONE');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FS', 'SS', 'FF', 'SF');

-- CreateEnum
CREATE TYPE "CashFlowKind" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "CashFlowCategory" AS ENUM ('VENTA_CUOTA_INICIAL', 'VENTA_SALDO', 'DESEMBOLSO_CREDITO', 'APORTE_SOCIO', 'EGRESO_CAPITULO', 'INTERES_CREDITO', 'AMORTIZACION_CREDITO', 'IMPUESTOS', 'OTRO');

-- CreateEnum
CREATE TYPE "UnitKind" AS ENUM ('APARTAMENTO', 'CASA', 'LOCAL', 'PARQUEADERO', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('DISPONIBLE', 'RESERVADA', 'NEGOCIANDO', 'VENDIDA', 'ESCRITURADA', 'BLOQUEADA');

-- CreateEnum
CREATE TYPE "ChangeOrderStatus" AS ENUM ('BORRADOR', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'APLICADA');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('PREFACTIBILIDAD', 'EJECUCION_PRESUPUESTAL', 'FLUJO_CAJA', 'ACTA_COMITE', 'RENTABILIDAD', 'SECOP_II', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('XLSX_SANTA_ISABEL', 'XLSX_GENERIC');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'GERENTE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "diff" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "housingType" "HousingType" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PREFACTIBILIDAD',
    "city" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expectedEndDate" TIMESTAMP(3) NOT NULL,
    "totalAreaM2" DECIMAL(18,4),
    "saleableAreaM2" DECIMAL(18,4),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subchapter" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subchapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRate" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APU" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLibrary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APU_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APUComponent" (
    "id" TEXT NOT NULL,
    "apuId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "wasteFactor" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "performance" DECIMAL(18,6),

    CONSTRAINT "APUComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL,
    "subchapterId" TEXT NOT NULL,
    "apuId" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "administracionPct" DECIMAL(6,4) NOT NULL,
    "imprevistosPct" DECIMAL(6,4) NOT NULL,
    "utilidadPct" DECIMAL(6,4) NOT NULL,
    "ivaUtilidadPct" DECIMAL(6,4) NOT NULL DEFAULT 19,
    "appliesToIndirect" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIUConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetBaseline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "BudgetBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TaskKind" NOT NULL DEFAULT 'TASK',
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "durationDays" INTEGER NOT NULL,
    "progress" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "earlyStart" TIMESTAMP(3),
    "earlyFinish" TIMESTAMP(3),
    "lateStart" TIMESTAMP(3),
    "lateFinish" TIMESTAMP(3),
    "totalFloat" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependency" (
    "id" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'FS',
    "lagDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "units" DECIMAL(8,4) NOT NULL DEFAULT 1,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBudgetAllocation" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "percentage" DECIMAL(6,4) NOT NULL,

    CONSTRAINT "TaskBudgetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "isContractual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleBaseline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "ScheduleBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "emiliani" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "CashFlowAccount" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bank" TEXT,
    "minBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashFlowAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashFlowEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "CashFlowKind" NOT NULL,
    "category" "CashFlowCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "chapterId" TEXT,
    "budgetItemId" TEXT,
    "saleId" TEXT,
    "loanFacilityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashFlowEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashTransaction" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "CashFlowKind" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reconciliationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanFacility" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "interestRateAnnual" DECIMAL(8,6) NOT NULL,
    "startDate" DATE NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "graceMonths" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanDisbursement" (
    "id" TEXT NOT NULL,
    "loanFacilityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,

    CONSTRAINT "LoanDisbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanPayment" (
    "id" TEXT NOT NULL,
    "loanFacilityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "principalAmount" DECIMAL(18,2) NOT NULL,
    "interestAmount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "LoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerContribution" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,

    CONSTRAINT "PartnerContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tower" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floors" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "towerId" TEXT,
    "code" TEXT NOT NULL,
    "kind" "UnitKind" NOT NULL,
    "floor" INTEGER,
    "privateAreaM2" DECIMAL(12,4) NOT NULL,
    "commonAreaM2" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "saleableAreaM2" DECIMAL(12,4) NOT NULL,
    "listPrice" DECIMAL(18,2) NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'DISPONIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerDocument" TEXT NOT NULL,
    "salePrice" DECIMAL(18,2) NOT NULL,
    "reservationDate" DATE NOT NULL,
    "expectedScriptureDate" DATE,
    "actualScriptureDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentScheduleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "estimatedCostImpact" DECIMAL(18,2) NOT NULL,
    "estimatedScheduleImpactDays" INTEGER NOT NULL DEFAULT 0,
    "status" "ChangeOrderStatus" NOT NULL DEFAULT 'BORRADOR',
    "createdById" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeOrderImpact" (
    "id" TEXT NOT NULL,
    "changeOrderId" TEXT NOT NULL,
    "budgetItemId" TEXT,
    "chapterId" TEXT,
    "newQuantity" DECIMAL(18,4),
    "newUnitCost" DECIMAL(18,4),
    "notes" TEXT,

    CONSTRAINT "ChangeOrderImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "changeOrderId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comments" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "name" TEXT NOT NULL,
    "htmlSource" TEXT NOT NULL,
    "cssSource" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "parameters" JSONB NOT NULL,
    "fileAssetId" TEXT,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GeneratedReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "kind" "ImportKind" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "fileAssetId" TEXT NOT NULL,
    "mappingJson" JSONB,
    "previewJson" JSONB,
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_taxId_key" ON "Organization"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_organizationId_code_key" ON "Project"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Chapter_projectId_idx" ON "Chapter"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_projectId_code_key" ON "Chapter"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Subchapter_chapterId_code_key" ON "Subchapter"("chapterId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_code_key" ON "Resource"("code");

-- CreateIndex
CREATE INDEX "ResourceRate_resourceId_effectiveDate_idx" ON "ResourceRate"("resourceId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceRate_resourceId_effectiveDate_key" ON "ResourceRate"("resourceId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "APU_code_version_key" ON "APU"("code", "version");

-- CreateIndex
CREATE INDEX "APUComponent_apuId_idx" ON "APUComponent"("apuId");

-- CreateIndex
CREATE INDEX "BudgetItem_subchapterId_idx" ON "BudgetItem"("subchapterId");

-- CreateIndex
CREATE UNIQUE INDEX "AIUConfig_projectId_key" ON "AIUConfig"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetBaseline_projectId_version_key" ON "BudgetBaseline"("projectId", "version");

-- CreateIndex
CREATE INDEX "Task_projectId_plannedStart_idx" ON "Task"("projectId", "plannedStart");

-- CreateIndex
CREATE UNIQUE INDEX "Task_projectId_code_key" ON "Task"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Dependency_predecessorId_successorId_key" ON "Dependency"("predecessorId", "successorId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_resourceId_key" ON "TaskAssignment"("taskId", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskBudgetAllocation_taskId_budgetItemId_key" ON "TaskBudgetAllocation"("taskId", "budgetItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleBaseline_projectId_version_key" ON "ScheduleBaseline"("projectId", "version");

-- CreateIndex
CREATE INDEX "CashFlowEntry_projectId_date_idx" ON "CashFlowEntry"("projectId", "date");

-- CreateIndex
CREATE INDEX "CashTransaction_projectId_date_idx" ON "CashTransaction"("projectId", "date");

-- CreateIndex
CREATE INDEX "CashTransaction_reconciliationId_idx" ON "CashTransaction"("reconciliationId");

-- CreateIndex
CREATE UNIQUE INDEX "Tower_projectId_code_key" ON "Tower"("projectId", "code");

-- CreateIndex
CREATE INDEX "Unit_projectId_status_idx" ON "Unit"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_projectId_code_key" ON "Unit"("projectId", "code");

-- CreateIndex
CREATE INDEX "Sale_unitId_idx" ON "Sale"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentScheduleItem_saleId_installmentNumber_key" ON "PaymentScheduleItem"("saleId", "installmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeOrder_projectId_code_key" ON "ChangeOrder"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subchapter" ADD CONSTRAINT "Subchapter_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRate" ADD CONSTRAINT "ResourceRate_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APUComponent" ADD CONSTRAINT "APUComponent_apuId_fkey" FOREIGN KEY ("apuId") REFERENCES "APU"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APUComponent" ADD CONSTRAINT "APUComponent_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_subchapterId_fkey" FOREIGN KEY ("subchapterId") REFERENCES "Subchapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_apuId_fkey" FOREIGN KEY ("apuId") REFERENCES "APU"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUConfig" ADD CONSTRAINT "AIUConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetBaseline" ADD CONSTRAINT "BudgetBaseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetBaseline" ADD CONSTRAINT "BudgetBaseline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBudgetAllocation" ADD CONSTRAINT "TaskBudgetAllocation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBudgetAllocation" ADD CONSTRAINT "TaskBudgetAllocation_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBaseline" ADD CONSTRAINT "ScheduleBaseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowAccount" ADD CONSTRAINT "CashFlowAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowEntry" ADD CONSTRAINT "CashFlowEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowEntry" ADD CONSTRAINT "CashFlowEntry_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowEntry" ADD CONSTRAINT "CashFlowEntry_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowEntry" ADD CONSTRAINT "CashFlowEntry_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowEntry" ADD CONSTRAINT "CashFlowEntry_loanFacilityId_fkey" FOREIGN KEY ("loanFacilityId") REFERENCES "LoanFacility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CashFlowAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanFacility" ADD CONSTRAINT "LoanFacility_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanDisbursement" ADD CONSTRAINT "LoanDisbursement_loanFacilityId_fkey" FOREIGN KEY ("loanFacilityId") REFERENCES "LoanFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_loanFacilityId_fkey" FOREIGN KEY ("loanFacilityId") REFERENCES "LoanFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerContribution" ADD CONSTRAINT "PartnerContribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tower" ADD CONSTRAINT "Tower_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_towerId_fkey" FOREIGN KEY ("towerId") REFERENCES "Tower"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentScheduleItem" ADD CONSTRAINT "PaymentScheduleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrderImpact" ADD CONSTRAINT "ChangeOrderImpact_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES "ChangeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrderImpact" ADD CONSTRAINT "ChangeOrderImpact_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrderImpact" ADD CONSTRAINT "ChangeOrderImpact_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES "ChangeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
