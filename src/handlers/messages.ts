import { Context, Telegraf } from 'telegraf';
import { transcribeAudio, routeIntent, translateText, generateResponse } from '../services/aiService';
import { logger } from '../services/metrics';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export function registerMessageHandlers(bot: Telegraf) {
  bot.on('text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;

    try {
      const text = ctx.message.text;
      const userId = String(ctx.from!.id);
      
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      const targetLang = user?.languagePreference || 'en';

      logger.info({ userId }, `Received text: ${text}`);

      const routing = await routeIntent(text);
      // Use router's target if it detected an explicit language, otherwise use user preference
      const finalTgt = routing.tgt !== 'en' && routing.tgt !== 'ru' ? routing.tgt : targetLang;

      let responseText: string;

      if (routing.intent === 'GENERATE') {
        logger.info({ userId }, 'Intent: GENERATE. Generating response...');
        // Pass the target language to the generator
        responseText = await generateResponse(routing.cleanText, routing.src, finalTgt);
      } else {
        logger.info({ userId }, 'Intent: TRANSLATE. Translating...');
        responseText = await translateText(routing.cleanText, routing.src, finalTgt);
      }
      
      await ctx.reply(responseText);
    } catch (error) {
      logger.error({ err: error, userId: ctx.from?.id }, 'Error processing text message');
      await ctx.reply('Sorry, something went wrong while processing your request.');
    }
  });

  bot.on('voice', async (ctx) => await handleAudio(ctx, ctx.message.voice.file_id));
  bot.on('audio', async (ctx) => await handleAudio(ctx, ctx.message.audio.file_id));
}

async function handleAudio(ctx: Context, fileId: string) {
  try {
    const userId = String(ctx.from!.id);
    logger.info({ userId }, 'Received audio message');
    
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await fetch(fileLink.href);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    const transcribedText = await transcribeAudio(buffer, 'voice.ogg');
    logger.info({ userId }, `Transcribed: ${transcribedText}`);

    const routing = await routeIntent(transcribedText);
    
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    const targetLang = user?.languagePreference || 'en';
    const finalTgt = routing.tgt !== 'en' && routing.tgt !== 'ru' ? routing.tgt : targetLang;

    let responseText: string;

    if (routing.intent === 'GENERATE') {
      responseText = await generateResponse(routing.cleanText, routing.src, finalTgt);
    } else {
      responseText = await translateText(routing.cleanText, routing.src, finalTgt);
    }
    
    await ctx.reply(responseText);
  } catch (error) {
    logger.error({ err: error, userId: ctx.from?.id }, 'Error processing audio message');
    await ctx.reply('Sorry, I could not process the audio message.');
  }
}
