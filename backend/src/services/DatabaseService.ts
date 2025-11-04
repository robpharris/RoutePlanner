import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import fs from 'fs/promises';

interface DatabaseConfig {
  type: 'sqlite' | 'postgresql';
  filename?: string; // For SQLite
  host?: string; // For PostgreSQL
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

export class DatabaseService {
  private db: Database | null = null;
  private config: DatabaseConfig;

  constructor(config?: DatabaseConfig) {
    this.config = config || {
      type: 'sqlite',
      filename: path.join(process.cwd(), 'data', 'routeplanner.db')
    };
  }

  async initialize(): Promise<void> {
    if (this.config.type === 'sqlite') {
      await this.initializeSQLite();
    } else {
      await this.initializePostgreSQL();
    }

    await this.runMigrations();
  }

  private async initializeSQLite(): Promise<void> {
    // Ensure data directory exists
    const dataDir = path.dirname(this.config.filename!);
    await fs.mkdir(dataDir, { recursive: true });

    this.db = await open({
      filename: this.config.filename!,
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await this.db.exec('PRAGMA foreign_keys = ON');
  }

  private async initializePostgreSQL(): Promise<void> {
    // For future PostgreSQL implementation
    throw new Error('PostgreSQL support not yet implemented');
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Check if migrations table exists
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Run initial schema if not exists
    const tables = await this.db.all(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );

    if (!tables.find(t => t.name === 'routes')) {
      await this.createInitialSchema();
    }
  }

  private async createInitialSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    
    try {
      const schema = await fs.readFile(schemaPath, 'utf8');
      
      // Split by semicolons and execute each statement
      const statements = schema
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        try {
          await this.db.exec(statement);
        } catch (error) {
          // Skip VIEW creation errors and comments
          if (!statement.includes('CREATE VIEW') && !statement.includes('CREATE INDEX')) {
            console.warn('Schema statement failed:', statement, error);
          }
        }
      }

      // Record migration
      await this.db.run(
        'INSERT INTO migrations (version) VALUES (?)',
        ['initial_schema_1.0.0']
      );

    } catch (error) {
      console.error('Failed to create schema:', error);
      throw error;
    }
  }

  // User management methods
  async createUser(email: string, passwordHash: string, name: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.run(
      'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      [email, passwordHash, name]
    );
    
    return result.lastID!;
  }

  async getUserByEmail(email: string) {
    if (!this.db) throw new Error('Database not initialized');
    
    return await this.db.get(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );
  }

  // Route management methods
  async createRoute(userId: number, name: string, totalDistance: number = 0, estimatedTime: number = 0) {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.run(
      'INSERT INTO routes (user_id, name, total_distance, estimated_time) VALUES (?, ?, ?, ?)',
      [userId, name, totalDistance, estimatedTime]
    );
    
    return result.lastID!;
  }

  async getRoutesByUserId(userId: number) {
    if (!this.db) throw new Error('Database not initialized');
    
    return await this.db.all(`
      SELECT 
        r.*,
        COUNT(a.id) as total_stops,
        SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_stops,
        SUM(CASE WHEN a.status = 'skipped' THEN 1 ELSE 0 END) as skipped_stops
      FROM routes r
      LEFT JOIN addresses a ON r.id = a.route_id
      WHERE r.user_id = ?
      GROUP BY r.id
      ORDER BY r.updated_at DESC
    `, [userId]);
  }

  async updateRoute(routeId: number, updates: any) {
    if (!this.db) throw new Error('Database not initialized');
    
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    
    return await this.db.run(
      `UPDATE routes SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, routeId]
    );
  }

  async deleteRoute(routeId: number) {
    if (!this.db) throw new Error('Database not initialized');
    
    return await this.db.run('DELETE FROM routes WHERE id = ?', [routeId]);
  }

  // Address management methods
  async addAddress(routeId: number, address: any) {
    if (!this.db) throw new Error('Database not initialized');
    
    // Get next sequence order
    const maxSeq = await this.db.get(
      'SELECT COALESCE(MAX(sequence_order), 0) as max_seq FROM addresses WHERE route_id = ?',
      [routeId]
    );
    
    const sequenceOrder = (maxSeq?.max_seq || 0) + 1;
    
    const result = await this.db.run(`
      INSERT INTO addresses (
        route_id, sequence_order, address, name, notes, 
        latitude, longitude, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      routeId,
      sequenceOrder,
      address.address,
      address.name || null,
      address.notes || null,
      address.latitude || null,
      address.longitude || null,
      address.status || 'pending'
    ]);
    
    return result.lastID!;
  }

  async getAddressesByRouteId(routeId: number) {
    if (!this.db) throw new Error('Database not initialized');
    
    return await this.db.all(
      'SELECT * FROM addresses WHERE route_id = ? ORDER BY sequence_order',
      [routeId]
    );
  }

  async updateAddressStatus(addressId: number, status: string) {
    if (!this.db) throw new Error('Database not initialized');
    
    const timestamp = status === 'completed' ? 'completed_at' : 
                     status === 'skipped' ? 'skipped_at' : null;
    
    let query = 'UPDATE addresses SET status = ?, updated_at = CURRENT_TIMESTAMP';
    let params = [status];
    
    if (timestamp) {
      query += `, ${timestamp} = CURRENT_TIMESTAMP`;
    } else {
      // Clear timestamps when resetting to pending
      query += ', completed_at = NULL, skipped_at = NULL';
    }
    
    query += ' WHERE id = ?';
    params.push(addressId.toString());
    
    return await this.db.run(query, params);
  }

  async deleteAddress(addressId: number) {
    if (!this.db) throw new Error('Database not initialized');
    
    return await this.db.run('DELETE FROM addresses WHERE id = ?', [addressId]);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();