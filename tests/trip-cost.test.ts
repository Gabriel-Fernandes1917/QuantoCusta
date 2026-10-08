import { describe, expect, it } from "vitest";
import { calculateTrip, tripInsights, tripComparisonInsights, type TripPlan, type TripScenario, type TripItem, type TripCategory } from "../src/lib/calculations/trip-cost";
import { decodeTripPlan, encodeTripPlan, TRIP_STORAGE_KEY } from "../src/lib/trip-storage";
import { newTripScenario, parseTripDraft, tripToDraft } from "../src/lib/trip-form";
import { travelTools } from "../src/lib/tools";

const item = (category: TripCategory, amount: number | null, mode: TripItem["mode"] = "total", rest: Partial<TripItem> = {}): TripItem => ({id:category,name:category,category,amount,mode,quantity:1,days:7,...rest});
const scenario = (rest: Partial<TripScenario> = {}): TripScenario => ({id:"a",name:"Caxias do Sul",days:7,nights:6,people:1,budget:null,items:[],reserve:{mode:"none",amount:null,percent:null},...rest});
const result = (s: TripScenario) => calculateTrip({mode:"single",scenarios:[s]}).scenarios[0];
export function regressionTrip(): TripPlan {return {mode:"compare",scenarios:[scenario({items:[item("tickets",60000),item("lodging",200000),item("food",100000),item("transport",40000)]}),scenario({id:"b",name:"Curitiba",items:[item("tickets",90000),item("lodging",120000),item("food",80000),item("transport",40000)]})]};}

describe("orçamento de viagem em centavos",()=>{
  it.each([["total",12003],["person",36009]] as const)("passagens %s",(mode,expected)=>expect(result(scenario({people:3,items:[item("tickets",12003,mode)]})).subtotal).toBe(expected));
  it.each([["total",12003],["night",72018]] as const)("hospedagem %s",(mode,expected)=>expect(result(scenario({items:[item("lodging",12003,mode)]})).subtotal).toBe(expected));
  it("viagem sem pernoite não presume relação entre dias e noites",()=>expect(result(scenario({days:2,nights:0,items:[item("lodging",12003,"night")]})).subtotal).toBe(0));
  it("alimentação considera apenas dias selecionados por pessoa",()=>{const r=result(scenario({people:3,items:[item("food",1234,"personDay",{days:4})]}));expect(r.subtotal).toBe(14808);});
  it("alimentação com zero dias permanece explicitamente considerada",()=>{const r=result(scenario({items:[item("food",1234,"personDay",{days:0})]}));expect(r.categories[2]).toMatchObject({considered:true,total:0});});
  it.each([["total",2000],["person",6000]] as const)("passeio %s inclui ocorrências",(mode,total)=>expect(result(scenario({people:3,items:[item("activities",1000,mode,{quantity:2})]})).subtotal).toBe(total));
  it("transporte, compras e outros sem duplicar multiplicadores",()=>expect(result(scenario({items:[item("transport",101,"unit",{quantity:3}),item("shopping",200),item("other",99,"unit",{quantity:2})]})).subtotal).toBe(701));
  it("soma vários itens da mesma categoria",()=>expect(result(scenario({items:[item("activities",100),item("activities",200,"person",{id:"second"})]})).subtotal).toBe(300));
  it("reserva fixa separada do subtotal",()=>{const r=result(scenario({items:[item("tickets",10000)],reserve:{mode:"fixed",amount:5000,percent:null}}));expect(r).toMatchObject({subtotal:10000,reserve:5000,total:15000});expect(r.reservePercentage).toBeCloseTo(100/3);expect(r.categories[0].percentage).toBe(100);});
  it("reserva percentual não é circular e arredonda metade para cima",()=>{const r=result(scenario({items:[item("tickets",5)],reserve:{mode:"percent",amount:null,percent:10}}));expect(r).toMatchObject({subtotal:5,reserve:1,total:6});});
  it("percentual com centésimos é preciso",()=>expect(result(scenario({items:[item("tickets",10000)],reserve:{mode:"percent",amount:null,percent:12.34}})).reserve).toBe(1234));
  it("normaliza por pessoa e dia com arredondamento consistente",()=>expect(result(scenario({days:2,people:3,items:[item("tickets",101)]}))).toMatchObject({total:101,perPerson:34,perDay:51}));
  it("categorias usam somente subtotal; ranking exclui zero e vazio",()=>{const r=result(scenario({items:[item("tickets",100),item("lodging",300),item("food",0),item("transport",null)],reserve:{mode:"fixed",amount:1000,percent:null}}));expect(r.categories[0].percentage).toBe(25);expect(r.largest?.id).toBe("lodging");expect(r.smallest?.id).toBe("tickets");expect(r.missing).toContain("Transporte local");expect(r.missing).not.toContain("Alimentação");});
  it("vazios não viram despesas reais e não geram ranking",()=>{const r=result(scenario());expect(r).toMatchObject({subtotal:0,total:0,perDay:0,perPerson:0,largest:null,smallest:null,budgetPercentage:null});expect(r.missing).toHaveLength(7);expect(tripInsights(r)).toEqual([]);});
  it.each([[10000,5000,50],[4000,-1000,125],[5000,0,100],[0,-5000,null]])("orçamento %i",(budget,remaining,pct)=>expect(result(scenario({budget,items:[item("tickets",5000)]}))).toMatchObject({budgetRemaining:remaining,budgetPercentage:pct,subtotal:5000}));
  it("insights usam os dados informados",()=>{const r=result(scenario({budget:5000,items:[item("tickets",4000),item("lodging",6000)],reserve:{mode:"fixed",amount:1000,percent:null}}));const notes=tripInsights(r).join(" ");expect(notes).toContain("60%");expect(notes).toContain("100%");expect(notes).toContain("R$ 10,00");expect(notes).toContain("R$ 60,00");});
  it("regressão: passagem mais barata pode produzir total maior",()=>{const r=calculateTrip(regressionTrip());expect(r.scenarios.map(s=>s.subtotal)).toEqual([400000,330000]);expect(r.differences).toMatchObject({total:70000,perPerson:70000,perDay:10000});expect(r.differences?.categories[0].delta).toBe(-30000);expect(tripComparisonInsights(r).join(" ")).toContain("Embora a passagem para Caxias do Sul custe R$ 300,00 a menos");});
  it("regressão com reserva de 10%",()=>{const p=regressionTrip();p.scenarios.forEach(s=>s.reserve={mode:"percent",amount:null,percent:10});const r=calculateTrip(p);expect(r.scenarios.map(s=>[s.subtotal,s.reserve,s.total])).toEqual([[400000,40000,440000],[330000,33000,363000]]);expect(r.differences?.total).toBe(77000);});
  it.each([2,3,4])("compara %i destinos",count=>{const r=calculateTrip({mode:"compare",scenarios:Array.from({length:count},(_,i)=>scenario({id:String(i),items:[item("tickets",(i+1)*1000)]}))});expect(r.scenarios).toHaveLength(count);expect(r.lowest).toBe(1000);expect(r.highest).toBe(count*1000);});
  it("empate inclui todas as opções sem recomendação",()=>{const r=calculateTrip({mode:"compare",scenarios:[scenario(),scenario({id:"b"})]});expect(r.differences?.total).toBe(0);expect(tripComparisonInsights(r).join(" ")).toContain("mesmo custo total");});
  it.each([{days:3},{people:3}])("avisa sobre grupos/durações diferentes %o",patch=>{const r=calculateTrip({mode:"compare",scenarios:[scenario(),scenario({id:"b",...patch})]});expect(r.differentGroups).toBe(true);expect(tripComparisonInsights(r).join(" ")).toContain("Compare também o custo por dia e por pessoa");});
  it("não compara categorias não consideradas",()=>{const p=regressionTrip();p.scenarios[1].items=p.scenarios[1].items.filter(i=>i.category!=="tickets");const r=calculateTrip(p);expect(r.differences?.categories[0].delta).toBeNull();expect(tripComparisonInsights(r).join(" ")).not.toContain("Embora");});
  it("modo simples conserva os destinos mas calcula só o primeiro",()=>{const p=regressionTrip();p.mode="single";expect(calculateTrip(p).scenarios).toHaveLength(1);});
  it.each([{days:0},{people:0},{nights:-1},{days:1.5},{people:10001}])("protege dimensões inválidas %o",patch=>expect(()=>result(scenario(patch))).toThrow());
  it.each([-1,1.2,NaN,Infinity,1_000_000_000_001])("rejeita dinheiro inválido %s",amount=>expect(()=>result(scenario({items:[item("tickets",amount)]}))).toThrow());
  it("protege overflow na multiplicação",()=>expect(()=>result(scenario({days:10000,people:10000,items:[item("food",1_000_000_000_000,"personDay",{days:10000})]}))).toThrow(/limite seguro/));
  it("protege overflow na soma",()=>expect(()=>result(scenario({people:10000,items:[item("tickets",1_000_000_000_000,"person")]}))).toThrow(/limite seguro/));
  it("não perde centavos em reserva percentual alta",()=>{const r=result(scenario({days:9999,people:9000,items:[item("tickets",999_999_999_999,"person")],reserve:{mode:"percent",amount:null,percent:0.01}}));expect(r.reserve).toBe(899999999999);expect(Number.isSafeInteger(r.total)).toBe(true);});
  it.each([-1,100.01,1.234,NaN,Infinity])("rejeita percentual inválido %s",percent=>expect(()=>result(scenario({reserve:{mode:"percent",amount:null,percent}}))).toThrow());
  it("reserva escolhida precisa de valor",()=>expect(()=>result(scenario({reserve:{mode:"fixed",amount:null,percent:null}}))).toThrow());
  it("refeições não podem usar mais dias que o roteiro",()=>expect(()=>result(scenario({items:[item("food",100,"personDay",{days:8})]}))).toThrow());
  it("proíbe modos incompatíveis",()=>expect(()=>result(scenario({items:[item("tickets",100,"night")]}))).toThrow());
  it.each([0,1,5])("limita comparação: %i destinos",n=>expect(()=>calculateTrip({mode:"compare",scenarios:Array.from({length:n},(_,i)=>scenario({id:String(i)}))})).toThrow());
  it("não aceita IDs duplicados",()=>expect(()=>calculateTrip({mode:"compare",scenarios:[scenario(),scenario()]})).toThrow());
});
describe("formulário e persistência independente",()=>{
  it("conserva cenários, modos, dias, itens, vazio e zero no roundtrip",()=>{const p=regressionTrip();p.scenarios[0].items.push(item("activities",0));p.scenarios[1].items.push(item("other",null));expect(decodeTripPlan(encodeTripPlan(p))).toEqual(p);expect(parseTripDraft(tripToDraft(p))).toEqual(p);expect(TRIP_STORAGE_KEY).toBe("quantocusta:trip-cost:v1");});
  it("cenário inicial não inventa preços",()=>{const d=newTripScenario("start");const r=calculateTrip(parseTripDraft({mode:"single",scenarios:[d]}));expect(r.scenarios[0].missing).toHaveLength(7);expect(r.scenarios[0].subtotal).toBe(0);});
  it("reserva desativada ignora valores escondidos inválidos",()=>{const d=newTripScenario("start");d.reserve={mode:"none",amount:"abc",percent:"abc"};expect(calculateTrip(parseTripDraft({mode:"single",scenarios:[d]})).scenarios[0].reserve).toBe(0);});
  it("quantidades não utilizadas não bloqueiam a estimativa",()=>{const d=newTripScenario("start");d.items[0].amount="10,00";d.items[0].quantity="";d.items[0].days="abc";expect(calculateTrip(parseTripDraft({mode:"single",scenarios:[d]})).scenarios[0].subtotal).toBe(1000);});
  it("despesa vazia permite quantidade em branco sem inventar gasto",()=>{const d=newTripScenario("start");d.items[14].mode="unit";d.items[14].quantity="";expect(calculateTrip(parseTripDraft({mode:"single",scenarios:[d]})).scenarios[0].missing).toContain("Transporte local");});
  it.each(["0x10","1e2","1,234","abc"])('rejeita percentual textual %s',percent=>{const d=newTripScenario("start");d.reserve={mode:"percent",amount:"",percent};expect(()=>parseTripDraft({mode:"single",scenarios:[d]})).toThrow();});
  it("aceita dinheiro brasileiro e percentual com vírgula",()=>{const d=newTripScenario("start");d.items[0].amount="1.250,50";d.reserve={mode:"percent",amount:"",percent:"12,34"};const p=parseTripDraft({mode:"single",scenarios:[d]});expect(p.scenarios[0].items[0].amount).toBe(125050);expect(p.scenarios[0].reserve.percent).toBe(12.34);});
  it.each(["not json",JSON.stringify({version:2,values:regressionTrip()}),JSON.stringify({version:1,values:{}})])("rejeita armazenamento corrompido %s",text=>expect(()=>decodeTripPlan(text)).toThrow());
  it("valida conteúdo salvo",()=>{const p=regressionTrip();p.scenarios[0].people=0;expect(()=>decodeTripPlan(JSON.stringify({version:1,values:p}))).toThrow();});
  it("catálogo mostra três ferramentas reais de viagens",()=>{expect(travelTools).toHaveLength(3);expect(travelTools[0]).toMatchObject({title:"Quanto custa minha viagem?",href:"/custo-da-viagem/"});expect(travelTools.every(t=>!!t.href)).toBe(true);});
});
