<?php
/** Deterministic intent and evidence policy, adapted from recovered BBL MVP 0.3. */
namespace BBL\Phase1;

final class Engine {
    public static function intent(string $question, array $previous = []): array {
        $s = array_merge(['service'=>null,'city'=>null,'zip'=>null,'urgency'=>null,'fuel'=>null,'request'=>''], $previous);
        $q = strtolower($question);
        if (preg_match('/\b(start over|new request|reset)\b/', $q)) {
            return self::intent('');
        }
        // Explicit corrections override prior slots; never infer city from a metro-radius cluster.
        if (preg_match('/\b(?:not|outside) denver\b/', $q)) $s['city'] = null;
        elseif (preg_match('/\bdenver\b/', $q)) $s['city'] = 'denver-co';
        if (preg_match('/\b(aurora|parker|lakewood|lynnwood|seattle|boulder)\b/', $q, $m)) {
            $s['city'] = $m[1] . (in_array($m[1], ['lynnwood','seattle'], true) ? '-wa' : '-co');
            $s['zip'] = null;
        }
        if (preg_match('/\b(\d{5})\b/', $q, $m)) {
            $s['zip'] = $m[1];
            // Only recovered explicit mappings; other ZIPs require a city rather than guesses.
            $map = ['80202'=>'denver-co','80249'=>'denver-co','80013'=>'aurora-co','80134'=>'parker-co','98036'=>'lynnwood-wa'];
            if (isset($map[$m[1]])) $s['city'] = $map[$m[1]];
            elseif (!preg_match('/\bdenver\b/', $q)) $s['city'] = null;
        }
        if (preg_match('/\b(water\s*heater|hot water tank)\b/', $q)) $s['service'] = 'water-heater';
        elseif (preg_match('/\b(drain|sewer|toilet|plumb(?:er|ing)?)\b/', $q)) $s['service'] = 'plumbing';
        elseif (preg_match('/\b(electrician|electrical|roof(?:er|ing)?|dentist)\b/', $q)) $s['service'] = 'unsupported';
        if (preg_match('/\b(not urgent|no rush|next week|routine)\b/', $q)) $s['urgency'] = 'routine';
        elseif (preg_match('/\b(today|asap|urgent|emergency|now)\b/', $q)) $s['urgency'] = 'today-requested';
        if (preg_match('/\b(electric|gas|tankless)\b/', $q, $m)) $s['fuel'] = $m[1];
        if ($s['request'] === '' && trim($question) !== '') $s['request'] = $question;
        $s['category'] = in_array($s['service'], ['water-heater','plumbing'], true) ? 'plumbing' : null;
        return $s;
    }

    public static function result(array $intent, array $businesses, int $now): array {
        $out = ['status'=>'No Verified Match','intent'=>$intent,'verified'=>[],'possible'=>[], 'availability'=>'unverified'];
        if (!$intent['service'] || $intent['service'] === 'unsupported') {
            $out['status']='Needs Clarification'; $out['message']='I can help with the Denver Plumbing pilot. Is this a water heater, drain, sewer, or another plumbing issue?'; return $out;
        }
        if (!$intent['city']) {
            $out['status']='Needs Clarification'; $out['message']='Which city is the property in? I will keep the plumbing details you already shared.'; return $out;
        }
        foreach ($businesses as $b) {
            if (($b['post_status'] ?? '') !== 'publish' || !in_array($intent['city'], $b['cities'] ?? [], true) ||
                !in_array('plumbing', $b['categories'] ?? [], true)) continue;
            $e = $b['evidence'] ?? [];
            $checked = strtotime($e['checked_at'] ?? '') ?: 0;
            $expires = strtotime($e['expires_at'] ?? '') ?: 0;
            $valid = ($e['status'] ?? '') === 'verified' && $checked > 0 && $checked <= $now && $expires > $now &&
                $expires > $checked && !empty($e['reviewed_by']) &&
                preg_match('~^https://[^\s]+$~', $e['source_url'] ?? '') &&
                in_array($intent['city'], $e['cities'] ?? [], true) &&
                in_array($intent['service'], $e['services'] ?? [], true);
            // feat, sponsorship, trust scores and payment NEVER participate in selection/order.
            $item = ['id'=>(int)$b['id'], 'name'=>$b['name'], 'url'=>$b['url'], 'phone'=>$b['phone'] ?? '',
                'status'=>$valid ? 'Verified' : 'Possible'];
            if ($valid) $item['evidence_url'] = $e['source_url'];
            $out[$valid ? 'verified' : 'possible'][] = $item;
        }
        foreach (['verified','possible'] as $key) usort($out[$key], static function($a,$b) {
            return strcasecmp($a['name'],$b['name']) ?: $a['id'] <=> $b['id'];
        });
        if ($out['verified']) {
            $out['status']='Verified'; $out['message']='These businesses have reviewed evidence for this service and city. Contact them to confirm pricing and availability; I cannot promise service today.';
        } elseif ($out['possible']) {
            $out['status']='Possible'; $out['message']='I found possible records, but their evidence is incomplete or expired. I cannot recommend them as verified matches or confirm availability.';
        } else {
            $out['message']='I do not have a verified plumbing match for your request in ' . ucwords(str_replace('-', ' ', $intent['city'])) . '. I cannot confirm someone can help today. You can leave a request for BBL to review; this is not a booking.';
        }
        if (!$intent['urgency']) $out['follow_up']='How soon do you need help: today, or a routine appointment?';
        elseif ($intent['service']==='water-heater' && !$intent['fuel']) $out['follow_up']='Is the water heater gas, electric, or tankless, if you know?';
        return $out;
    }

    public static function isDemoRoute(string $uri, string $basePath, array $query): bool {
        $path = parse_url($uri, PHP_URL_PATH);
        $base = rtrim($basePath, '/');
        return $path === $base . '/category/home-services/plumbing/' ||
            ($path === $base . '/' && ($query['bbl_sammy'] ?? '') === '1');
    }
}
