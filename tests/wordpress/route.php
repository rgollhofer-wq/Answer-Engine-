<?php
require __DIR__.'/../../wordpress/bbl-answer-engine-mvp/route.php';
use BBL\Phase1\Route;
$base=sys_get_temp_dir().'/bbl-recovery-'.bin2hex(random_bytes(6));
mkdir($base);mkdir($base.'/backed-by-local');file_put_contents($base.'/backed-by-local/index.php','<?php // synthetic');
$root=$base.'/backed-by-local';$checks=0;
function check($ok,$why){global $checks;$checks++;if(!$ok)throw new RuntimeException($why);}
try {
 try { Route::install($base);check(false,'Non-staging root accepted'); } catch(RuntimeException $e){check(true,'Reject root');}
 check(Route::install($root)['status']==='installed','Install only under temporary clone');
 check(Route::install($root)['status']==='already installed','Repeat is idempotent');
 $entry=$root.'/category/home-services/plumbing/index.php';
 check(file_get_contents($entry)===Route::CONTENT,'Exact scoped loader');
 file_put_contents($entry,'existing file');
 try { Route::install($root);check(false,'Overwrote existing route'); } catch(RuntimeException $e){check(file_get_contents($entry)==='existing file','Existing route preserved');}
} finally {
 // All targets are descendants of the unique test directory created above.
 $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
 foreach($it as $p){$p->isDir()?rmdir($p->getPathname()):unlink($p->getPathname());}rmdir($base);
}
echo "$checks route checks passed\n";
