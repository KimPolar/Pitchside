import * as cheerio from 'cheerio';
import type { DatabaseSync } from 'node:sqlite';
import { stamp,transaction,upsert } from '../db.ts';
import { absolute,clean,number,request,saveTeam } from './common.ts';

export function parseKfaMatches(html:string,season:number){
 const $=cheerio.load(html);return $('td[onclick*="_result"]').map((_i,td)=>{
  const call=$(td).attr('onclick')!.match(/k[34]_result\('([^']+)','([^']+)'/);const blocks=$(td).children('div');
  const names=blocks.eq(0).find('h3');const scores=blocks.eq(1).find('h3');const raw=clean(blocks.eq(1).find('span').text());
  const date=raw.match(/(\d{2})-(\d{2})/);const time=raw.match(/(\d{2}:\d{2})/);
  if(!call||!date)return null;
  const formatted=`${season}-${date[1]}-${date[2]}`;
  const h=number(scores.eq(0).text()),a=number(scores.eq(1).text());
  return {competition:call[1],sourceId:call[2],home:clean(names.eq(0).text()),away:clean(names.eq(1).text()),homeEmblem:absolute(names.eq(0).find('img').attr('src'),'https://www.kfa.or.kr'),awayEmblem:absolute(names.eq(1).find('img').attr('src'),'https://www.kfa.or.kr'),homeScore:h,awayScore:a,date:formatted,kickoff:time?`${formatted}T${time[1]}:00+09:00`:null,venue:clean(blocks.eq(0).find('span').text()),status:/연기/.test($(td).text())?'postponed':h!==null&&a!==null?'finished':'scheduled'};
 }).get().filter(Boolean);
}
export async function collectKfa(db:DatabaseSync,season:number){
 let count=0;
 for(const league of ['k3','k4']){
  const url=`https://www.kfa.or.kr/competition/${league}_${season}.php`;const page=await(await request(url)).text();
  const competition=`kfa-${league}-${season}`;
  upsert(db,'competitions',{id:competition,league_id:league,name:`${season} ${league.toUpperCase()}리그`,season,region:'전국',format:'league',availability:'partial',...stamp('kfa',url)});
  const save=(html:string,round:string)=>{
   const rows=parseKfaMatches(html,season);
   transaction(db,()=>{for(const r of rows){
    const h=saveTeam(db,'kfa',league,r.home,r.home,r.homeEmblem,url),a=saveTeam(db,'kfa',league,r.away,r.away,r.awayEmblem,url);
    upsert(db,'matches',{id:`kfa-${r.sourceId}`,competition_id:competition,home_id:h,away_id:a,kickoff:r.kickoff,date:r.date,round,venue:r.venue,home_score:r.homeScore,away_score:r.awayScore,status:r.status,...stamp('kfa',`https://www.kfa.or.kr/layer_popup/domestic.php?act=domestic_detail&idx=${r.competition}&s_idx=${r.sourceId}&div=${league}`)});count++;
   }});return rows;
  };
  const $=cheerio.load(page);save(page,clean($('#result_view .title h3').text()));
  // 공식 페이지의 라운드 이동과 동일한 공개 조회 경로를 순회합니다.
  let lastSignature='';
  for(let round=1;round<=40;round++){
   const html=await(await request(`${url}?act=${league}_round&chk_round=now&act_sub=${league}&round=${round}`)).text();
   const rows=parseKfaMatches(html,season);if(!rows.length)break;
   const signature=rows.map(r=>r.sourceId).join(',');if(signature===lastSignature)break;lastSignature=signature;
   save(html,`${round}R`);
   if(cheerio.load(html)('#next_round_check').val()==='N')break;
  }
  transaction(db,()=>{
   $('table').filter((_i,t)=>$(t).find('thead').text().includes('승점')).first().find('tbody tr').each((_i,tr)=>{
    const c=$(tr).children('td');if(c.length<7)return;const name=clean(c.eq(1).text());const team=saveTeam(db,'kfa',league,name,name,absolute(c.eq(1).find('img').attr('src'),url),url);
    const wins=number(c.eq(3).text()),draws=number(c.eq(4).text()),losses=number(c.eq(5).text());
    upsert(db,'standings',{id:`${competition}-${team}`,competition_id:competition,team_id:team,position:number(c.eq(0).text())!,points:number(c.eq(2).text()),wins,draws,losses,played:wins!==null&&draws!==null&&losses!==null?wins+draws+losses:null,goal_difference:number(c.eq(6).text()),...stamp('kfa',url)});
   });
  });
 }
 return count;
}
