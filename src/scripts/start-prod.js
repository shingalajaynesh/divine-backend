import { spawn } from 'node:child_process';

const runStep = (command, args = []) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
  });

try {
  console.log('Starting production bootstrap...');
  console.log('Running Sequelize migrations...');
  await runStep('npx', ['sequelize-cli', 'db:migrate']);

  console.log('Running post-migration sync...');
  await runStep('node', ['src/scripts/sync-db.js']);

  console.log('Starting API server...');
  await runStep('node', ['src/index.js']);
} catch (error) {
  console.error('Production startup failed.');
  console.error(error);
  process.exit(1);
}
