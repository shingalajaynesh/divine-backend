import dotenv from 'dotenv';
import { initializeDataModels } from '../config/db-init.js';
import Logger from '../util/logger.js';

dotenv.config();

const log = new Logger('PromoteUser');

const email = process.argv[2];

if (!email) {
  log.error('Please specify an email address to promote: node src/scripts/promote-user.js <email>');
  process.exit(1);
}

const run = async () => {
  log.info(`Promoting user with email "${email}" to ADMIN...`);

  try {
    const dataModels = initializeDataModels(log);
    const { User, Role } = dataModels.models;

    const user = await User.findOne({
      where: { emailAddress: email.trim().toLowerCase() }
    });

    if (!user) {
      log.error(`User with email "${email}" not found.`);
      process.exit(1);
    }

    const adminRole = await Role.findOne({
      where: { roleType: 'ADMIN' }
    });

    if (!adminRole) {
      log.error('ADMIN role not found in the database.');
      process.exit(1);
    }

    await user.update({ roleId: adminRole.id });

    log.info(`\n✅ Successfully promoted user "${user.displayName}" (${user.emailAddress}) to ADMIN!`);
    process.exit(0);
  } catch (error) {
    log.error('❌ Promotion failed:', error);
    process.exit(1);
  }
};

run();
