import dotenv from 'dotenv';
dotenv.config();

import { initializeDataModels } from './src/config/db-init.js';

const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.log
};

const dataModels = initializeDataModels(logger);
const { models } = dataModels;

const run = async () => {
  try {
    console.log('--- Payment Model Attributes ---');
    console.log(Object.keys(models.Payment.rawAttributes));

    console.log('--- PaymentRefund Model Attributes ---');
    console.log(Object.keys(models.PaymentRefund.rawAttributes));

    console.log('--- CrmUser Model Attributes ---');
    console.log(Object.keys(models.CrmUser.rawAttributes));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
};

run();
