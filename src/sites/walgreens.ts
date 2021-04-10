import fetch from "node-fetch";
import {ScanOutcome, ScanResult, Site} from "../index";

export const walgreensMoco: Site = {
  displayName: "Walgreens Moco",
  interval: 30000,
  lastAppointments: [],
  async scanner(): Promise<ScanResult> {
    const res = await fetch(`https://www.walgreens.com/findcare/vaccination/covid-19/location-screening`, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.5",
        "Pragma": "no-cache",
        "rx-channel": "WEB",
        "DNT": "1",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "TE": "Trailers",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:87.0) Gecko/20100101 Firefox/87.0"
      },
    })

    console.log(res)

    return {
      outcome: ScanOutcome.UNAVAILABLE,
    }
  }
}
