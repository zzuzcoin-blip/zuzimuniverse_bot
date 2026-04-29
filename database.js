const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'zuz.db'));

// Создание таблиц
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        wallet TEXT,
        balance REAL DEFAULT 0,
        staked REAL DEFAULT 0,
        rewards REAL DEFAULT 0,
        referrer_id INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_id INTEGER,
        referred_id INTEGER,
        earned REAL DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS staking (
        user_id INTEGER PRIMARY KEY,
        amount REAL DEFAULT 0,
        last_update INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(user_id)
    );
`);

module.exports = db;
