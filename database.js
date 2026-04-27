const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

let db;

async function initDB() {
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      wallet_address TEXT,
      private_key TEXT,
      balance_eth REAL DEFAULT 0,
      balance_zuz REAL DEFAULT 0,
      staked_zuz REAL DEFAULT 0,
      staking_rewards REAL DEFAULT 0,
      referrer_id INTEGER,
      sage_level TEXT DEFAULT 'Novice',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER,
      referred_id INTEGER,
      earned_zuz REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      amount_eth REAL,
      amount_zuz REAL,
      tx_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staking_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT,
      amount_zuz REAL,
      timestamp INTEGER
    );
  `);

  console.log('✅ Database initialized');
  return db;
}

function getDB() { return db; }

module.exports = { initDB, getDB };
