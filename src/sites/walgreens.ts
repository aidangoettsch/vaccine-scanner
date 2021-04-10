import fetch from "node-fetch";
import {ScanOutcome, ScanResult, Site} from "../index";
import { chromium } from "playwright";

interface WalgreensAuth {
  cookies: string,
  csrfToken: string,
}

async function getAuth(): Promise<WalgreensAuth> {
  const browser = await chromium.launch({
    headless: false
  })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto("https://www.walgreens.com/login.jsp")

  if (!process.env.WALGREENS_EMAIL || !process.env.WALGREENS_PASSWORD) throw("Walgreens login not configured");
  await page.type("#user_name", process.env.WALGREENS_EMAIL)
  await page.type("#user_password", process.env.WALGREENS_PASSWORD)
  await page.click("#submit_btn")

  const cookies = (await context.cookies()).filter(c => c.domain === ".walgreens.com" || c.domain === "www.walgreens.com")

  await page.goto("https://www.walgreens.com/findcare/vaccination/covid-19/location-screening")
  const csrfToken = await page.getAttribute("meta[name=_csrf]", "content")
  if (!csrfToken) throw new Error("Could not parse CSRF token")

  await browser.close()
  return {
    cookies: cookies.map(c => `${c.name}=${c.value}`).join("; "),
    csrfToken,
  }
}

export const walgreensMoco: Site = {
  displayName: "Walgreens Moco",
  interval: 30000,
  lastAppointments: [],
  async scanner(): Promise<ScanResult> {
    if (!this.auth) this.auth = await getAuth()
    console.log(this.auth)

    const res = await fetch(`https://www.walgreens.com/hcschedulersvc/svc/v1/immunizationLocations/availability`, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "application/json, text/plain, */*",
        "Authority": "www.walgreens.com",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json; charset=UTF-8",
        "Origin": "https://www.walgreens.com",
        "Pragma": "no-cache",
        "Referer": "https://www.walgreens.com/findcare/vaccination/covid-19/location-screening",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:87.0) Gecko/20100101 Firefox/87.0",
        "Cookie": this.auth.cookies,
        "X-XSRF-TOKEN": this.auth.csrfToken,
      },
    })

    console.log(res)

    return {
      outcome: ScanOutcome.UNAVAILABLE,
    }
  }
}
