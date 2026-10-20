// Manual visual regression: two Development/fake exports, fresh QA contexts, no external network.
const {chromium}=require('playwright');
const sharp=require('sharp');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.join(process.cwd(),'docs/design/component-audit/adaptations');fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.ttf':'font/ttf','.png':'image/png','.webp':'image/webp','.json':'application/json'};
function serve(root){const s=http.createServer((req,res)=>{let f=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));const relative=path.relative(root,f);if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);return res.end()}try{if(fs.statSync(f).isDirectory())f=path.join(f,'index.html')}catch{f=path.join(root,'index.html')}res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res)});return new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve({s,url:'http://127.0.0.1:'+s.address().port})))}
const measurement={id:'component_qa_measurement',measured_on:'2026-10-18',measured_at:'2026-10-18T12:00:00Z',weight_kg:80,body_fat_pct:15,photo_uri:null,neck_cm:null,chest_cm:null,waist_cm:82,hips_cm:null,biceps_cm:null,quadriceps_cm:null,calf_cm:null,height_cm:null};
const seed={templates:[],workoutHistory:[],dietByDate:{},measurements:[measurement],threads:[{id:'component_qa_thread',title:'QA componentes'}],messagesByThread:{component_qa_thread:[]},keys:[{provider:'openai',is_active:true,api_key:'component-qa-placeholder',model:'gpt-5.6-luna'}],chatProvider:'openai',foodAIProvider:'openai'};
(async()=>{const servers=[],results={};let browser;try{browser=await chromium.launch({headless:true});
for(const version of ['before','after']){
 const root=process.env[version==='before'?'COMPONENT_QA_BEFORE':'COMPONENT_QA_AFTER'];assert.ok(root&&fs.existsSync(path.join(root,'index.html')),'Exporta Development/fake y configura COMPONENT_QA_BEFORE y COMPONENT_QA_AFTER');const server=await serve(path.resolve(root));servers.push(server.s);const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'es-ES',timezoneId:'Europe/Madrid'});
 await context.addInitScript(({seed})=>{localStorage.setItem('gymnasia.development:gymnasia.mobile.local.v3',JSON.stringify(seed))},{seed});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const page=await context.newPage();await page.clock.install({time:new Date('2026-10-19T12:00:00Z')});await page.goto(server.url);await page.getByTestId('home-primary-training-action').waitFor();
 const snap=async name=>{await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(output,`${name}-${version}.png`),animations:'disabled',caret:'hide'});console.log(version,name)};
 const tab=async name=>page.getByTestId('nav-tab-'+name).click();const settings=async name=>{await tab('settings');await page.getByTestId('settings-tab-'+name).click()};
 await snap('home');await tab('measures');await page.getByTestId('measurement-add').waitFor();await snap('measures');await page.getByTestId('measurement-add').click();await page.getByTestId('measurement-weight-input').waitFor();await snap('measurement-form');await page.getByText('Cancelar',{exact:true}).first().click();
 await tab('diet');await page.getByTestId('diet-meal-category-desayuno').waitFor();await snap('diet');
 await tab('chat');await page.getByTestId('chat-input').waitFor();await snap('coach');
 await settings('diet');await snap('diet-settings');await settings('notifications');await snap('notifications');await settings('memory');await snap('memory');await settings('measures');await snap('measurement-records');await settings('provider');await snap('provider');
 await tab('diet');await page.getByTestId('open-food-estimator-desayuno').click();await page.getByPlaceholder('Describe la comida o pide ajustes...').waitFor();await snap('estimator');
 await page.reload();await page.getByTestId('home-primary-training-action').waitFor();await settings('personalFoods');await page.getByTestId('open-personal-food-assistant').click();await page.getByTestId('personal-food-assistant-input').waitFor();await snap('personal-food-assistant');
 await page.reload();await page.getByTestId('home-primary-training-action').waitFor();await settings('foods');await snap('foods');
 await context.close();}
 const names=fs.readdirSync(output).filter(f=>f.endsWith('-before.png')).map(f=>f.slice(0,-11));
 for(const name of names){const a=await sharp(path.join(output,name+'-before.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(path.join(output,name+'-after.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual(a.info,b.info);let changed=0,significant=0,maxChannelDelta=0;for(let i=0;i<a.data.length;i+=4){const delta=Math.max(...[0,1,2].map(c=>Math.abs(a.data[i+c]-b.data[i+c])));maxChannelDelta=Math.max(maxChannelDelta,delta);if(delta>0)changed++;if(delta>2&&(i/4)%a.info.width<370)significant++}results[name]={changedPixels:changed,significantContentPixels:significant,maxChannelDelta,totalPixels:a.info.width*a.info.height};assert.equal(significant,0,`${name}: variación de contenido superior a 2/255 (se excluyen los 20 px derechos de la barra nativa)`);}
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
}finally{if(browser)await browser.close();await Promise.all(servers.map(s=>new Promise(r=>s.close(r))))}})().catch(e=>{console.error(e);process.exitCode=1});
