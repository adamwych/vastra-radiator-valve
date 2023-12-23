import NobleBluetoothCentral from "../lib/bluetooth-noble";
import RadiatorValves from "../lib/radiator-valves";

NobleBluetoothCentral.create().then((bluetooth) => {
  console.log("Looking for radiator valves...");

  new RadiatorValves(bluetooth).startScanning(async (valve) => {
    console.log(`Found a radiator valve @ ${valve.peripheral.address}`);
  });
});
