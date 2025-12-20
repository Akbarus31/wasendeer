create database db_wasender;

CREATE TABLE `wa_handover_messages` (
	`id` INT NOT NULL AUTO_INCREMENT,
	`group_id` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`group_name` VARCHAR(100) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`message` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`updated_by` VARCHAR(30) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`updated_at` TIMESTAMP NULL DEFAULT (now()),
	PRIMARY KEY (`id`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=9
;


CREATE TABLE `wa_message_logs` (
	`id` BIGINT NOT NULL AUTO_INCREMENT,
	`group_id` VARCHAR(50) NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`group_name` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`message` TEXT NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`status` ENUM('SUCCESS','FAILED') NOT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`error_message` TEXT NULL DEFAULT NULL COLLATE 'utf8mb4_0900_ai_ci',
	`sent_at` DATETIME NOT NULL DEFAULT (now()),
	PRIMARY KEY (`id`) USING BTREE
)
COLLATE='utf8mb4_0900_ai_ci'
ENGINE=InnoDB
AUTO_INCREMENT=8
;
