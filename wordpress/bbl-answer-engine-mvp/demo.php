<?php if (!defined('ABSPATH')) exit; ?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Denver Plumbing · Ask Sammy · BBL Staging</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fahkwang:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="<?php echo esc_url(plugins_url('sammy.css',__FILE__)); ?>"></head>
<body><header><a href="<?php echo esc_url(home_url('/')); ?>">Backed by Local</a><span>Staging demonstration · synthetic test requests only</span></header>
<main><section id="sammy" class="soft"><div class="container"><div class="sammy-box"><div class="sammy-layout">
<div class="sammy-copy"><div class="kicker">Ask Sammy</div><h1>Denver Plumbing.<br>Let’s find your next step.</h1><p>Tell me what’s happening, where you need help, and how soon.</p><p>Recommendations depend on reviewed business evidence. Sponsored placements never affect your matches.</p><p class="note">This pilot does not book appointments or confirm prices or same-day availability.</p><a href="<?php echo esc_url(admin_url('tools.php?page=bbl-sammy')); ?>">Review saved test leads</a></div>
<div class="sammy-chat"><div class="chat-window" id="sammyOutput" role="log" aria-live="polite" aria-label="Conversation"><div class="chat-line sammy"><strong>Sammy:</strong> Hi — what plumbing help do you need, and in which city?</div></div>
<div class="try-buttons"><button type="button" id="example">Try: Leaking water heater in Denver</button><button type="button" id="reset">Start a new request</button></div>
<form id="askForm" class="chat-input"><label for="sammyInput">Your message</label><input id="sammyInput" maxlength="1000" required autocomplete="off" placeholder="Ask Sammy what you’re looking for..."><button class="btn" type="submit" id="sammyAsk">Ask Sammy</button></form>
<p id="requestError" role="alert"></p><section id="matchPanel" hidden><h2 id="matchStatus"></h2><p id="intentSummary"></p><ul id="matches"></ul></section>
</div></div></div></div></section>
<section id="leadPanel" hidden><h2>Ask BBL to review your request</h2><p>No appointment is booked. This staging form accepts synthetic test details only. Email delivery is unverified.</p>
<form id="leadForm"><label for="contactName">Test name</label><input id="contactName" required maxlength="100" autocomplete="off">
<label for="contactEmail">Test email</label><input id="contactEmail" type="email" required maxlength="254" autocomplete="off">
<label for="contactPhone">Test phone (optional)</label><input id="contactPhone" type="tel" maxlength="40" autocomplete="off">
<label for="provider">Provider</label><select id="provider"><option value="0">No provider selected — BBL review</option></select>
<label class="consent"><input id="consent" type="checkbox" required> <?php echo esc_html(BBL_Answer_Engine_MVP::CONSENT); ?></label>
<button class="btn" type="submit">Save test request</button></form><p id="leadReceipt" role="status" aria-live="polite"></p></section></main>
<footer>Backed by Local · Verified evidence before recommendations</footer>
<script id="bbl-config" type="application/json"><?php echo wp_json_encode($config,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT); ?></script>
<script src="<?php echo esc_url(plugins_url('sammy.js',__FILE__)); ?>"></script></body></html>
