-- Insert Factory and Manager
SET FOREIGN_KEY_CHECKS=0;

INSERT IGNORE INTO `factories` (`id`, `uuid`, `name`, `slug`, `industry_type`, `email`, `phone`, `country_code`, `currency_code`, `timezone`, `default_locale`, `status`, `created_at`, `updated_at`) VALUES (1, 'ff6de14a-7cc3-4156-8ce5-4ccd33c07626', 'NOGUCHI HOLDINGS Ltd', 'noguchi-holdings-ltd', 'Garment Manufacturing', 'info@noguchi.rw', NULL, 'RW', 'RWF', 'Africa/Kigali', 'en', 'active', NOW(), NOW());

INSERT IGNORE INTO `users` (`id`, `current_factory_id`, `school_id`, `name`, `username`, `email`, `locale`, `timezone`, `password`, `is_platform_admin`, `is_active`, `created_at`, `updated_at`) VALUES (2, 1, NULL, 'Samuel', 'samuel_noguchi', 'samuel@noguchi.rw', 'en', 'Africa/Kigali', '$2y$12$FKIiNBh0u4AUUMa4kJbE/OD7qXKx1LvJomXsqvyz5zzmHzdaPeKC6', 0, 1, NOW(), NOW());

INSERT IGNORE INTO `factory_user` (`factory_id`, `user_id`, `job_title`, `is_owner`, `is_active`, `joined_at`, `created_at`, `updated_at`) VALUES (1, 2, 'Factory Manager', 1, 1, NOW(), NOW(), NOW());

-- Link existing schools and orders to this factory
UPDATE `schools` SET `factory_id` = 1 WHERE `factory_id` IS NULL OR `factory_id` = 1;
UPDATE `sales_documents` SET `factory_id` = 1 WHERE `factory_id` IS NULL OR `factory_id` = 1;
UPDATE `sales_document_lines` SET `factory_id` = 1 WHERE `factory_id` IS NULL OR `factory_id` = 1;

SET FOREIGN_KEY_CHECKS=1;
