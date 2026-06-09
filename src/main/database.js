const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;

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
        const hashed = bcrypt.hashSync('admin123', BCRYPT_ROUNDS);
        this.db.prepare(
          'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)'
        ).run('admin', hashed, 'Administrator', 'admin');
      }
    } catch (err) {
      console.error('Error bootstrapping admin:', err);
    }

    // Migrate any existing plain-text passwords to bcrypt hashes.
    // A bcrypt hash always starts with "$2" — skip rows already hashed.
    try {
      const users = this.db.prepare(
        "SELECT id, password FROM users WHERE password NOT LIKE '$2%'"
      ).all();

      const updateStmt = this.db.prepare('UPDATE users SET password = ? WHERE id = ?');
      const migrate = this.db.transaction((rows) => {
        for (const u of rows) {
          const hashed = bcrypt.hashSync(u.password, BCRYPT_ROUNDS);
          updateStmt.run(hashed, u.id);
        }
      });
      migrate(users);

      if (users.length > 0) {
        console.log(`Migrated ${users.length} plain-text password(s) to bcrypt.`);
      }
    } catch (err) {
      console.error('Error migrating passwords:', err);
    }
  }

  // ---------- password helpers ----------

  hashPassword(plainText) {
    return bcrypt.hashSync(plainText, BCRYPT_ROUNDS);
  }

  verifyPassword(plainText, hash) {
    return bcrypt.compareSync(plainText, hash);
  }

  // ---------- query helpers ----------

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

  /**
   * Execute multiple {sql, params} operations atomically.
   * All succeed or all roll back.
   */
  transaction(operations) {
    const txn = this.db.transaction((ops) => {
      const results = [];
      for (const op of ops) {
        const stmt = this.db.prepare(op.sql);
        const res = stmt.run(...(op.params || []));
        results.push({ id: res.lastInsertRowid, changes: res.changes });
      }
      return results;
    });
    return txn(operations);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DatabaseManager;
