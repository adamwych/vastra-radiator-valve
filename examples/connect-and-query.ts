import NobleBluetoothCentral from "../lib/bluetooth-noble";
import { RadiatorValveScanner } from "../lib/scanner";

NobleBluetoothCentral.create().then((bluetooth) => {
  const scanner = new RadiatorValveScanner(bluetooth);

  scanner.on("connected", async (valve) => {
    try {
      console.log("isLocked", await valve.getLocked());
      console.log("batteryVoltage", await valve.getBatteryVoltage());
      console.log("temperatureDeviation", await valve.getTemperatureDeviation());
      console.log("currentTemperature", await valve.getCurrentTemperature());
    } catch (error) {
      console.error(error);
    }
  });

  scanner.start();
});
