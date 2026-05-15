-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('MANO_OBRA', 'MATERIAL', 'EQUIPO', 'FUNGIBLE', 'OTRO');

-- AlterTable
ALTER TABLE "BudgetItem" ADD COLUMN     "costType" "CostType" DEFAULT 'MATERIAL',
ADD COLUMN     "customCategory" TEXT;
