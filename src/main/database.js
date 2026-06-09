const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    const userDataPath = app ? app.getPath('userData') : './data';
    
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    const dbPath = path.join(userDataPath, 'inventory.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  init() {
    // Products table
    this.db.exec(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      cost_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      quantity INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 10,
      unit TEXT DEFAULT 'pcs',
      barcode TEXT,
      supplier TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Transactions table
    this.db.exec(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      notes TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    // Users table
    this.db.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT,
      role TEXT DEFAULT 'staff',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Categories table
    this.db.exec(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    )`);

    // Bootstrap default admin only when no admin account exists
    try {
      const adminExists = this.db.prepare(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      ).get();
      
      if (!adminExists || adminExists.count === 0) {
        this.db.prepare(
          "INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)"
        ).run('admin', 'admin123', 'Administrator', 'admin');
      }
    } catch (err) {
      console.error('Error bootstrapping admin:', err);
    }
  }

  run(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return { id: result.lastInsertRowid, changes: result.changes };
    } catch (err) {
      throw err;
    }
  }

  get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params);
    } catch (err) {
      throw err;
    }
  }

  all(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (err) {
      throw err;
    }
  }

  query(sql, params = []) {
    return this.all(sql, params);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DatabaseManager;
