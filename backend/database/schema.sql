-- Route Planner Database Schema
-- This schema supports both SQLite (development) and PostgreSQL (production)

-- Users table for multi-user support
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- Use SERIAL for PostgreSQL
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Routes table
CREATE TABLE routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- Use SERIAL for PostgreSQL
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    total_distance DECIMAL(10, 2) DEFAULT 0,
    estimated_time INTEGER DEFAULT 0, -- in minutes
    is_active BOOLEAN DEFAULT FALSE,
    current_step_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Addresses/Stops table
CREATE TABLE addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- Use SERIAL for PostgreSQL
    route_id INTEGER NOT NULL,
    sequence_order INTEGER NOT NULL,
    address TEXT NOT NULL,
    name VARCHAR(255),
    notes TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, skipped
    completed_at TIMESTAMP NULL,
    skipped_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

-- Route templates for frequently used routes
CREATE TABLE route_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Template addresses
CREATE TABLE template_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    sequence_order INTEGER NOT NULL,
    address TEXT NOT NULL,
    name VARCHAR(255),
    notes TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    FOREIGN KEY (template_id) REFERENCES route_templates(id) ON DELETE CASCADE
);

-- API keys and settings per user
CREATE TABLE user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    google_maps_api_key VARCHAR(255),
    default_start_address TEXT,
    optimization_preference VARCHAR(50) DEFAULT 'balanced', -- speed, distance, balanced
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Route sharing (for team collaboration)
CREATE TABLE route_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    shared_with_user_id INTEGER NOT NULL,
    permission_level VARCHAR(20) DEFAULT 'view', -- view, edit
    shared_by_user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(route_id, shared_with_user_id)
);

-- Indexes for performance
CREATE INDEX idx_routes_user_id ON routes(user_id);
CREATE INDEX idx_routes_created_at ON routes(created_at DESC);
CREATE INDEX idx_addresses_route_id ON addresses(route_id);
CREATE INDEX idx_addresses_sequence ON addresses(route_id, sequence_order);
CREATE INDEX idx_addresses_status ON addresses(status);
CREATE INDEX idx_route_shares_user ON route_shares(shared_with_user_id);

-- Views for common queries
CREATE VIEW route_summary AS
SELECT 
    r.id,
    r.user_id,
    r.name,
    r.total_distance,
    r.estimated_time,
    r.is_active,
    r.created_at,
    r.updated_at,
    COUNT(a.id) as total_stops,
    SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_stops,
    SUM(CASE WHEN a.status = 'skipped' THEN 1 ELSE 0 END) as skipped_stops,
    SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) as pending_stops
FROM routes r
LEFT JOIN addresses a ON r.id = a.route_id
GROUP BY r.id, r.user_id, r.name, r.total_distance, r.estimated_time, r.is_active, r.created_at, r.updated_at;