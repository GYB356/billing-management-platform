import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logging';
import cron from 'node-cron';
import path from 'path';

const execAsync = promisify(exec);

// Initialize Prisma with connection pooling
const prisma = new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pooling configuration
  __internal: {
    engine: {
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '40'),
      queueLimit: 100,
      connectionTimeout: 20000,
    },
  },
});

// Database backup configuration
const backupConfig = {
  enabled: true,
  schedule: '0 0 * * *', // Daily at midnight
  backupDir: path.join(process.cwd(), 'backups'),
  retention: 7, // Keep backups for 7 days
};

// Backup function
async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.sql`;
  const backupPath = path.join(backupConfig.backupDir, filename);

  try {
    // Extract database connection details from URL
    const dbUrl = new URL(process.env.DATABASE_URL as string);
    const host = dbUrl.hostname;
    const database = dbUrl.pathname.slice(1);
    const username = dbUrl.username;
    const password = dbUrl.password;
    const port = dbUrl.port;

    // Create backup
    const command = `PGPASSWORD=${password} pg_dump -h ${host} -U ${username} -p ${port} -d ${database} -F c -f ${backupPath}`;
    await execAsync(command);

    logger.info(`Database backup created successfully: ${filename}`);

    // Clean old backups
    const cleanCommand = `find ${backupConfig.backupDir} -name "backup-*.sql" -mtime +${backupConfig.retention} -delete`;
    await execAsync(cleanCommand);
  } catch (error) {
    logger.error('Database backup failed:', error);
  }
}

// Schedule backups
if (process.env.NODE_ENV === 'production' && backupConfig.enabled) {
  cron.schedule(backupConfig.schedule, createBackup);
}

// Query optimization middleware
prisma.$use(async (params, next) => {
  const startTime = Date.now();
  const result = await next(params);
  const duration = Date.now() - startTime;

  if (duration > 1000) { // Log slow queries (>1s)
    logger.warn('Slow query detected:', {
      model: params.model,
      action: params.action,
      duration,
      args: params.args,
    });
  }

  return result;
});

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

export { prisma }; 