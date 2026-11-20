<?php
// In-memory WordPress boundary doubles. No network, database, real people or mail.
define('ABSPATH','/synthetic/backed-by-local/'); define('DAY_IN_SECONDS',86400);
$site='https://backedbylocal.com'; $admin=true; $user=7; $hooks=[]; $options=[]; $sessions=[]; $mailCalls=0;
function untrailingslashit($s){return rtrim($s,'/');} function home_url(){global $site;return $site;}
function wp_normalize_path($s){return str_replace('\\','/',$s);}
function add_action($name,$callback,$priority=10){global $hooks;$hooks[]=$name;}
function current_user_can($cap){global $admin;return $admin;} function get_current_user_id(){global $user;return $user;}
function sanitize_textarea_field($v){return strip_tags($v);} function esc_html($v){return htmlspecialchars($v);}
function get_transient($k){global $sessions;return $sessions[$k]??false;}
function set_transient($k,$v,$ttl){global $sessions;$sessions[$k]=$v;return true;}
function get_option($k){global $options;return $options[$k]??false;}
function add_option($k,$v,$unused='',$autoload=false){global $options;if(isset($options[$k]))return false;$options[$k]=$v;return true;}
function update_option($k,$v,$autoload=false){global $options;$options[$k]=$v;return true;}
function is_email($v){return filter_var($v,FILTER_VALIDATE_EMAIL);}
function wp_mail(...$args){global $mailCalls;$mailCalls++;throw new RuntimeException('No mail allowed in recovery tests');}
class WP_Query { public $posts=[]; function __construct($args){} }
class WP_Error {public $code;function __construct($code,$message,$data=[]){$this->code=$code;}}
class WP_REST_Response {public $data;public $status;function __construct($data,$status){$this->data=$data;$this->status=$status;}}
class WP_REST_Request {private $data;function __construct($data){$this->data=$data;}function get_json_params(){return $this->data;}}
require __DIR__.'/../../wordpress/bbl-answer-engine-mvp/bbl-answer-engine-mvp.php';
$checks=0;function check($c,$m){global $checks;$checks++;if(!$c)throw new RuntimeException($m);}
check($hooks===[],'Production instance must register no hooks');
$site='https://backedbylocal.com/backed-by-local';$plugin=new BBL_Answer_Engine_MVP();
check(in_array('rest_api_init',$hooks,true),'Existing staging hooks registered');
$admin=false;check($plugin->permission() instanceof WP_Error,'Non-admin blocked');$admin=true;
check($plugin->permission()===true,'Named clone administrator allowed');
$answer=$plugin->answer(new WP_REST_Request(['question'=>'Water heater leaking in Denver today']));
check($answer->status===200 && $answer->data['status']==='No Verified Match','No fabricated business');
$token=$answer->data['conversation_id'];
$follow=$plugin->answer(new WP_REST_Request(['question'=>'electric','conversation_id'=>$token]));
check($follow->data['intent']['city']==='denver-co' && $follow->data['intent']['fuel']==='electric','Session retains context');
$user=8;check($plugin->answer(new WP_REST_Request(['question'=>'hello','conversation_id'=>$token])) instanceof WP_Error,'Sessions isolated by user');$user=7;
$p=['conversation_id'=>$token,'version'=>$follow->data['version'],'name'=>'Synthetic Tester','email'=>'tester@example.invalid','phone'=>'','provider_id'=>0,'consent'=>true];
$bad=$p;$bad['consent']=false;check($plugin->lead(new WP_REST_Request($bad)) instanceof WP_Error,'Consent required');
$bad=$p;$bad['version']=1;check($plugin->lead(new WP_REST_Request($bad)) instanceof WP_Error,'Stale context rejected');
$bad=$p;$bad['provider_id']=99;check($plugin->lead(new WP_REST_Request($bad)) instanceof WP_Error,'Unverified provider rejected');
$receipt=$plugin->lead(new WP_REST_Request($p));
check($receipt->data['persisted']===true && $receipt->data['delivery_status']==='disabled','Saved locally with mail disabled');
check($receipt->data['delivery_verified']===false && $mailCalls===0,'No email or delivery claim');
$retry=$plugin->lead(new WP_REST_Request($p));
check($retry->data['id']===$receipt->data['id'] && count($options)===1,'Idempotent retry');
$site='https://backedbylocal.com';check($plugin->permission() instanceof WP_Error,'Production permission denied');
echo "$checks plugin boundary checks passed\n";
