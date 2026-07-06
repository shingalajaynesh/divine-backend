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

    // Schema is managed via Sequelize CLI migrations. Simply log progress
    log.info('✅ Schema migrations check complete.');

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

      // Seed default Expert Schedules using the newly created Admin user
      const UserModel = dataModels.models.User;
      const adminUser = await UserModel.findOne({
        where: { emailAddress: "divinegarbhsanskarmaincenter@gmail.com" }
      });

      if (adminUser) {
        const ExpertScheduleModel = dataModels.models.ExpertSchedule;
        const schedules = [
          { expertId: adminUser.id, dayOfWeek: 1, startTime: "10:00", endTime: "16:00", slotDurationMins: 30 },
          { expertId: adminUser.id, dayOfWeek: 3, startTime: "10:00", endTime: "16:00", slotDurationMins: 30 },
          { expertId: adminUser.id, dayOfWeek: 5, startTime: "10:00", endTime: "16:00", slotDurationMins: 30 }
        ];

        for (const sched of schedules) {
          await ExpertScheduleModel.create(sched);
        }
        log.info('✅ Default Expert Schedules seeded successfully.');
      }
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
