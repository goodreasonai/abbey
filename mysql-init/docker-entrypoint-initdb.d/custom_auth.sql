CREATE DATABASE custom_auth;

USE custom_auth;

DROP TABLE IF EXISTS users;

CREATE TABLE users (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `joined` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `email` TEXT,
    `user_info` TEXT
);
