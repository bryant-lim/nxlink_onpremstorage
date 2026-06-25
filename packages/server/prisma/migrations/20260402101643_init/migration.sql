-- CreateTable
CREATE TABLE `User` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'viewer',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiConfig` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `region` VARCHAR(20) NOT NULL,
    `apiGateway` VARCHAR(255) NOT NULL,
    `accessKey` VARCHAR(255) NOT NULL,
    `secretKey` VARCHAR(255) NOT NULL,
    `bizType` VARCHAR(10) NOT NULL DEFAULT '8',
    `action` VARCHAR(10) NOT NULL DEFAULT 'cc',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DownloadRule` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `agentNames` JSON NULL,
    `directions` JSON NULL,
    `answeredOnly` BOOLEAN NOT NULL DEFAULT false,
    `minDuration` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` BIGINT UNSIGNED NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SchedulerConfig` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `cronExpression` VARCHAR(50) NOT NULL DEFAULT '0 */6 * * *',
    `lookbackHours` INTEGER NOT NULL DEFAULT 24,
    `pageSize` INTEGER NOT NULL DEFAULT 100,
    `storagePath` VARCHAR(500) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CdrRecord` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `orderId` VARCHAR(100) NULL,
    `callId` VARCHAR(100) NOT NULL,
    `agentName` VARCHAR(100) NULL,
    `agentNickName` VARCHAR(100) NULL,
    `caller` VARCHAR(50) NULL,
    `callee` VARCHAR(50) NULL,
    `direction` INTEGER NULL,
    `answered` BOOLEAN NULL,
    `callStatus` VARCHAR(100) NULL,
    `startTime` BIGINT NULL,
    `endTime` BIGINT NULL,
    `answerTime` BIGINT NULL,
    `ringTime` BIGINT NULL,
    `callDuration` INTEGER NULL,
    `ringDuration` INTEGER NULL,
    `queueDuration` INTEGER NULL,
    `hangupBy` INTEGER NULL,
    `hangupCode` INTEGER NULL,
    `hangupReason` VARCHAR(255) NULL,
    `recordUrl` VARCHAR(1000) NULL,
    `leaveMsgUrl` VARCHAR(1000) NULL,
    `mos` DECIMAL(4, 2) NULL,
    `totalCustomerPrice` DECIMAL(10, 4) NULL,
    `lineIp` VARCHAR(50) NULL,
    `apiConfigId` BIGINT UNSIGNED NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CdrRecord_callId_key`(`callId`),
    INDEX `CdrRecord_agentName_idx`(`agentName`),
    INDEX `CdrRecord_startTime_idx`(`startTime`),
    INDEX `CdrRecord_direction_idx`(`direction`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DownloadLog` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `cdrId` BIGINT UNSIGNED NOT NULL,
    `ruleId` BIGINT UNSIGNED NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `filePath` VARCHAR(1000) NULL,
    `fileSize` BIGINT NULL,
    `errorMessage` TEXT NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `triggeredBy` VARCHAR(20) NOT NULL DEFAULT 'scheduler',
    `triggeredByUserId` BIGINT UNSIGNED NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DownloadLog_status_idx`(`status`),
    INDEX `DownloadLog_createdAt_idx`(`createdAt`),
    INDEX `DownloadLog_cdrId_idx`(`cdrId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyLog` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `logDate` DATE NOT NULL,
    `totalCdrsSynced` INTEGER NOT NULL DEFAULT 0,
    `totalDownloadsAttempted` INTEGER NOT NULL DEFAULT 0,
    `totalDownloadsSuccess` INTEGER NOT NULL DEFAULT 0,
    `totalDownloadsFailed` INTEGER NOT NULL DEFAULT 0,
    `totalDownloadsSkipped` INTEGER NOT NULL DEFAULT 0,
    `totalSizeBytes` BIGINT NOT NULL DEFAULT 0,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DailyLog_logDate_key`(`logDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserPreference` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` BIGINT UNSIGNED NOT NULL,
    `visibleColumns` JSON NOT NULL,
    `columnOrder` JSON NULL,
    `pageSize` INTEGER NOT NULL DEFAULT 20,

    UNIQUE INDEX `UserPreference_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DownloadRule` ADD CONSTRAINT `DownloadRule_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CdrRecord` ADD CONSTRAINT `CdrRecord_apiConfigId_fkey` FOREIGN KEY (`apiConfigId`) REFERENCES `ApiConfig`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DownloadLog` ADD CONSTRAINT `DownloadLog_cdrId_fkey` FOREIGN KEY (`cdrId`) REFERENCES `CdrRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DownloadLog` ADD CONSTRAINT `DownloadLog_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `DownloadRule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DownloadLog` ADD CONSTRAINT `DownloadLog_triggeredByUserId_fkey` FOREIGN KEY (`triggeredByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPreference` ADD CONSTRAINT `UserPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
