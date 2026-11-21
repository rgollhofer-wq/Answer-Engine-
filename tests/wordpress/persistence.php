<?php
$dir=sys_get_temp_dir().'/bbl-persistence-'.bin2hex(random_bytes(6));mkdir($dir);
file_put_contents($dir.'/store.json',json_encode(['options'=>[],'sessions'=>[],'mail_calls'=>0]));
$checks=0;function check($ok,$message){global $checks;$checks++;if(!$ok)throw new RuntimeException($message);}
function request($mode){
    global $dir;
    $p=proc_open([PHP_BINARY,__DIR__.'/persistence-worker.php',$dir,$mode],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
    $out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
    if(proc_close($p)!==0)throw new RuntimeException($err);return $out;
}
try {
    $answer=request('conversation');file_put_contents($dir.'/answer.json',$answer);$a=json_decode($answer,true);
    check($a['status']==='No Verified Match' && $a['intent']['fuel']==='electric','Three-turn context');
    $r=json_decode(request('lead'),true);
    check($r['persisted']===true && $r['delivery_status']==='disabled','New process saves mail-disabled lead');
    $again=json_decode(request('lead'),true);
    check($again['id']===$r['id'],'Retry from new process preserves ID');
    $s=json_decode(file_get_contents($dir.'/store.json'),true);$lead=array_values($s['options'])[0];
    check(count($s['options'])===1 && count($lead['conversation'])===3,'One durable complete lead');
    check($lead['intent']['city']==='denver-co' && $lead['provider_id']===null,'Context and no fabricated provider');
    check($s['mail_calls']===0 && $lead['test_lead']===true,'No external email');
    $admin=request('admin');
    check(strpos($admin,$r['id'])!==false && strpos($admin,'Synthetic PR5 Tester')!==false,'Admin renders durable test lead');
    check(strpos($admin,'No Verified Match | disabled')!==false,'Admin renders honest match and email status');
} finally {
    foreach(['store.json','answer.json'] as $file){if(is_file($dir.'/'.$file))unlink($dir.'/'.$file);}rmdir($dir);
}
echo "$checks separate-process persistence/admin checks passed (synthetic WordPress boundary)\n";
