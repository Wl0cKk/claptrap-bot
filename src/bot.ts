import { Telegraf } from 'telegraf';
import { config } from './config';
import { db } from './db';
import { users } from './db/schema';
import { logger } from './services/metrics';
import { registerCommandHandlers } from './handlers/commands';
import { registerMessageHandlers } from './handlers/messages';
import { eq } from 'drizzle-orm';

export const bot = new Telegraf(config.BOT_TOKEN);

// Middleware to register user in DB on first interaction
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();
  
  const userId = String(ctx.from.id);
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!existingUser) {
    await db.insert(users).values({
      id: userId,
      languagePreference: 'en',
    });
    logger.info(`New user registered: ${userId}`);
  }
  
  await next();
});

// Register handlers
registerCommandHandlers(bot);
registerMessageHandlers(bot);

export async function launchBot() {
  logger.info('Launching bot in Long Polling mode...');
  await bot.launch({ dropPendingUpdates: true });
  
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
