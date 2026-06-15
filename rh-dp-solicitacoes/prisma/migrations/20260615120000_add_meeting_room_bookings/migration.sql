-- CreateEnum
CREATE TABLE `MeetingRoomBooking` (
    `id` VARCHAR(191) NOT NULL,
    `room` ENUM('OURO', 'SOLAR', 'DIAMANTE') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `meetingType` VARCHAR(191) NOT NULL,
    `description` LONGTEXT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `requesterId` VARCHAR(191) NULL,
    `requesterName` VARCHAR(191) NULL,
    `requesterEmail` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdByName` VARCHAR(191) NULL,
    `status` ENUM('AGENDADA', 'CANCELADA', 'CONCLUIDA') NOT NULL DEFAULT 'AGENDADA',
    `cancelReason` LONGTEXT NULL,
    `canceledAt` DATETIME(3) NULL,
    `canceledById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MeetingRoomBooking_room_startsAt_endsAt_idx`(`room`, `startsAt`, `endsAt`),
    INDEX `MeetingRoomBooking_status_startsAt_idx`(`status`, `startsAt`),
    INDEX `MeetingRoomBooking_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
