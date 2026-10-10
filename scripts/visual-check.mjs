/** Browser QA of the real HomeScreen, using isolated fixtures instead of Firebase credentials. */
import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, dirname } from "node:path";
import assert from "node:assert/strict";
import * as requireFs from "node:fs";
const sourceFiles = new Set(collect("src"));

const out = resolve(".visual");
await mkdir(out, { recursive: true });
const state = `
import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS } from "@/lib/types";
const now = new Date();
const start = new Date(now.getTime() + 3600000);
const end = new Date(start.getTime() + 3600000);
const event = { id: "event", title: "Brunch chez Emma", start: start.toISOString(), end: end.toISOString(), allDay: false, profileIds: ["emma"], type: "social", location: {label:"Chez Emma",address:"3 rue des Marronniers, Lyon",lat:45.76,lng:4.84}, reminders:[], source:"local", createdAt:now.toISOString(), updatedAt:now.toISOString() };
const occ = { key: "event", event, start, end };
const travel = { origin:{label:"Maison",lat:45.75,lng:4.85}, route:{mode:"driving",durationMin:20,distanceKm:4}, marginMin:10, departAt:new Date(start.getTime()-1800000) };
const voices = [{ name:"Voix française de test",voiceURI:"fixture-fr",lang:"fr-FR",localService:true,default:true }];
export const app = {
 status:"ready", household:{id:"fixture",name:"La maison",ownerUid:"fixture",memberUids:["fixture"],settings:{...DEFAULT_SETTINGS,ambientAfterSec:0,nightMode:{enabled:false,start:"22:30",end:"06:30"}}},
 householdId:"fixture", user:{uid:"fixture",email:"fixture@example.test"}, myProfileId:"emma",
 profiles:[{id:"emma",name:"Emma",avatar:"E",color:"#857c9e",type:"PERSON",memberIds:[],order:0}],
 events:[event],reminders:[],history:[],places:[], homePlace:{id:"home",name:"Lyon",address:"Lyon",lat:45.75,lng:4.85,icon:"",profileIds:[],order:0},
 shopping:["Lait","Œufs","Pain complet","Tomates","Bananes","Café"].map((name,i)=>({id:String(i),name,checked:false,createdAt:now.toISOString()})),
 timers:[{id:"timer",label:"Pâtes",duration:600000,createdAt:now.toISOString(),expiresAt:new Date(now.getTime()+504000).toISOString(),status:"running"}],
 scenes:[{id:"morning",name:"Matin",icon:"",widgets:["clock","weather","agenda","nextDeparture","music"],large:false,dim:false},{id:"kitchen",name:"Cuisine",icon:"",widgets:["music","timers","shopping"],large:true,dim:false},{id:"evening",name:"Soir",icon:"",widgets:["clock","tomorrow","music"],large:false,dim:true}],
 llm:null,toolContext:()=>null,
 speech:{isSupported:()=>false},
 tts:{isSupported:()=>true,getVoices:()=>voices,onVoicesChanged:()=>()=>{},speak:()=>{},stop:()=>{}},
};
let version=0; const listeners=new Set(); export const emit=()=>{version++;listeners.forEach(l=>l());};
export const hook=()=>useSyncExternalStore(l=>{listeners.add(l);return()=>listeners.delete(l)},()=>version,()=>0);
let activeId=null;
export const scenes=()=>({scenes:app.scenes,active:app.scenes.find(s=>s.id===activeId)||null,suggested:null,activate:id=>{activeId=id;emit()},exit:()=>{activeId=null;emit()}});
export const forecast={current:{temperature:18,weatherCode:0,isDay:true},daily:[{date:now,tMin:12,tMax:21,weatherCode:0,precipitationProbability:0}]};
export const departure={occ,travel,status:{level:"green",minutes:30,text:"Départ conseillé à "+travel.departAt.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}),emoji:""}};
const noop=async()=>{};
const artwork="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#b3a18a"/><circle cx="80" cy="80" r="54" fill="#e2d2b7"/><circle cx="80" cy="80" r="23" fill="#806e60"/></svg>');
export const music={enabled:true,connected:true,loading:false,busy:false,profile:{name:"Emma"},error:null,devices:[],playlists:[],recent:[],playback:{isPlaying:true,item:{uri:"fixture:track",type:"track",name:"Sunday morning",subtitle:"La playlist de la maison",image:artwork},device:{id:"speaker",name:"Salon"},progressMs:42000,durationMs:240000,fetchedAt:now.getTime()},
 toggle:()=>{music.playback={...music.playback,isPlaying:!music.playback.isPlaying};emit()},previous:noop,next:noop,loadLibrary:noop,playItem:noop,loadDevices:noop,setActive:noop,refresh:noop,connect:noop};
export const voice={enabled:false,state:"idle",engineStatus:"ready",suspend:noop,resume:noop,notice:null};
export const stores={timers:{update:async(id,patch)=>{app.timers=app.timers.map(t=>t.id===id?{...t,...patch}:t);emit()},remove:async(id)=>{app.timers=app.timers.filter(t=>t.id!==id);emit()},add:noop},shopping:{update:async(id,patch)=>{app.shopping=app.shopping.map(t=>t.id===id?{...t,...patch}:t);emit()},remove:noop,add:noop},scenes:{update:noop,remove:noop,add:noop}};
`;
const mocks = {
 "@/components/app/AppProvider": 'import {app,hook} from "@fixture"; export function useApp(){hook();return app}',
 "@/components/music/MusicContext": 'import {music,hook} from "@fixture"; export function useMusic(){hook();return music}',
 "@/components/scenes/SceneContext": 'import {scenes,hook} from "@fixture"; export function useScenes(){hook();return scenes()}',
 "@/components/voice/VoiceContext": 'import {voice,hook} from "@fixture"; export function useVoice(){hook();return voice}',
 "@/hooks/useModules": 'import {stores} from "@fixture"; export function useModuleStores(){return stores}',
 "@/hooks/useWeather": 'import {forecast} from "@fixture"; export function useForecast(){return forecast} export function useEventWeather(){return null}',
 "@/hooks/useTravel": 'import {departure} from "@fixture"; export function useTravel(occ){return occ ? departure.travel : null}',
 "@/hooks/useNextDeparture": 'import {departure} from "@fixture"; export function useNextDeparture(){return {next:departure.occ,departure}}',
 "@/lib/firebase/client": 'export const firebaseConfigured=false; export const firestore=()=>({}); export const auth=()=>({});',
 "@/components/assistant/useAssistantRunner": 'export function useAssistantRunner(){return async()=>null}',
 "next/link": 'export default function Link({href,children,...props}){return <a href={href} {...props} onClick={e=>{e.preventDefault();history.pushState(null,"",href);dispatchEvent(new Event("popstate"))}}>{children}</a>}',
};
const fixture = `
import {useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {AmbientScreen} from "@/components/app/AmbientScreen";
import {Appearance} from "@/components/app/Appearance";
import {HomeScreen} from "@/components/app/HomeScreen";
import {SettingsScreen} from "@/components/settings/SettingsScreen";
import {VoiceOverlay} from "@/components/voice/VoiceOverlay";
import {app} from "@fixture";
function Fixture(){
 const [path,setPath]=useState(location.pathname);
 useEffect(()=>{const change=()=>setPath(location.pathname);addEventListener("popstate",change);return()=>removeEventListener("popstate",change)},[]);
 useEffect(()=>{const clock=setInterval(()=>{const h=new Date().getHours();document.documentElement.dataset.period=h<6||h>=23?"night":h<11?"morning":h<18?"day":"evening"},60000);return()=>clearInterval(clock)},[]);
 if(new URLSearchParams(location.search).has("ambient")) return <><Appearance/><AmbientScreen now={new Date()} night={false} onWake={()=>location.assign("/")}/></>;
 return <><Appearance/>{path==="/settings"?<SettingsScreen/>:<HomeScreen/>}<VoiceOverlay/></>;
}
window.fixtureApp=app;
createRoot(document.getElementById("root")).render(<Fixture/>);
`;
await build({
 stdin:{contents:fixture,resolveDir:process.cwd(),sourcefile:"fixture.jsx",loader:"jsx"},
 bundle:true,outfile:out+"/app.js",platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"',"process.env":"{}"},
 plugins:[{name:"isolated-fixtures",setup(b){
   b.onResolve({filter:/.*/},a=>{
     if(a.path==="@fixture" || mocks[a.path]) return {path:a.path,namespace:"fixture"};
     if(a.path.startsWith(".")) { const target=resolve(dirname(a.importer),a.path).replace(/\.(tsx?|jsx?)$/, ""); const key=Object.keys(mocks).find(k=>k.startsWith("@/")&&resolve("src",k.slice(2))===target); if(key)return {path:key,namespace:"fixture"}; }
     if(a.path.startsWith("@/")) return {path:resolve("src",a.path.slice(2)+ (a.path.match(/\.(tsx?|jsx?)$/)?"":existsExtension(a.path.slice(2))))};
   });
   b.onLoad({filter:/.*/,namespace:"fixture"},a=>({contents:a.path==="@fixture"?state:mocks[a.path],loader:"jsx",resolveDir:process.cwd()}));
 }}],
});
function existsExtension(path) {
 // Module files in this repository use .ts or .tsx, with a few index.ts barrels.
 const files = sourceFiles;
 return files.has("src/"+path+".tsx") ? ".tsx" : files.has("src/"+path+".ts") ? ".ts" : "/index.ts";
}
function collect(dir) {
 return requireFs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?collect(dir+"/"+d.name):[dir+"/"+d.name]);
}

const nextCss=(await Promise.all(collect(".next/static").filter(p=>p.endsWith(".css")).map(p=>readFile(p,"utf8")))).join("\n");
const sans=nextCss.match(/--font-geist-sans:([^;}]+)/)?.[1] || "ui-sans-serif";
const mono=nextCss.match(/--font-geist-mono:([^;}]+)/)?.[1] || "ui-monospace";
await writeFile(out+"/style.css", nextCss+"\n:root{--font-geist-sans:"+sans+";--font-geist-mono:"+mono+";}");
await writeFile(out+"/index.html",'<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
const server=createServer(async(req,res)=>{
 try{const url=new URL(req.url,"http://localhost");const file=url.pathname==="/app.js"||url.pathname==="/style.css"?out+url.pathname:url.pathname.startsWith("/media/")?resolve(".next/static",url.pathname.slice(1)):url.pathname.startsWith("/_next/static/")?resolve(".next/static",url.pathname.slice(14)):url.pathname.startsWith("/ambience/")?resolve("public",url.pathname.slice(1)):out+"/index.html";res.setHeader("Content-Type",file.endsWith(".js")?"application/javascript; charset=utf-8":file.endsWith(".css")?"text/css; charset=utf-8":file.endsWith(".svg")?"image/svg+xml":file.endsWith(".woff2")?"font/woff2":"text/html; charset=utf-8");res.end(await readFile(file))}catch{res.statusCode=404;res.end()}
});
await new Promise(r=>server.listen(4173,"127.0.0.1",r));
const browser=await chromium.launch({headless:true});
const sizes=[{name:"phone",width:390,height:844},{name:"tablet-portrait",width:820,height:1180},{name:"tablet-landscape",width:1200,height:800},{name:"desktop",width:1440,height:900}];
const errors=[];
try {
 for(const size of sizes)for(const theme of ["light","dark"])for(const [period,hour] of [["morning",8],["day",14],["evening",20],["night",1]]) {
  const context=await browser.newContext({viewport:{width:size.width,height:size.height},colorScheme:theme,reducedMotion:"reduce"});
  const page=await context.newPage();
  page.on("console",m=>console.log("BROWSER_CONSOLE:"+m.type()+":"+m.text()));
 page.on("pageerror",e=>{errors.push(e.message);console.log("BROWSER_ERROR:"+e.name+":"+e.message+":"+e.stack)});
  await page.clock.install({time:new Date(2026,3,26,hour,42)});
  await page.addInitScript(({theme,period})=>{localStorage.setItem("homecal.theme",theme);document.addEventListener("DOMContentLoaded",()=>{document.documentElement.classList.toggle("dark",theme==="dark");document.documentElement.dataset.period=period},{once:true})},{theme,period});
  await page.goto("http://127.0.0.1:4173");
  await page.getByRole("heading",{level:1}).waitFor({timeout:10000}).catch(async e=>{await page.screenshot({path:out+"/failed-screen.png"});console.log("BROWSER_HTML:"+await page.content());throw e});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:out+"/"+size.name+"-"+theme+"-"+period+".png",fullPage:true});
  if((size.name==="tablet-landscape"&&theme==="light"&&period==="day")||(size.name==="desktop"&&theme==="dark"&&period==="evening")||(size.name==="phone"&&theme==="dark"&&period==="morning")) console.log("VISUAL_REVIEW:"+size.name+":"+(await page.screenshot({type:"jpeg",quality:55})).toString("base64"));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"horizontal overflow: "+size.name+" "+theme+" "+period);
  const overflow=await page.locator(".home-widget").evaluateAll(elements=>elements.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.getAttribute("data-widget")));
  assert.deepEqual(overflow,[],"card overflow: "+size.name);
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1200,height:800},reducedMotion:"reduce"});
 const page=await context.newPage();
 page.on("console",m=>console.log("BROWSER_CONSOLE:"+m.type()+":"+m.text()));
 page.on("pageerror",e=>{errors.push(e.message);console.log("BROWSER_ERROR:"+e.name+":"+e.message+":"+e.stack)});
 await page.clock.install({time:new Date(2026,3,26,8,42)});
 await page.goto("http://127.0.0.1:4173");
 await page.getByRole("button",{name:"Personnaliser l’accueil"}).click();
 await page.getByRole("button",{name:"Masquer Courses",exact:true}).click();
 await page.getByRole("button",{name:"Terminer",exact:true}).click();
 assert.equal(await page.locator('[data-widget="shopping"]').count(),0);
 await page.reload();
 await page.getByRole("heading",{level:1}).waitFor();
 assert.equal(await page.locator('[data-widget="shopping"]').count(),0);
 await page.getByRole("button",{name:"Personnaliser l’accueil"}).click();
 await page.getByRole("button",{name:"Restaurer la disposition"}).click();
 await page.getByRole("button",{name:"Terminer",exact:true}).click();
 assert.equal(await page.locator('[data-widget="shopping"]').count(),1);
 await page.getByRole("button",{name:"Mettre en pause Pâtes"}).click();
 await page.getByRole("button",{name:"Reprendre Pâtes"}).waitFor();
 await page.getByRole("button",{name:"Arrêter Pâtes"}).click();
 assert.equal(await page.locator('[data-widget="timers"]').count(),0);
 await page.getByRole("button",{name:"Calendrier",exact:true}).click();
 await page.getByRole("button",{name:"Mois",exact:true}).click();
 await page.screenshot({path:out+"/calendar.png"});
 await page.getByRole("button",{name:"Aujourd’hui",exact:true}).click();
 await page.getByRole("heading",{level:1}).waitFor();
 await page.getByRole("button",{name:"Maison",exact:true}).click();
 await page.getByRole("button",{name:"Activer Cuisine",exact:true}).click();
 await page.getByRole("button",{name:"Quitter la scène"}).waitFor();
 await page.screenshot({path:out+"/kitchen.png"});
 await page.getByRole("button",{name:"Quitter la scène"}).click();
 await page.getByRole("link",{name:"Réglages",exact:true}).click();
 await page.getByRole("button",{name:"Affichage",exact:true}).click();
 await page.screenshot({path:out+"/settings.png"});
 await page.getByRole("button",{name:"Voix et notifications",exact:true}).click();
 await page.getByRole("button",{name:"Tester la voix",exact:true}).waitFor();
 await page.screenshot({path:out+"/voice.png"});
 await page.getByRole("link",{name:"Retour",exact:true}).click();
 for(const [name,file] of [["Matin","morning"],["Soir","evening"]]) {
  await page.getByRole("button",{name:"Maison",exact:true}).click();
  await page.getByRole("button",{name:"Activer "+name,exact:true}).click();
  await page.getByRole("button",{name:"Quitter la scène"}).waitFor();
  await page.screenshot({path:out+"/scene-"+file+".png"});
  await page.getByRole("button",{name:"Quitter la scène"}).click();
 }
 await page.getByRole("button",{name:/Un mot, et c’est fait/}).click();
 await page.getByRole("button",{name:"Parler",exact:true}).waitFor();
 await page.screenshot({path:out+"/assistant.png"});
 await page.goto("http://127.0.0.1:4173/?ambient=1");
 await page.getByRole("button",{name:"Revenir à l’accueil",exact:true}).waitFor();
 await page.screenshot({path:out+"/ambient.png"});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"ambient horizontal overflow");
 assert.deepEqual(errors,[],"browser errors");
 await context.close();
 await writeFile(out+"/report.json",JSON.stringify({screenshots:40,viewports:sizes,themes:2,periods:4,checks:["no document/card overflow","persist hidden widgets","restore layout","pause/resume/stop timer","calendar navigation","kitchen scene","settings navigation","device voice picker","morning/evening scenes","assistant orb","ambient mode"],browserErrors:errors},null,2));
 console.log("PASS: 32 home combinations + calendar, all scenes, settings, voice, assistant and ambient; layout persistence, timer controls and navigation.");
} finally { await browser.close();server.close(); }
