type DeviceSimData = {
  deviceNo: number;
  sims: {
    simNo: number;
    phone: string;
    bkLimit: number;
    ngLimit: number;
  }[];
};

export function parseDeviceSet(text: string): DeviceSimData | null {
  const dsMatch = text.match(/^DS-(\d+)\s*$/m);
  if (!dsMatch || !dsMatch[1]) {
    console.log("❌ Invalid DS format");
    return null;
  }
  const ds = parseInt(dsMatch[1], 10);
  const simValidationRegex = /^Sim[1-4] - 01\d{9} BK \d+K \| NG \d+K$/; // Sim1 - 01832553404 BK 80K | NG 80K
  const lines = text.split("\n").slice(2); // Skip the DS line and the empty line
  const validLines = lines.filter((line) => simValidationRegex.test(line.trim()));
  const simDataArray: DeviceSimData["sims"] = [];
  if (validLines.length === lines.length && validLines.length > 0 && validLines.length <= 4) {
    for (let i = 0; i < validLines.length; i++) {
      const line = validLines[i];
      if (line) {
        const simData = extractSimData(line);
        if (simData && !simDataArray.find((s) => s.simNo === simData?.simNo)) {
          simDataArray.push(simData);
        } else {
          console.log("❌ Invalid Sim data in line:", line);
          break;
        }
      }
    }
    // console.log("Valid settings:", ds, simDataArray);
    if (simDataArray && validLines.length === simDataArray.length)
      return {
        deviceNo: ds,
        sims: simDataArray,
      };
    else return null;
  } else {
    console.log("❌ Invalid Sim format");
    return null;
  }
}

export function extractSimData(line: string): DeviceSimData["sims"][number] | null {
  // Sim extraction regex with capture groups
  const regex = /^Sim([1-4]) - (01\d{9}) BK (\d+)K \| NG (\d+)K$/;
  const match = line.match(regex);

  if (!match) return null;

  if (!match[1] || !match[2] || !match[3] || !match[4]) return null;

  return {
    simNo: parseInt(match[1], 10), // Sim number
    phone: match[2], // Phone number
    bkLimit: parseInt(match[3], 10), // BK value
    ngLimit: parseInt(match[4], 10), // NG value
  };
}
