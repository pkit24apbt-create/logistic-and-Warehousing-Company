-- Sprint 1 base schema for SafeStack: roles and users.
-- Run this first, before seed.js, on a fresh database.
-- Safe to re-run: every statement is idempotent.

CREATE TABLE IF NOT EXISTS roles (
    role_id     SERIAL PRIMARY KEY,
    role_name   VARCHAR(30) UNIQUE NOT NULL CHECK (role_name IN
                 ('employee','trainer','supervisor','administrator')),
    description TEXT
);

CREATE TABLE IF NOT EXISTS users (
    user_id        SERIAL PRIMARY KEY,
    role_id        INTEGER NOT NULL REFERENCES roles(role_id),
    full_name      VARCHAR(120) NOT NULL,
    email          VARCHAR(160) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    department     VARCHAR(120),
    status         VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO roles (role_name, description) VALUES
 ('employee', 'Completes training modules, quizzes and hazard scenarios'),
 ('trainer', 'Creates and manages training modules and quizzes'),
 ('supervisor', 'Monitors team progress and compliance'),
 ('administrator', 'Manages users, roles and system settings')
ON CONFLICT (role_name) DO NOTHING;