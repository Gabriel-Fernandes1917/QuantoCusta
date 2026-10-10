import { createPlanningExcel, planningSheets } from "../src/lib/export/excel";
import { calculateCostOfLiving, emptySimulation } from "../src/lib/calculations/cost-of-living";
import { createComparisonExcel, comparisonSheets } from "../src/lib/export/property-comparison";
import { calculateComparison, emptyComparison } from "../src/lib/calculations/property-comparison";
import { createMealExcel, mealSheets } from "../src/lib/export/meal-comparison";
import { calculateMealRoutine, emptyMealRoutine } from "../src/lib/calculations/meal-comparison";
import { createVehicleExcel, vehicleSheets } from "../src/lib/export/vehicle-comparison";
import { calculateVehicleComparison, emptyVehicleComparison } from "../src/lib/calculations/vehicle-comparison";
import { createLodgingExcel, lodgingSheets } from "../src/lib/export/lodging-comparison";
import { calculateLodgingComparison, emptyLodgingComparison } from "../src/lib/calculations/lodging-comparison";
import { createRentalExcel, rentalSheets } from "../src/lib/export/rental-comparison";
import { calculateRentalComparison, emptyRentalComparison, emptyRentalRide } from "../src/lib/calculations/rental-comparison";
import { createTripExcel, tripSheets } from "../src/lib/export/trip-cost";
import { calculateTrip } from "../src/lib/calculations/trip-cost";
import { newTripScenario, parseTripDraft } from "../src/lib/trip-form";
import { describe, expect, it } from "vitest";
import writeExcelFile, { type Sheet } from "write-excel-file/universal";
import { inflateRawSync } from "node:zlib";
import { styleExcelSheets } from "../src/lib/export/excel-style";

function unzip(blob: Buffer) {
  let end = blob.length - 22;
  while (blob.readUInt32LE(end) !== 0x06054b50) end--;
  let pos = blob.readUInt32LE(end + 16);
  const files: Record<string, string> = {};
  for (let i = 0; i < blob.readUInt16LE(end + 10); i++) {
    const size = blob.readUInt32LE(pos + 20), len = blob.readUInt16LE(pos + 28), offset = blob.readUInt32LE(pos + 42);
    const name = blob.subarray(pos + 46, pos + 46 + len).toString();
    const start = offset + 30 + blob.readUInt16LE(offset + 26) + blob.readUInt16LE(offset + 28);
    const data = blob.subarray(start, start + size);
    files[name] = (blob.readUInt16LE(pos + 10) === 8 ? inflateRawSync(data) : data).toString();
    pos += 46 + len + blob.readUInt16LE(pos + 30) + blob.readUInt16LE(pos + 32);
  }
  return files;
}
const sheets: Sheet<Blob>[] = [{ sheet: "Example", columns: [{width: 40}, {width: 25}], data: [
  [{ value: "Header", backgroundColor: "#164B3B", textColor: "#FFFFFF", fontWeight: "bold" }, "Long header"],
  ["Zero", { value: 0, type: Number, format: '"R$" #,##0.00' }],
  ["Negative", { value: -1.25, type: Number, format: "0.00" }],
  ["Formula", { value: "SUM(B2:B3)", type: "Formula" }],
  [null],
  [{ value: "Merged note", columnSpan: 2 }],
] }];
describe("Excel presentation", () => {
  it("preserves values, formats, formulas, widths and merges without mutating inputs", () => {
    const styled = styleExcelSheets(sheets);
    expect(sheets[0].data[1][0]).toBe("Zero");
    expect(styled[0].columns).toEqual(sheets[0].columns);
    expect(styled[0].data).toHaveLength(sheets[0].data.length);
    expect(styled[0].data.map(r => r.length)).toEqual(sheets[0].data.map(r => r.length));
    expect(styled[0].data[0][0]).toMatchObject({backgroundColor:"#164B3B",textColor:"#FFFFFF",fontWeight:"bold",wrap:true});
    expect(styled[0].data[1][1]).toMatchObject({value:0,type:Number,format:'"R$" #,##0.00',align:"right",backgroundColor:"#FFFFFF",borderStyle:"thin",borderColor:"#DCE1E5"});
    expect(styled[0].data[2][1]).toMatchObject({value:-1.25,format:"0.00",backgroundColor:"#F5F6F7"});
    expect(styled[0].data[3][1]).toMatchObject({value:"SUM(B2:B3)",type:"Formula"});
    expect(styled[0].data[4]).toEqual([null]);
    expect(styled[0].data[5][0]).toMatchObject({columnSpan:2});
    expect(styled[0].stickyRowsCount).toBe(1);
  });
  it("writes actual OOXML borders, fills, frozen pane and unchanged cell contents", async () => {
    const raw = unzip(Buffer.from(await (await writeExcelFile(sheets).toBlob()).arrayBuffer()));
    const styled = unzip(Buffer.from(await (await writeExcelFile(styleExcelSheets(sheets)).toBlob()).arrayBuffer()));
    const xml = styled["xl/worksheets/sheet1.xml"];
    expect(xml).toContain('state="frozen"');
    expect(xml).toContain('ySplit="1"');
    expect(xml).toContain('topLeftCell="A2"');
    expect(styled["xl/styles.xml"]).toContain('style="thin"');
    expect(styled["xl/styles.xml"]).toContain("FFDCE1E5");
    expect(styled["xl/styles.xml"]).toContain("FFF5F6F7");
    const contents = (s: string) => [...s.matchAll(/<(?:v|f|t)(?: [^>]*)?>[^<]*<\/(?:v|f|t)>/g)].map(m => m[0]);
    expect(contents(xml)).toEqual(contents(raw["xl/worksheets/sheet1.xml"]));
    expect(styled["xl/sharedStrings.xml"]).toEqual(raw["xl/sharedStrings.xml"]);
    expect(xml).toContain('ref="A6:B6"');
    expect(xml).not.toContain('r="A7"');
  });
});

const options = {brand:{name:"Coyler",domain:"coyler.example"},generatedAt:new Date("2026-10-09T12:00:00Z")};
const life = calculateCostOfLiving({...emptySimulation(),salary:100000,rent:125000});
const property = calculateComparison(emptyComparison());
const mealInput = emptyMealRoutine(); Object.assign(mealInput.meals[0],{enabled:true,frequency:5,outside:1200,ingredients:[{id:"i",name:"Item",used:200,usedUnit:"g",price:1000,bought:1000,boughtUnit:"g"}]});
const meal = calculateMealRoutine(mealInput);
const vehicle = calculateVehicleComparison({...emptyVehicleComparison(),vehicle:"car",ownership:"owned",app:"car",fuelMonthly:20000,insurance:120000,rides:10,fare:2500});
const lodgingInput = emptyLodgingComparison(); Object.assign(lodgingInput,{people:2,nights:4,transport:"own",efficiency:10,fuelPrice:600}); lodgingInput.lodgings[0].price=200000; lodgingInput.lodgings[1].price=160000;
const lodging = calculateLodgingComparison(lodgingInput);
const rental = calculateRentalComparison({...emptyRentalComparison(),days:7,vehicle:"car",priceMode:"total",rentalPrice:10000,fuelDirect:0,rides:[{...emptyRentalRide("ride"),count:1,outwardFare:20000}]});
const scenario = newTripScenario("test","Destination"); scenario.items[0].amount="100,00";
const trip = calculateTrip(parseTripDraft({mode:"single",scenarios:[scenario]}));
const cases = [
  {name:"life",raw:()=>planningSheets(life,options),create:()=>createPlanningExcel(life,options)},
  {name:"property",raw:()=>comparisonSheets(property,options),create:()=>createComparisonExcel(property,options)},
  {name:"meal",raw:()=>mealSheets(meal,options),create:()=>createMealExcel(meal,options)},
  {name:"vehicle",raw:()=>vehicleSheets(vehicle,options),create:()=>createVehicleExcel(vehicle,options)},
  {name:"lodging",raw:()=>lodgingSheets(lodging,options),create:()=>createLodgingExcel(lodging,options)},
  {name:"rental",raw:()=>rentalSheets(rental,options),create:()=>createRentalExcel(rental,options)},
  {name:"trip",raw:()=>tripSheets(trip,options),create:()=>createTripExcel(trip,options)},
];
it.each(cases)("preserves actual workbook data and numeric formats for $name",async ({raw,create})=>{
  const original=unzip(Buffer.from(await (await writeExcelFile(raw(),{fontFamily:"Arial",fontSize:11}).toBlob()).arrayBuffer()));
  const styled=unzip(Buffer.from(await (await create()).arrayBuffer()));
  expect(styled["xl/sharedStrings.xml"]).toEqual(original["xl/sharedStrings.xml"]);
  expect(styled["xl/workbook.xml"]).toEqual(original["xl/workbook.xml"]);
  const numberFormats=(files:Record<string,string>)=>files["xl/styles.xml"].match(/<numFmts.*?<\/numFmts>/)?.[0];
  expect(numberFormats(styled)).toEqual(numberFormats(original));
  for(const name of Object.keys(original).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n))){
    const cells=(xml:string)=>[...xml.replace(/<c\b[^>]*\/>/g, "").matchAll(/<c\b[^>]*r="([^"]+)"[^>]*>(.*?)<\/c>/g)].filter(m=>/<[vft](?: |>)/.test(m[2])).map(m=>[m[1],m[2]]);
    expect(cells(styled[name])).toEqual(cells(original[name]));
    expect(styled[name]).toContain('state="frozen"');
    expect(styled[name].match(/<mergeCells.*?<\/mergeCells>/)?.[0]).toEqual(original[name].match(/<mergeCells.*?<\/mergeCells>/)?.[0]);
  }
});
