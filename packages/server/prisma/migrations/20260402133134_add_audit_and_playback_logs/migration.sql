-- CreateTable
CREATE TABLE `AuditLog` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` BIGINT UNSIGNED NULL,
    `action` VARCHAR(50) NOT NULL,
    `entityType` VARCHAR(50) NULL,
    `entityId` BIGINT UNSIGNED NULL,
    `details` JSON NULL,
    `ipAddress` VARCHAR(50) NULL,
    `userAgent` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    INDEX `AuditLog_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlaybackLog` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` BIGINT UNSIGNED NULL,
    `cdrId` BIGINT UNSIGNED NULL,
    `callId` VARCHAR(100) NULL,
    `playedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `durationPlayed` INTEGER NULL,

    INDEX `PlaybackLog_userId_idx`(`userId`),
    INDEX `PlaybackLog_playedAt_idx`(`playedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlaybackLog` ADD CONSTRAINT `PlaybackLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlaybackLog` ADD CONSTRAINT `PlaybackLog_cdrId_fkey` FOREIGN KEY (`cdrId`) REFERENCES `CdrRecord`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
