import NobleBluetoothCentral from "../lib/bluetooth-noble";
import RadiatorValves from "../lib/radiator-valves";

NobleBluetoothCentral.create().then((bluetooth) => {
  console.log("Looking for radiator valves...");

  new RadiatorValves(bluetooth).startScanning(async (valve) => {
    try {
      await valve.connect();
    } catch (error) {
      console.error(error);
      return;
    }

    try {
      console.log("isLocked", await valve.getLocked());
      console.log("batteryVoltage", await valve.getBatteryVoltage());
      console.log("temperatureDeviation", await valve.getTemperatureDeviation());
      console.log("currentTemperature", await valve.getCurrentTemperature());
    } catch (error) {
      console.error(error);
    }

    await valve.disconnect();

    process.exit(0);
  });
});
