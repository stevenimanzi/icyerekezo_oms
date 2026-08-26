-- Database Schema Export
-- Structure only, with 1 Super Admin user

SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS `agreement_documents`;
CREATE TABLE `agreement_documents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploaded_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `agreement_documents_uploaded_by_foreign` (`uploaded_by`),
  KEY `agreement_documents_factory_id_created_at_index` (`factory_id`,`created_at`),
  CONSTRAINT `agreement_documents_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `agreement_documents_uploaded_by_foreign` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `event` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auditable_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auditable_id` bigint unsigned DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `request_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `audit_logs_factory_id_foreign` (`factory_id`),
  KEY `audit_logs_user_id_foreign` (`user_id`),
  KEY `audit_logs_auditable_type_auditable_id_index` (`auditable_type`,`auditable_id`),
  KEY `audit_logs_event_index` (`event`),
  KEY `audit_logs_request_id_index` (`request_id`),
  KEY `audit_logs_created_at_index` (`created_at`),
  CONSTRAINT `audit_logs_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `audit_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=177 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `batches`;
CREATE TABLE `batches` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `item_id` bigint unsigned NOT NULL,
  `supplier_id` bigint unsigned DEFAULT NULL,
  `batch_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `manufactured_at` date DEFAULT NULL,
  `expires_at` date DEFAULT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'available',
  `production_stage` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qc_status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `batches_factory_id_item_id_batch_number_unique` (`factory_id`,`item_id`,`batch_number`),
  KEY `batches_item_id_foreign` (`item_id`),
  KEY `batches_supplier_id_foreign` (`supplier_id`),
  KEY `batches_expires_at_index` (`expires_at`),
  KEY `batches_status_index` (`status`),
  KEY `batches_production_stage_index` (`production_stage`),
  KEY `batches_qc_status_index` (`qc_status`),
  CONSTRAINT `batches_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `batches_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `batches_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `bill_of_material_items`;
CREATE TABLE `bill_of_material_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `bill_of_material_id` bigint unsigned NOT NULL,
  `item_id` bigint unsigned NOT NULL,
  `unit_id` bigint unsigned NOT NULL,
  `quantity` decimal(20,6) NOT NULL,
  `waste_percent` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `substitute_item_id` bigint unsigned DEFAULT NULL,
  `is_optional` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bill_of_material_items_bill_of_material_id_item_id_unique` (`bill_of_material_id`,`item_id`),
  KEY `bill_of_material_items_item_id_foreign` (`item_id`),
  KEY `bill_of_material_items_unit_id_foreign` (`unit_id`),
  KEY `bill_of_material_items_substitute_item_id_foreign` (`substitute_item_id`),
  CONSTRAINT `bill_of_material_items_bill_of_material_id_foreign` FOREIGN KEY (`bill_of_material_id`) REFERENCES `bills_of_materials` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bill_of_material_items_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `bill_of_material_items_substitute_item_id_foreign` FOREIGN KEY (`substitute_item_id`) REFERENCES `items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `bill_of_material_items_unit_id_foreign` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `bills_of_materials`;
CREATE TABLE `bills_of_materials` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `item_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `output_quantity` decimal(20,6) NOT NULL DEFAULT '1.000000',
  `expected_waste_percent` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `effective_from` date DEFAULT NULL,
  `effective_until` date DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bills_of_materials_factory_id_item_id_version_unique` (`factory_id`,`item_id`,`version`),
  KEY `bills_of_materials_item_id_foreign` (`item_id`),
  KEY `bills_of_materials_approved_by_foreign` (`approved_by`),
  KEY `bills_of_materials_status_index` (`status`),
  CONSTRAINT `bills_of_materials_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `bills_of_materials_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bills_of_materials_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `branches`;
CREATE TABLE `branches` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'plant',
  `address` text COLLATE utf8mb4_unicode_ci,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `branches_factory_id_code_unique` (`factory_id`,`code`),
  CONSTRAINT `branches_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `cache`;
CREATE TABLE `cache` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `cache_locks`;
CREATE TABLE `cache_locks` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `corrective_actions`;
CREATE TABLE `corrective_actions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `source_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_id` bigint unsigned DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `assigned_to` bigint unsigned DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `corrective_actions_factory_id_foreign` (`factory_id`),
  KEY `corrective_actions_assigned_to_foreign` (`assigned_to`),
  KEY `corrective_actions_created_by_foreign` (`created_by`),
  CONSTRAINT `corrective_actions_assigned_to_foreign` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `corrective_actions_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `corrective_actions_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `database_backups`;
CREATE TABLE `database_backups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `requested_by` bigint unsigned DEFAULT NULL,
  `disk` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'local',
  `path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `size_bytes` bigint unsigned DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `database_backups_requested_by_foreign` (`requested_by`),
  KEY `database_backups_status_index` (`status`),
  CONSTRAINT `database_backups_requested_by_foreign` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `delivery_vehicles`;
CREATE TABLE `delivery_vehicles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `registration_number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vehicle_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `driver_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `driver_phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'available',
  `capacity` decimal(20,3) DEFAULT NULL,
  `capacity_unit` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `delivery_vehicles_factory_id_registration_number_unique` (`factory_id`,`registration_number`),
  KEY `delivery_vehicles_status_index` (`status`),
  CONSTRAINT `delivery_vehicles_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `branch_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `manager_id` bigint unsigned DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `departments_factory_id_code_unique` (`factory_id`,`code`),
  KEY `departments_branch_id_foreign` (`branch_id`),
  KEY `departments_manager_id_foreign` (`manager_id`),
  CONSTRAINT `departments_branch_id_foreign` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL,
  CONSTRAINT `departments_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `departments_manager_id_foreign` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `employee_attendances`;
CREATE TABLE `employee_attendances` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `date` date NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'present',
  `check_in_time` time DEFAULT NULL,
  `check_out_time` time DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `recorded_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_attendances_factory_id_user_id_date_unique` (`factory_id`,`user_id`,`date`),
  KEY `employee_attendances_user_id_foreign` (`user_id`),
  KEY `employee_attendances_recorded_by_foreign` (`recorded_by`),
  CONSTRAINT `employee_attendances_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_attendances_recorded_by_foreign` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `employee_attendances_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `employee_profiles`;
CREATE TABLE `employee_profiles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `department_id` bigint unsigned DEFAULT NULL,
  `workstation_id` bigint unsigned DEFAULT NULL,
  `employee_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `skills` json DEFAULT NULL,
  `employment_status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `hired_at` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_profiles_factory_id_user_id_unique` (`factory_id`,`user_id`),
  UNIQUE KEY `employee_profiles_factory_id_employee_number_unique` (`factory_id`,`employee_number`),
  KEY `employee_profiles_user_id_foreign` (`user_id`),
  KEY `employee_profiles_department_id_foreign` (`department_id`),
  KEY `employee_profiles_workstation_id_foreign` (`workstation_id`),
  CONSTRAINT `employee_profiles_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `employee_profiles_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_profiles_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_profiles_workstation_id_foreign` FOREIGN KEY (`workstation_id`) REFERENCES `workstations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `factories`;
CREATE TABLE `factories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `industry_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country_code` varchar(2) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'RW',
  `currency_code` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'RWF',
  `timezone` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Africa/Kigali',
  `default_locale` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'en',
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `settings` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `factories_uuid_unique` (`uuid`),
  UNIQUE KEY `factories_slug_unique` (`slug`),
  KEY `factories_status_index` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `factory_subscriptions`;
CREATE TABLE `factory_subscriptions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `subscription_plan_id` bigint unsigned NOT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'trial',
  `starts_at` timestamp NOT NULL,
  `ends_at` timestamp NOT NULL,
  `grace_ends_at` timestamp NULL DEFAULT NULL,
  `expiry_reminder_sent_at` timestamp NULL DEFAULT NULL,
  `auto_renew` tinyint(1) NOT NULL DEFAULT '0',
  `suspended_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `factory_subscriptions_factory_id_foreign` (`factory_id`),
  KEY `factory_subscriptions_subscription_plan_id_foreign` (`subscription_plan_id`),
  KEY `factory_subscriptions_status_index` (`status`),
  KEY `factory_subscriptions_ends_at_index` (`ends_at`),
  KEY `factory_subscriptions_grace_ends_at_index` (`grace_ends_at`),
  CONSTRAINT `factory_subscriptions_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `factory_subscriptions_subscription_plan_id_foreign` FOREIGN KEY (`subscription_plan_id`) REFERENCES `subscription_plans` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `factory_user`;
CREATE TABLE `factory_user` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `job_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_owner` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `joined_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `factory_user_factory_id_user_id_unique` (`factory_id`,`user_id`),
  KEY `factory_user_user_id_foreign` (`user_id`),
  CONSTRAINT `factory_user_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `factory_user_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `failed_jobs`;
CREATE TABLE `failed_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
  KEY `failed_jobs_connection_queue_failed_at_index` (`connection`,`queue`,`failed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `item_categories`;
CREATE TABLE `item_categories` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `item_categories_factory_id_code_unique` (`factory_id`,`code`),
  KEY `item_categories_parent_id_foreign` (`parent_id`),
  CONSTRAINT `item_categories_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `item_categories_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `item_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `items`;
CREATE TABLE `items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `category_id` bigint unsigned DEFAULT NULL,
  `unit_id` bigint unsigned NOT NULL,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `barcode` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `standard_cost` decimal(20,4) NOT NULL DEFAULT '0.0000',
  `tax_rate` decimal(7,4) NOT NULL DEFAULT '0.0000',
  `minimum_stock` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `reorder_level` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `batch_tracked` tinyint(1) NOT NULL DEFAULT '0',
  `serial_tracked` tinyint(1) NOT NULL DEFAULT '0',
  `expiry_tracked` tinyint(1) NOT NULL DEFAULT '0',
  `storage_conditions` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `items_factory_id_sku_unique` (`factory_id`,`sku`),
  UNIQUE KEY `items_factory_id_barcode_unique` (`factory_id`,`barcode`),
  KEY `items_category_id_foreign` (`category_id`),
  KEY `items_unit_id_foreign` (`unit_id`),
  KEY `items_type_index` (`type`),
  CONSTRAINT `items_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `item_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `items_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `items_unit_id_foreign` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `job_batches`;
CREATE TABLE `job_batches` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` mediumtext COLLATE utf8mb4_unicode_ci,
  `cancelled_at` int DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `jobs`;
CREATE TABLE `jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` smallint unsigned NOT NULL,
  `reserved_at` int unsigned DEFAULT NULL,
  `available_at` int unsigned NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `leave_requests`;
CREATE TABLE `leave_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `leave_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `starts_at` date NOT NULL,
  `ends_at` date NOT NULL,
  `days_requested` smallint unsigned NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `reviewed_by` bigint unsigned DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `review_note` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `leave_requests_factory_id_foreign` (`factory_id`),
  KEY `leave_requests_user_id_foreign` (`user_id`),
  KEY `leave_requests_reviewed_by_foreign` (`reviewed_by`),
  CONSTRAINT `leave_requests_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leave_requests_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `leave_requests_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `machines`;
CREATE TABLE `machines` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `department_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `serial_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `manufacturer` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'operational',
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `runtime_hours` decimal(12,2) NOT NULL DEFAULT '0.00',
  `installed_at` date DEFAULT NULL,
  `next_maintenance_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `machines_factory_id_code_unique` (`factory_id`,`code`),
  KEY `machines_department_id_foreign` (`department_id`),
  KEY `machines_status_index` (`status`),
  KEY `machines_next_maintenance_at_index` (`next_maintenance_at`),
  CONSTRAINT `machines_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `machines_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `maintenance_records`;
CREATE TABLE `maintenance_records` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `machine_id` bigint unsigned NOT NULL,
  `reported_by` bigint unsigned NOT NULL,
  `assigned_to` bigint unsigned DEFAULT NULL,
  `maintenance_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `priority` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `downtime_minutes` int unsigned NOT NULL DEFAULT '0',
  `cost` decimal(18,2) NOT NULL DEFAULT '0.00',
  `resolution` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `maintenance_records_factory_id_foreign` (`factory_id`),
  KEY `maintenance_records_machine_id_foreign` (`machine_id`),
  KEY `maintenance_records_reported_by_foreign` (`reported_by`),
  KEY `maintenance_records_assigned_to_foreign` (`assigned_to`),
  KEY `maintenance_records_maintenance_type_index` (`maintenance_type`),
  KEY `maintenance_records_status_index` (`status`),
  KEY `maintenance_records_scheduled_at_index` (`scheduled_at`),
  CONSTRAINT `maintenance_records_assigned_to_foreign` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `maintenance_records_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `maintenance_records_machine_id_foreign` FOREIGN KEY (`machine_id`) REFERENCES `machines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `maintenance_records_reported_by_foreign` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `migrations`;
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notifiable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notifiable_id` bigint unsigned NOT NULL,
  `data` json NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_notifiable_type_notifiable_id_index` (`notifiable_type`,`notifiable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `password_reset_tokens`;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `permission_role`;
CREATE TABLE `permission_role` (
  `permission_id` bigint unsigned NOT NULL,
  `role_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`role_id`),
  KEY `permission_role_role_id_foreign` (`role_id`),
  CONSTRAINT `permission_role_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `permission_role_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_slug_unique` (`slug`),
  KEY `permissions_module_index` (`module`)
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `platform_announcements`;
CREATE TABLE `platform_announcements` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_by` bigint unsigned DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `audience` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `published_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `platform_announcements_created_by_foreign` (`created_by`),
  CONSTRAINT `platform_announcements_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `ppe_assignments`;
CREATE TABLE `ppe_assignments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `equipment_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issued_at` date NOT NULL,
  `condition` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new',
  `returned_at` date DEFAULT NULL,
  `issued_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ppe_assignments_factory_id_foreign` (`factory_id`),
  KEY `ppe_assignments_user_id_foreign` (`user_id`),
  KEY `ppe_assignments_issued_by_foreign` (`issued_by`),
  CONSTRAINT `ppe_assignments_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ppe_assignments_issued_by_foreign` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ppe_assignments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `procurement_payments`;
CREATE TABLE `procurement_payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `purchase_document_id` bigint unsigned NOT NULL,
  `payment_number` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(20,2) NOT NULL,
  `method` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_on` date NOT NULL,
  `recorded_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `procurement_payments_factory_id_payment_number_unique` (`factory_id`,`payment_number`),
  KEY `procurement_payments_purchase_document_id_foreign` (`purchase_document_id`),
  KEY `procurement_payments_recorded_by_foreign` (`recorded_by`),
  CONSTRAINT `procurement_payments_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `procurement_payments_purchase_document_id_foreign` FOREIGN KEY (`purchase_document_id`) REFERENCES `purchase_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `procurement_payments_recorded_by_foreign` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `production_orders`;
CREATE TABLE `production_orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `order_number` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_id` bigint unsigned NOT NULL,
  `bill_of_material_id` bigint unsigned NOT NULL,
  `workflow_template_id` bigint unsigned NOT NULL,
  `warehouse_id` bigint unsigned DEFAULT NULL,
  `planned_quantity` decimal(20,6) NOT NULL,
  `completed_quantity` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `rejected_quantity` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `waste_quantity` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `planned_start` date DEFAULT NULL,
  `planned_end` date DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `production_orders_factory_id_order_number_unique` (`factory_id`,`order_number`),
  KEY `production_orders_item_id_foreign` (`item_id`),
  KEY `production_orders_bill_of_material_id_foreign` (`bill_of_material_id`),
  KEY `production_orders_workflow_template_id_foreign` (`workflow_template_id`),
  KEY `production_orders_warehouse_id_foreign` (`warehouse_id`),
  KEY `production_orders_created_by_foreign` (`created_by`),
  KEY `production_orders_approved_by_foreign` (`approved_by`),
  KEY `production_orders_status_index` (`status`),
  CONSTRAINT `production_orders_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `production_orders_bill_of_material_id_foreign` FOREIGN KEY (`bill_of_material_id`) REFERENCES `bills_of_materials` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `production_orders_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `production_orders_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `production_orders_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `production_orders_warehouse_id_foreign` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `production_orders_workflow_template_id_foreign` FOREIGN KEY (`workflow_template_id`) REFERENCES `workflow_templates` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `production_stage_executions`;
CREATE TABLE `production_stage_executions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `production_order_id` bigint unsigned NOT NULL,
  `workflow_stage_id` bigint unsigned NOT NULL,
  `assigned_user_id` bigint unsigned DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not_started',
  `input_quantity` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `output_quantity` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `waste_quantity` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `rejected_quantity` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `downtime_minutes` int unsigned NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `production_order_stage_unique` (`production_order_id`,`workflow_stage_id`),
  KEY `production_stage_executions_factory_id_foreign` (`factory_id`),
  KEY `production_stage_executions_workflow_stage_id_foreign` (`workflow_stage_id`),
  KEY `production_stage_executions_assigned_user_id_foreign` (`assigned_user_id`),
  KEY `production_stage_executions_status_index` (`status`),
  CONSTRAINT `production_stage_executions_assigned_user_id_foreign` FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `production_stage_executions_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `production_stage_executions_production_order_id_foreign` FOREIGN KEY (`production_order_id`) REFERENCES `production_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `production_stage_executions_workflow_stage_id_foreign` FOREIGN KEY (`workflow_stage_id`) REFERENCES `workflow_stages` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `purchase_document_lines`;
CREATE TABLE `purchase_document_lines` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `purchase_document_id` bigint unsigned NOT NULL,
  `item_id` bigint unsigned NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `quantity` decimal(20,6) NOT NULL,
  `unit_price` decimal(20,4) NOT NULL DEFAULT '0.0000',
  `received_quantity` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `line_total` decimal(20,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_document_lines_purchase_document_id_item_id_unique` (`purchase_document_id`,`item_id`),
  KEY `purchase_document_lines_factory_id_foreign` (`factory_id`),
  KEY `purchase_document_lines_item_id_foreign` (`item_id`),
  CONSTRAINT `purchase_document_lines_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `purchase_document_lines_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `purchase_document_lines_purchase_document_id_foreign` FOREIGN KEY (`purchase_document_id`) REFERENCES `purchase_documents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `purchase_documents`;
CREATE TABLE `purchase_documents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `document_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_number` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplier_id` bigint unsigned DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `purpose` text COLLATE utf8mb4_unicode_ci,
  `currency_code` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'RWF',
  `total_amount` decimal(20,2) NOT NULL DEFAULT '0.00',
  `payment_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unpaid',
  `paid_amount` decimal(20,2) NOT NULL DEFAULT '0.00',
  `line_count` int unsigned NOT NULL DEFAULT '0',
  `document_date` date NOT NULL,
  `expected_date` date DEFAULT NULL,
  `received_at` timestamp NULL DEFAULT NULL,
  `ordered_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `factory_purchase_document_unique` (`factory_id`,`document_type`,`document_number`),
  KEY `purchase_documents_supplier_id_foreign` (`supplier_id`),
  KEY `purchase_documents_created_by_foreign` (`created_by`),
  KEY `purchase_documents_approved_by_foreign` (`approved_by`),
  KEY `purchase_documents_factory_id_document_date_index` (`factory_id`,`document_date`),
  KEY `purchase_documents_document_type_index` (`document_type`),
  KEY `purchase_documents_status_index` (`status`),
  CONSTRAINT `purchase_documents_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `purchase_documents_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `purchase_documents_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `purchase_documents_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `push_subscriptions`;
CREATE TABLE `push_subscriptions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `endpoint` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `endpoint_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `public_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auth_token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_encoding` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aesgcm',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `push_subscriptions_endpoint_hash_unique` (`endpoint_hash`),
  KEY `push_subscriptions_user_id_foreign` (`user_id`),
  CONSTRAINT `push_subscriptions_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `quality_inspections`;
CREATE TABLE `quality_inspections` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `inspection_number` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `production_order_id` bigint unsigned DEFAULT NULL,
  `stage_execution_id` bigint unsigned DEFAULT NULL,
  `item_id` bigint unsigned DEFAULT NULL,
  `batch_id` bigint unsigned DEFAULT NULL,
  `inspection_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sample_size` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `inspected_quantity` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `passed_quantity` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `rejected_quantity` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `result` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `defect_details` text COLLATE utf8mb4_unicode_ci,
  `corrective_action` text COLLATE utf8mb4_unicode_ci,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `inspector_id` bigint unsigned NOT NULL,
  `inspected_at` timestamp NULL DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `quality_inspections_factory_id_inspection_number_unique` (`factory_id`,`inspection_number`),
  KEY `quality_inspections_production_order_id_foreign` (`production_order_id`),
  KEY `quality_inspections_stage_execution_id_foreign` (`stage_execution_id`),
  KEY `quality_inspections_item_id_foreign` (`item_id`),
  KEY `quality_inspections_inspector_id_foreign` (`inspector_id`),
  KEY `quality_inspections_approved_by_foreign` (`approved_by`),
  KEY `quality_inspections_inspection_type_index` (`inspection_type`),
  KEY `quality_inspections_result_index` (`result`),
  KEY `quality_inspections_batch_id_foreign` (`batch_id`),
  CONSTRAINT `quality_inspections_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `quality_inspections_batch_id_foreign` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`) ON DELETE SET NULL,
  CONSTRAINT `quality_inspections_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quality_inspections_inspector_id_foreign` FOREIGN KEY (`inspector_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `quality_inspections_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `quality_inspections_production_order_id_foreign` FOREIGN KEY (`production_order_id`) REFERENCES `production_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `quality_inspections_stage_execution_id_foreign` FOREIGN KEY (`stage_execution_id`) REFERENCES `production_stage_executions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `role_user`;
CREATE TABLE `role_user` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `role_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_user_factory_id_role_id_user_id_unique` (`factory_id`,`role_id`,`user_id`),
  KEY `role_user_role_id_foreign` (`role_id`),
  KEY `role_user_user_id_foreign` (`user_id`),
  CONSTRAINT `role_user_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_user_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_user_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dashboard_key` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'operations',
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_factory_id_slug_unique` (`factory_id`,`slug`),
  CONSTRAINT `roles_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=556 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `safety_incidents`;
CREATE TABLE `safety_incidents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `reported_by` bigint unsigned DEFAULT NULL,
  `incident_date` date NOT NULL,
  `location` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'minor',
  `injured_person` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reported',
  `resolution_note` text COLLATE utf8mb4_unicode_ci,
  `resolved_by` bigint unsigned DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `safety_incidents_factory_id_foreign` (`factory_id`),
  KEY `safety_incidents_reported_by_foreign` (`reported_by`),
  KEY `safety_incidents_resolved_by_foreign` (`resolved_by`),
  CONSTRAINT `safety_incidents_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `safety_incidents_reported_by_foreign` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `safety_incidents_resolved_by_foreign` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `safety_inspections`;
CREATE TABLE `safety_inspections` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `inspector_id` bigint unsigned DEFAULT NULL,
  `area` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `inspection_date` date NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `result` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pass',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `safety_inspections_factory_id_foreign` (`factory_id`),
  KEY `safety_inspections_inspector_id_foreign` (`inspector_id`),
  CONSTRAINT `safety_inspections_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `safety_inspections_inspector_id_foreign` FOREIGN KEY (`inspector_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `sales_document_lines`;
CREATE TABLE `sales_document_lines` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `sales_document_id` bigint unsigned NOT NULL,
  `item_id` bigint unsigned DEFAULT NULL,
  `class_level` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `garment_category` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity_ordered` int unsigned NOT NULL,
  `quantity_packed` int unsigned NOT NULL DEFAULT '0',
  `quantity_delivered` int unsigned NOT NULL DEFAULT '0',
  `quantity_rejected` int unsigned NOT NULL DEFAULT '0',
  `rejection_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sales_document_lines_factory_id_garment_category_index` (`factory_id`,`garment_category`),
  KEY `sales_document_lines_sales_document_id_class_level_index` (`sales_document_id`,`class_level`),
  KEY `sales_document_lines_item_id_foreign` (`item_id`),
  CONSTRAINT `sales_document_lines_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_document_lines_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sales_document_lines_sales_document_id_foreign` FOREIGN KEY (`sales_document_id`) REFERENCES `sales_documents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15383 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `sales_documents`;
CREATE TABLE `sales_documents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `school_id` bigint unsigned DEFAULT NULL,
  `document_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_number` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `school_district` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `school_sector` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `academic_year` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `currency_code` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'RWF',
  `total_amount` decimal(20,2) NOT NULL DEFAULT '0.00',
  `paid_amount` decimal(20,2) NOT NULL DEFAULT '0.00',
  `payment_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unpaid',
  `item_count` int unsigned NOT NULL DEFAULT '0',
  `document_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `invoice_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_original_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_uploaded_at` timestamp NULL DEFAULT NULL,
  `invoice_uploaded_by` bigint unsigned DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `factory_sales_document_unique` (`factory_id`,`document_type`,`document_number`),
  KEY `sales_documents_created_by_foreign` (`created_by`),
  KEY `sales_documents_factory_id_document_date_index` (`factory_id`,`document_date`),
  KEY `sales_documents_document_type_index` (`document_type`),
  KEY `sales_documents_status_index` (`status`),
  KEY `sales_documents_school_district_index` (`school_district`),
  KEY `sales_documents_school_sector_index` (`school_sector`),
  KEY `sales_documents_academic_year_index` (`academic_year`),
  KEY `sales_documents_school_id_foreign` (`school_id`),
  KEY `sales_documents_invoice_uploaded_by_foreign` (`invoice_uploaded_by`),
  CONSTRAINT `sales_documents_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sales_documents_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_documents_invoice_uploaded_by_foreign` FOREIGN KEY (`invoice_uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sales_documents_school_id_foreign` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=204 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `school_agreement_signatures`;
CREATE TABLE `school_agreement_signatures` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `school_id` bigint unsigned NOT NULL,
  `agreement_document_id` bigint unsigned NOT NULL,
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `school_agreement_signatures_factory_id_foreign` (`factory_id`),
  KEY `school_agreement_signatures_school_id_foreign` (`school_id`),
  KEY `school_agreement_signatures_doc_school_idx` (`agreement_document_id`,`school_id`),
  CONSTRAINT `school_agreement_signatures_agreement_document_id_foreign` FOREIGN KEY (`agreement_document_id`) REFERENCES `agreement_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `school_agreement_signatures_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `school_agreement_signatures_school_id_foreign` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `school_payment_submissions`;
CREATE TABLE `school_payment_submissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `school_id` bigint unsigned NOT NULL,
  `sales_document_id` bigint unsigned NOT NULL,
  `amount` decimal(20,2) NOT NULL,
  `payment_method` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_reference` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_at` date DEFAULT NULL,
  `proof_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `review_note` text COLLATE utf8mb4_unicode_ci,
  `reviewed_by` bigint unsigned DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `school_payment_submissions_factory_id_foreign` (`factory_id`),
  KEY `school_payment_submissions_school_id_foreign` (`school_id`),
  KEY `school_payment_submissions_sales_document_id_foreign` (`sales_document_id`),
  KEY `school_payment_submissions_reviewed_by_foreign` (`reviewed_by`),
  CONSTRAINT `school_payment_submissions_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `school_payment_submissions_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `school_payment_submissions_sales_document_id_foreign` FOREIGN KEY (`sales_document_id`) REFERENCES `sales_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `school_payment_submissions_school_id_foreign` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `school_returns`;
CREATE TABLE `school_returns` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `school_id` bigint unsigned NOT NULL,
  `sales_document_id` bigint unsigned NOT NULL,
  `sales_document_line_id` bigint unsigned NOT NULL,
  `quantity` int unsigned NOT NULL,
  `reason` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `factory_feedback` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `school_returns_factory_id_foreign` (`factory_id`),
  KEY `school_returns_school_id_foreign` (`school_id`),
  KEY `school_returns_sales_document_id_foreign` (`sales_document_id`),
  KEY `school_returns_sales_document_line_id_foreign` (`sales_document_line_id`),
  CONSTRAINT `school_returns_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `school_returns_sales_document_id_foreign` FOREIGN KEY (`sales_document_id`) REFERENCES `sales_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `school_returns_sales_document_line_id_foreign` FOREIGN KEY (`sales_document_line_id`) REFERENCES `sales_document_lines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `school_returns_school_id_foreign` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `schools`;
CREATE TABLE `schools` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `legacy_id` int unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `district` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sector` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `schools_factory_id_legacy_id_unique` (`factory_id`,`legacy_id`),
  KEY `schools_factory_id_name_index` (`factory_id`,`name`),
  KEY `schools_district_index` (`district`),
  KEY `schools_sector_index` (`sector`),
  CONSTRAINT `schools_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=352 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `sessions`;
CREATE TABLE `sessions` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `shipments`;
CREATE TABLE `shipments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `shipment_number` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sales_document_id` bigint unsigned DEFAULT NULL,
  `delivery_vehicle_id` bigint unsigned DEFAULT NULL,
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `destination` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `package_count` int unsigned NOT NULL DEFAULT '0',
  `total_weight` decimal(20,3) NOT NULL DEFAULT '0.000',
  `weight_unit` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'kg',
  `planned_dispatch_at` timestamp NULL DEFAULT NULL,
  `dispatched_at` timestamp NULL DEFAULT NULL,
  `delivered_at` timestamp NULL DEFAULT NULL,
  `received_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_notes` text COLLATE utf8mb4_unicode_ci,
  `proof_reference` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `shipments_factory_id_shipment_number_unique` (`factory_id`,`shipment_number`),
  KEY `shipments_sales_document_id_foreign` (`sales_document_id`),
  KEY `shipments_delivery_vehicle_id_foreign` (`delivery_vehicle_id`),
  KEY `shipments_factory_id_planned_dispatch_at_index` (`factory_id`,`planned_dispatch_at`),
  KEY `shipments_status_index` (`status`),
  CONSTRAINT `shipments_delivery_vehicle_id_foreign` FOREIGN KEY (`delivery_vehicle_id`) REFERENCES `delivery_vehicles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `shipments_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shipments_sales_document_id_foreign` FOREIGN KEY (`sales_document_id`) REFERENCES `sales_documents` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `stock_balances`;
CREATE TABLE `stock_balances` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `item_id` bigint unsigned NOT NULL,
  `warehouse_id` bigint unsigned NOT NULL,
  `location_id` bigint unsigned DEFAULT NULL,
  `batch_id` bigint unsigned DEFAULT NULL,
  `quantity_on_hand` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `quantity_reserved` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `quantity_quarantined` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_balance_dimension_unique` (`factory_id`,`item_id`,`warehouse_id`,`location_id`,`batch_id`),
  KEY `stock_balances_item_id_foreign` (`item_id`),
  KEY `stock_balances_warehouse_id_foreign` (`warehouse_id`),
  KEY `stock_balances_location_id_foreign` (`location_id`),
  KEY `stock_balances_batch_id_foreign` (`batch_id`),
  CONSTRAINT `stock_balances_batch_id_foreign` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `stock_balances_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_balances_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `stock_balances_location_id_foreign` FOREIGN KEY (`location_id`) REFERENCES `storage_locations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `stock_balances_warehouse_id_foreign` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `stock_transactions`;
CREATE TABLE `stock_transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `factory_id` bigint unsigned NOT NULL,
  `item_id` bigint unsigned NOT NULL,
  `warehouse_id` bigint unsigned NOT NULL,
  `location_id` bigint unsigned DEFAULT NULL,
  `batch_id` bigint unsigned DEFAULT NULL,
  `type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity_delta` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `reserved_delta` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `quarantined_delta` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `unit_cost` decimal(20,4) NOT NULL DEFAULT '0.0000',
  `balance_after` decimal(20,6) NOT NULL,
  `reference_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` bigint unsigned DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `performed_by` bigint unsigned DEFAULT NULL,
  `reverses_transaction_id` bigint unsigned DEFAULT NULL,
  `occurred_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_transactions_uuid_unique` (`uuid`),
  KEY `stock_transactions_item_id_foreign` (`item_id`),
  KEY `stock_transactions_warehouse_id_foreign` (`warehouse_id`),
  KEY `stock_transactions_location_id_foreign` (`location_id`),
  KEY `stock_transactions_batch_id_foreign` (`batch_id`),
  KEY `stock_transactions_reference_type_reference_id_index` (`reference_type`,`reference_id`),
  KEY `stock_transactions_performed_by_foreign` (`performed_by`),
  KEY `stock_transactions_reverses_transaction_id_foreign` (`reverses_transaction_id`),
  KEY `stock_ledger_lookup` (`factory_id`,`item_id`,`warehouse_id`,`occurred_at`),
  KEY `stock_transactions_type_index` (`type`),
  KEY `stock_transactions_occurred_at_index` (`occurred_at`),
  CONSTRAINT `stock_transactions_batch_id_foreign` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `stock_transactions_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_transactions_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `stock_transactions_location_id_foreign` FOREIGN KEY (`location_id`) REFERENCES `storage_locations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `stock_transactions_performed_by_foreign` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `stock_transactions_reverses_transaction_id_foreign` FOREIGN KEY (`reverses_transaction_id`) REFERENCES `stock_transactions` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `stock_transactions_warehouse_id_foreign` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `storage_locations`;
CREATE TABLE `storage_locations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `warehouse_id` bigint unsigned NOT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bin',
  `is_quarantine` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `storage_locations_warehouse_id_code_unique` (`warehouse_id`,`code`),
  KEY `storage_locations_factory_id_foreign` (`factory_id`),
  KEY `storage_locations_parent_id_foreign` (`parent_id`),
  CONSTRAINT `storage_locations_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `storage_locations_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `storage_locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `storage_locations_warehouse_id_foreign` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `subscription_plans`;
CREATE TABLE `subscription_plans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `monthly_price` decimal(20,2) NOT NULL DEFAULT '0.00',
  `currency_code` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'RWF',
  `limits` json DEFAULT NULL,
  `features` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subscription_plans_code_unique` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `supplier_item`;
CREATE TABLE `supplier_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `supplier_id` bigint unsigned NOT NULL,
  `item_id` bigint unsigned NOT NULL,
  `supplier_sku` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_price` decimal(20,4) NOT NULL DEFAULT '0.0000',
  `lead_time_days` int unsigned NOT NULL DEFAULT '0',
  `minimum_order_quantity` decimal(20,6) NOT NULL DEFAULT '0.000000',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `supplier_item_supplier_id_item_id_unique` (`supplier_id`,`item_id`),
  KEY `supplier_item_item_id_foreign` (`item_id`),
  CONSTRAINT `supplier_item_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `supplier_item_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE `suppliers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tax_number` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `payment_terms_days` smallint unsigned NOT NULL DEFAULT '0',
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `rating` decimal(3,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `suppliers_factory_id_code_unique` (`factory_id`,`code`),
  CONSTRAINT `suppliers_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `support_messages`;
CREATE TABLE `support_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `support_ticket_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_internal` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `support_messages_support_ticket_id_foreign` (`support_ticket_id`),
  KEY `support_messages_user_id_foreign` (`user_id`),
  CONSTRAINT `support_messages_support_ticket_id_foreign` FOREIGN KEY (`support_ticket_id`) REFERENCES `support_tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `support_messages_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `support_tickets`;
CREATE TABLE `support_tickets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `ticket_number` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',
  `priority` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `assigned_to` bigint unsigned DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `support_tickets_ticket_number_unique` (`ticket_number`),
  KEY `support_tickets_factory_id_foreign` (`factory_id`),
  KEY `support_tickets_user_id_foreign` (`user_id`),
  KEY `support_tickets_assigned_to_foreign` (`assigned_to`),
  KEY `support_tickets_status_index` (`status`),
  CONSTRAINT `support_tickets_assigned_to_foreign` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `support_tickets_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `support_tickets_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` longtext COLLATE utf8mb4_unicode_ci,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'string',
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `system_settings_key_unique` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `training_participants`;
CREATE TABLE `training_participants` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `training_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'registered',
  `certified` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `training_participants_training_id_user_id_unique` (`training_id`,`user_id`),
  KEY `training_participants_user_id_foreign` (`user_id`),
  CONSTRAINT `training_participants_training_id_foreign` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `training_participants_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `trainings`;
CREATE TABLE `trainings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `trainer` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scheduled_at` date NOT NULL,
  `duration_hours` decimal(5,2) NOT NULL DEFAULT '1.00',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'scheduled',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `trainings_factory_id_foreign` (`factory_id`),
  KEY `trainings_created_by_foreign` (`created_by`),
  CONSTRAINT `trainings_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `trainings_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `unit_conversions`;
CREATE TABLE `unit_conversions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `from_unit_id` bigint unsigned NOT NULL,
  `to_unit_id` bigint unsigned NOT NULL,
  `multiplier` decimal(20,8) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unit_conversions_factory_id_from_unit_id_to_unit_id_unique` (`factory_id`,`from_unit_id`,`to_unit_id`),
  KEY `unit_conversions_from_unit_id_foreign` (`from_unit_id`),
  KEY `unit_conversions_to_unit_id_foreign` (`to_unit_id`),
  CONSTRAINT `unit_conversions_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `unit_conversions_from_unit_id_foreign` FOREIGN KEY (`from_unit_id`) REFERENCES `units` (`id`) ON DELETE CASCADE,
  CONSTRAINT `unit_conversions_to_unit_id_foreign` FOREIGN KEY (`to_unit_id`) REFERENCES `units` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `units`;
CREATE TABLE `units` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `symbol` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dimension` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'count',
  `precision` tinyint unsigned NOT NULL DEFAULT '3',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `units_factory_id_symbol_unique` (`factory_id`,`symbol`),
  CONSTRAINT `units_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `current_factory_id` bigint unsigned DEFAULT NULL,
  `school_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `locale` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'en',
  `timezone` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Africa/Kigali',
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `otp_code` varchar(4) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp_expires_at` timestamp NULL DEFAULT NULL,
  `otp_attempts` tinyint unsigned NOT NULL DEFAULT '0',
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `last_login_ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_platform_admin` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_current_factory_id_foreign` (`current_factory_id`),
  KEY `users_school_id_foreign` (`school_id`),
  CONSTRAINT `users_current_factory_id_foreign` FOREIGN KEY (`current_factory_id`) REFERENCES `factories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_school_id_foreign` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `warehouses`;
CREATE TABLE `warehouses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `branch_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',
  `allows_negative_stock` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `warehouses_factory_id_code_unique` (`factory_id`,`code`),
  KEY `warehouses_branch_id_foreign` (`branch_id`),
  CONSTRAINT `warehouses_branch_id_foreign` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL,
  CONSTRAINT `warehouses_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `work_assignments`;
CREATE TABLE `work_assignments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `workstation_id` bigint unsigned DEFAULT NULL,
  `assignment_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assignable_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assignable_id` bigint unsigned DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `instructions` text COLLATE utf8mb4_unicode_ci,
  `priority` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'assigned',
  `starts_at` timestamp NULL DEFAULT NULL,
  `due_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `assigned_by` bigint unsigned DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `work_assignments_user_id_foreign` (`user_id`),
  KEY `work_assignments_workstation_id_foreign` (`workstation_id`),
  KEY `work_assignments_assignable_type_assignable_id_index` (`assignable_type`,`assignable_id`),
  KEY `work_assignments_assigned_by_foreign` (`assigned_by`),
  KEY `work_assignments_factory_id_user_id_status_index` (`factory_id`,`user_id`,`status`),
  KEY `work_assignments_assignment_type_index` (`assignment_type`),
  KEY `work_assignments_status_index` (`status`),
  KEY `work_assignments_due_at_index` (`due_at`),
  CONSTRAINT `work_assignments_assigned_by_foreign` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `work_assignments_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_assignments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_assignments_workstation_id_foreign` FOREIGN KEY (`workstation_id`) REFERENCES `workstations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `workflow_stages`;
CREATE TABLE `workflow_stages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `workflow_template_id` bigint unsigned NOT NULL,
  `department_id` bigint unsigned DEFAULT NULL,
  `workstation_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sequence` smallint unsigned NOT NULL,
  `expected_minutes` int unsigned NOT NULL DEFAULT '0',
  `required_workers` smallint unsigned NOT NULL DEFAULT '1',
  `quality_required` tinyint(1) NOT NULL DEFAULT '0',
  `approval_required` tinyint(1) NOT NULL DEFAULT '0',
  `instructions` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workflow_stages_workflow_template_id_sequence_unique` (`workflow_template_id`,`sequence`),
  KEY `workflow_stages_department_id_foreign` (`department_id`),
  KEY `workflow_stages_workstation_id_foreign` (`workstation_id`),
  CONSTRAINT `workflow_stages_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `workflow_stages_workflow_template_id_foreign` FOREIGN KEY (`workflow_template_id`) REFERENCES `workflow_templates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `workflow_stages_workstation_id_foreign` FOREIGN KEY (`workstation_id`) REFERENCES `workstations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `workflow_templates`;
CREATE TABLE `workflow_templates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workflow_templates_factory_id_code_unique` (`factory_id`,`code`),
  KEY `workflow_templates_status_index` (`status`),
  CONSTRAINT `workflow_templates_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `workstations`;
CREATE TABLE `workstations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `factory_id` bigint unsigned NOT NULL,
  `department_id` bigint unsigned DEFAULT NULL,
  `branch_id` bigint unsigned DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `workstations_factory_id_code_unique` (`factory_id`,`code`),
  KEY `workstations_department_id_foreign` (`department_id`),
  KEY `workstations_branch_id_foreign` (`branch_id`),
  CONSTRAINT `workstations_branch_id_foreign` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`) ON DELETE SET NULL,
  CONSTRAINT `workstations_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `workstations_factory_id_foreign` FOREIGN KEY (`factory_id`) REFERENCES `factories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Super Admin
INSERT INTO `users` (`name`, `email`, `password`, `is_platform_admin`, `is_active`, `created_at`, `updated_at`) VALUES ('Super Admin', 'stivenimanzi1@gmail.com', '$2y$12$ytGyR6Ha/Sc2UzjvFKizhuBtAy/s0oNCIxcdgvs9g0KEjGXIqbLO2', 1, 1, '2026-08-26 16:23:51', '2026-08-26 16:23:51');

SET FOREIGN_KEY_CHECKS=1;
