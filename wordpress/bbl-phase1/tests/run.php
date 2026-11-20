<?php
// Application contract tests with explicit WordPress doubles. Live staging supplies the WP smoke test.
define('ABSPATH','/test/backed-by-local/'); define('DAY_IN_SECONDS',86400);
$opts=[];$sessions=[];$mailCalls=0;$mailResult=false;$posts=[];$registrations=[];$site='https://backedbylocal.com/backed-by-local';$cap=true;$failAdd=false;$failUpdate=false;
function home_url($p=''){global $site;return $site.$p;}
function untrailingslashit($s){return rtrim($s,'/');} function wp_normalize_path($s){return str_replace('\\','/',$s);}
function add_action(...$a){} function current_user_can($s){global $cap;return $cap;} function get_current_user_id(){return 7;}
function sanitize_textarea_field($s){return trim(strip_tags($s));} function is_email($s){return filter_var($s,FILTER_VALIDATE_EMAIL);}
function get_transient($k){global $sessions;return $sessions[$k]??false;} function set_transient($k,$v,$ttl){global $sessions;$sessions[$k]=$v;return true;}
function get_option($k){global $opts;return $opts[$k]??false;} function add_option($k,$v,$d='',$a=false){global $opts,$failAdd;if($failAdd||isset($opts[$k]))return false;$opts[$k]=$v;return true;}
function update_option($k,$v,$a=false){global $opts,$failUpdate;if($failUpdate)return false;$opts[$k]=$v;return true;}
function wp_mail(...$a){global $mailCalls,$mailResult;$mailCalls++;if($mailResult==='throw')throw new RuntimeException('private SMTP detail');return $mailResult;}
function esc_html($s){return htmlspecialchars($s,ENT_QUOTES);} function is_wp_error($v){return $v instanceof WP_Error;}
class WP_Error{public $code,$message,$data;function __construct($c,$m,$d=[]){$this->code=$c;$this->message=$m;$this->data=$d;}}
class WP_REST_Request{private $p;function __construct($p){$this->p=$p;}function get_json_params(){return $this->p;}}
class WP_REST_Response{public $data,$status;function __construct($d,$s){$this->data=$d;$this->status=$s;}}
class WP_Query{public $posts;function __construct($args){global $posts;$this->posts=$posts;}}
function post_type_exists($n){return $n==='cities';}function taxonomy_exists($n){return $n==='business_category';}
function register_post_type($n,$a){global $registrations;$registrations[$n]=$a;}function register_taxonomy($n,$t,$a){global $registrations;$registrations[$n]=$a;}
require __DIR__.'/../bbl-answer-engine-mvp/bbl-answer-engine-mvp.php';
use BBL\Phase1\Engine;
$count=0;function check($ok,$label){global $count;if(!$ok){fwrite(STDERR,"FAIL: $label\n");exit(1);}echo 'PASS '.(++$count).": $label\n";}
$now=strtotime('2026-11-20');
$i=Engine::intent('My water heater is leaking in Denver. Can someone help today?');
check($i['service']==='water-heater'&&$i['city']==='denver-co'&&$i['urgency']==='today-requested','Natural-language Denver water heater intent');
$next=Engine::intent('It is electric',$i);check($next['fuel']==='electric'&&$next['city']==='denver-co'&&$next['service']==='water-heater','Follow-up retains service, location and urgency');
check(Engine::intent('Actually Aurora',$next)['city']==='aurora-co','Location correction');
check(Engine::intent('No rush, next week',$next)['urgency']==='routine','Urgency correction');
check(Engine::intent('start over',$next)['city']===null,'Reset removes previous intent');
check(Engine::intent('plumber')['city']===null,'No silent Lynnwood default');
check(Engine::intent('water heater 99999')['city']===null,'Unknown ZIP does not fabricate city');
check(Engine::intent('plumber 80202')['city']==='denver-co','Recovered explicit ZIP map');
check(Engine::result(Engine::intent('plumber'),[],$now)['status']==='Needs Clarification','Missing city asks follow-up');
check(Engine::result(Engine::intent('dentist in Denver'),[],$now)['status']==='Needs Clarification','Unsupported service asks clarification');
$none=Engine::result($i,[],$now);check($none['status']==='No Verified Match'&&$none['verified']===[],'Empty evidence produces explicit no-match');
check($none['availability']==='unverified'&&strpos($none['message'],'cannot confirm')!==false,'Today request never becomes availability claim');
$b=['id'=>1,'name'=>'Synthetic Test Plumber','url'=>'https://example.invalid/','phone'=>'','post_status'=>'publish','cities'=>['denver-co'],'categories'=>['plumbing'],'evidence'=>['status'=>'verified','source_url'=>'https://example.invalid/evidence','reviewed_by'=>'fixture reviewer','checked_at'=>'2026-11-01','expires_at'=>'2026-12-01','cities'=>['denver-co'],'services'=>['water-heater']]];
check(Engine::result($i,[$b],$now)['status']==='Verified','Current scoped evidence permits verified status (synthetic fixture only)');
$bad=$b;$bad['evidence']=[];check(Engine::result($i,[$bad],$now)['status']==='Possible','Missing evidence is Possible, never Verified');
$bad=$b;$bad['evidence']['expires_at']='2026-11-10';check(Engine::result($i,[$bad],$now)['status']==='Possible','Expired evidence rejected');
$bad=$b;$bad['evidence']['services']=['plumbing'];check(Engine::result($i,[$bad],$now)['status']==='Possible','Generic plumbing evidence cannot assert water-heater capability');
$bad=$b;$bad['evidence']['cities']=['aurora-co'];check(Engine::result($i,[$bad],$now)['status']==='Possible','Evidence must cover requested city');
$bad=$b;$bad['post_status']='draft';check(Engine::result($i,[$bad],$now)['status']==='No Verified Match','Draft businesses excluded');
$bad=$b;$bad['cities']=['aurora-co'];check(Engine::result($i,[$bad],$now)['status']==='No Verified Match','Nearby city is not assumed coverage');
$b2=$b;$b2['id']=2;$b2['name']='A Synthetic';$b['feat']=true;$b['sponsorship']=99999;
check(array_column(Engine::result($i,[$b,$b2],$now)['verified'],'id')===[2,1],'Sponsorship cannot change organic order');
check(Engine::isDemoRoute('/backed-by-local/category/home-services/plumbing/','/backed-by-local/',[]),'Exact plumbing route');
check(Engine::isDemoRoute('/backed-by-local/?bbl_sammy=1','/backed-by-local/',['bbl_sammy'=>'1']),'Plain-permalink fallback route');
foreach(['/','/backed-by-local/','/backed-by-local/?page_id=907','/category/home-services/plumbing/','/backed-by-local/cities/denver/'] as $route)check(!Engine::isDemoRoute($route,'/backed-by-local/',[]),'Preserve route '.$route);
$app=new BBL_Answer_Engine_MVP();$app->register_dependencies();check(!isset($registrations['cities'])&&!isset($registrations['business_category']),'Existing legacy registrations untouched');
$site='https://backedbylocal.com';check(!BBL_Answer_Engine_MVP::allowed_site(),'Production home URL blocked');$site='https://backedbylocal.com/backed-by-local';
$cap=false;check($app->permission() instanceof WP_Error,'Anonymous or unprivileged REST access blocked');$cap=true;
check($app->answer(new WP_REST_Request(['question'=>[]])) instanceof WP_Error,'Malformed question rejected');
$answer=$app->answer(new WP_REST_Request(['question'=>'My water heater is leaking in Denver. Can someone help today?']))->data;
$follow=$app->answer(new WP_REST_Request(['question'=>'Electric','conversation_id'=>$answer['conversation_id']]))->data;
check($follow['intent']['city']==='denver-co'&&$follow['version']===2,'Server-owned conversation state across requests');
$payload=['conversation_id'=>$follow['conversation_id'],'version'=>2,'name'=>'Synthetic QA','email'=>'qa@example.invalid','phone'=>'','consent'=>true,'provider_id'=>0];
$p=$payload;$p['consent']=false;check($app->lead(new WP_REST_Request($p)) instanceof WP_Error,'Consent required before storage');
$p=$payload;$p['provider_id']=99;check($app->lead(new WP_REST_Request($p)) instanceof WP_Error,'Client cannot forge matched provider');
$p=$payload;$p['version']=1;check($app->lead(new WP_REST_Request($p)) instanceof WP_Error,'Stale answer cannot be submitted');
$p=$payload;$p['email']='bad';check($app->lead(new WP_REST_Request($p)) instanceof WP_Error,'Invalid contact rejected');
$failAdd=true;check($app->lead(new WP_REST_Request($payload)) instanceof WP_Error&&$mailCalls===0,'Storage failure prevents email and false receipt');$failAdd=false;
$r=$app->lead(new WP_REST_Request($payload))->data;
check($r['persisted']&&$r['delivery_status']==='failed'&&!$r['delivery_verified'],'Failed mail retains persisted lead and truthful status');
$saved=$opts[BBL_Answer_Engine_MVP::PREFIX.$r['id']];
check($saved['contact']['email']==='qa@example.invalid'&&$saved['intent']['city']==='denver-co'&&$saved['provider_id']===null&&$saved['consent']['accepted']&&$saved['created_at']&&$saved['source'],'Lead contains contact, request, location, provider, consent, source, timestamp');
$app->lead(new WP_REST_Request($payload));check(count($opts)===1&&$mailCalls===1,'Retry is idempotent and does not resend notification');
$mailResult=true;$new=$app->answer(new WP_REST_Request(['question'=>'Plumber in Denver today']))->data;$p=$payload;$p['conversation_id']=$new['conversation_id'];$p['version']=1;
$r=$app->lead(new WP_REST_Request($p))->data;check($r['delivery_status']==='accepted_unverified'&&!$r['delivery_verified'],'wp_mail success is never delivery verification');
$mailResult='throw';$new=$app->answer(new WP_REST_Request(['question'=>'Plumber in Denver today']))->data;$p['conversation_id']=$new['conversation_id'];$r=$app->lead(new WP_REST_Request($p))->data;check($r['delivery_status']==='failed','Mailer exception preserves durable record without leaking diagnostic secrets');
$new=$app->answer(new WP_REST_Request(['question'=>'Plumber in Denver today']))->data;$p['conversation_id']=$new['conversation_id'];$failUpdate=true;$r=$app->lead(new WP_REST_Request($p))->data;check($r['delivery_status']==='pending','Status write failure retains honest pending state');
$tmp=sys_get_temp_dir().'/bbl-route-'.bin2hex(random_bytes(6));mkdir($tmp);mkdir($tmp.'/backed-by-local');file_put_contents($tmp.'/backed-by-local/index.php','<?php // test clone');
$route=\BBL\Phase1\Route::install($tmp.'/backed-by-local');check($route['status']==='installed','Scoped route entry installs beneath staging only');
check(\BBL\Phase1\Route::install($tmp.'/backed-by-local')['status']==='already installed','Route installation is idempotent');
file_put_contents($tmp.'/backed-by-local/category/home-services/plumbing/index.php','existing file');
try {\BBL\Phase1\Route::install($tmp.'/backed-by-local');check(false,'Must refuse overwrite');}catch(RuntimeException $e){check(file_get_contents($tmp.'/backed-by-local/category/home-services/plumbing/index.php')==='existing file','Existing route file is never overwritten');}
try {\BBL\Phase1\Route::install($tmp);check(false,'Must refuse production root');}catch(RuntimeException $e){check(true,'Route installer refuses non-staging root');}
echo "\n$count tests passed. WordPress functions are doubles; live staging smoke evidence is separate.\n";
