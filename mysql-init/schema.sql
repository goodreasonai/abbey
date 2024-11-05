CREATE DATABASE IF NOT EXISTS learn;

USE learn;

DROP TABLE IF EXISTS assets;

CREATE TABLE assets (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `creator_id` TEXT,  /* A user id */
    `author` TEXT,  /* Author or source, like Wikipedia*/
    `title` TEXT,
    `lm_desc` TEXT,  /* Description for indexing by a language model */
    `preview_desc` TEXT,  /* Human readable short description */
    `template` TEXT, /* Type of asset and associated env - pdf article, foreign language md etc. */
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `group_id` INT
);

DROP TABLE IF EXISTS asset_resources;

CREATE TABLE asset_resources (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `asset_id` INT,
    `name` TEXT,  /* The spec of the template determines the appropriate values */
    `from` TEXT,  /* Determines where the resource is located - the cloud, local, etc. */
    `path` TEXT,  /* Used in conjunction with "from" to get the resource */
    `title` TEXT,
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS asset_metadata;

CREATE TABLE asset_metadata (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `asset_id` INT,
    `user_id` TEXT,  /* Extra info tying info to user - optional (empty for something all can see) */
    `key` TEXT,  /* The spec of the template determines the appropriate values */
    `value` LONGTEXT,  /* The value based on the key */
    `needs_attention` INT,  /* 0 or null means not attention; >=1 means user should be notified of pending request */
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP
);


DROP TABLE IF EXISTS asset_permissions;

CREATE TABLE asset_permissions (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `asset_id` INT,
    `public` INT,  /* 0 = not public, non-zero = public */
    `email_domain` TEXT, /* if not null, permissions any users with an email domain matching this field */
    `user_id` TEXT,  /* Used when email_domain not convenient (say - propagating creator permission) */
    `joint_asset_id` INT,  /* Used when one asset gives another asset permissions */
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `group_id` INT,  /* Like joint_asset_id, but used to give permissions to a group in a single entry */
    `can_edit` INT DEFAULT 0
);


DROP TABLE IF EXISTS asset_retrieval_storage;

CREATE TABLE asset_retrieval_storage (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `asset_id` INT,
    `resource_id` INT,
    `from` TEXT,
    `path` TEXT,
    `metadata` JSON,
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP
);


DROP TABLE IF EXISTS user_metadata;

CREATE TABLE user_metadata (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `user_id` TEXT,
    `key` TEXT,
    `value` LONGTEXT,
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS user_activity;

CREATE TABLE user_activity (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `user_id` TEXT,
    `asset_id` INT,  /* Associated asset */
    `ip` TEXT,
    `type` TEXT,  /* 'view' | 'edit' | ... */
    `metadata` LONGTEXT,  /* Info about the request, pursuant to the type / asset id template */
    `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(`user_id`(191), `timestamp`, `type`(30))
);

DROP TABLE IF EXISTS reports;

/* For bug reports, feature requests, etc. */
CREATE TABLE reports (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `user_id` TEXT,
    `asset_id` INT,  /* Associated asset, should one exist */
    `ip` TEXT,
    `type` TEXT,  /* 'bug' | 'feature' | ... */
    `description` TEXT,  /* TBD */
    `from` TEXT,  /* The path from which the user sent the request, if known */
    `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
);


DROP TABLE IF EXISTS announcements;

CREATE TABLE announcements (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `audience` TEXT,  /* unused atm */
    `type` TEXT,  /* 'tip' | 'announcement' | 'post' */
    `body` TEXT,
    `author` TEXT,
    `link` TEXT,
    `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
);


DROP TABLE IF EXISTS jobs;

CREATE TABLE jobs (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `user_id` TEXT,
    `resource_id` TEXT,  /* links into asset_resources table */
    `has_started` INT,  /* 0 or 1 */
    `is_running` INT,
    `progress` FLOAT,  /* Between zero and one */
    `is_complete` INT,  /* 0 or 1 */
    `error` JSON,  /* Schema TBD, probably should have some text for the user + restartable flag */
    `title` TEXT,
    `asset_id` INT,
    `metadata` JSON,
    `kind` TEXT, 
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP
);


DROP TABLE IF EXISTS jobs_storage;

CREATE TABLE jobs_storage (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `job_id` INT,
    `name` TEXT,  /* e.g., transformation_result */
    `text_data` LONGTEXT,
    `blob_data` BLOB,
    `metadata` JSON,  /* 0 or 1 */
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP
);


DROP TABLE IF EXISTS asset_groups;

CREATE TABLE asset_groups (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `creator_id` TEXT,  /* A user id - mostly unused unless we allow users to create their own */
    `title` TEXT,
    `lm_desc` TEXT,  /* Description for indexing by a language model */
    `preview_desc` TEXT,  /* Human readable short description */
    `metadata` JSON, /* Can specify sections or other info based on template */
    `image` TEXT,  /* URL for representative image */
    `product_id` INT,  /* Foreign key into products table */
    `template` TEXT,  /* How frontend should display asset group */
    `preview_template` TEXT,  /* How frontend should display purchase preview, if appropriate */
    `hidden` INT,  /* Hide from users (for admin) */
    `promoted` INT,  /* Is this asset group being promoted on the site currently? (1 or 0 or none) */
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP
);


DROP TABLE if EXISTS asset_group_resources;

CREATE TABLE asset_group_resources (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `group_id` INT,
    `name` TEXT,  /* The spec of the template determines the appropriate values */
    `from` TEXT,  /* Determines where the resource is located - the cloud, local, etc. */
    `path` TEXT,  /* Used in conjunction with "from" to get the resource */
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP
);


DROP TABLE if EXISTS products;

/* Everything that can be purchased is a product, and how the purchase is effected is determined by the resolution protocol */
CREATE TABLE products (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `def_price_usd_cents` INT,
    `stripe_price_lookup_key` TEXT,
    `name` TEXT,
    `code` TEXT,  /* Used so it's easy to specifiy subscription code -> model options and so forth (could use ID, but that's annoying) */
    `resolution_protocol` TEXT  /* ('main-sub' or 'add-group-perm' as of 4/30) Defines the rules for how the backend should implement a successful payment */
);


DROP TABLE IF EXISTS asset_tags;

CREATE TABLE asset_tags (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `asset_id` INT,
    `value` varchar(32),
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS notifications;

CREATE TABLE notifications (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `asset_id` INT,  /* Should feel optional */
    `message_type` varchar(32),  /* 'email' etc. */
    `endpoint` varchar(32),  /* Optionally, the endpoint used to trigger it */
    `n_recipients` INT,
    `user_id` TEXT,  /* The user id of the person who triggered the notification, if any. */
    `metadata` JSON,  /* Recipient, sender info, etc. */
    `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS inter_asset_retrieval_storage;

CREATE TABLE inter_asset_retrieval_storage (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `group_id` INT,
    `from` TEXT,
    `path` TEXT,
    `metadata` JSON,
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP
);


DROP TABLE IF EXISTS media_data;

CREATE TABLE media_data (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `asset_id` INT,
    `name` TEXT,
    `media_type` varchar(32),  /* "audio", "video", etc. */
    `extension` varchar(32),  /* mp3, mp4, etc. */
    `from` TEXT,
    `path` TEXT,
    `metadata` JSON,
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS art_history;

CREATE TABLE art_history (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `markdown` TEXT,
    `image` TEXT,
    `time_uploaded` DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS product_codes;

CREATE TABLE product_codes (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `product_id` INT,  /* Which product is this code for? */
    `value` TEXT,
    `expiration` DATETIME,
    `stripe_price_lookup_key` TEXT,  /* New price for product (if none/undefined, then the user automatically gets the product for free) */
    `new_price_cents` INT,
    `time_created` DATETIME DEFAULT CURRENT_TIMESTAMP
);

/* Indexes for optimization */

CREATE INDEX idx_creator_id ON assets (creator_id(9));
CREATE INDEX idx_group_id ON assets (group_id);
CREATE INDEX idx_time_uploaded ON assets (time_uploaded);

CREATE INDEX idx_asset_id ON asset_resources (asset_id);

CREATE INDEX idx_asset_id ON asset_metadata (asset_id);
CREATE INDEX idx_asset_id_x_user_id ON asset_metadata (asset_id, user_id(9));

CREATE INDEX idx_asset_id ON asset_permissions (asset_id);
CREATE INDEX idx_group_id ON asset_permissions (group_id);
CREATE INDEX idx_email_domain ON asset_permissions (email_domain(9));

CREATE INDEX idx_asset_id ON asset_retrieval_storage (asset_id);
CREATE INDEX idx_time_uploaded ON asset_retrieval_storage (`time_uploaded`);

CREATE INDEX idx_user_id ON user_metadata (user_id(9));

CREATE INDEX idx_user_id ON user_activity (user_id(9));
CREATE INDEX idx_user_id_x_asset_id ON user_activity (user_id(9), asset_id);
CREATE INDEX idx_timestamp ON user_activity (`timestamp`);

CREATE INDEX idx_asset_id ON jobs (asset_id);

CREATE INDEX idx_asset_id ON asset_tags (asset_id);
CREATE INDEX idx_value ON asset_tags (value(10));

CREATE INDEX idx_asset_id ON notifications (asset_id);
CREATE INDEX idx_user_id ON notifications (user_id(9));
CREATE INDEX idx_timestamp ON notifications (`timestamp`);

CREATE INDEX idx_group_id ON inter_asset_retrieval_storage (group_id);

CREATE INDEX idx_product_id ON asset_groups (product_id);

/* For natural language queries. */
ALTER TABLE assets ADD FULLTEXT(title);
ALTER TABLE assets ADD FULLTEXT(preview_desc);
ALTER TABLE assets ADD FULLTEXT(author);
ALTER TABLE assets ADD FULLTEXT idx_ft_title_desc_author (title, preview_desc, author);

ALTER TABLE asset_groups ADD FULLTEXT(title, preview_desc);
