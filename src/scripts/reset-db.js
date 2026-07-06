import dotenv from 'dotenv';
import { initializeDataModels } from '../config/db-init.js';
import Logger from '../util/logger.js';

dotenv.config();
const log = new Logger('DBReset');

const runReset = async () => {
  log.info('Connecting to PostgreSQL database to reset schema...');
  try {
    const dataModels = initializeDataModels(log);

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
