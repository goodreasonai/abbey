# Frontend

This was made with `create-next-app`.

First, you'll probably want to do `npm install`.

This repo also expects a `.env.local` file under `/frontend` containing various environment variables.
You can run the development server using `npm run dev`. 

## Custom Auth

It's possible to use custom authentication with a database to keep track of users from different identity providers. The initialization of the database looks like:

```
CREATE DATABASE custom_auth
USE custom_auth;

DROP TABLE IF EXISTS users;

CREATE TABLE users (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `joined` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `email` TEXT,
    `user_info` TEXT
);
```