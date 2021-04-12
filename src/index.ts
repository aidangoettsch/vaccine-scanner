import fetch from "node-fetch"
import chalk from "chalk"
import dotenv from "dotenv"
import Discord from "discord.js"
import {
  ColorResolvable,
  DiscordAPIError,
  MessageEmbed,
  WebhookClient,
} from "discord.js"
import { safewayMd } from "./sites/albertsons"
import { cvs } from "./sites/cvs"
import { harrisTeeterMoco } from "./sites/kroger"
import { walgreensMoco } from "./sites/walgreens"
import { walmartMoco } from "./sites/walmart"
import { DateTime } from "luxon"

dotenv.config()

export enum ScanOutcome {
  UNAVAILABLE = "UNAVAILABLE",
  AVAILABLE = "AVAILABLE",
  NEW_AVAILABLE = "NEW AVAILABLE",
}

export interface ScanResult {
  outcome: ScanOutcome
  message?: string
}

export interface Site {
  displayName: string
  color: ColorResolvable
  thumbnail: string
  interval: number
  scanner: () => Promise<ScanResult>
  [instanceData: string]: any
}

const sites: Site[] = [
  safewayMd,
  cvs,
  harrisTeeterMoco,
  walgreensMoco,
  walmartMoco,
]

const bot: any = new Discord.Client()

bot.login(process.env.TOKEN)
bot.on("ready", async () => {
  if (!process.env.GUILD_ID || !process.env.CHANNEL_ID)
    throw new Error("Environment not configured")

  console.log(`[i] Bot ready!`)
  console.log(`[i] Invite: ${await bot.generateInvite()}`)

  const channel = bot.guilds
    .resolve(process.env.GUILD_ID)
    ?.channels!.resolve(process.env.CHANNEL_ID)

  async function execute(site: Site) {
    if (!channel) throw new Error("Cannot find Discord channel")
    else if (!channel.isText())
      throw new Error("GuildChannel not a text channel")

    try {
      const res = await site.scanner()

      const formattedMsg =
        res.outcome === ScanOutcome.NEW_AVAILABLE
          ? chalk.green(res.message)
          : res.outcome === ScanOutcome.AVAILABLE
          ? chalk.yellow("No new appointments found")
          : chalk.red("No appointments found")
      console.log(
        `[${new Date().toISOString()}][${site.displayName}][${
          res.outcome
        }] ${formattedMsg}`
      )

      if (res.outcome === ScanOutcome.NEW_AVAILABLE) {
        const embed = new MessageEmbed()
          .setColor(site.color)
          .setThumbnail(site.thumbnail)
          .setTitle(`New availability for ${site.displayName}`)
          .setDescription(res.message?.slice(0, 2048))
          .setFooter(
            `${DateTime.now().toLocaleString(DateTime.DATETIME_FULL)}`,
            "https://cdn.discordapp.com/avatars/161566417018159104/c0e236f34cf194621b8cf03b4fdf20a4.png?size=128"
          )

        const msg = await channel.send(embed)

        await bot.rest.request(
          "POST",
          `/channels/${channel.id}/messages/${msg.id}/crosspost`,
          { versioned: true, auth: true }
        )
      }
    } catch (e) {
      console.error(
        `[${new Date().toISOString()}][${site.displayName}][ERROR] ${chalk.red(
          e.stack
        )}`
      )
    }
  }

  for (const site of sites) {
    execute(site).catch((e) =>
      console.error(
        `[${new Date().toISOString()}][INTERNAL ERROR] ${chalk.red(e)}`
      )
    )
    setInterval(() => {
      execute(site).catch((e) =>
        console.error(
          `[${new Date().toISOString()}][INTERNAL ERROR] ${chalk.red(e)}`
        )
      )
    }, site.interval)
  }
})
