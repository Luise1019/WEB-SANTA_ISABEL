-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'RESIDENTE_OBRA';

-- AlterTable
ALTER TABLE "BudgetItem" ADD COLUMN     "formulaExpr" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "reportColor" TEXT DEFAULT '#1e3a5f',
ADD COLUMN     "reportFooter" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "SystemParams" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "aiuAdmin" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "aiuImprevistos" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "aiuUtilidad" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "factorPrestacional" DECIMAL(6,4) NOT NULL DEFAULT 0.5213,
    "ivaRate" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "reteIvaRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "reteIcaRate" DECIMAL(7,4) NOT NULL DEFAULT 0.966,
    "trm" DECIMAL(10,2) NOT NULL DEFAULT 4200,
    "smmlv" DECIMAL(12,2) NOT NULL DEFAULT 1300000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemParams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemParams_organizationId_key" ON "SystemParams"("organizationId");

-- AddForeignKey
ALTER TABLE "SystemParams" ADD CONSTRAINT "SystemParams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
