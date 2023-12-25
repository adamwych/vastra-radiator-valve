import NobleBluetoothCentral from "../lib/bluetooth-noble";
import { RadiatorValveScanner } from "../lib/scanner";

NobleBluetoothCentral.create().then((bluetooth) => {
  const scanner = new RadiatorValveScanner(bluetooth);

  scanner.on("connected", (valve) => {
    console.log(`Found a radiator valve @ ${valve.peripheral.address}`);
  });

  scanner.start();
});
