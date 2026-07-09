import dotenv from 'dotenv';
import { initializeDataModels } from '../config/db-init.js';
import Logger from '../util/logger.js';

dotenv.config();
const log = new Logger('QueryRunner');

const run = async () => {
  try {
    const dataModels = initializeDataModels(log);
    log.info('Running enum type alteration outside transaction...');
    try {
      await dataModels.sequelize.query(`ALTER TYPE "enum_roles_role_type" ADD VALUE 'PARTNER'`);
      log.info('✅ Alteration complete (added PARTNER).');
    } catch (err) {
      if (err.message.includes('already exists')) {
        log.info('Enum value PARTNER already exists in enum_roles_role_type.');
      } else {
        throw err;
      }
    }
    process.exit(0);
  } catch (err) {
    log.error('❌ Alteration failed:', err);
    process.exit(1);
  }
};

run();
