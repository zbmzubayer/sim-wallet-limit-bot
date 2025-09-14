import { Prisma } from "../generated/prisma";

export type DeviceSimData = Prisma.ChatGetPayload<{
  select: { devices: { include: { deviceSims: { include: { sim: true } } } } };
}>;

export function formatDeviceData(chat: DeviceSimData): string {
  let output = "";

  chat.devices.forEach((device, deviceIndex) => {
    // Add device header (assuming device has a name or ID)
    output += `📟 DS-${device.deviceNo}\n`;

    device.deviceSims.forEach((deviceSim) => {
      const sim = deviceSim.sim;

      // Format: Sim1 - 01832553404 | BK: 80K | NG: 80K
      output += `Sim${deviceSim.simNo} - ${sim.phone || "N/A"} | BK: ${sim.bkLimit / 1000}K | NG: ${
        sim.ngLimit / 1000
      }K\n`;
    });

    // Add extra line between devices if there are multiple devices
    if (deviceIndex < chat.devices.length - 1) {
      output += "---------------------------------------\n";
    }
  });

  return output.trim();
}

export function formatUpdateBalanceData(chat: DeviceSimData): string {
  let output = "";

  chat.devices.forEach((device) => {
    device.deviceSims.forEach((deviceSim) => {
      const sim = deviceSim.sim;

      // Format: Sim1 - 01832553404 | BK: 80K | NG: 80K
      output += `Sim${deviceSim.simNo} - ${sim.phone || "N/A"} | BK: ${sim.bkLimit / 1000}K | NG: ${
        sim.ngLimit / 1000
      }K\n`;
    });
  });

  return output.trim();
}
