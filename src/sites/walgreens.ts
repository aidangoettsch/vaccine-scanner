import fetch from "node-fetch";
import { curly } from "node-libcurl";
import {ScanOutcome, ScanResult, Site} from "../index";
import {firefox} from "playwright-extra";
import humanizePlugin from "@extra/humanize";
import { PlaywrightBlocker } from '@cliqz/adblocker-playwright'
import {DateTime} from "luxon";

interface WalgreensAuth {
  cookies: string,
}

interface WalgreensAvailAuth {
  cookies: string,
  csrfToken: string,
}

// async function getLoggedInAuth(): Promise<WalgreensAuth> {
//   const browser = await firefox.launch({
//     headless: false,
//     firefoxUserPrefs: {
//       "general.appversion.override":
//         "5.0 (Macintosh; Intel Mac OS X 10.15; rv:87.0) Gecko/20100101 Firefox/87.0",
//       "general.oscpu.override": "Intel Mac OS X 10.15",
//       "general.platform.override": "MacIntel",
//       "general.useragent.override":
//         "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:87.0) Gecko/20100101 Firefox/87.0",
//       "intl.accept_languages": "en-US, en",
//       "intl.locale.requested": "en-US",
//     },
//   })
//   const context = await browser.newContext({
//     userAgent:
//       "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:87.0) Gecko/20100101 Firefox/87.0",
//   })
//   const page = await context.newPage()
//   const blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
//   await blocker.enableBlockingInPage(page);
//
//   await page.goto("https://www.walgreens.com/login.jsp")
//
//   if (!process.env.WALGREENS_EMAIL || !process.env.WALGREENS_PASSWORD) throw("Walgreens login not configured");
//   await page.type("#user_name", process.env.WALGREENS_EMAIL)
//   await page.type("#user_password", process.env.WALGREENS_PASSWORD)
//   await page.click("#submit_btn")
//
//   const cookies = (await context.cookies()).filter(c => c.domain === ".walgreens.com" || c.domain === "www.walgreens.com")
//
//   await browser.close()
//   return {
//     cookies: cookies.map(c => `${c.name}=${c.value}`).join("; ")
//   }
// }

async function getAuth(): Promise<WalgreensAvailAuth> {
  firefox.use(humanizePlugin())
  const browser = await firefox.launch({
    headless: false,
    firefoxUserPrefs: {
      "general.appversion.override":
        "5.0 (Macintosh; Intel Mac OS X 10.15; rv:87.0) Gecko/20100101 Firefox/87.0",
      "general.oscpu.override": "Intel Mac OS X 10.15",
      "general.platform.override": "MacIntel",
      "general.useragent.override":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:87.0) Gecko/20100101 Firefox/87.0",
      "intl.accept_languages": "en-US, en",
      "intl.locale.requested": "en-US",
    },
  })
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:87.0) Gecko/20100101 Firefox/87.0",
  })
  const page = await context.newPage()
  const blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
  // @ts-ignore
  await blocker.enableBlockingInPage(page);

  await page.goto("https://www.walgreens.com/login.jsp")

  if (!process.env.WALGREENS_EMAIL || !process.env.WALGREENS_PASSWORD) throw("Walgreens login not configured");
  await page.type("#user_name", process.env.WALGREENS_EMAIL)
  await page.type("#user_password", process.env.WALGREENS_PASSWORD)
  await page.click("#submit_btn")

  await page.goto(
    "https://www.walgreens.com/findcare/vaccination/covid-19",
    { waitUntil: "networkidle" }
  );

  const waitForSchedulePromise = page.waitForNavigation({
    waitUntil: "networkidle",
  });
  await page.click(
    "[href='/findcare/vaccination/covid-19/location-screening']"
  );
  await waitForSchedulePromise;

  const cookies = (await context.cookies()).filter(c => c.domain === ".walgreens.com" || c.domain === "www.walgreens.com")
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
  async fetchTimeslots(productId: string, startDateTime: string) {
    if (!this.auth) this.auth = await getAuth()

    const data = await curly.post(`https://www.walgreens.com/hcschedulersvc/svc/v2/immunizationLocations/timeslots`, {
      httpHeader: [
        "Accept-Language: en-US,en;q=0.9",
        "Accept: application/json, text/plain, */*",
        "Authority: www.walgreens.com",
        "Cache-Control: no-cache",
        "Content-Type: application/json; charset=UTF-8",
        "Origin: https://www.walgreens.com",
        "Pragma: no-cache",
        "Referer: https://www.walgreens.com/findcare/vaccination/covid-19/appointment/next-available",
        "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:87.0) Gecko/20100101 Firefox/87.0",
        `Cookie: ${this.auth.cookies}`,
      ],
      postFields: JSON.stringify({
        serviceId: "99",
        position: {
          latitude: 38.5976262,
          longitude: -80.4549026,
        },
        state: "WV",
        vaccine: {
          productId
        },
        appointmentAvailability: {
          startDateTime,
        },
        radius: 25,
        size: 25,
      }),
      acceptEncoding: "gzip",
    })

    console.log(data)
  },
  async scanner(): Promise<ScanResult> {
    if (!this.auth) this.auth = await getAuth()

    const tomorrow = DateTime.now()
      .setZone("UTC-5")
      .plus({ days: 1 });
    const startDateTime = tomorrow.toISODate();

    const { data } = await curly.post(`https://www.walgreens.com/hcschedulersvc/svc/v1/immunizationLocations/availability`, {
      httpHeader: [
        "Accept-Language: en-US,en;q=0.9",
        "Accept: application/json, text/plain, */*",
        "Authority: www.walgreens.com",
        "Cache-Control: no-cache",
        "Content-Type: application/json; charset=UTF-8",
        "Origin: https://www.walgreens.com",
        "Pragma: no-cache",
        "Referer: https://www.walgreens.com/findcare/vaccination/covid-19/location-screening",
        "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:87.0) Gecko/20100101 Firefox/87.0",
        `Cookie: ${this.auth.cookies}`,
        `X-XSRF-TOKEN: ${this.auth.csrfToken}`,
      ],
      postFields: JSON.stringify({
        serviceId: "99",
        position: {
          latitude: 38.5976262,
          longitude: -80.4549026,
        },
        appointmentAvailability: {
          startDateTime,
        },
        radius: 25,
      }),
      acceptEncoding: "gzip",
    })

    if (!data.appointmentsAvailable) return {
      outcome: ScanOutcome.UNAVAILABLE,
    }

    console.log(data)
    await this.fetchTimeslots("5fd42921195d89e656c0b028", startDateTime)

    return {
      outcome: ScanOutcome.UNAVAILABLE,
    }
  }
}
