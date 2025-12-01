/**
 * Use this file to define custom functions and blocks.
 * Read more at https://makecode.microbit.org/blocks/custom
 */

/**
 * Custom blocks
 */
//% weight=100 color=#0fbc11 icon="\uf0ac"
namespace timezoneDB {
  interface TimezoneInfo {
    utcOffset: number;
    hasDst: boolean;
    dstDiff: number;
  }
  interface DateTime {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  }

  const HEADER_SIZE = 10;
  let resLat = 0;
  let resLon = 0;
  let resTime = 0;
  let encoding = 2;
  let timezoneInfo = { utcOffset: 0, hasDst: false, dstDiff: 0 };
  let timezoneTime = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
  };
  let timezoneTimeDst = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
  };
  let latitude = 0.0;
  let longitude = 0.0;

  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function padNumber(num: number, size: number): string {
    let s = "" + num;
    while (s.length < size) {
      s = "0" + s;
    }
    return s;
  }

  function isLeap(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  function applyTimezoneOffset(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    offsetHours: number
  ): DateTime {
    // Local copy of month days for leap-year calculation
    const monthDays = MONTH_DAYS.slice();
    if (isLeap(year)) {
      monthDays[1] = 29; // February
    }

    // Convert UTC time to total seconds
    let totalSeconds = hour * 3600 + minute * 60 + second;
    totalSeconds += Math.floor(offsetHours * 3600);

    // Extract new time values
    second = ((totalSeconds % 60) + 60) % 60;
    let totalMinutes = Math.trunc(totalSeconds / 60);

    minute = ((totalMinutes % 60) + 60) % 60;
    let totalHours = Math.trunc(totalMinutes / 60);

    hour = ((totalHours % 24) + 24) % 24;

    let dayChange = 0;
    if (totalHours < 0) dayChange = -1;
    else if (totalHours >= 24) dayChange = 1;

    // Apply day change
    day += dayChange;

    // Overflow (day too high)
    if (day > monthDays[month - 1]) {
      day -= monthDays[month - 1];
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    // Underflow (day too low)
    else if (day < 1) {
      month -= 1;
      if (month < 1) {
        month = 12;
        year -= 1;
      }

      // Recompute February if year changed
      const newMonthDays = MONTH_DAYS.slice();
      if (isLeap(year)) {
        newMonthDays[1] = 29;
      }

      day += newMonthDays[month - 1];
    }

    return { year, month, day, hour, minute, second };
  }

  function weekdayForDate(year: number, month: number, day: number): number {
    /*
    - d=day, m=month, y=year
    - for January or February, m=m+12, y=y-1
    - K=y mod 100 (year of century)
    - J=y // 100 (century)
    - h=0 → Saturday, 1 → Sunday, … , 6 → Friday
    - h=(d + (13 * (m + 1)) / 5 + K + K / 4 + J / 4 + 5 * J) % 7
    */
    let d = day;
    let m = month > 2 ? month : month + 12;
    let y = month > 2 ? year : year - 1;
    let K = y % 100;
    let J = y; // 100
    let h =
      (d +
        Math.trunc((13 * (m + 1)) / 5) +
        K +
        Math.trunc(K / 4) +
        Math.trunc(J / 4) +
        5 * J) %
      7;
    //print(f"d={d}, m={m}, y={y}, K={K}, J={J}, h={h}")
    return h;
  }

  function lastSundayOfMarch(year: number): number {
    // last Sunday of March / October=31 - ((h - 1) % 7)
    let weekday = weekdayForDate(31, 3, year);
    return 31 - ((weekday - 1) % 7);
  }

  function lastSundayOfOctober(year: number): number {
    // last Sunday of March / October=31 - ((h - 1) % 7)
    let weekday = weekdayForDate(31, 10, year);
    return 31 - ((weekday - 1) % 7);
  }

  function firstSundayOfApril(year: number): number {
    // first Sunday of April / October=1 + ((8 - h) % 7)
    let weekday = weekdayForDate(1, 4, year);
    return 1 + ((8 - weekday) % 7);
  }

  function firstSundayOfOctober(year: number): number {
    // first Sunday of April / October=1 + ((8 - h) % 7)
    let weekday = weekdayForDate(1, 10, year);
    return 1 + ((8 - weekday) % 7);
  }

  function isDstActive(
    latitude: number,
    year: number,
    month: number,
    day: number,
    hour: number
  ) {
    if (latitude >= 0.0) {
      //serial.writeLine("isDstActive: northern hemisphere");
      // northern hemisphere
      let startDstDay = lastSundayOfMarch(year);
      //serial.writeLine("isDstActive: startDstDay=" + startDstDay.toString());
      let startDstHour = 2; // from 02:00 to 03:00
      let endDstDay = lastSundayOfOctober(year);
      //serial.writeLine("isDstActive: endDstDay=" + endDstDay.toString());
      let endDstHour = 2; // from 03:00 to 02:00
      /*serial.writeLine(
        "isDstActive: endDstHour=" +
          endDstHour.toString() +
          " hour=" +
          hour.toString()
      );*/
      if (month < 3 || month > 10) {
        return false;
      }

      if (month == 3) {
        if (day < startDstDay) {
          return false;
        }
        if (day == startDstDay) {
          return hour >= startDstHour;
        }
        return true;
      }

      if (month == 10) {
        if (day > endDstDay) {
          return false;
        }
        if (day == endDstDay) {
          return hour < endDstHour;
        }
        return true;
      }

      return true;
    } else {
      // southern hemisphere
      let startDstDay = firstSundayOfOctober(year);
      let startDstHour = 2; // from 02:00 to 03:00
      let endDstDay = firstSundayOfApril(year);
      let endDstHour = 2; // from 03:00 to 02:00

      if (month > 4 && month < 10) {
        return false;
      }

      if (month == 4) {
        if (day > endDstDay) {
          return false;
        }
        if (day == endDstDay) {
          return hour < endDstHour;
        }
        return true;
      }

      if (month == 10) {
        if (day < startDstDay) {
          return false;
        }
        if (day == startDstDay) {
          return hour >= startDstHour;
        }
        return true;
      }

      return true;
    }
  }

  /*
  Current timezone information stored in last sector (address = 0x00fff000)
  00-03: TEUN (4-byte string)
  04-11: latitude (number)
  12-19: longitude (number)
  20-27: utc offset (number)
  28-29: has dst (boolean encoded in 16 bit unsigned int)
  30-37: dst diff (number)

  size = 38 bytes
  */
  const CURRENT_TIMEZONE_ADDRESS = 0x00fff000;
  const CURRENT_TIMEZONE_SIZE = 38;

  function readCurrentTimezone(): void {
    let data = w25q128.readData(
      CURRENT_TIMEZONE_ADDRESS,
      CURRENT_TIMEZONE_SIZE
    );

    const magicString =
      String.fromCharCode(data[0]) +
      String.fromCharCode(data[1]) +
      String.fromCharCode(data[2]) +
      String.fromCharCode(data[3]);
    if (magicString == "TEUN") {
      latitude = data.getNumber(NumberFormat.Float64BE, 4);
      longitude = data.getNumber(NumberFormat.Float64BE, 12);
      let utcOffset = data.getNumber(NumberFormat.Float64BE, 20);
      let hasDst = data.getNumber(NumberFormat.UInt16BE, 28);
      let dstDiff = data.getNumber(NumberFormat.Float64BE, 30);
      timezoneInfo = {
        utcOffset: utcOffset,
        hasDst: hasDst == 1 ? true : false,
        dstDiff: dstDiff,
      };

      serial.writeLine("Loaded timezone from flash");
    } else {
      latitude = 0.0;
      longitude = 0.0;
      timezoneInfo = {
        utcOffset: 0.0,
        hasDst: false,
        dstDiff: 0.0,
      };
    }
    serial.writeLine(
      "Current timezone: lat=" +
        latitude.toString() +
        " lon=" +
        longitude.toString() +
        " utcOffset=" +
        timezoneInfo.utcOffset.toString() +
        " hasDst=" +
        (timezoneInfo.hasDst ? "true" : "false") +
        " dstDiff=" +
        timezoneInfo.dstDiff.toString()
    );
  }

  /**
   */
  //% block
  export function writeCurrentTimezone(): void {
    let data = pins.createBuffer(CURRENT_TIMEZONE_SIZE);
    data[0] = "T".charCodeAt(0);
    data[1] = "E".charCodeAt(0);
    data[2] = "U".charCodeAt(0);
    data[3] = "N".charCodeAt(0);

    data.setNumber(NumberFormat.Float64BE, 4, latitude);
    data.setNumber(NumberFormat.Float64BE, 12, longitude);
    data.setNumber(NumberFormat.Float64BE, 20, timezoneInfo.utcOffset);
    data.setNumber(NumberFormat.UInt16BE, 28, timezoneInfo.hasDst ? 1 : 0);
    data.setNumber(NumberFormat.Float64BE, 30, timezoneInfo.dstDiff);

    // Will also first erase the sector
    w25q128.writeData(CURRENT_TIMEZONE_ADDRESS, CURRENT_TIMEZONE_SIZE, data);
  }

  /**
   */
  //% block="resetCurrentTimezone lat $lat|lon $lon|utcOffset $utcOffset|hasDst $hasDst|dstDiff $dstDiff"
  export function resetCurrentTimezone(
    lat: number,
    lon: number,
    utcOffset: number,
    hasDst: boolean,
    dstDiff: number
  ): void {
    latitude = lat;
    longitude = lon;
    timezoneInfo = {
      utcOffset: utcOffset,
      hasDst: hasDst,
      dstDiff: dstDiff,
    };

    writeCurrentTimezone();
  }

  /**
   */
  //% block
  export function setupTimezoneDatabase(): void {
    let address = 0;
    let data = w25q128.readData(address, HEADER_SIZE);

    let year = (data[0] << 8) | data[1];
    let month = data[2];
    let day = data[3];

    let numLat = (data[4] << 8) | data[5];
    let numLon = (data[6] << 8) | data[7];

    let numTime = data[8];
    encoding = data[9];

    resLat = 180.0 / (numLat - 1);
    resLon = 360.0 / (numLon - 1);
    resTime = 1.0 / numTime;

    serial.writeLine(
      year.toString() +
        "-" +
        padNumber(month, 2) +
        "-" +
        padNumber(day, 2) +
        " numLat=" +
        numLat.toString() +
        " (res=" +
        resLat.toString() +
        ") numLon=" +
        numLon.toString() +
        " (res=" +
        resLon.toString() +
        ") numTime=" +
        numTime.toString() +
        " (res=" +
        resTime.toString() +
        ") encoding=" +
        encoding.toString()
    );

    readCurrentTimezone();
  }

  /**
   */
  //% block="readTimezone lat $lat|lon $lon"
  export function readTimezone(lat: number, lon: number): void {
    let latRoundToRes = Math.round(lat / resLat) * resLat;
    let lonRoundToRes = Math.round(lon / resLon) * resLon;
    let latIndex = Math.idiv((latRoundToRes + 90) / resLat, 1);
    let lonIndex = Math.idiv((lonRoundToRes + 180) / resLon, 1);
    let lonCount = 360 / resLon + 1;

    let byteCount = encoding == 1 ? 1 : 2;
    let coordinate_index = byteCount * (latIndex * lonCount + lonIndex);
    let flash_index = coordinate_index + HEADER_SIZE;

    let data = w25q128.readData(flash_index, byteCount);

    let hasDst = false;
    let utcOffset = 0.0;
    let dstDiff = 0.0;

    if (encoding == 1) {
      hasDst = (data[0] & 0x1) == 1;
      let encodedOffset = (data[0] >> 1) & 0xff;
      utcOffset = (encodedOffset - 24.0 / resTime) * resTime;
      dstDiff = 1.0;
    } else {
      hasDst = (data[0] & 0x1) == 1;
      let encodedOffset = data[1];
      utcOffset = (encodedOffset - 24.0 / resTime) * resTime;

      let dstDiffEnc = hasDst ? (data[0] >> 1) & 0x3 : 0;
      let supportedDstDiff = [1800, 3600, 7200];
      if (dstDiffEnc < supportedDstDiff.length) {
        dstDiff = hasDst ? supportedDstDiff[dstDiffEnc] / 3600.0 : 0.0;
      }
    }

    latitude = lat;
    longitude = lon;
    timezoneInfo = {
      utcOffset: utcOffset,
      hasDst: hasDst,
      dstDiff: dstDiff,
    };
  }

  /**
   */
  //% block
  export function getTimezoneUtcOffset(): number {
    return timezoneInfo.utcOffset;
  }

  /**
   */
  //% block
  export function getTimezoneHasDst(): boolean {
    return timezoneInfo.hasDst;
  }

  /**
   */
  //% block
  export function getTimezoneDstDiff(): number {
    return timezoneInfo.dstDiff;
  }

  /**
   */
  //% block="printTimezone lat $lat|lon $lon|location $location"
  export function printTimezone(
    lat: number,
    lon: number,
    location: string
  ): void {
    readTimezone(lat, lon);
    serial.writeLine(
      "timezone " +
        location +
        " (" +
        lat.toString() +
        ", " +
        lon.toString() +
        "): utcOffset=" +
        getTimezoneUtcOffset().toString() +
        ", hasDst=" +
        getTimezoneHasDst().toString() +
        ", dstDiff=" +
        getTimezoneDstDiff().toString()
    );
  }

  /**
   */
  //% block="calculateTimeForTimezone year $year|month $month|day $day|hour $hour|minute $minute|second $second"
  export function calculateTimeForTimezone(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number
  ): number[] {
    timezoneTime = applyTimezoneOffset(
      year,
      month,
      day,
      hour,
      minute,
      second,
      timezoneInfo.utcOffset
    );

    const hasDst = timezoneInfo.hasDst;
    const isActive = hasDst
      ? isDstActive(
          latitude,
          timezoneTime.year,
          timezoneTime.month,
          timezoneTime.day,
          timezoneTime.hour
        )
      : false;
    /*serial.writeLine(
      "hasDst=" +
        (hasDst ? "true" : "false") +
        " isDstActive=" +
        (isActive ? "true" : "false")
    );*/
    if (hasDst && isActive) {
      timezoneTimeDst = applyTimezoneOffset(
        timezoneTime.year,
        timezoneTime.month,
        timezoneTime.day,
        timezoneTime.hour,
        timezoneTime.minute,
        timezoneTime.second,
        timezoneInfo.dstDiff
      );
    } else {
      timezoneTimeDst = timezoneTime;
    }

    return [
      timezoneTimeDst.year,
      timezoneTimeDst.month,
      timezoneTimeDst.day,
      timezoneTimeDst.hour,
      timezoneTimeDst.minute,
      timezoneTimeDst.second,
    ];
  }

  function printDateTime(header: string, dateTime: DateTime): void {
    serial.writeLine(
      header +
        padNumber(dateTime.year, 2) +
        "-" +
        padNumber(dateTime.month, 2) +
        "-" +
        padNumber(dateTime.day, 2) +
        " " +
        padNumber(dateTime.hour, 2) +
        ":" +
        padNumber(dateTime.minute, 2) +
        ":" +
        padNumber(dateTime.second, 2)
    );
  }

  /**
   */
  //% block="printTimeForTimezone year $year|month $month|day $day|hour $hour|minute $minute|second $second"
  export function printTimeForTimezone(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number
  ) {
    calculateTimeForTimezone(year, month, day, hour, minute, second);
    printDateTime("Time in utc: ", { year, month, day, hour, minute, second });
    printDateTime("Time in tz: ", timezoneTime);
    printDateTime("Time in tz with dst: ", timezoneTimeDst);
  }
}
