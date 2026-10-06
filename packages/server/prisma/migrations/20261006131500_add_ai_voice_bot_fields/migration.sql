-- AlterTable ApiConfig
ALTER TABLE `ApiConfig` 
    ADD COLUMN `aiTokenUrl` VARCHAR(500) NULL,
    ADD COLUMN `aiAppUrl` VARCHAR(255) NULL DEFAULT 'https://app.nxlink.ai';

-- AlterTable DownloadRule
ALTER TABLE `DownloadRule` 
    ADD COLUMN `recordingType` VARCHAR(20) NULL DEFAULT 'all',
    ADD COLUMN `flowNames` JSON NULL;

-- AlterTable CdrRecord
ALTER TABLE `CdrRecord` 
    ADD COLUMN `conversationId` VARCHAR(100) NULL,
    ADD COLUMN `recordingType` VARCHAR(20) NOT NULL DEFAULT 'agent',
    ADD COLUMN `flowName` VARCHAR(100) NULL,
    ADD COLUMN `tags` JSON NULL,
    ADD COLUMN `summary` TEXT NULL,
    ADD COLUMN `sentiment` VARCHAR(50) NULL;

-- CreateIndex
CREATE INDEX `CdrRecord_recordingType_idx` ON `CdrRecord`(`recordingType`);
CREATE INDEX `CdrRecord_conversationId_idx` ON `CdrRecord`(`conversationId`);
