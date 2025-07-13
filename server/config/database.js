const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'bittrade',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20, // Increased from 10
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  charset: 'utf8mb4',
  // Additional optimizations
  idleTimeout: 600000, // 10 minutes
  maxIdle: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Timezone handling
  timezone: 'Z',
  // Enable query caching
  queryTimeout: 30000
};

let pool;

const createPool = () => {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
    console.log('Database pool created successfully');
  }
  return pool;
};

const getConnection = async () => {
  try {
    const pool = createPool();
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error('Error getting database connection:', error);
    throw error;
  }
};

const query = async (sql, params = []) => {
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const transaction = async (callback) => {
  let connection;
  try {
    connection = await getConnection();
    await connection.beginTransaction();
    
    const result = await callback(connection);
    
    await connection.commit();
    return result;
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Transaction error:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  createPool,
  getConnection,
  query,
  transaction,
  pool: () => pool
};
