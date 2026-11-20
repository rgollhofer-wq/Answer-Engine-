<?php
/**
 * Plugin Name: BBL Answer Engine MVP — Staging Phase 1
 * Description: Staging-only Sammy conversation, evidence matching and persistent lead review. Derived from BBL MVP 0.3.
 * Version: 0.4.2
 * Requires PHP: 7.4
 * Author: Backed by Local
 */
if (!defined('ABSPATH')) exit;
require_once __DIR__ . '/engine.php';
require_once __DIR__ . '/route.php';

final class BBL_Answer_Engine_MVP {
    const PREFIX = 'bbl_p1_lead_';
    const CONSENT = 'I agree that Backed by Local may store this request and contact me about it. This is not a booking or a promise of service.';

    public static function allowed_site(): bool {
        // Hard stop outside the named clone; a production activation must remain inert.
        return untrailingslashit(home_url()) === 'https://backedbylocal.com/backed-by-local' &&
            basename(untrailingslashit(wp_normalize_path(ABSPATH))) === 'backed-by-local';
    }
    public function __construct() {
        if (!self::allowed_site()) return;
        add_action('init', [$this,'register_dependencies'], 30);
        add_action('rest_api_init', [$this,'register_routes']);
        add_action('template_redirect', [$this,'demo'], 0);
        add_action('admin_menu', function() { add_management_page('BBL Sammy','BBL Sammy','manage_options','bbl-sammy',[$this,'admin']); });
    }
    public function register_dependencies(): void {
        // Reconstruct registrations from recovered CPT UI settings. Never rewrite existing registrations or terms.
        foreach (['business'=>'Businesses','cities'=>'My Cities'] as $type=>$label) {
            if (!post_type_exists($type)) register_post_type($type, ['label'=>$label,'public'=>true,'show_in_rest'=>true,
                'supports'=>['title','editor','thumbnail','custom-fields'],'has_archive'=>$type==='cities' ? 'cities' : false]);
        }
        foreach (['bbl_category'=>['business',true,'Categories'],'bbl_city'=>['business',false,'Cities'],
            'business_category'=>['cities',true,'Business Categories']] as $name=>$cfg) {
            if (!taxonomy_exists($name)) register_taxonomy($name, [$cfg[0]], ['label'=>$cfg[2], 'public'=>true,
                'hierarchical'=>$cfg[1],'show_in_rest'=>true,'rewrite'=>['slug'=>$name,'hierarchical'=>false]]);
        }
    }
    public function permission() {
        return self::allowed_site() && current_user_can('manage_options') ? true :
            new WP_Error('bbl_staging_access','Sign in as a staging administrator to test Sammy.', ['status'=>403]);
    }
    public function register_routes(): void {
        register_rest_route('bbl/v1','/answer',['methods'=>'POST','callback'=>[$this,'answer'],'permission_callback'=>[$this,'permission']]);
        register_rest_route('bbl/v1','/leads',['methods'=>'POST','callback'=>[$this,'lead'],'permission_callback'=>[$this,'permission']]);
    }
    private function error($code,$message,$status=400) { return new WP_Error($code,$message,['status'=>$status]); }
    private function text($v, $max=1000): string {
        return is_string($v) ? substr(sanitize_textarea_field($v),0,$max) : '';
    }
    private function session($token) {
        if (!is_string($token) || !preg_match('/^[a-f0-9]{48}$/',$token)) return false;
        $s=get_transient('bbl_p1_session_'.$token);
        return is_array($s) && $s['user']===get_current_user_id() ? $s : false;
    }
    public function businesses(): array {
        $query = new WP_Query(['post_type'=>'business','post_status'=>'publish','posts_per_page'=>-1,'no_found_rows'=>true]);
        $out=[];
        foreach ($query->posts as $post) {
            $city=wp_get_object_terms($post->ID,'bbl_city',['fields'=>'slugs']);
            $cat=wp_get_object_terms($post->ID,'bbl_category',['fields'=>'slugs']);
            $e=get_post_meta($post->ID,'_bbl_evidence',true);
            $out[]=['id'=>$post->ID,'post_status'=>$post->post_status,'name'=>get_the_title($post),'url'=>get_permalink($post),
                'cities'=>is_wp_error($city)?[]:$city,'categories'=>is_wp_error($cat)?[]:$cat,
                'phone'=>get_post_meta($post->ID,'phone_number',true) ?: get_post_meta($post->ID,'bbl_phone',true),
                'evidence'=>is_array($e)?$e:[]];
        }
        return $out;
    }
    public function answer(WP_REST_Request $request) {
        $p=$request->get_json_params(); if (!is_array($p)) return $this->error('body','A JSON object is required.');
        $q=$this->text($p['question']??''); if ($q==='') return $this->error('question','Please describe what you need.');
        $token=$p['conversation_id']??'';
        if ($token==='') { $token=bin2hex(random_bytes(24)); $s=['user'=>get_current_user_id(),'intent'=>[],'turns'=>[],'version'=>0]; }
        else { $s=$this->session($token); if (!$s) return $this->error('session','Conversation expired. Start a new request.',409); }
        if (count($s['turns'])>=30) return $this->error('turn_limit','Please start a new request.',429);
        $s['intent']=\BBL\Phase1\Engine::intent($q,$s['intent']);
        $s['turns'][]=$q; $s['version']++;
        $result=\BBL\Phase1\Engine::result($s['intent'],$this->businesses(),time());
        if (!set_transient('bbl_p1_session_'.$token,$s,DAY_IN_SECONDS)) return $this->error('storage','Could not save the conversation. Please retry.',503);
        $result['conversation_id']=$token; $result['version']=$s['version'];
        $result['answer_html']='<p>'.esc_html($result['message']).'</p>'; // MVP compatibility; safe text only.
        $result['raw_results']=$result['verified'];
        return new WP_REST_Response($result,200);
    }
    public function lead(WP_REST_Request $request) {
        $p=$request->get_json_params(); if (!is_array($p)) return $this->error('body','A JSON object is required.');
        $s=$this->session($p['conversation_id']??null); if (!$s) return $this->error('session','Start a conversation first.',409);
        if (($p['version']??null)!==$s['version']) return $this->error('stale','The conversation changed. Review the latest answer first.',409);
        if (($p['consent']??false)!==true) return $this->error('consent','Consent is required.');
        $name=$this->text($p['name']??'',100); $email=$this->text($p['email']??'',254); $phone=$this->text($p['phone']??'',40);
        if (!$name || !is_email($email)) return $this->error('contact','Enter a name and valid email address.');
        if ($phone && !preg_match('/^[+()0-9 .-]{7,40}$/',$phone)) return $this->error('phone','Check the phone number.');
        $result=\BBL\Phase1\Engine::result($s['intent'],$this->businesses(),time());
        if ($result['status']==='Needs Clarification') return $this->error('clarify','Please clarify the service and city before leaving a request.');
        $provider=(int)($p['provider_id']??0);
        $verified=array_column($result['verified'],'id');
        if ($provider && !in_array($provider,$verified,true)) return $this->error('provider','That provider is not a verified match.');
        $id=substr(hash('sha256',$p['conversation_id'].':'.$s['version']),0,24);
        $key=self::PREFIX.$id;
        $existing=get_option($key);
        if ($existing) return $this->receipt($existing);
        $record=['id'=>$id,'created_at'=>gmdate('c'),'contact'=>['name'=>$name,'email'=>$email,'phone'=>$phone],
            'request'=>$s['intent']['request'],'conversation'=>$s['turns'],'intent'=>$s['intent'],'provider_id'=>$provider?:null,
            'match_status'=>$result['status'],'consent'=>['accepted'=>true,'text'=>self::CONSENT,'version'=>'1','at'=>gmdate('c')],
            'source'=>'sammy-denver-plumbing-staging','test_lead'=>true,'owner'=>get_current_user_id(),
            'notification_to'=>'info@backedbylocal.com',
            'delivery_status'=>defined('BBL_STAGING_ENABLE_EMAIL') && BBL_STAGING_ENABLE_EMAIL === true ? 'pending' : 'disabled',
            'delivery_verified'=>false];
        // Entire lead is durable before notification. Unique option name makes retries idempotent.
        if (!add_option($key,$record,'',false)) {
            $existing=get_option($key); return $existing ? $this->receipt($existing) : $this->error('storage','Request was not saved. Please retry.',503);
        }
        // Recovery/integration must never send mail by default. Enabling this requires
        // a separately reviewed staging deployment and explicit notification approval.
        if (!defined('BBL_STAGING_ENABLE_EMAIL') || BBL_STAGING_ENABLE_EMAIL !== true) {
            return $this->receipt($record);
        }
        try {
            $accepted=wp_mail('info@backedbylocal.com','[BBL STAGING TEST] Lead '.$id,
                "Synthetic staging test request saved. Lead ID: $id\nReview in staging Tools > BBL Sammy.\nThis is not customer demand or a booking.");
            $record['delivery_status']=$accepted?'accepted_unverified':'failed';
        } catch (\Throwable $e) { $record['delivery_status']='failed'; }
        $record['notification_attempted_at']=gmdate('c');
        if (!update_option($key,$record,false)) {
            // Preserve the durable pending state if status persistence fails; never claim delivered.
            return $this->receipt(get_option($key));
        }
        return $this->receipt($record);
    }
    private function receipt(array $r) {
        return new WP_REST_Response(['id'=>$r['id'],'persisted'=>true,'delivery_status'=>$r['delivery_status'],
            'delivery_verified'=>false,'message'=>$r['delivery_status']==='disabled'
                ? 'Your staging test request is saved. Email notifications are disabled. This is not a booking.'
                : 'Your staging test request is saved. Email delivery is unverified. This is not a booking.'],200);
    }
    public function demo(): void {
        $base=wp_parse_url(home_url('/'),PHP_URL_PATH);
        if (!\BBL\Phase1\Engine::isDemoRoute($_SERVER['REQUEST_URI']??'', $base, $_GET)) return;
        if (!current_user_can('manage_options')) { auth_redirect(); exit; }
        status_header(200); nocache_headers(); header('X-Robots-Tag: noindex, nofollow');
        $config=['answer'=>rest_url('bbl/v1/answer'),'leads'=>rest_url('bbl/v1/leads'),'nonce'=>wp_create_nonce('wp_rest')];
        include __DIR__.'/demo.php'; exit;
    }
    public function admin(): void {
        if (!current_user_can('manage_options')) return;
        global $wpdb;
        echo '<div class="wrap"><h1>BBL Sammy — staging test leads</h1><p><a href="'.esc_url(home_url('/?bbl_sammy=1')).'">Open Sammy demonstration</a> · <a href="'.esc_url(home_url('/category/home-services/plumbing/')).'">Denver Plumbing route</a></p>';
        if (isset($_POST['bbl_install_route']) && self::allowed_site()) {
            check_admin_referer('bbl_install_route');
            try { $route=\BBL\Phase1\Route::install(ABSPATH); echo '<p>Staging plumbing entry: '.esc_html($route['status']).' — SHA256 '.esc_html($route['sha256']).'</p>'; }
            catch (\Throwable $e) { echo '<p>Route unchanged or incomplete: '.esc_html($e->getMessage()).'</p>'; }
        }
        echo '<details><summary>Reviewed staging route installation</summary><p>Creates only category/home-services/plumbing/index.php beneath this clone. Loads the clone index.php. Existing files and symlinks are refused. No global permalink, taxonomy, or production changes.</p><form method="post">';
        wp_nonce_field('bbl_install_route');
        echo '<button class="button" name="bbl_install_route" value="1">Install scoped staging plumbing entry</button></form></details>';
        echo '<p>All records are staging tests. Delivery is unverified until independently confirmed. No customer demand is inferred.</p>';
        $names=$wpdb->get_col($wpdb->prepare("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s ORDER BY option_id DESC LIMIT 50",$wpdb->esc_like(self::PREFIX).'%'));
        foreach ($names as $key) {
            $r=get_option($key); echo '<details><summary>'.esc_html($r['id'].' | '.$r['match_status'].' | '.$r['delivery_status'].' | '.$r['created_at']).'</summary><pre>'.esc_html(wp_json_encode($r,JSON_PRETTY_PRINT)).'</pre></details>';
        }
        echo '<h2>Dependency review</h2><p>WordPress core only; no external AI key required for this deterministic pilot. Missing registrations are added in memory; existing registrations and taxonomy terms are untouched. Leads use non-autoloaded namespaced options; conversations expire after 24 hours. No schema migration.</p></div>';
    }
}
new BBL_Answer_Engine_MVP();
