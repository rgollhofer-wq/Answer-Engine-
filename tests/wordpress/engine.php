<?php
require __DIR__.'/../../wordpress/bbl-answer-engine-mvp/engine.php';
use BBL\Phase1\Engine;
$checks=0;
function check($condition, $message) { global $checks; $checks++; if (!$condition) throw new RuntimeException($message); }
$now=strtotime('2026-11-20T12:00:00Z');
$intent=Engine::intent('My water heater is leaking in Denver today');
check($intent['service']==='water-heater' && $intent['city']==='denver-co', 'Service and city extraction');
$next=Engine::intent('It is electric', $intent);
check($next['service']==='water-heater' && $next['city']==='denver-co' && $next['fuel']==='electric', 'Context retained');
check(Engine::intent('Actually Aurora', $next)['city']==='aurora-co','Explicit city correction');
check(Engine::intent('Start over',$next)['service']===null,'Reset clears context');
check(Engine::intent('Plumber 80202')['city']==='denver-co','Recovered ZIP mapping');
check(Engine::intent('Plumber 99999')['city']===null,'Unknown ZIP does not invent city');
check(Engine::result(Engine::intent('Plumber'),[],$now)['status']==='Needs Clarification','Missing city asks clarification');
check(Engine::result($intent,[],$now)['status']==='No Verified Match','Empty inventory stays empty');
$business=['id'=>1,'name'=>'Synthetic Test Plumbing','url'=>'https://example.invalid/business/1','post_status'=>'publish',
 'cities'=>['denver-co'],'categories'=>['plumbing'],'phone'=>'',
 'evidence'=>['status'=>'verified','checked_at'=>'2026-11-19T12:00:00Z','expires_at'=>'2026-12-19T12:00:00Z',
 'reviewed_by'=>'synthetic-reviewer','source_url'=>'https://example.invalid/evidence','cities'=>['denver-co'],'services'=>['water-heater']]];
$r=Engine::result($intent,[$business],$now);
check($r['status']==='Verified' && $r['availability']==='unverified','Evidence does not verify availability');
foreach (['status'=>'possible','expires_at'=>'2026-11-19','checked_at'=>'2026-12-01','reviewed_by'=>'','source_url'=>'javascript:alert(1)','cities'=>['aurora-co'],'services'=>['drain']] as $key=>$value) {
 $b=$business; $b['evidence'][$key]=$value;
 check(Engine::result($intent,[$b],$now)['status']==='Possible','Invalid evidence cannot verify: '.$key);
}
foreach (['post_status'=>'draft','cities'=>['aurora-co'],'categories'=>['electrical']] as $key=>$value) {
 $b=$business; $b[$key]=$value;
 check(Engine::result($intent,[$b],$now)['status']==='No Verified Match','Record excluded: '.$key);
}
$paid=$business; $paid['sponsored']=true; $paid['trust_score']=999; $paid['feat']=true;
check(Engine::result($intent,[$paid],$now)===$r,'Commercial fields never alter matching');
check(Engine::isDemoRoute('/backed-by-local/category/home-services/plumbing/','/backed-by-local/',[]),'Scoped route retained');
check(!Engine::isDemoRoute('/category/home-services/plumbing/','/backed-by-local/',[]),'Production path excluded');
check(Engine::isDemoRoute('/backed-by-local/','/backed-by-local/',['bbl_sammy'=>'1']),'Query route retained');
echo "$checks engine checks passed\n";
