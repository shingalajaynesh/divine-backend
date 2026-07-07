import { DataModels } from 'divine-data-models';

/**
 * Dynamically initializes and returns the DataModels instance.
 * Supports both standard environment variables and DATABASE_URL connection URI.
 * 
 * @param {object} logger - Logger instance
 * @returns {DataModels} Initialized DataModels instance
 */
export const initializeDataModels = (logger) => {
  const dataModels = new DataModels(logger);

  let config = {};

  const pool = {
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 5,
    min: process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN, 10) : 1,
    acquire: process.env.DB_POOL_ACQUIRE ? parseInt(process.env.DB_POOL_ACQUIRE, 10) : 30000,
    idle: process.env.DB_POOL_IDLE ? parseInt(process.env.DB_POOL_IDLE, 10) : 10000,
  };

  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    const useSSL = process.env.DB_SSL === 'true' || process.env.DATABASE_URL.includes('sslmode=require');
    
    config = {
      database: decodeURIComponent(url.pathname.substring(1)),
      dbUser: decodeURIComponent(url.username),
      dbPassword: decodeURIComponent(url.password),
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : 5432,
      dialect: 'postgres',
      dialectOptions: useSSL ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {},
      pool
    };
  } else {
    const useSSL = process.env.DB_SSL === 'true';
    config = {
      database: process.env.DB_NAME || 'divine_garbh_sanskar',
      dbUser: process.env.DB_USER || 'postgres',
      dbPassword: process.env.DB_PASSWORD || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      dialect: 'postgres',
      dialectOptions: useSSL ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {},
      pool
    };
  }

  dataModels.init(config);
  dataModels.models.Sequelize = dataModels.sequelize.constructor;
  return dataModels;
};
