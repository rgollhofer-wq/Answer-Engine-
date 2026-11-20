<?php
namespace BBL\Phase1;
final class Route {
    const CONTENT = "<?php\n// BBL staging-only plumbing entry. Loads this clone, never the production root.\nrequire dirname(__DIR__, 3) . '/index.php';\n";
    public static function install(string $root): array {
        $base=realpath($root);
        if (!$base || basename($base)!=='backed-by-local' || !is_file($base.'/index.php')) throw new \RuntimeException('Not the staging root.');
        $path=$base;
        foreach (['category','home-services','plumbing'] as $part) {
            $path.='/'.$part;
            if (is_link($path)) throw new \RuntimeException('Symlink path refused.');
            if (!is_dir($path) && !mkdir($path,0755)) throw new \RuntimeException('Cannot create staging route directory.');
            $resolved=realpath($path);
            if (!$resolved || strpos($resolved, $base.DIRECTORY_SEPARATOR)!==0) throw new \RuntimeException('Route escaped staging.');
        }
        $file=$path.'/index.php';
        if (file_exists($file) || is_link($file)) {
            if (!is_link($file) && file_get_contents($file)===self::CONTENT) return ['status'=>'already installed','sha256'=>hash('sha256',self::CONTENT)];
            throw new \RuntimeException('Existing route file preserved; installation refused.');
        }
        $handle=fopen($file,'x');
        if (!$handle) throw new \RuntimeException('Cannot create route entry.');
        $written=fwrite($handle,self::CONTENT);fclose($handle);
        if ($written!==strlen(self::CONTENT)) throw new \RuntimeException('Incomplete route write; review file before continuing.');
        return ['status'=>'installed','sha256'=>hash_file('sha256',$file)];
    }
}
