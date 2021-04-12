import fetch from "node-fetch"
import chalk from "chalk";
import dotenv from "dotenv"
import {ColorResolvable, MessageEmbed, WebhookClient} from "discord.js";
import {safewayMd} from "./sites/albertsons";
import {cvs} from "./sites/cvs";
import {harrisTeeterMoco} from "./sites/kroger";
import {walgreensMoco} from "./sites/walgreens";
import { walmartMoco } from "./sites/walmart";
import { DateTime } from "luxon";

dotenv.config()

export enum ScanOutcome {
  UNAVAILABLE = "UNAVAILABLE",
  AVAILABLE = "AVAILABLE",
  NEW_AVAILABLE = "NEW AVAILABLE",
}

export interface ScanResult {
  outcome: ScanOutcome,
  message?: string,
}

export interface Site {
  displayName: string,
  color: ColorResolvable,
  thumbnail: string,
  interval: number,
  scanner: () => Promise<ScanResult>,
  [instanceData: string]: any,
}

const sites: Site[] = [
<<<<<<< HEAD
  // safewayMd,
  // cvs,
  // harrisTeeterMoco,
  walgreensMoco,
=======
  safewayMd,
  cvs,
  harrisTeeterMoco,
  // walgreensMoco,
  walmartMoco
>>>>>>> f8701275f9bbb473ca66a3cd1fde615c311869b2
]

if (!process.env.WEBHOOK_ID || !process.env.WEBHOOK_TOKEN) throw("Environment not configured");

const webhookClient = new WebhookClient(process.env.WEBHOOK_ID, process.env.WEBHOOK_TOKEN)

async function execute(site: Site) {
  try {
    const res = await site.scanner()

    const formattedMsg = res.outcome === ScanOutcome.NEW_AVAILABLE ?
      chalk.green(res.message) :
      res.outcome === ScanOutcome.AVAILABLE ?
        chalk.yellow("No new appointments found") :
        chalk.red("No appointments found")
    console.log(`[${new Date().toISOString()}][${site.displayName}][${res.outcome}] ${formattedMsg}`)

    if (res.outcome === ScanOutcome.NEW_AVAILABLE) {
      const embed = new MessageEmbed()
        .setColor(site.color)
        .setThumbnail(site.thumbnail)
        .setTitle(`New availability for ${site.displayName}`)
        .setDescription(res.message?.slice(0, 2048))
        .setFooter(`${DateTime.now().toLocaleString(DateTime.DATETIME_FULL)}`, 'https://cdn.discordapp.com/avatars/161566417018159104/c0e236f34cf194621b8cf03b4fdf20a4.png?size=128')

      // await webhookClient.send(embed)
    }
  } catch (e) {
    console.error(`[${new Date().toISOString()}][${site.displayName}][ERROR] ${chalk.red(e.stack)}`)
  }
}

for (const site of sites) {
  execute(site).catch(e => console.error(`[${new Date().toISOString()}][INTERNAL ERROR] ${chalk.red(e)}`))
  setInterval(() => {
    execute(site).catch(e => console.error(`[${new Date().toISOString()}][INTERNAL ERROR] ${chalk.red(e)}`))
  }, site.interval)
}
