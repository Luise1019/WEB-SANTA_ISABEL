-- CreateEnum
CREATE TYPE "WeatherCondition" AS ENUM ('SUNNY', 'PARTLY_CLOUDY', 'CLOUDY', 'RAINY', 'STORM', 'WINDY', 'FOGGY');

-- CreateEnum
CREATE TYPE "LogbookStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateTable
CREATE TABLE "LogbookEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "LogbookStatus" NOT NULL DEFAULT 'DRAFT',
    "weather" "WeatherCondition" NOT NULL DEFAULT 'SUNNY',
    "weatherDesc" TEXT,
    "temperatureC" DECIMAL(4,1),
    "humidity" INTEGER,
    "windSpeedKmh" DECIMAL(5,1),
    "shift" TEXT NOT NULL DEFAULT 'FULL',
    "generalNotes" TEXT NOT NULL,
    "safetyNotes" TEXT,
    "qualityNotes" TEXT,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL DEFAULT 'Residente de obra',
    "weatherFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogbookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogbookPhoto" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "dataUrl" TEXT,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3),
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "sizeBytes" INTEGER,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogbookPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogbookDocument" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogbookDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogbookPersonnel" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "hoursWorked" DECIMAL(4,1) NOT NULL DEFAULT 8,
    "company" TEXT,
    "observations" TEXT,

    CONSTRAINT "LogbookPersonnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogbookEquipment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "hoursOperated" DECIMAL(4,1) NOT NULL DEFAULT 8,
    "operator" TEXT,
    "observations" TEXT,

    CONSTRAINT "LogbookEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogbookMaterial" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "supplier" TEXT,
    "notes" TEXT,

    CONSTRAINT "LogbookMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogbookActivity" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "progressPct" DECIMAL(5,2),
    "crew" TEXT,
    "location" TEXT,
    "observations" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LogbookActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogbookTechnicalVisit" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "specialistName" TEXT NOT NULL,
    "company" TEXT,
    "specialty" TEXT NOT NULL,
    "visitReason" TEXT NOT NULL,
    "findings" TEXT,
    "instructions" TEXT,
    "nextVisitDate" TIMESTAMP(3),
    "signatureUrl" TEXT,

    CONSTRAINT "LogbookTechnicalVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogbookDelay" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionTaken" TEXT,
    "impactDays" DECIMAL(4,1),
    "responsible" TEXT,

    CONSTRAINT "LogbookDelay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogbookEntry_projectId_date_idx" ON "LogbookEntry"("projectId", "date");

-- CreateIndex
CREATE INDEX "LogbookEntry_projectId_status_idx" ON "LogbookEntry"("projectId", "status");

-- AddForeignKey
ALTER TABLE "LogbookEntry" ADD CONSTRAINT "LogbookEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogbookPhoto" ADD CONSTRAINT "LogbookPhoto_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LogbookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogbookDocument" ADD CONSTRAINT "LogbookDocument_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LogbookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogbookPersonnel" ADD CONSTRAINT "LogbookPersonnel_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LogbookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogbookEquipment" ADD CONSTRAINT "LogbookEquipment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LogbookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogbookMaterial" ADD CONSTRAINT "LogbookMaterial_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LogbookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogbookActivity" ADD CONSTRAINT "LogbookActivity_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LogbookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogbookTechnicalVisit" ADD CONSTRAINT "LogbookTechnicalVisit_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LogbookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogbookDelay" ADD CONSTRAINT "LogbookDelay_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LogbookEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
