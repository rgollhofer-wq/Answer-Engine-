<?php
require __DIR__.'/../../wordpress/bbl-answer-engine-mvp/route.php';
use BBL\Phase1\Route;
$base=sys_get_temp_dir().'/bbl-route-'.bin2hex(random_bytes(6));
mkdir($base);mkdir($base.'/backed-by-local');
file_put_contents($base.'/index.php','<?php echo "PRODUCTION";');
$root=$base.'/backed-by-local';
file_put_contents($root.'/index.php','<?php echo "CLONE";');
$checks=0;
function check($ok,$why){global $checks;$checks++;if(!$ok)throw new RuntimeException($why);}
function refuses($root,$why){
    $rejected=false;
    try { Route::install($root); } catch(RuntimeException $e){$rejected=true;}
    check($rejected,$why); // Never catch our own assertion.
}
try {
    refuses($base,'Non-staging root accepted');
    refuses($base.'/missing','Missing root accepted');
    check(Route::install($root)['status']==='installed','Install in temporary clone');
    check(Route::install($root.'/')['status']==='already installed','Idempotent with trailing separator');
    $entry=$root.'/category/home-services/plumbing/index.php';
    ob_start();include $entry;$output=ob_get_clean();
    check($output==='CLONE','Generated loader must execute clone, not sibling production root');
    file_put_contents($entry,'existing file');
    refuses($root,'Existing file accepted');
    check(file_get_contents($entry)==='existing file','Existing file preserved');
    unlink($entry);
    unlink($root.'/index.php');
    refuses($root,'Missing clone entrypoint accepted');
    if (@symlink($base.'/index.php',$root.'/index.php')) {
        refuses($root,'Production entrypoint symlink accepted');
        unlink($root.'/index.php');
        file_put_contents($root.'/index.php','<?php echo "CLONE";');
        symlink($base.'/index.php',$entry);
        refuses($root,'Route file symlink accepted');unlink($entry);
        rmdir(dirname($entry));
        symlink($base,dirname($entry));
        refuses($root,'Route directory symlink accepted');unlink(dirname($entry));
        mkdir($base.'/alias');symlink($root,$base.'/alias/backed-by-local');
        refuses($base.'/alias/backed-by-local/','Symlink root accepted');
        unlink($base.'/alias/backed-by-local');
    } else {
        if (PHP_OS_FAMILY!=='Windows') throw new RuntimeException('Symlink tests required on Linux CI');
        echo "SKIP: Windows account cannot create symlinks; Linux CI requires these four cases.\n";
    }
} finally {
    $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST);
    foreach($it as $p){!$p->isLink() && $p->isDir()?rmdir($p->getPathname()):unlink($p->getPathname());}rmdir($base);
}
echo "$checks route checks passed\n";
