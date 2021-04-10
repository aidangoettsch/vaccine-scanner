import fetch from "node-fetch";
import {ScanOutcome, ScanResult, Site} from "../index";

interface CVSPharmacy {
  city: string,
  state: string,
  status: string,
}

export const cvs: Site = {
  displayName: "CVS Maryland",
  interval: 30000,
  lastStores: [],
  async scanner(): Promise<ScanResult> {
    const res = await fetch("https://www.cvs.com/immunizations/covid-19-vaccine.vaccine-status.MD.json?vaccineinfo", {
      headers: {
        "Referer": "https://www.cvs.com/immunizations/covid-19-vaccine",
      }
    })
    const data: CVSPharmacy[] = (await res.json()).responsePayloadData.data.MD

    const avail = data.filter(({ status }) => status !== "Fully Booked")

    if (avail.length === 0) {
      return {
        outcome: ScanOutcome.UNAVAILABLE,
      }
    }

    const newAvail = avail.filter(store => !this.lastStores.includes(store.city))
    if (newAvail.length === 0) {
      return {
        outcome: ScanOutcome.AVAILABLE,
      }
    }
    const message = `New availability at ${
      newAvail.length
    } stores\n${
      newAvail.map(store => `${store.city}, ${store.state}`).join("\n")
    }\nhttps://www.cvs.com/immunizations/covid-19-vaccine`
    this.lastStores = avail.map(store => store.city)

    return {
      outcome: ScanOutcome.NEW_AVAILABLE,
      message
    }
  }
}
