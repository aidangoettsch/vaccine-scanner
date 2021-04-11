import fetch from "node-fetch"
import chalk from "chalk";
import dotenv from "dotenv"
import {MessageEmbed, WebhookClient} from "discord.js";
import {safewayMd} from "./sites/albertsons";
import {cvs} from "./sites/cvs";
import {harrisTeeterMoco} from "./sites/kroger";
import {walgreensMoco} from "./sites/walgreens";

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
  interval: number
  scanner: () => Promise<ScanResult>,
  [instanceData: string]: any,
}

const sites: Site[] = [
  safewayMd,
  cvs,
  harrisTeeterMoco,
  // walgreensMoco,
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
        .setColor('#0099ff')
        .setTitle(`New availability for ${site.displayName}`)
        .setDescription(res.message)

      await webhookClient.send(embed)
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
