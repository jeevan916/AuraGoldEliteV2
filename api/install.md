-- AuraGold Elite Database Setup
-- Run this in your Hostinger phpMyAdmin SQL tab

CREATE TABLE IF NOT EXISTS app_state (
    id INT PRIMARY KEY,
    content LONGTEXT COMMENT 'Full JSON state of the application',
    last_updated BIGINT COMMENT 'Epoch timestamp of last change'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize with empty state if desired
INSERT IGNORE INTO app_state (id, content, last_updated) 
VALUES (1, '{"orders":[], "logs":[], "lastUpdated":0}', 0);
