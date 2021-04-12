import fetch from "node-fetch";
import { curly } from "node-libcurl";
import {ScanOutcome, ScanResult, Site} from "../index";
import {firefox} from "playwright";
import { PlaywrightBlocker } from '@cliqz/adblocker-playwright'
import {DateTime} from "luxon";
import * as util from "util";

interface WalgreensLoggedInAuth {
  cookies: string,
  userAgent: string,
}

interface WalgreensAuth {
  cookies: string,
  csrfToken: string,
  userAgent: string,
}

interface WalgreensManufacturer {
  productId: string,
  name: string,
  daysInBetween: number,
}

interface WalgreensAppointmentDay {
  date: string,
  day: string,
  slots: string[],
  restricted: boolean
}

interface WalgreensAppointment {
  date: string,
  day: string,
  slot: string,
  restricted: boolean,
  store: WalgreensStore,
  manufacturer: WalgreensManufacturer[],
}

type WalgreensAppointmentWithSecondDose = WalgreensAppointment & {
  secondDose: string | false
  secondDoseType: string | false
}

interface WalgreensStore {
  locationId: string,
  address: {
    line1: string,
    line2: string,
    city: string,
    state: string,
    country: string,
    zip: string,
  },
  manufacturer: WalgreensManufacturer[],
  appointmentAvailability: WalgreensAppointmentDay[]
}

async function getLoggedInAuth(): Promise<WalgreensLoggedInAuth> {
  const browser = await firefox.launch( {
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
  const context = await browser.newContext()
  const page = await context.newPage()
  const userAgent = await page.evaluate(() => navigator.userAgent)
  const blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
  // @ts-ignore
  await blocker.enableBlockingInPage(page);

  await page.goto(
    "https://www.walgreens.com/login.jsp?ru=%2Ffindcare%2Fvaccination%2Fcovid-19%2Feligibility-survey%3Fflow%3Dcovidvaccine%26register%3Drx",
    {
      waitUntil: "networkidle",
    }
  )

  if (!process.env.WALGREENS_EMAIL || !process.env.WALGREENS_PASSWORD) throw("Walgreens login not configured");
  await page.type("#user_name", process.env.WALGREENS_EMAIL)
  await page.type("#user_password", process.env.WALGREENS_PASSWORD)
  let waitForLoginResponsePromise = page.waitForResponse((response) =>
    response.url().startsWith("https://www.walgreens.com/profile/v1/login")
  );
  let waitForLoginIdlePromise = page.waitForLoadState("networkidle");
  await (await page.$("input[name=password]"))?.press("Enter");
  await waitForLoginResponsePromise;
  await waitForLoginIdlePromise;

  let errorVisible
  try {
    errorVisible = await page.isVisible("#error_msg", {timeout: 1000});
  } catch {}

  let retries = 0
  while (errorVisible && retries < 5) {
    await (await page.$("input[name=password]"))?.press("Enter");

    errorVisible = await page.isVisible("#error_msg", {timeout: 1000});
    retries++
  }

  if (errorVisible) throw new Error(`Error logging into Walgreens: ${await (await page.$("#error_msg"))?.innerText() || "Unknown error"}`)

  await page.waitForLoadState("load");
  await page.waitForLoadState("networkidle");
  await page.waitForSelector(".ApptScreens, #radio-security");
  await page.waitForTimeout(1500);
  await page.waitForSelector(".ApptScreens, #radio-security");
  await page.waitForLoadState("load");
  await page.waitForLoadState("networkidle");

  let visible;
  try {
    visible = await page.isVisible("#radio-security", {timeout: 2000});
  } catch {
  }

  if (visible) {
    await page.check("#radio-security");
    await page.click("#optionContinue");
    await page.fill("#secQues", process.env.WALGREENS_PASSWORD);
    await page.click("#validate_security_answer");
  }

  await page.waitForSelector(".ApptScreens");

  await page.goto(
    "https://www.walgreens.com/findcare/vaccination/covid-19",
    { waitUntil: "networkidle" }
  );

  const waitForSchedulePromise = page.waitForNavigation({
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1500);
  await page.click(
    "[href='/findcare/vaccination/covid-19/location-screening']"
  );
  await waitForSchedulePromise
  const cookies = (await context.cookies()).filter(c => c.domain === ".walgreens.com" || c.domain === "www.walgreens.com")

  // await context.close()
  return {
    cookies: cookies.map(c => `${c.name}=${c.value}`).join("; "),
    userAgent,
  }
}

async function getAuth(): Promise<WalgreensAuth> {
  const browser = await firefox.launch( {
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
  const context = await browser.newContext()
  const page = await context.newPage()
  const userAgent = await page.evaluate(() => navigator.userAgent)
  const blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
  // @ts-ignore
  await blocker.enableBlockingInPage(page);

  await page.goto(
    "https://www.walgreens.com/findcare/vaccination/covid-19",
    { waitUntil: "networkidle" }
  );

  const waitForSchedulePromise = page.waitForNavigation({
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1500);
  await page.click(
    "[href='/findcare/vaccination/covid-19/location-screening']"
  );
  await waitForSchedulePromise;

  const cookies = (await context.cookies()).filter(c => c.domain === ".walgreens.com" || c.domain === "www.walgreens.com")
  const csrfToken = await page.getAttribute("meta[name=_csrf]", "content")
  if (!csrfToken) throw new Error("Could not parse CSRF token")

  await context.close()
  return {
    cookies: cookies.map(c => `${c.name}=${c.value}`).join("; "),
    csrfToken,
    userAgent,
  }
}

export const walgreensMoco: Site = {
  displayName: "Walgreens Moco",
  interval: 3600000,
  color: '#e41133',
  thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Walgreens_Logo.svg/320px-Walgreens_Logo.svg.png',
  lastAppointments: [],
  async fetchTimeslots(productId: string, tomorrow: DateTime): Promise<WalgreensStore[]> {
    if (!this.loggedInAuth) this.loggedInAuth = await getLoggedInAuth()
    console.log(this.loggedInAuth.userAgent)

    const httpHeader = [
      "Accept-Language: en-US,en;q=0.9",
      "Accept: application/json, text/plain, */*",
      "Authority: www.walgreens.com",
      "Cache-Control: no-cache",
      "Content-Type: application/json; charset=UTF-8",
      "Origin: https://www.walgreens.com",
      "Pragma: no-cache",
      "Referer: https://www.walgreens.com/findcare/vaccination/covid-19/appointment/next-available",
      `User-Agent: ${this.loggedInAuth.userAgent}`,
      `Cookie: ${this.loggedInAuth.cookies}`,
    ]

    const postFields = JSON.stringify({
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
        startDateTime: tomorrow.toISODate(),
      },
      radius: 25,
      size: 25,
    })

    const res = await curly.post(`https://www.walgreens.com/hcschedulersvc/svc/v2/immunizationLocations/timeslots`, {
      httpHeader,
      postFields,
      acceptEncoding: "gzip",
    })

    if (!res.data.locations) throw new Error(`Could not parse response ${util.inspect(res)}`)

    return res.data.locations
  },
  async scanner(): Promise<ScanResult> {
    if (!this.auth) this.auth = await getAuth()

    const tomorrow = DateTime.now()
      .setZone("UTC-5")
      .plus({ days: 1 });

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
        `User-Agent: ${this.auth.userAgent}`,
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
          startDateTime: tomorrow.toISODate(),
        },
        radius: 25,
      }),
      acceptEncoding: "gzip",
    })

    if (!data.appointmentsAvailable) return {
      outcome: ScanOutcome.UNAVAILABLE,
    }

    const manufacturers: WalgreensManufacturer[] = []
    const firstDoseAppointments: WalgreensAppointment[] = []
    const firstDoseAvailability: WalgreensStore[] = await this.fetchTimeslots("", tomorrow)

    for (const store of firstDoseAvailability) {
      for (const manufacturer of store.manufacturer) {
        if (!manufacturers.includes(manufacturer)) manufacturers.push(manufacturer)
      }

      for (const day of store.appointmentAvailability) {
        for (const slot of day.slots) {
          firstDoseAppointments.push({
            ...day,
            slot: slot,
            store,
            manufacturer: store.manufacturer,
          })
        }
      }
    }
    console.log(manufacturers)

    const secondDoseAvailability: WalgreensStore[] = (await Promise.all(manufacturers.map(
      async m => await this.fetchTimeslots(m.productId, tomorrow.plus({ days: m.daysInBetween })))
    )).reduce((a, s) => {
      a.push(...s)
      return a
    }, [])

    console.log(secondDoseAvailability)

    const allAppointments: WalgreensAppointmentWithSecondDose[] = firstDoseAppointments.map(appointment => {
      const secondDoseStore = secondDoseAvailability.filter(s => s.locationId === appointment.store.locationId)

      if (secondDoseStore.length === 0) return {
        ...appointment,
        secondDose: false,
        secondDoseType: false,
      }

      const secondDoseDaysAvail: WalgreensAppointmentDay[] = []
      const secondDoseType: WalgreensManufacturer[] = []
      for (const storeWeek of secondDoseStore) {
        const secondDoseDates = appointment.manufacturer.map(m => DateTime.fromISO(appointment.date).plus({ days: m.daysInBetween }).toISODate())
        secondDoseDaysAvail.push(...storeWeek.appointmentAvailability.filter(d => secondDoseDates.includes(d.date)))
        secondDoseType.push(...storeWeek.manufacturer)
      }

      return {
        ...appointment,
        secondDose: secondDoseDaysAvail.map(d => d.date).filter((v, i, self) => self.indexOf(v) === i).join("/"),
        secondDoseType: secondDoseType.map(t => t.name).filter((v, i, self) => self.indexOf(v) === i).join("/"),
      }
    })

    const newAppointments = allAppointments.filter(a => !this.lastAppointments.includes(a))

    if (newAppointments.length > 0) {
      return {
        outcome: ScanOutcome.NEW_AVAILABLE,
        message: `${newAppointments.length} new appointments ${
          newAppointments.map(a => `${a.store.address.city}, ${a.store.address.state} ${a.store.address.zip} ${a.date} ${a.slot} ${a.secondDoseType} (Second dose on ${a.secondDose})`).join("\n")
        }\nhttps://www.walgreens.com/findcare/vaccination/covid-19`
      }
    }

    this.lastAppointments = newAppointments

    return {
      outcome: ScanOutcome.AVAILABLE
    }
  }
}
