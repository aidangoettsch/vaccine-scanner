import fetch from "node-fetch";
import type {ScanResult, Site} from "../index";
import {ScanOutcome} from "../index";

interface AlbertsonsPharmacy {
  id: string,
  region: string,
  address: string,
  lat: string,
  long: string,
  coach_url: string,
  availability: "yes" | "no",
}

export const safewayMd: Site = {
  displayName: "Safeway Maryland (Albertsons)",
  interval: 30000,
  lastStores: [],
  async scanner(): Promise<ScanResult> {
    const res = await fetch("https://s3-us-west-2.amazonaws.com/mhc.cdn.content/vaccineAvailability.json")
    const data: AlbertsonsPharmacy[] = await res.json()

    const avail = data.filter(({ availability, region }) => availability === "yes" && region === "Maryland")

    if (avail.length === 0) {
      return {
        outcome: ScanOutcome.UNAVAILABLE,
      }
    }

    const newAvail = avail.filter(store => !this.lastStores.includes(store.address))
    if (newAvail.length === 0) {
      return {
        outcome: ScanOutcome.AVAILABLE,
      }
    }
    const message = `New availability at ${
      newAvail.length
    } stores\n${
      newAvail.map(store => `${store.address}: book at ${store.coach_url}`).join("\n")
    }`
    this.lastStores = avail.map(store => store.address)

    return {
      outcome: ScanOutcome.NEW_AVAILABLE,
      message
    }
  }
}
