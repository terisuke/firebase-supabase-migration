require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.SUPABASE_HOST,
  database: 'postgres',
  user: process.env.SUPABASE_USER,
  password: process.env.SUPABASE_PASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false  // 自己署名証明書を許可
  }
});

async function createTables() {
  try {
    // exec関数の作成
    await pool.query(`
      create or replace function exec(query text)
      returns void
      language plpgsql
      security definer
      as $$
      begin
        execute query;
      end;
      $$;
    `);
    console.log('exec function created');

    // users テーブル
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        number TEXT UNIQUE,
        name TEXT,
        pronunciation TEXT,
        email TEXT,
        phone TEXT,
        address1 TEXT,
        address2 TEXT,
        city TEXT,
        prefecture TEXT,
        belongs TEXT,
        job TEXT,
        found TEXT,
        comments TEXT,
        details TEXT,
        created_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('users table created');

    // logs テーブル
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        space TEXT,
        start_time TIME,
        end_time TIME,
        timestamp TIMESTAMP WITH TIME ZONE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
    console.log('logs table created');

    // nfc テーブル
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nfc (
        nfc_id TEXT PRIMARY KEY,
        internal_nfc_id TEXT,
        user_number TEXT
      );
    `);
    console.log('nfc table created');

    // notices テーブル
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id TEXT PRIMARY KEY,
        date TEXT,
        message TEXT,
        message_timestamp TIMESTAMP WITH TIME ZONE,
        message_user_id TEXT
      );
    `);
    console.log('notices table created');

    // counters テーブル
    await pool.query(`
      CREATE TABLE IF NOT EXISTS counters (
        id TEXT PRIMARY KEY,
        latest_number TEXT,
        updated_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('counters table created');

    // foreigner テーブル
    await pool.query(`
      CREATE TABLE IF NOT EXISTS foreigner (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('foreigner table created');

  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

createTables();