import "dotenv/config";
import { scrapeBetplay } from "./scrapers/betplay.js";

scrapeBetplay().then((odds) => {
  console.log(`\nTotal: ${odds.length} cuotas`);
  console.log("Muestra (primeras 6):");
  console.log(JSON.stringify(odds.slice(0, 6), null, 2));
}).catch(console.error);
