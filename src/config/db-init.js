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
      } : {}
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
      } : {}
    };
  }

  dataModels.init(config);
  return dataModels;
};
