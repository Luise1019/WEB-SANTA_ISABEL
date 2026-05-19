-- CreateEnum
CREATE TYPE "FeasibilityCostCategory" AS ENUM ('LOTE', 'URBANISMO', 'DIRECTO', 'INDIRECTO', 'FINANCIERO', 'VENTAS');

-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('PRICE_DB_CONSTRUDATA', 'PRICE_DB_CAMACOL', 'ERP_SAP', 'ERP_SINCO', 'POSTGRES', 'MYSQL', 'MSSQL', 'GSHEETS');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('CONFIGURED', 'CONNECTED', 'ERROR', 'DISABLED');

-- CreateTable
CREATE TABLE "FeasibilityAnalysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "promoter" TEXT,
    "totalUnits" INTEGER,
    "builtAreaM2" DECIMAL(18,4),
    "saleableAreaM2" DECIMAL(18,4),
    "pricePerM2" DECIMAL(18,4),
    "totalSales" DECIMAL(18,2),
    "initialPaymentPct" DECIMAL(5,2),
    "breakEvenUnits" INTEGER,
    "stratum" INTEGER,
    "constructionSystem" TEXT,
    "tir" DECIMAL(8,4),
    "npv" DECIMAL(18,2),
    "paybackMonths" INTEGER,
    "discountRate" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeasibilityAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeasibilityCostItem" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "category" "FeasibilityCostCategory" NOT NULL,
    "concept" TEXT NOT NULL,
    "fideicomisoValue" DECIMAL(18,2),
    "constructorValue" DECIMAL(18,2),
    "totalValue" DECIMAL(18,2) NOT NULL,
    "pctOfSales" DECIMAL(5,2),
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FeasibilityCostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeasibilityCashFlow" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "initialBalance" DECIMAL(18,2) NOT NULL,
    "salesInitialPayment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "salesFinalPayment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ownResources" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "constructionCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "directCosts" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "indirectCosts" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "financialCosts" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "finalBalance" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "FeasibilityCashFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeasibilityScenario" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceVariationPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "costVariationPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "salesVelocityVariationPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "computedTir" DECIMAL(8,4),
    "computedNpv" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeasibilityScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalConnector" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ConnectorType" NOT NULL,
    "name" TEXT NOT NULL,
    "configEncrypted" TEXT NOT NULL,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'CONFIGURED',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorSync" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "recordsAffected" INTEGER,
    "errorMessage" TEXT,

    CONSTRAINT "ConnectorSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nueva conversación',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "toolResult" JSONB,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeasibilityAnalysis_projectId_key" ON "FeasibilityAnalysis"("projectId");

-- CreateIndex
CREATE INDEX "FeasibilityCostItem_analysisId_category_idx" ON "FeasibilityCostItem"("analysisId", "category");

-- CreateIndex
CREATE INDEX "FeasibilityCashFlow_analysisId_year_idx" ON "FeasibilityCashFlow"("analysisId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "FeasibilityCashFlow_analysisId_year_month_key" ON "FeasibilityCashFlow"("analysisId", "year", "month");

-- CreateIndex
CREATE INDEX "ExternalConnector_organizationId_type_idx" ON "ExternalConnector"("organizationId", "type");

-- CreateIndex
CREATE INDEX "ConnectorSync_connectorId_startedAt_idx" ON "ConnectorSync"("connectorId", "startedAt");

-- CreateIndex
CREATE INDEX "AIConversation_userId_updatedAt_idx" ON "AIConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AIConversation_projectId_idx" ON "AIConversation"("projectId");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "FeasibilityAnalysis" ADD CONSTRAINT "FeasibilityAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeasibilityCostItem" ADD CONSTRAINT "FeasibilityCostItem_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "FeasibilityAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeasibilityCashFlow" ADD CONSTRAINT "FeasibilityCashFlow_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "FeasibilityAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeasibilityScenario" ADD CONSTRAINT "FeasibilityScenario_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "FeasibilityAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalConnector" ADD CONSTRAINT "ExternalConnector_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorSync" ADD CONSTRAINT "ConnectorSync_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "ExternalConnector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
