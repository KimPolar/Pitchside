import type { DatabaseSync } from 'node:sqlite';
import { XMLParser } from 'fast-xml-parser';
import { stamp,transaction,upsert } from '../db.ts';
import { clean,number,request,saveTeam } from './common.ts';
import { classifyVideo } from './video.ts';
import type { Lineup, MatchEvent } from '../../shared/types.ts';

type JsonRow=Record<string,unknown>;
const base='https://www.joinkfa.com';
const headers={'Content-Type':'application/json; charset=UTF-8','Accept':'application/json, text/plain, */*','Referer':`${base}/portal/mat/matchList.do`,'Origin':base,'X-Requested-With':'XMLHttpRequest'};
const array=<T>(value:T|T[]|undefined):T[]=>value===undefined?[]:Array.isArray(value)?value:[value];
export function detailXml(matchIdx:string,singleIdx:string){
 if(!/^\d+$/.test(matchIdx)||!/^\d+$/.test(singleIdx))throw new Error('경기 식별자를 확인해 주세요');
 return `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="http://www.nexacroplatform.com/platform/dataset"><Parameters><Parameter id="GP_SYS_CD" type="string">USER</Parameter><Parameter id="GP_MENU_ID" type="string">MAT_02_HIDDEN</Parameter><Parameter id="GP_SVC_PATH" type="string">/generate/MAT_04_001/SEARCH00.do</Parameter><Parameter id="GP_SERVICE_ID" type="string">SEARCH00</Parameter><Parameter id="GP_LOG_YN" type="string">N</Parameter></Parameters><Dataset id="dsReqParam"><ColumnInfo><Column id="v_MATCH_IDX" type="STRING" size="256"/><Column id="v_SINGLE_IDX" type="STRING" size="256"/><Column id="v_USER_ID" type="STRING" size="256"/></ColumnInfo><Rows><Row><Col id="v_MATCH_IDX">${matchIdx}</Col><Col id="v_SINGLE_IDX">${singleIdx}</Col><Col id="v_USER_ID"></Col></Row></Rows></Dataset></Root>`;
}
export function parseJoinDetail(xml:string,homeId:string,awayId:string){
 const doc=new XMLParser({ignoreAttributes:false,parseTagValue:false}).parse(xml);
 const parameters=array<JsonRow>(doc.Root?.Parameters?.Parameter);
 const error=parameters.find(p=>p['@_id']==='ErrorMsg')?.['#text'];
 if(String(error).includes('로그인'))return {status:'requires_login',message:'이 경기의 상세 기록은 JoinKFA 로그인이 필요해요.',lineups:[],events:[]};
 const errorCode=parameters.find(p=>p['@_id']==='ErrorCode')?.['#text'];
 if(errorCode&&String(errorCode)!=='0')throw new Error(clean(error)||'JoinKFA 상세 기록 응답을 확인해 주세요');
 const lineups:Lineup[]=[],events:MatchEvent[]=[];
 for(const dataset of array<JsonRow>(doc.Root?.Dataset)){
  const ds=String(dataset['@_id']||'');
  for(const raw of array<JsonRow>((dataset.Rows as JsonRow|undefined)?.Row as JsonRow|JsonRow[]|undefined)){
   const row=Object.fromEntries(array<JsonRow>(raw.Col as JsonRow|JsonRow[]|undefined).map(c=>[String(c['@_id']),String(c['#text']??'')]));
   const name=row.PLAYER_NAME||row.HNAME||row.NAME;const side=/HOME/i.test(ds)||row.TEAM_ID===homeId?homeId:/AWAY/i.test(ds)||row.TEAM_ID===awayId?awayId:null;
   if(!name||!side)continue;
   if(/player|lineup|entry/i.test(ds))lineups.push({team_id:side,player_name:name,number:row.BACK_NO||row.BACKNUMBER||'',position:row.POSITION||'',starter:row.START_YN?row.START_YN==='Y':null,minutes:number(row.PLAY_TIME),goals:number(row.GOAL),yellow_cards:number(row.WARNING),red_cards:number(row.EXIT)});
   else if(/goal|event|change|card/i.test(ds))events.push({team_id:side,player_name:name,minute:row.TIME||row.EVENT_TIME||'',type:/goal/i.test(ds)?'goal':/change/i.test(ds)?'substitution':'card',detail:row.EVENT_NAME||row.CONTENT||''});
  }
 }
 return {status:lineups.length||events.length?'partial':'unavailable',message:lineups.length||events.length?'공개된 항목만 제공해요.':'공개 응답에 상세 기록이 없어요.',lineups,events};
}
export async function collectJoin(db:DatabaseSync,season:number,options:{league?:string;competition?:string;month?:string;details?:boolean}={}){
 // 현재 사이트는 공개 페이지 경로에 404를 돌려줄 수 있어 초기 JSON 조회와 분리합니다.
 let cookie='';
 try {const session=await request(`${base}/portal/mat/matchList.do`);cookie=session.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}catch{/* 공개 초기 조회는 익명 쿠키 없이도 응답합니다. */}
 const post=async(path:string,body:JsonRow)=>await(await request(`${base}/portal/mat/${path}`,{method:'POST',headers:{...headers,Cookie:cookie},body:JSON.stringify(body)})).json() as JsonRow;
 const init=await post('getInitData1.do',{v_ITEM_CD:'S'});
 db.prepare('INSERT INTO source_metadata VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').run('joinkfa-init',JSON.stringify(init),new Date().toISOString());
 const grades=array<JsonRow>(init.initDataList4 as JsonRow[]).filter(g=>g.CODE&&g.REF3);
 const knownGrades=/초등|중등|고등|대학|K3|WK|K5|K6|K7|i-리그|시도리그|시군구리그|여자|클럽/;
 let count=0;
 for(const grade of grades.filter(g=>knownGrades.test(String(g.NAME)))){
  if(options.competition)break;
  for(let page=1;page<=100;page++){
   const data=await post('getMatchList.do',{v_CURPAGENUM:String(page),v_ROWCOUNTPERPAGE:'100',v_ORDERBY:'',v_YEAR:String(season),v_STYLE:grade.REF3,v_MGC_IDX:grade.CODE,v_AREACODE:'',v_SIGUNGU_CODE:'',v_ITEM_CD:'S',v_TITLE:'',v_TEAMID:'',v_USER_ID:''});
   const rows=array<JsonRow>(data.matchList as JsonRow[]);
   for(const row of rows){
    const name=clean(row.TITLE||row.NAME);const code=String(grade.NAME);let league=classifyVideo(name).league;
    if(!league){league=/초등/.test(code)?'school-u12':/중등/.test(code)?'school-u15':/고등/.test(code)?'school-u18':/대학/.test(code)?'u1':/시도/.test(code)?'regional-city':/시군구/.test(code)?'regional-district':null;}
    if(!league||options.league&&league!==options.league)continue;
    const idx=String(row.IDX);if(!/^\d+$/.test(idx))continue;
    const id=`joinkfa-${idx}`;
    upsert(db,'competitions',{id,league_id:league,name,season,region:clean(row.AREANAME),format:grade.REF3==='MATCH'?'tournament':'league',availability:'partial',...stamp('joinkfa',`${base}/portal/mat/matchList.do`)});
    count+=await collectCompetition(id,idx,league);
   }
   if(rows.length<100||page*100>=Number(data.totalCount||0))break;
  }
 }
 if(options.competition){
  const row=db.prepare('SELECT * FROM competitions WHERE id=?').get(`joinkfa-${options.competition}`);
  const league=options.league||String(row?.league_id||'');if(!league)throw new Error('--competition 사용 시 --league를 지정해 주세요');
  if(!row){const data=await post('getMatchInfo.do',{v_MATCH_IDX:options.competition});const info=(data.matchInfo as JsonRow)||{};
   upsert(db,'competitions',{id:`joinkfa-${options.competition}`,league_id:league,name:clean(info.TITLE)||`${season} ${league.toUpperCase()}`,season,region:clean(info.AREANAME),format:'league',availability:'partial',...stamp('joinkfa',base)});
  }
  count+=await collectCompetition(`joinkfa-${options.competition}`,options.competition,league);
 }
 // KFA 공개 페이지에서 얻은 대회·경기 식별자로도 대표 상세 접근 범위를 검증합니다.
 if(options.details!==false){
  const samples=db.prepare("SELECT * FROM matches WHERE source='kfa' AND detail_status IN ('not_collected','failed') ORDER BY date DESC LIMIT 2").all();
  for(const sample of samples){const url=new URL(String(sample.source_url));await detail(String(sample.id),url.searchParams.get('idx')!,url.searchParams.get('s_idx')!,String(sample.home_id),String(sample.away_id));}
 }
 async function detail(id:string,idx:string,single:string,home:string,away:string){
  try{
   const xml=await(await request(`${base}/generate/MAT_04_001/SEARCH00.do?CALL_TYPE=NEXACRO`,{method:'POST',headers:{'Content-Type':'text/xml; charset=UTF-8'},body:detailXml(idx,single)})).text();
   const parsed=parseJoinDetail(xml,home,away);
   db.prepare('UPDATE matches SET detail_status=?,detail_message=?,lineups_json=?,events_json=? WHERE id=? AND manual_locked=0').run(parsed.status,parsed.message,JSON.stringify(parsed.lineups),JSON.stringify(parsed.events),id);
  }catch(error){db.prepare("UPDATE matches SET detail_status='failed',detail_message=? WHERE id=? AND manual_locked=0").run(String(error),id);}
 }
 async function collectCompetition(id:string,idx:string,league:string){
  let found=0;
  const teamData=await post('getApplyTeamList.do',{v_MATCH_IDX:idx});
  for(const team of array<JsonRow>(teamData.applyTeamList as JsonRow[])){
   const teamId=String(team.TEAMID||team.TEAM_ID||'');if(!teamId)continue;
   const savedTeam=saveTeam(db,'joinkfa',league,clean(team.TEAMNAME),teamId,null,base);
   const players=await post('getApplyPlayerList.do',{v_TEAMID:teamId,v_MATCH_IDX:idx,v_MGC_TYPE:'S'});
   transaction(db,()=>{for(const player of array<JsonRow>(players.applyPlayerList as JsonRow[])){
    const pid=String(player.PLAYER_ID||player.HUMAN_ID||player.IDX||'');const name=clean(player.HNAME||player.NAME||player.PLAYER_NAME);if(!pid||!name)continue;
    upsert(db,'players',{id:`joinkfa-${pid}`,name,team_id:savedTeam,photo:null,...stamp('joinkfa',base)});
   }});
  }
  const months=options.month?[options.month]:Array.from({length:12},(_,i)=>`${season}${String(i+1).padStart(2,'0')}`);
  for(const month of months)for(let page=1;page<=100;page++){
   const data=await post('getMatchSingleList.do',{v_CURPAGENUM:String(page),v_ROWCOUNTPERPAGE:'100',v_ORDERBY:'',v_MATCH_IDX:idx,v_YEAR_MONTH:month,v_TEAMID:'',v_USER_ID:''});
   const rows=array<JsonRow>(data.singleList as JsonRow[]);
   for(const row of rows){
    const raw=clean(row.MATCH_DATE||row.G_DATE).replaceAll(/[^\d]/g,'');if(raw.length<8)continue;
    const date=`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;const single=String(row.IDX||row.SINGLE_IDX||'');if(!single)continue;
    const home=saveTeam(db,'joinkfa',league,clean(row.TEAM_HOME_NAME||row.HOME_TEAM),String(row.TEAM_HOME_ID||row.TEAM_HOME_NAME),null,base);
    const away=saveTeam(db,'joinkfa',league,clean(row.TEAM_AWAY_NAME||row.AWAY_TEAM),String(row.TEAM_AWAY_ID||row.TEAM_AWAY_NAME),null,base);
    const time=clean(row.START_TIME||row.MATCH_TIME);const hs=number(row.HOME_SCORE),as=number(row.AWAY_SCORE);const match=`joinkfa-${idx}-${single}`;
    upsert(db,'matches',{id:match,competition_id:id,home_id:home,away_id:away,date,kickoff:/^\d{2}:\d{2}$/.test(time)?`${date}T${time}:00+09:00`:null,home_score:hs,away_score:as,venue:clean(row.PLACE_NAME||row.STADIUM),round:clean(row.ROUND),stage:clean(row.GROUP_NAME),status:hs!==null&&as!==null?'finished':'scheduled',...stamp('joinkfa',base)});found++;
    if(options.details!==false)await detail(match,idx,single,home,away);
   }
   if(rows.length<100||page*100>=Number(data.totalCount||0))break;
  }
  return found;
 }
 return count;
}
