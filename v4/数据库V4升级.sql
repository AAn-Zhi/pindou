-- 在 MySQL Workbench 中执行一次；请先备份数据库。
-- 原有图纸不会删除；旧记录 user_id 为 NULL，暂时不会出现在任何新账号图纸库中。
CREATE TABLE IF NOT EXISTS users (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 email VARCHAR(254) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE patterns ADD COLUMN user_id BIGINT UNSIGNED NULL;
CREATE INDEX idx_patterns_user_id ON patterns(user_id);
ALTER TABLE patterns ADD CONSTRAINT fk_patterns_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE;
