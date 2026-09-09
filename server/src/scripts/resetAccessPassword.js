import readline from 'node:readline';
import { databaseService } from '../services/database.js';
import { updateAccessSettings } from '../services/authService.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(text) {
  return new Promise((resolve) => rl.question(text, resolve));
}

async function main() {
  await databaseService.initialize();
  const password = (await question('请输入新的访问密码（至少 4 位，直接回车可关闭保护）：')).trim();
  if (password && password.length < 4) {
    throw new Error('访问密码至少需要 4 位');
  }
  const settings = updateAccessSettings({ enabled: Boolean(password), password });
  console.log(settings.enabled ? '访问保护已开启，密码已重置。' : '访问保护已关闭。');
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rl.close();
  databaseService.close();
}
