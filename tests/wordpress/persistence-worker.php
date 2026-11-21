<?php
// Separate PHP requests share only a synthetic file-backed WordPress boundary.
// This tests plugin persistence/admin contracts, not a real WordPress database.
$dir=$argv[1]??'';$mode=$argv[2]??'';
if (!$dir || !is_dir($dir)) throw new RuntimeException('Test directory required');
define('ABSPATH','/synthetic/backed-by-local/');define('DAY_IN_SECONDS',86400);
function dbread(){global $dir;return json_decode(file_get_contents($dir.'/store.json'),true);}
function dbwrite($s){global $dir;file_put_contents($dir.'/store.json',json_encode($s),LOCK_EX);}
function untrailingslashit($s){return rtrim($s,'/');}
function home_url($path=''){return 'https://backedbylocal.com/backed-by-local'.$path;}
function wp_normalize_path($s){return str_replace('\\','/',$s);}
function add_action(...$args){} function current_user_can($c){return true;}function get_current_user_id(){return 7;}
function sanitize_textarea_field($s){return strip_tags($s);}function esc_html($s){return htmlspecialchars($s,ENT_QUOTES);}
function esc_url($s){return esc_html($s);}function wp_nonce_field($s){}function wp_json_encode($v,$flags=0){return json_encode($v,$flags);}
function is_email($s){return filter_var($s,FILTER_VALIDATE_EMAIL);}
function get_transient($k){return dbread()['sessions'][$k]??false;}
function set_transient($k,$v,$ttl){$s=dbread();$s['sessions'][$k]=$v;dbwrite($s);return true;}
function get_option($k){return dbread()['options'][$k]??false;}
function add_option($k,$v,$unused='',$autoload=false){
    if($autoload!==false)throw new RuntimeException('Lead must not autoload');
    $s=dbread();if(isset($s['options'][$k]))return false;$s['options'][$k]=$v;dbwrite($s);return true;
}
function wp_mail(...$args){$s=dbread();$s['mail_calls']++;dbwrite($s);throw new RuntimeException('Forbidden mail');}
class WP_Query {public $posts=[];function __construct($args){}}
class WP_Error {public $code;function __construct($c,$m,$d=[]){$this->code=$c;}}
class WP_REST_Response {public $data;public $status;function __construct($d,$s){$this->data=$d;$this->status=$s;}}
class WP_REST_Request {private $data;function __construct($d){$this->data=$d;}function get_json_params(){return $this->data;}}
class TestDB {
    public $options='synthetic_options';
    function esc_like($s){return addcslashes($s,'_%\\');}
    function prepare($sql,$arg){return $sql;}
    function get_col($sql){return array_keys(dbread()['options']);}
}
$wpdb=new TestDB();
require __DIR__.'/../../wordpress/bbl-answer-engine-mvp/bbl-answer-engine-mvp.php';
$p=new BBL_Answer_Engine_MVP();
if($mode==='conversation'){
    $r=$p->answer(new WP_REST_Request(['question'=>'My water heater is leaking.']));
    $r=$p->answer(new WP_REST_Request(['question'=>'Denver, today.','conversation_id'=>$r->data['conversation_id']]));
    $r=$p->answer(new WP_REST_Request(['question'=>'It is electric.','conversation_id'=>$r->data['conversation_id']]));
    echo json_encode($r->data);
}elseif($mode==='lead'){
    $r=json_decode(file_get_contents($dir.'/answer.json'),true);
    $result=$p->lead(new WP_REST_Request(['conversation_id'=>$r['conversation_id'],'version'=>$r['version'],
        'name'=>'Synthetic PR5 Tester','email'=>'pr5-test@example.invalid','consent'=>true,'provider_id'=>0]));
    echo json_encode($result->data);
}elseif($mode==='admin'){$p->admin();}
else throw new RuntimeException('Unknown test mode');
