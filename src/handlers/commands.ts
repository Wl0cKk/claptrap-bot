import { Telegraf } from 'telegraf';
import { SUPPORTED_LANGS } from '../constants';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export function registerCommandHandlers(bot: Telegraf) {
  bot.start((ctx) => ctx.reply('Welcome! Send me text or voice messages. Use /lang to change target language.'));

  bot.command('lang', async (ctx) => {
    const args = ctx.message.text.split(' ');
    const langCode = args[1]?.toLowerCase();

    if (!langCode) {
      const langList = Object.entries(SUPPORTED_LANGS)
        .map(([code, name]) => `${code} - ${name}`)
        .join('\n');
      return ctx.reply(`Current target language preference. Please specify a language code.\n\nSupported languages:\n${langList}`);
    }

    if (!SUPPORTED_LANGS[langCode]) {
      return ctx.reply(`Unsupported language code: ${langCode}. Use /lang to see supported languages.`);
    }

    const userId = String(ctx.from!.id);
    await db.update(users)
      .set({ languagePreference: langCode })
      .where(eq(users.id, userId));

    ctx.reply(`Target language updated to: ${SUPPORTED_LANGS[langCode]} (${langCode})`);
  });
}
