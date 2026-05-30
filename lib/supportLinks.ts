export type PublicSupportLink = {
  label: string
  href: string
  description: string
  platform: 'telegram' | 'discord'
  mode: 'direct' | 'community'
}

export function compactUrl(href: string) {
  try {
    const url = new URL(href)
    return `${url.hostname}${url.pathname}`.replace(/\/$/, '')
  } catch {
    return href
  }
}

export function getPublicSupportLinks() {
  return {
    telegramProfile: {
      label: 'Telegram DM',
      href: process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_PROFILE || 'https://t.me/your_username',
      description: 'Fast one-to-one setup help, access activation, and urgent monitoring questions.',
      platform: 'telegram',
      mode: 'direct',
    },
    telegramChannel: {
      label: 'Telegram community',
      href: process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_CHANNEL || 'https://t.me/your_channel',
      description: 'Updates, incident notes, release announcements, and operating guidance.',
      platform: 'telegram',
      mode: 'community',
    },
    discordProfile: {
      label: 'Discord',
      href: process.env.NEXT_PUBLIC_SUPPORT_DISCORD_PROFILE || 'https://discord.com/users/000000000000000000',
      description: 'Use Discord if that is where your team already lives.',
      platform: 'discord',
      mode: 'direct',
    },
  } satisfies Record<string, PublicSupportLink>
}

export function getChromeExtensionUrl() {
  return process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL || 'https://chrome.google.com/webstore/detail/your-extension-id'
}
