import {ScanOutcome, ScanResult, Site} from "../index";
import {DateTime} from "luxon";
import fetch from "node-fetch";

interface KrogerAppointment {
  start_time: string,
  ar_reason: string
}

interface KrogerPharmacy {
  loc_id: number,
  loc_no: string,
  facilityDetails: {
    facilityId: string,
    legalName: string,
    vanityName: string,
    address: {
      address1: string
      address2: string
      city: string
      state: string
      zipCode: string
    },
    distance: number,
    phone: {
      countryCode: string
      areaCode: string
      phoneNumber: string
      extension: string
    },
    onlinePaymentsEnabled: boolean,
    onlineOrderingEnabled: boolean,
    pharmacyHours: any,
    brand: string,
    isPharmacyLocation: boolean,
    isTlcLocation: boolean
  },
  dates: {
    date: string,
    slots: KrogerAppointment[]
  }[]
}

export const harrisTeeterMoco: Site = {
  displayName: "Harris Teeter Moco",
  interval: 30000,
  lastAppointments: [],
  async scanner(): Promise<ScanResult> {
    const startDate = DateTime.now().setZone("UTC-5");
    const endDate = startDate.plus({ days: 10 });
    const radiusMiles = 50;

    const res = await fetch(`https://www.kroger.com/rx/api/anonymous/scheduler/slots/locationsearch/20878/${startDate.toISODate()}/${endDate.toISODate()}/${radiusMiles}?appointmentReason=131&appointmentReason=134&appointmentReason=137&appointmentReason=122&appointmentReason=125&appointmentReason=129&benefitCode=null`, {
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.kroger.com/rx/covid-vaccine",
        "X-Sec-Clge-Req-Type": "ajax",
        "Pragma": "no-cache",
        "rx-channel": "WEB",
        "DNT": "1",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "TE": "Trailers",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:87.0) Gecko/20100101 Firefox/87.0"
      },
    })
    const data: KrogerPharmacy[] = await res.json()
    const appointments = []

    for (const store of data) {
      for (const day of store.dates) {
        for (const slot of day.slots) {
          appointments.push(`${store.facilityDetails.vanityName} ${day.date} ${slot.start_time} ${slot.ar_reason}`)
        }
      }
    }

    if (appointments.length === 0) {
      return {
        outcome: ScanOutcome.UNAVAILABLE,
      }
    }

    const newAppointments = appointments.filter(a => !this.lastAppointments.includes(a))
    if (newAppointments.length === 0) {
      return {
        outcome: ScanOutcome.AVAILABLE,
      }
    }
    const message = `${
      newAppointments.length
    } new appointments\n${
      newAppointments.join("\n")
    }\nhttps://www.harristeeterpharmacy.com/rx/covid-eligibility`
    this.lastAppointments = appointments

    return {
      outcome: ScanOutcome.NEW_AVAILABLE,
      message
    }
  }
}
