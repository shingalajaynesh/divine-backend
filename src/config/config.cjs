require('dotenv').config();

const baseConfig = {
  dialect: 'postgres',
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true' || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require'))
      ? { rejectUnauthorized: false }
      : false,
  },
};

const devConfig = process.env.DATABASE_URL
  ? { ...baseConfig, use_env_variable: 'DATABASE_URL', logging: console.log }
  : {
      ...baseConfig,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'divinegarbh_sanskar',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      logging: console.log,
    };

const prodConfig = process.env.DATABASE_URL
  ? { ...baseConfig, use_env_variable: 'DATABASE_URL', logging: false }
  : {
      ...baseConfig,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      logging: false,
    };

module.exports = {
  development: devConfig,
  production: prodConfig,
};

