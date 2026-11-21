import { Telegraf, Context } from 'telegraf';
import { config } from './config';
import { db } from './db';
import { users } from './db/schema';
import { transcribeAudio, routeIntent, translateText } from './services/aiService';
import { logger } from './services/metrics';
import { eq } from 'drizzle-orm';

// Initialize Telegraf bot
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
      languagePreference: 'en', // Default target language
    });
    logger.info(`New user registered: ${userId}`);
  }
  
  await next();
});

// Handle /start command
bot.start((ctx) => ctx.reply('Welcome! Send me text or voice messages, and I will translate them for you.'));

// Handle text messages
bot.on('text', async (ctx) => {
  try {
    const text = ctx.message.text;
    logger.info({ userId: ctx.from?.id }, `Received text: ${text}`);

    // Step 1: Route intent (detect languages and clean text)
    const routing = await routeIntent(text);
    
    // Step 2: Translate using NLLB
    const translated = await translateText(routing.cleanText, routing.src, routing.tgt);
    
    await ctx.reply(translated);
  } catch (error) {
    logger.error({ err: error, userId: ctx.from?.id }, 'Error processing text message');
    await ctx.reply('Sorry, something went wrong while processing your request.');
  }
});

// Handle voice and audio messages
bot.on('voice', async (ctx) => await handleAudio(ctx, ctx.message.voice.file_id));
bot.on('audio', async (ctx) => await handleAudio(ctx, ctx.message.audio.file_id));

async function handleAudio(ctx: Context, fileId: string) {
  try {
    logger.info({ userId: ctx.from?.id }, 'Received audio message');
    
    // Get file link from Telegram
    const fileLink = await ctx.telegram.getFileLink(fileId);
    
    // Download file as buffer
    const response = await fetch(fileLink.href);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Step 1: Transcribe audio using Whisper
    const transcribedText = await transcribeAudio(buffer, 'voice.ogg');
    logger.info({ userId: ctx.from?.id }, `Transcribed: ${transcribedText}`);

    // Step 2: Route intent
    const routing = await routeIntent(transcribedText);
    
    // Step 3: Translate using NLLB
    const translated = await translateText(routing.cleanText, routing.src, routing.tgt);
    
    await ctx.reply(translated);
  } catch (error) {
    logger.error({ err: error, userId: ctx.from?.id }, 'Error processing audio message');
    await ctx.reply('Sorry, I could not process the audio message.');
  }
}

// Function to launch the bot
export async function launchBot() {
  logger.info('Launching bot in Long Polling mode...');
  await bot.launch({ dropPendingUpdates: true });
  
  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
