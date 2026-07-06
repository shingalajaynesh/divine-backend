import dotenv from 'dotenv';
import { DataModels } from 'divine-data-models';
import Logger from '../util/logger.js';

dotenv.config();

const log = new Logger('DBSync');

const runSync = async () => {
  log.info('Connecting to PostgreSQL database to synchronize schema...');

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

    // Sync database tables (create if not exist, or recreate if matching)
    await dataModels.sequelize.sync({ force: true });
    log.info('✅ Database schema synchronized successfully.');

    // Seed default Center and Admin User if no centers exist
    const CenterModel = dataModels.models.Center;
    const existingCenterCount = await CenterModel.count();

    if (existingCenterCount === 0) {
      log.info('No existing centers found. Seeding default Center, Role, and Admin user...');
      const defaultCenter = await CenterModel.createCenterWithDefaultRoleAndUser({
        name: "Divine Garbh Sanskar Main Center",
        address: "Divine Garbh Sanskar, 101 Spiritual Avenue",
        contactno: "9876543210",
        emailAddress: "admin@divinegarbhsanskar.com"
      });
      log.info('✅ Default center seeded successfully:', defaultCenter.name);
    } else {
      log.info('Database already has center data. Skipping seeding.');
    }

    log.info('✅ Database bootstrapping complete.');
    process.exit(0);
  } catch (error) {
    log.error('❌ Database synchronization failed:', error);
    process.exit(1);
  }
};

runSync();
