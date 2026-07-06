import dotenv from 'dotenv';
import { DataModels } from 'divine-data-models';
import Logger from '../util/logger.js';

dotenv.config();
const log = new Logger('DBReset');

const runReset = async () => {
  log.info('Connecting to PostgreSQL database to reset schema...');
  const dataModels = new DataModels(log);
  
  try {
    const useSSL = process.env.DB_SSL === 'true';
    dataModels.init({
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
    });

    log.info('Dropping public schema cascade...');
    await dataModels.sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    log.info('✅ All tables dropped successfully.');
    process.exit(0);
  } catch (error) {
    log.error('❌ Database reset failed:', error);
    process.exit(1);
  }
};

runReset();
