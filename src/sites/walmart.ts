import { ScanOutcome, ScanResult, Site } from "../index"
import { chromium, Cookie } from "playwright"
import fetch from "node-fetch"
import { DateTime } from "luxon"

interface WalmartAuth {
  cid?: string
  auth?: string
}

interface WalmartVaccine {
  productMdsFamId: string
  shortName: string
  quantity: number
}

interface WalmartStoreDataSlotDaySlot {
  slotId: string
  startTime: string
  endTime: string
}

interface WalmartStoreDataSlotDay {
  message?: string
  slotDate: string
  slots: WalmartStoreDataSlotDaySlot[]
}

interface WalmartStoreData {
  startDate: string
  endDate: string
  slotDays: WalmartStoreDataSlotDay[]
}

interface WalmartStore {
  id: string
  displayName: string
  inventory: WalmartVaccine[]
  address: {
    postalCode: string
    address1: string
    city: string
    state: string
    country: string
  }
  data: WalmartStoreData
}

async function getAuth(): Promise<WalmartAuth> {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    userAgent: "Vaccine Scanner",
  })
  const page = await context.newPage()

  await page.goto("https://www.walmart.com/account/login")

  while (!(await page.$("#password"))) {
    await context.clearCookies()
    await page.reload()
  }

  if (!process.env.WALMART_EMAIL || !process.env.WALMART_PASSWORD)
    throw "Walmart login not configured"
  await page.type("#email", process.env.WALMART_EMAIL)
  await page.type("#password", process.env.WALMART_PASSWORD)
  await page.click("button[data-automation-id=signin-submit-btn]")

  await page.waitForNavigation({ waitUntil: "networkidle" })

  const cookies = await context.cookies()

  await browser.close()
  return {
    cid: cookies.find((c: Cookie) => c.name === "CID")?.value,
    auth: cookies.find((c: Cookie) => c.name === "auth")?.value,
  }
}

export const walmartMoco: Site = {
  displayName: "Walmart Moco",
  interval: 300000000,
  lastAppointments: [],
  async scanner(): Promise<ScanResult> {
    if (!this.auth) this.auth = await getAuth()

    const { cid, auth } = this.auth

    async function authFetch(
      url: string,
      method: string = "GET",
      body?: object
    ): Promise<any> {
      return await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Cookie: `CID=${cid}; auth=${auth}`,
        },
        body: JSON.stringify(body),
      })
        .then((res) => res.json())
        .then((res) => res.data)
    }

    let res = await fetch(
      `https://www.walmart.com/pharmacy/v2/storefinder/stores/${cid}?searchString=20878&serviceType=covid_immunizations&filterDistance=25`
    ).then((res) => res.json())

    if (res.status !== "1") throw "Walmart store request failed"

    const stores: WalmartStore[] = await Promise.all(
      res.data.storesData.stores.map(async (store: WalmartStore) => {
        const id = store.id

        console.log()

        return {
          ...store,
          inventory: (await authFetch(
            `https://www.walmart.com/pharmacy/v2/clinical-services/inventory/store/${id}/${cid}?type=imz`
          )).inventory,
          data: await authFetch(
            `https://www.walmart.com/pharmacy/v2/clinical-services/time-slots/${cid}`,
            "POST",
            {
              startDate: DateTime.now().toFormat("MMddyyyy"),
              endDate: DateTime.now().plus({ days: 6 }).toFormat("MMddyyyy"),
              imzStoreNumber: { USStoreId: id },
            }
          ),
        }
      })
    )

    let toRet = []

    for (const store of stores) {
      const {
        displayName,
        inventory,
        address: { address1, city,  postalCode, state },
        data: { slotDays },
      } = store

    const inventoryAvail = inventory
      .filter((v) => v.quantity > 0)
      .map((v) => v.shortName.split(" ")[0])

    if (inventoryAvail.length) {
        for (const slotDay of slotDays) {
          const { slotDate } = slotDay

          const slotTimeDate = DateTime.fromFormat(slotDate, 'MMddyyyy').toLocaleString(DateTime.DATE_SHORT)

          for (const slot of slotDay.slots) {
            const { startTime, endTime } = slot

            const startTimeDate = DateTime.fromFormat(startTime, 'h:mm').toLocaleString(DateTime.TIME_SIMPLE)

            toRet.push(`${slotTimeDate} @ ${startTimeDate} - ${address1}, ${city}, ${state} ${postalCode} (${inventoryAvail.join(', ')})`)
          }
        }
      }
    }

    const newAvail = toRet.filter(e => !this.lastAppointments.includes(e))
    this.lastAppointments = toRet

    if (newAvail.length === 0) {
      return {
        outcome: ScanOutcome.AVAILABLE,
      }
    } else {
      return {
        outcome: ScanOutcome.NEW_AVAILABLE,
        message:
`
${toRet.length} new appointment(s) pogCHAMP
${toRet.join('\n')}
https://www.walmart.com/pharmacy/clinical-services/immunization/scheduled?imzType=covid
`
      }
    }
  },
}
