"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import mesaLogo from "@/image/MESA.svg"

const css = `
.mesa-landing{
  --orange:#F2701E; --orange-d:#D85B12; --orange-soft:#FDEFE4;
  --ink:#0F2740; --ink-2:#1B3A5B;
  --text:#1A1512; --muted:#6C6A66;
  --bg:#FFFFFF; --panel:#F7F5F2; --line:#E9E5DF; --line-2:#DED9D1;
  --r:16px; --r-lg:24px;
  --shadow:0 1px 2px rgba(16,39,64,.04), 0 12px 32px -12px rgba(16,39,64,.12);
  --shadow-lg:0 2px 6px rgba(16,39,64,.05), 0 40px 80px -24px rgba(16,39,64,.22);
  --maxw:1200px;
  --sans:var(--font-manrope),"Manrope",system-ui,sans-serif;
  --disp:var(--font-grotesk),"Space Grotesk","Manrope",sans-serif;
  font-family:var(--sans);color:var(--text);background:var(--bg);
  -webkit-font-smoothing:antialiased;line-height:1.5;width:100%;
}
.mesa-landing *{box-sizing:border-box}
.mesa-landing h1,.mesa-landing h2,.mesa-landing h3,.mesa-landing h4{font-family:var(--disp);margin:0;line-height:1.05;letter-spacing:-.02em;font-weight:700}
.mesa-landing p{margin:0}
.mesa-landing a{color:inherit;text-decoration:none}
.mesa-landing img{display:block;max-width:100%}
.mesa-landing .wrap{max-width:var(--maxw);margin:0 auto;padding:0 28px}
.mesa-landing .eyebrow{font-family:var(--sans);font-weight:700;font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--orange)}
.mesa-landing .btn{display:inline-flex;align-items:center;gap:9px;font-family:var(--sans);font-weight:700;font-size:15px;padding:13px 20px;border-radius:999px;border:1px solid transparent;cursor:pointer;transition:.18s ease;white-space:nowrap}
.mesa-landing .btn svg{width:17px;height:17px}
.mesa-landing .btn-primary{background:var(--orange);color:#fff}
.mesa-landing .btn-primary:hover{background:var(--orange-d);transform:translateY(-1px);box-shadow:0 10px 22px -8px rgba(242,112,30,.6)}
.mesa-landing .btn-ghost{background:transparent;color:var(--ink);border-color:var(--line-2)}
.mesa-landing .btn-ghost:hover{border-color:var(--ink);background:#fff}
.mesa-landing .btn-dark{background:var(--ink);color:#fff}
.mesa-landing .btn-dark:hover{background:var(--ink-2);transform:translateY(-1px)}

.mesa-landing header.nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.82);backdrop-filter:blur(14px);border-bottom:1px solid transparent;transition:border-color .2s,box-shadow .2s}
.mesa-landing header.nav.scrolled{border-color:var(--line);box-shadow:0 6px 24px -18px rgba(16,39,64,.4)}
.mesa-landing .nav-in{display:flex;align-items:center;justify-content:space-between;height:72px}
.mesa-landing .brand{display:flex;align-items:center;gap:10px}
.mesa-landing .brand img{height:34px}
.mesa-landing .nav-links{display:flex;align-items:center;gap:6px}
.mesa-landing .nav-links a{font-weight:600;font-size:15px;color:#3a3733;padding:9px 14px;border-radius:10px;transition:.15s}
.mesa-landing .nav-links a:hover{background:var(--panel);color:var(--text)}
.mesa-landing .nav-cta{display:flex;align-items:center;gap:10px}
.mesa-landing .nav-toggle{display:none;background:none;border:1px solid var(--line-2);border-radius:10px;width:42px;height:42px;cursor:pointer;align-items:center;justify-content:center}
.mesa-landing .nav-toggle svg{width:20px;height:20px}

.mesa-landing .hero{position:relative;overflow:hidden;padding:74px 0 40px}
.mesa-landing .hero::before{content:"";position:absolute;inset:0;background:
  radial-gradient(680px 420px at 88% -8%, rgba(242,112,30,.10), transparent 60%),
  radial-gradient(620px 500px at 8% 110%, rgba(15,39,64,.05), transparent 60%);pointer-events:none}
.mesa-landing .hero-grid{display:grid;grid-template-columns:1.02fr .98fr;gap:54px;align-items:center;position:relative}
.mesa-landing .badge{display:inline-flex;align-items:center;gap:9px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 14px 7px 8px;font-weight:600;font-size:13.5px;color:#4a4742;box-shadow:var(--shadow)}
.mesa-landing .badge .dot{display:inline-flex;align-items:center;gap:6px;background:var(--orange-soft);color:var(--orange-d);font-weight:700;font-size:11px;letter-spacing:.04em;padding:4px 9px;border-radius:999px}
.mesa-landing h1.hero-title{font-size:clamp(38px,5.2vw,62px);margin:22px 0 0;letter-spacing:-.03em}
.mesa-landing h1.hero-title .hl{color:var(--orange)}
.mesa-landing .hero p.lead{font-size:19px;color:var(--muted);max-width:30em;margin:20px 0 0;line-height:1.55}
.mesa-landing .hero-cta{display:flex;gap:12px;margin-top:30px;flex-wrap:wrap}
.mesa-landing .hero-meta{display:flex;gap:26px;margin-top:30px;flex-wrap:wrap}
.mesa-landing .hero-meta .m{display:flex;flex-direction:column;gap:2px}
.mesa-landing .hero-meta .m b{font-family:var(--disp);font-size:22px}
.mesa-landing .hero-meta .m span{font-size:13px;color:var(--muted)}

.mesa-landing .mock{background:#0F2740;border-radius:26px;padding:14px;box-shadow:var(--shadow-lg);position:relative}
.mesa-landing .mock .screen{background:#fff;border-radius:16px;overflow:hidden}
.mesa-landing .mock-top{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line)}
.mesa-landing .mock-top .t{font-family:var(--disp);font-weight:700;font-size:14px}
.mesa-landing .mock-dots{display:flex;gap:6px}
.mesa-landing .mock-dots i{width:9px;height:9px;border-radius:50%;background:var(--line-2)}
.mesa-landing .mock-body{padding:16px}
.mesa-landing .stat-row{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:10px}
.mesa-landing .stat{border:1px solid var(--line);border-radius:14px;padding:13px 14px}
.mesa-landing .stat .lbl{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
.mesa-landing .stat .big{font-family:var(--disp);font-size:26px;font-weight:700;margin-top:6px}
.mesa-landing .stat.accent{background:var(--orange);border-color:var(--orange)}
.mesa-landing .stat.accent .lbl,.mesa-landing .stat.accent .big,.mesa-landing .stat.accent small{color:#fff}
.mesa-landing .stat small{font-size:11px;color:var(--muted)}
.mesa-landing .orders{margin-top:14px;display:flex;flex-direction:column;gap:8px}
.mesa-landing .orders .head{display:flex;justify-content:space-between;align-items:center;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:2px}
.mesa-landing .orders .head a{color:var(--orange);text-transform:none;letter-spacing:0;font-size:11px}
.mesa-landing .order{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:12px;padding:11px 13px;transition:.15s}
.mesa-landing .order:hover{border-color:var(--orange);box-shadow:0 8px 20px -14px rgba(242,112,30,.6)}
.mesa-landing .order .who b{font-size:14px;font-family:var(--disp)}
.mesa-landing .order .who span{display:block;font-size:11.5px;color:var(--muted);margin-top:1px}
.mesa-landing .pill{font-size:11px;font-weight:700;padding:5px 10px;border-radius:999px}
.mesa-landing .pill.new{background:var(--orange-soft);color:var(--orange-d)}
.mesa-landing .pill.prep{background:#0F2740;color:#fff}
.mesa-landing .pill.done{background:#E7F4EC;color:#1E7A48}
.mesa-landing .qr-float{position:absolute;right:-16px;bottom:24px;background:#fff;border-radius:16px;padding:12px;box-shadow:var(--shadow-lg);display:flex;align-items:center;gap:11px;border:1px solid var(--line)}
.mesa-landing .qr-float .qr{width:46px;height:46px;border-radius:8px;background:
  repeating-linear-gradient(0deg,#0F2740 0 4px,#fff 4px 8px),
  repeating-linear-gradient(90deg,#0F2740 0 4px,transparent 4px 8px);background-blend-mode:multiply;border:2px solid #0F2740}
.mesa-landing .qr-float .txt b{font-size:13px;font-family:var(--disp);display:block}
.mesa-landing .qr-float .txt span{font-size:11px;color:var(--muted)}

.mesa-landing section.sec{padding:92px 0}
.mesa-landing .sec-head{max-width:640px}
.mesa-landing .sec-head h2{font-size:clamp(28px,3.6vw,42px);margin-top:14px}
.mesa-landing .sec-head p{color:var(--muted);font-size:18px;margin-top:14px;line-height:1.55}
.mesa-landing .center{margin-left:auto;margin-right:auto;text-align:center}

.mesa-landing .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:44px}
.mesa-landing .card{background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:26px;transition:.2s;position:relative;overflow:hidden}
.mesa-landing .card:hover{transform:translateY(-4px);box-shadow:var(--shadow);border-color:var(--line-2)}
.mesa-landing .card .ic{width:46px;height:46px;border-radius:13px;background:var(--orange-soft);color:var(--orange-d);display:flex;align-items:center;justify-content:center;margin-bottom:18px}
.mesa-landing .card .ic svg{width:23px;height:23px}
.mesa-landing .card h3{font-size:20px}
.mesa-landing .card p{color:var(--muted);font-size:15px;margin-top:9px;line-height:1.55}

.mesa-landing .ai{margin-top:24px;background:linear-gradient(135deg,#0F2740,#16395B);border-radius:32px;color:#fff;padding:48px;display:grid;grid-template-columns:1fr 1fr;gap:44px;align-items:center;overflow:hidden;position:relative}
.mesa-landing .ai::after{content:"";position:absolute;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(242,112,30,.4),transparent 70%);top:-120px;right:-80px}
.mesa-landing .ai .tag{display:inline-flex;align-items:center;gap:8px;background:rgba(242,112,30,.18);color:#FFC79A;border:1px solid rgba(242,112,30,.35);font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;padding:6px 12px;border-radius:999px}
.mesa-landing .ai h2{font-size:clamp(26px,3vw,38px);margin-top:18px;color:#fff}
.mesa-landing .ai p{color:#B9C6D6;font-size:17px;margin-top:14px;line-height:1.6}
.mesa-landing .ai ol{margin:22px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px}
.mesa-landing .ai ol li{display:flex;gap:13px;align-items:flex-start;font-size:15px;color:#DCE4EE}
.mesa-landing .ai ol li .n{flex:none;width:26px;height:26px;border-radius:50%;background:var(--orange);color:#fff;font-family:var(--disp);font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center}
.mesa-landing .ai-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:20px;position:relative;z-index:1;backdrop-filter:blur(6px)}
.mesa-landing .ai-card .file{display:flex;align-items:center;gap:12px;padding:13px;background:rgba(255,255,255,.06);border-radius:12px;border:1px solid rgba(255,255,255,.1)}
.mesa-landing .ai-card .file .fi{width:38px;height:38px;border-radius:9px;background:var(--orange);display:flex;align-items:center;justify-content:center}
.mesa-landing .ai-card .file b{font-size:14px}.mesa-landing .ai-card .file span{font-size:12px;color:#9fb0c4}
.mesa-landing .ai-card .bar{height:6px;border-radius:99px;background:rgba(255,255,255,.12);margin-top:14px;overflow:hidden}
.mesa-landing .ai-card .bar i{display:block;height:100%;width:78%;background:var(--orange);border-radius:99px}
.mesa-landing .detect{margin-top:16px;display:flex;flex-direction:column;gap:9px}
.mesa-landing .detect .it{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:11px;padding:11px 13px}
.mesa-landing .detect .it b{font-size:13.5px}.mesa-landing .detect .it span{font-size:13px;color:#9fb0c4}
.mesa-landing .detect .it .conf{font-size:11px;font-weight:700;color:#86E0A8;background:rgba(46,160,90,.18);padding:3px 8px;border-radius:99px}
.mesa-landing .detect .it .conf.warn{color:#FFC79A;background:rgba(242,112,30,.18)}

.mesa-landing .views{margin-top:44px}
.mesa-landing .tabbar{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.mesa-landing .tab{font-family:var(--sans);font-weight:700;font-size:15px;padding:11px 20px;border-radius:999px;border:1px solid var(--line-2);background:#fff;color:#4a4742;cursor:pointer;transition:.16s}
.mesa-landing .tab:hover{border-color:var(--ink)}
.mesa-landing .tab.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.mesa-landing .tab-panels{margin-top:28px}
.mesa-landing .panel{display:none;grid-template-columns:1fr 1fr;gap:40px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:28px;padding:40px}
.mesa-landing .panel.active{display:grid;animation:mesaFade .35s ease}
@keyframes mesaFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.mesa-landing .panel .pi{font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--orange)}
.mesa-landing .panel h3{font-size:28px;margin-top:12px}
.mesa-landing .panel p{color:var(--muted);font-size:16px;margin-top:12px;line-height:1.6}
.mesa-landing .panel ul{margin:18px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}
.mesa-landing .panel ul li{display:flex;gap:11px;font-size:15px;color:#3a3733;align-items:flex-start}
.mesa-landing .panel ul li svg{width:19px;height:19px;color:var(--orange);flex:none;margin-top:1px}
.mesa-landing .panel .visual{background:#fff;border:1px solid var(--line);border-radius:18px;min-height:280px;padding:18px;box-shadow:var(--shadow)}

.mesa-landing .kit-row{display:flex;gap:10px;flex-wrap:wrap}
.mesa-landing .kit-card{flex:1 1 120px;border:1px solid var(--line);border-radius:12px;padding:12px}
.mesa-landing .kit-card .ph{height:54px;border-radius:8px;background:repeating-linear-gradient(45deg,#F0ECE5 0 8px,#F7F5F2 8px 16px);margin-bottom:9px}
.mesa-landing .kit-card b{font-size:13px;font-family:var(--disp)}
.mesa-landing .kit-card span{font-size:12px;color:var(--muted)}
.mesa-landing .kds{display:flex;flex-direction:column;gap:9px}
.mesa-landing .kds .k{border-radius:11px;padding:12px;color:#fff}
.mesa-landing .kds .k.dark{background:#13202b}
.mesa-landing .kds .k.dark.b{background:#1b2c3a}
.mesa-landing .kds .k .kh{display:flex;justify-content:space-between;font-size:12px;opacity:.7}
.mesa-landing .kds .k .km{font-family:var(--disp);font-weight:700;font-size:16px;margin-top:3px}
.mesa-landing .kds .k .ki{font-size:12.5px;opacity:.85;margin-top:4px}

.mesa-landing .plans{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:46px;align-items:stretch}
.mesa-landing .plan{display:flex;flex-direction:column;background:#fff;border:1px solid var(--line);border-radius:22px;padding:26px;transition:.2s;position:relative}
.mesa-landing .plan:hover{transform:translateY(-4px);box-shadow:var(--shadow)}
.mesa-landing .plan.feat{border-color:var(--orange);box-shadow:0 0 0 1px var(--orange),var(--shadow)}
.mesa-landing .plan .ribbon{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--orange);color:#fff;font-size:11px;font-weight:700;letter-spacing:.04em;padding:5px 13px;border-radius:999px;white-space:nowrap}
.mesa-landing .plan .pn{font-family:var(--disp);font-weight:700;font-size:19px}
.mesa-landing .plan .range{font-size:13px;color:var(--muted);margin-top:3px}
.mesa-landing .plan .price{font-family:var(--disp);font-weight:700;font-size:30px;margin-top:18px;letter-spacing:-.02em}
.mesa-landing .plan .price small{display:block;font-family:var(--sans);font-weight:600;font-size:12px;color:var(--muted);letter-spacing:0;margin-top:3px}
.mesa-landing .plan .sup{margin-top:14px;padding:12px;background:var(--panel);border-radius:12px;border:1px solid var(--line)}
.mesa-landing .plan .sup b{font-size:14px;font-family:var(--disp)}
.mesa-landing .plan .sup span{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}
.mesa-landing .plan .feats{margin:18px 0 22px;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px;flex:1}
.mesa-landing .plan .feats li{display:flex;gap:9px;font-size:13.5px;color:#3a3733;align-items:flex-start}
.mesa-landing .plan .feats li svg{width:16px;height:16px;color:var(--orange);flex:none;margin-top:2px}
.mesa-landing .plan .btn{width:100%;justify-content:center}
.mesa-landing .plan-note{text-align:center;color:var(--muted);font-size:13.5px;margin-top:22px}

.mesa-landing .help-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;margin-top:46px;align-items:start}
.mesa-landing .faq .q{border-bottom:1px solid var(--line)}
.mesa-landing .faq .q button{width:100%;display:flex;justify-content:space-between;align-items:center;gap:18px;background:none;border:none;padding:20px 2px;text-align:left;cursor:pointer;font-family:var(--disp);font-weight:600;font-size:18px;color:var(--text)}
.mesa-landing .faq .q button:hover{color:var(--orange)}
.mesa-landing .faq .q .chev{flex:none;width:26px;height:26px;border-radius:50%;border:1px solid var(--line-2);display:flex;align-items:center;justify-content:center;transition:.25s}
.mesa-landing .faq .q .chev svg{width:15px;height:15px;transition:.25s}
.mesa-landing .faq .q.open .chev{background:var(--orange);border-color:var(--orange);color:#fff}
.mesa-landing .faq .q.open .chev svg{transform:rotate(45deg)}
.mesa-landing .faq .a{max-height:0;overflow:hidden;transition:max-height .3s ease}
.mesa-landing .faq .a p{padding:0 2px 22px;color:var(--muted);font-size:15.5px;line-height:1.6;max-width:46em}
.mesa-landing .guide{background:var(--panel);border:1px solid var(--line);border-radius:24px;padding:28px}
.mesa-landing .guide h3{font-size:21px}
.mesa-landing .guide p.s{color:var(--muted);font-size:14.5px;margin-top:8px}
.mesa-landing .steps{margin:22px 0 0;padding:0;list-style:none;display:flex;flex-direction:column}
.mesa-landing .steps li{display:flex;gap:15px;padding:15px 0;border-top:1px dashed var(--line-2)}
.mesa-landing .steps li:first-child{border-top:none;padding-top:6px}
.mesa-landing .steps li .sn{flex:none;width:32px;height:32px;border-radius:10px;background:#fff;border:1px solid var(--line);font-family:var(--disp);font-weight:700;color:var(--orange);display:flex;align-items:center;justify-content:center;font-size:15px}
.mesa-landing .steps li b{font-size:15px;font-family:var(--disp);display:block}
.mesa-landing .steps li span{font-size:13.5px;color:var(--muted);display:block;margin-top:2px;line-height:1.5}

.mesa-landing .cta-band{background:var(--ink);border-radius:32px;padding:56px;text-align:center;color:#fff;position:relative;overflow:hidden}
.mesa-landing .cta-band::before{content:"";position:absolute;inset:0;background:radial-gradient(500px 280px at 50% -20%,rgba(242,112,30,.3),transparent 60%)}
.mesa-landing .cta-band h2{font-size:clamp(28px,3.4vw,40px);position:relative}
.mesa-landing .cta-band p{color:#B9C6D6;font-size:18px;margin:16px auto 0;max-width:34em;position:relative}
.mesa-landing .cta-band .hero-cta{justify-content:center;position:relative}

.mesa-landing footer.foot-wrap{border-top:1px solid var(--line);padding:56px 0 38px;margin-top:92px}
.mesa-landing .foot{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:30px}
.mesa-landing .foot .brand img{height:32px}
.mesa-landing .foot p.fd{color:var(--muted);font-size:14px;margin-top:14px;max-width:24em;line-height:1.6}
.mesa-landing .foot h5{font-family:var(--disp);font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#3a3733;margin-bottom:14px}
.mesa-landing .foot a{display:block;color:var(--muted);font-size:14.5px;padding:6px 0;transition:.15s;cursor:pointer}
.mesa-landing .foot a:hover{color:var(--orange)}
.mesa-landing .foot-bot{display:flex;justify-content:space-between;align-items:center;margin-top:40px;padding-top:24px;border-top:1px solid var(--line);color:var(--muted);font-size:13.5px;flex-wrap:wrap;gap:12px}

.mesa-landing .reveal{opacity:0;transform:translateY(22px);transition:opacity .6s ease,transform .6s ease}
.mesa-landing .reveal.in{opacity:1;transform:none}

.mesa-modal-bg{position:fixed;inset:0;background:rgba(15,39,64,.5);backdrop-filter:blur(4px);z-index:100;display:none;align-items:center;justify-content:center;padding:24px;
  --orange:#F2701E; --orange-d:#D85B12; --orange-soft:#FDEFE4; --ink:#0F2740;
  --text:#1A1512; --muted:#6C6A66; --bg:#FFFFFF; --panel:#F7F5F2; --line:#E9E5DF; --line-2:#DED9D1;
  --shadow-lg:0 2px 6px rgba(16,39,64,.05), 0 40px 80px -24px rgba(16,39,64,.22);
  --sans:var(--font-manrope),"Manrope",system-ui,sans-serif;
  --disp:var(--font-grotesk),"Space Grotesk","Manrope",sans-serif;
  font-family:var(--sans)}
.mesa-modal-bg.open{display:flex;animation:mesaFade .25s}
.mesa-modal-bg h3{font-family:var(--disp);font-weight:700;letter-spacing:-.02em;margin:0}
.mesa-modal-bg .modal{background:#fff;border-radius:24px;max-width:480px;width:100%;padding:34px;box-shadow:var(--shadow-lg);position:relative;color:var(--text)}
.mesa-modal-bg .modal h3{font-size:25px}
.mesa-modal-bg .modal p.s{color:var(--muted);margin-top:8px;font-size:15px}
.mesa-modal-bg .modal .close{position:absolute;top:16px;right:16px;width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.mesa-modal-bg .modal .close:hover{background:var(--panel)}
.mesa-modal-bg .field{margin-top:16px}
.mesa-modal-bg .field label{font-size:13px;font-weight:700;display:block;margin-bottom:6px}
.mesa-modal-bg .field input,.mesa-modal-bg .field select,.mesa-modal-bg .field textarea{width:100%;border:1px solid var(--line-2);border-radius:12px;padding:12px 14px;font-family:var(--sans);font-size:15px;background:var(--bg);transition:.15s}
.mesa-modal-bg .field input:focus,.mesa-modal-bg .field select:focus,.mesa-modal-bg .field textarea:focus{outline:none;border-color:var(--orange);box-shadow:0 0 0 3px var(--orange-soft)}
.mesa-modal-bg .btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;font-family:var(--sans);font-weight:700;font-size:15px;padding:13px 20px;border-radius:999px;border:1px solid transparent;cursor:pointer;transition:.18s ease;background:var(--orange);color:#fff;width:100%;margin-top:20px}
.mesa-modal-bg .btn:hover{background:var(--orange-d)}
.mesa-modal-bg .ok{text-align:center;padding:14px 0}
.mesa-modal-bg .ok .ico{width:64px;height:64px;border-radius:50%;background:var(--orange-soft);color:var(--orange-d);display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
.mesa-modal-bg .ok .ico svg{width:32px;height:32px}

@media(max-width:920px){
  .mesa-landing .hero-grid{grid-template-columns:1fr;gap:38px}
  .mesa-landing .ai{grid-template-columns:1fr;padding:34px}
  .mesa-landing .panel{grid-template-columns:1fr;padding:28px}
  .mesa-landing .cards{grid-template-columns:1fr 1fr}
  .mesa-landing .plans{grid-template-columns:1fr 1fr}
  .mesa-landing .help-grid{grid-template-columns:1fr;gap:34px}
  .mesa-landing .foot{grid-template-columns:1fr 1fr}
}
@media(max-width:680px){
  .mesa-landing .nav-links,.mesa-landing .nav-cta .btn-ghost{display:none}
  .mesa-landing .nav-toggle{display:flex}
  .mesa-landing .nav-links.mobile-open{display:flex;position:absolute;top:72px;left:0;right:0;flex-direction:column;background:#fff;border-bottom:1px solid var(--line);padding:14px 20px;gap:4px}
  .mesa-landing .nav-links.mobile-open a{padding:13px}
  .mesa-landing .cards,.mesa-landing .plans,.mesa-landing .foot{grid-template-columns:1fr}
  .mesa-landing .hero{padding:48px 0 30px}
  .mesa-landing section.sec{padding:64px 0}
  .mesa-landing .qr-float{display:none}
  .mesa-landing .cta-band,.mesa-landing .ai{padding:32px 24px}
}
`

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg>
)

const tabs = [
  { id: "cliente", label: "Cliente" },
  { id: "cocina", label: "Cocina" },
  { id: "mesero", label: "Mesero" },
  { id: "admin", label: "Admin" },
]

const faqs = [
  {
    q: "¿Necesito instalar una app?",
    a: "No. MESA es una web app: tus clientes escanean el QR con la cámara y el menú abre directo en el navegador. Tú gestionas todo desde el panel, también en el navegador.",
  },
  {
    q: "¿Qué pasa si se cae el internet?",
    a: "El sistema es offline-first: el menú sigue visible desde el cache local y los pedidos se encolan para sincronizarse automáticamente cuando vuelve la conexión. Funciona incluso con WiFi malo.",
  },
  {
    q: "¿Puedo subir mi menú actual en PDF?",
    a: "Sí, es nuestra feature estrella. Subes tu PDF, la IA extrae productos, precios y categorías, y tú revisas y apruebas antes de publicar. La IA propone, el humano aprueba.",
  },
  {
    q: "¿Cuánto tarda la configuración?",
    a: "El onboarding es autónomo: un dueño sin conocimientos técnicos puede dejar todo configurado en unos 20 minutos, sin llamar a soporte.",
  },
  {
    q: "¿Funciona con impresora de cocina o pantalla?",
    a: "Con ambos. Puedes recibir los pedidos en una pantalla de cocina en tiempo real o como impresión de boleta. Si la máquina falla, el mesero puede activar el envío manual como respaldo.",
  },
  {
    q: "¿Sirve para varias sucursales?",
    a: "Sí. Para más de 100 mesas o varias sucursales tenemos el plan Personalizado, con reportes consolidados e integraciones a medida.",
  },
]

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("cliente")
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSent, setModalSent] = useState(false)

  const openModal = () => {
    setModalSent(false)
    setModalOpen(true)
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    const els = document.querySelectorAll(".mesa-landing .reveal")
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in")
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.12 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="mesa-landing">
        <header className={`nav${scrolled ? " scrolled" : ""}`} id="nav">
          <div className="wrap nav-in">
            <a href="#top" className="brand" aria-label="MESA inicio">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mesaLogo.src} alt="MESA" />
            </a>
            <nav className={`nav-links${navOpen ? " mobile-open" : ""}`} id="navlinks">
              <a href="#funcionalidades" onClick={() => setNavOpen(false)}>Funcionalidades</a>
              <a href="#planes" onClick={() => setNavOpen(false)}>Planes</a>
              <a href="#ayuda" onClick={() => setNavOpen(false)}>Ayuda</a>
            </nav>
            <div className="nav-cta">
              <Link href="/login" className="btn btn-ghost">Iniciar sesión</Link>
              <button className="btn btn-primary" onClick={openModal}>Contacta a un ejecutivo</button>
              <button className="nav-toggle" aria-label="Menú" onClick={() => setNavOpen((v) => !v)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
              </button>
            </div>
          </div>
        </header>

        <a id="top" />
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="badge"><span className="dot">PWA</span> Pedidos por QR para restaurantes y cafeterías</span>
              <h1 className="hero-title">Menos caos en el local. <span className="hl">Más mesas atendidas.</span></h1>
              <p className="lead">MESA digitaliza el pedido completo: tus clientes escanean el QR de su mesa, piden desde el navegador y todo llega en tiempo real a cocina. Sin pedidos perdidos, sin errores, sin contratar más personal.</p>
              <div className="hero-cta">
                <button className="btn btn-primary" onClick={openModal}>Contacta a un ejecutivo
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
                <a href="#funcionalidades" className="btn btn-ghost">Ver funcionalidades</a>
              </div>
              <div className="hero-meta">
                <div className="m"><b>&lt;2s</b><span>Carga del menú en 4G</span></div>
                <div className="m"><b>20 min</b><span>Configuración autónoma</span></div>
                <div className="m"><b>Offline</b><span>El menú nunca se cae</span></div>
              </div>
            </div>
            <div className="mock" aria-hidden="true">
              <div className="screen">
                <div className="mock-top">
                  <div className="t">Panel · Hoy</div>
                  <div className="mock-dots"><i /><i /><i /></div>
                </div>
                <div className="mock-body">
                  <div className="stat-row">
                    <div className="stat"><div className="lbl">Ventas del día</div><div className="big">$428.000</div><small>24 pedidos cerrados</small></div>
                    <div className="stat accent"><div className="lbl">Pedidos activos</div><div className="big">18</div><small>Ver comandas →</small></div>
                    <div className="stat"><div className="lbl">Mesas totales</div><div className="big">16</div><small>QR y estados</small></div>
                  </div>
                  <div className="orders">
                    <div className="head"><span>Pedidos recientes</span><a href="#funcionalidades">Ver todos</a></div>
                    <div className="order"><div className="who"><b>Mesa 4</b><span>Pedido #101 · $25.990</span></div><span className="pill new">Nuevo</span></div>
                    <div className="order"><div className="who"><b>Mesa 2</b><span>Pedido #102 · $18.990</span></div><span className="pill prep">En preparación</span></div>
                    <div className="order"><div className="who"><b>Mesa 7</b><span>Pedido #103 · $32.990</span></div><span className="pill done">Listo</span></div>
                  </div>
                </div>
              </div>
              <div className="qr-float">
                <div className="qr" />
                <div className="txt"><b>Mesa 12</b><span>QR único activo</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="funcionalidades">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">Funcionalidades</span>
              <h2>Todo lo que necesitas para operar tu local.</h2>
              <p>Desde la carta hasta el cierre del día. MESA reúne la gestión de menú, mesas con QR y seguimiento de pedidos en una sola web app.</p>
            </div>
            <div className="cards">
              <div className="card reveal">
                <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg></div>
                <h3>Categorías del menú</h3>
                <p>Organiza tu carta por categorías para que cada producto sea fácil de encontrar y editar.</p>
              </div>
              <div className="card reveal">
                <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></svg></div>
                <h3>Productos y precios</h3>
                <p>Administra platos, descripciones, precios, estado visible e imagen de cada producto.</p>
              </div>
              <div className="card reveal">
                <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 21v.01M21 17v.01M17 21v.01" /></svg></div>
                <h3>Mesas del local</h3>
                <p>Cada mesa tiene su QR único para que los clientes pidan desde el celular, sin instalar nada.</p>
              </div>
              <div className="card reveal">
                <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3 8-8" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg></div>
                <h3>Seguimiento de pedidos</h3>
                <p>Revisa pedidos por mesa, estado, tiempo de ingreso y total durante todo el servicio.</p>
              </div>
              <div className="card reveal">
                <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg></div>
                <h3>Gestión de meseros</h3>
                <p>Agrega meseros desde el panel y MESA les envía las credenciales por correo para acceder al área de meseros.</p>
              </div>
              <div className="card reveal">
                <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg></div>
                <h3>Reportes básicos y avanzados</h3>
                <p>Productos más vendidos, total por mesa, horas peak y facturación: del día al año o por rango personalizado.</p>
              </div>
            </div>

            <div className="ai reveal">
              <div>
                <span className="tag">★ Feature estrella</span>
                <h2>Sube tu menú en PDF y deja que la IA lo arme por ti.</h2>
                <p>¿Ya tienes tu carta en PDF? No la reescribas. La IA la analiza y extrae productos, precios y categorías. Tú solo revisas y publicas.</p>
                <ol>
                  <li><span className="n">1</span><div>Subes el PDF de tu menú existente al panel.</div></li>
                  <li><span className="n">2</span><div>La IA detecta nombres, precios, categorías e imágenes.</div></li>
                  <li><span className="n">3</span><div>Revisas y corriges los ítems marcados como inciertos.</div></li>
                  <li><span className="n">4</span><div>Con un click queda publicado y disponible vía QR.</div></li>
                </ol>
              </div>
              <div className="ai-card">
                <div className="file">
                  <div className="fi"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg></div>
                  <div><b>menu-cafe-aurora.pdf</b><span>Analizando con IA…</span></div>
                </div>
                <div className="bar"><i /></div>
                <div className="detect">
                  <div className="it"><div><b>Café cortado</b> <span>· Cafetería</span></div><span className="conf">$2.500 ✓</span></div>
                  <div className="it"><div><b>Sandwich Italiano</b> <span>· Sándwiches</span></div><span className="conf">$6.900 ✓</span></div>
                  <div className="it"><div><b>Kuchen del día</b> <span>· Pastelería</span></div><span className="conf warn">revisar precio</span></div>
                </div>
              </div>
            </div>

            <div className="views">
              <div className="sec-head center reveal" style={{ maxWidth: 560, marginBottom: 8 }}>
                <span className="eyebrow">Cuatro vistas, un solo sistema</span>
                <h2 style={{ fontSize: "clamp(24px,3vw,34px)" }}>Cada rol ve exactamente lo que necesita.</h2>
              </div>
              <div className="tabbar reveal">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    className={`tab${activeTab === t.id ? " active" : ""}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="tab-panels">
                <div className={`panel${activeTab === "cliente" ? " active" : ""}`}>
                  <div>
                    <div className="pi">Vista Cliente</div>
                    <h3>Escanea, pide y sigue tu pedido.</h3>
                    <p>El cliente abre el menú en el navegador sin instalar nada, arma su carrito con notas por ítem y confirma. Ve el estado en tiempo real.</p>
                    <ul>
                      <li><Check />Carrito universal con división de cuenta por dispositivo</li>
                      <li><Check />Notas por ítem (&quot;sin cebolla&quot;)</li>
                      <li><Check />Pide sin tener que llamar al mesero</li>
                    </ul>
                  </div>
                  <div className="visual">
                    <div className="kit-row">
                      <div className="kit-card"><div className="ph" /><b>Pizza Margarita</b><span>$8.900</span></div>
                      <div className="kit-card"><div className="ph" /><b>Limonada menta</b><span>$3.500</span></div>
                    </div>
                    <div className="order" style={{ marginTop: 12 }}><div className="who"><b>Tu pedido · Mesa 12</b><span>2 ítems · $12.400</span></div><span className="pill new">Confirmar</span></div>
                  </div>
                </div>
                <div className={`panel${activeTab === "cocina" ? " active" : ""}`}>
                  <div>
                    <div className="pi">Vista Cocina</div>
                    <h3>Los pedidos llegan solos, en tiempo real.</h3>
                    <p>Pantalla grande o impresión de boleta. Cada pedido muestra mesa, ítems, notas y tiempo transcurrido. Alertas para pedidos nuevos y olvidados.</p>
                    <ul>
                      <li><Check />Estados Nuevo → En preparación → Listo</li>
                      <li><Check />Alerta visual y sonora</li>
                      <li><Check />Modo oscuro optimizado para cocina</li>
                    </ul>
                  </div>
                  <div className="visual">
                    <div className="kds">
                      <div className="k dark"><div className="kh"><span>Mesa 4 · #101</span><span>2 min</span></div><div className="km">2× Pizza · 1× Limonada</div><div className="ki">Nota: sin cebolla</div></div>
                      <div className="k dark b"><div className="kh"><span>Mesa 7 · #103</span><span>6 min</span></div><div className="km">1× Lomo · 1× Papas</div><div className="ki">En preparación</div></div>
                    </div>
                  </div>
                </div>
                <div className={`panel${activeTab === "mesero" ? " active" : ""}`}>
                  <div>
                    <div className="pi">Vista Mesero</div>
                    <h3>Gestiona tus mesas y nada se te escapa.</h3>
                    <p>El mesero ve sus mesas asignadas, recibe notificaciones de pedidos nuevos y mesas sin atender, y actúa como segundo filtro antes de cocina.</p>
                    <ul>
                      <li><Check />Notificaciones de pedidos y mesas no atendidas</li>
                      <li><Check />Confirma qué pedidos pasan a preparación</li>
                      <li><Check />Respaldo si falla la impresora de cocina</li>
                    </ul>
                  </div>
                  <div className="visual">
                    <div className="orders">
                      <div className="order"><div className="who"><b>Mesa 3</b><span>Esperando atención · 4 min</span></div><span className="pill new">Atender</span></div>
                      <div className="order"><div className="who"><b>Mesa 8</b><span>Pedido nuevo · $14.500</span></div><span className="pill prep">A cocina</span></div>
                      <div className="order"><div className="who"><b>Mesa 5</b><span>Listo para entregar</span></div><span className="pill done">Entregar</span></div>
                    </div>
                  </div>
                </div>
                <div className={`panel${activeTab === "admin" ? " active" : ""}`}>
                  <div>
                    <div className="pi">Vista Admin</div>
                    <h3>Tú tienes el control total del local.</h3>
                    <p>Edita menú, precios, categorías y mesas. Registra meseros, genera los QR y revisa reportes diarios, semanales o por el rango que quieras.</p>
                    <ul>
                      <li><Check />Reportes del día, semana, 3/6 meses, 1 año o personalizado</li>
                      <li><Check />QR descargables en PDF para imprimir</li>
                      <li><Check />Pedidos del local en tiempo real</li>
                    </ul>
                  </div>
                  <div className="visual">
                    <div className="stat-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      <div className="stat"><div className="lbl">Facturado hoy</div><div className="big">$428.000</div></div>
                      <div className="stat accent"><div className="lbl">Ticket promedio</div><div className="big">$17.800</div></div>
                    </div>
                    <div className="kit-card" style={{ marginTop: 12 }}><b style={{ display: "block", marginBottom: 8 }}>Más vendidos</b><span>1. Pizza Margarita · 2. Café cortado · 3. Lomo a lo pobre</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="ai reveal" style={{ background: "#fff", border: "1px solid var(--line)", color: "var(--text)", boxShadow: "var(--shadow)" }}>
              <div>
                <span className="tag" style={{ background: "var(--orange-soft)", color: "var(--orange-d)", borderColor: "transparent" }}>Arquitectura anti-caos</span>
                <h2 style={{ color: "var(--text)" }}>Diseñado para no fallar un sábado a las 9 PM.</h2>
                <p style={{ color: "var(--muted)" }}>La confiabilidad es el producto. Si se cae el internet, el menú sigue visible desde el dispositivo y los pedidos se encolan para sincronizarse al volver la conexión.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="card" style={{ margin: 0 }}><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0 1 14 0M8.5 16.4a6 6 0 0 1 7 0M2 8.82a15 15 0 0 1 20 0" /><line x1="12" y1="20" x2="12" y2="20" /></svg></div><h3 style={{ fontSize: 17 }}>Offline-first</h3><p style={{ fontSize: 14 }}>El menú se cachea localmente y funciona con WiFi malo.</p></div>
                <div className="card" style={{ margin: 0 }}><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.4 2.6L21 8" /><path d="M21 3v5h-5" /></svg></div><h3 style={{ fontSize: 17 }}>Reconexión auto</h3><p style={{ fontSize: 14 }}>Detecta la pérdida de señal y reanuda sin intervención.</p></div>
                <div className="card" style={{ margin: 0 }}><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 3 14h9l-1 8 10-12h-9z" /></svg></div><h3 style={{ fontSize: 17 }}>Carga &lt;2s</h3><p style={{ fontSize: 14 }}>El menú del cliente abre en menos de 2 segundos en 4G.</p></div>
                <div className="card" style={{ margin: 0 }}><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div><h3 style={{ fontSize: 17 }}>Cola local</h3><p style={{ fontSize: 14 }}>Ningún pedido se pierde, aunque falle la red.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="planes" style={{ background: "var(--panel)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          <div className="wrap">
            <div className="sec-head center reveal">
              <span className="eyebrow">Planes</span>
              <h2>Un plan para cada tamaño de local.</h2>
              <p>El precio depende de la cantidad de mesas. Incluye acceso completo a la plataforma; el soporte Tier 3 24/7 es un complemento recomendado.</p>
            </div>
            <div className="plans">
              <div className="plan reveal">
                <div className="pn">Plan 15</div>
                <div className="range">1 – 15 mesas</div>
                <div className="price">$2.500.000 + IVA<small>Acceso a la plataforma</small></div>
                <div className="sup"><b>+ $150.000</b><span>Soporte Tier 3 · 24/7 (recomendado)</span></div>
                <ul className="feats">
                  <li><Check />Menú QR + upload con IA</li>
                  <li><Check />Vistas Cliente, Cocina, Mesero y Admin</li>
                  <li><Check />Reportes básicos</li>
                </ul>
                <button className="btn btn-ghost" onClick={openModal}>Contactar</button>
              </div>
              <div className="plan feat reveal">
                <div className="ribbon">Más elegido</div>
                <div className="pn">Plan 50</div>
                <div className="range">16 – 50 mesas</div>
                <div className="price">$6.000.000 + IVA<small>Acceso a la plataforma</small></div>
                <div className="sup"><b>+ $300.000</b><span>Soporte Tier 3 · 24/7 (recomendado)</span></div>
                <ul className="feats">
                  <li><Check />Todo lo del Plan 15</li>
                  <li><Check />Reportes avanzados y horas peak</li>
                  <li><Check />Gestión completa de meseros</li>
                </ul>
                <button className="btn btn-primary" onClick={openModal}>Contactar</button>
              </div>
              <div className="plan reveal">
                <div className="pn">Plan 100</div>
                <div className="range">50 – 100 mesas</div>
                <div className="price">$10.000.000 + IVA<small>Acceso a la plataforma</small></div>
                <div className="sup"><b>+ $450.000</b><span>Soporte Tier 3 · 24/7 (recomendado)</span></div>
                <ul className="feats">
                  <li><Check />Todo lo del Plan 50</li>
                  <li><Check />Operación de alto volumen</li>
                  <li><Check />Prioridad en soporte</li>
                </ul>
                <button className="btn btn-ghost" onClick={openModal}>Contactar</button>
              </div>
              <div className="plan reveal">
                <div className="pn">Personalizado</div>
                <div className="range">100+ mesas o varias sucursales</div>
                <div className="price">Contactar<small>A medida de tu operación</small></div>
                <div className="sup"><b>Soporte a medida</b><span>Definimos el nivel según tu caso</span></div>
                <ul className="feats">
                  <li><Check />Multi-sucursal</li>
                  <li><Check />Reportes consolidados</li>
                  <li><Check />Integraciones a medida</li>
                </ul>
                <button className="btn btn-dark" onClick={openModal}>Contactar</button>
              </div>
            </div>
            <p className="plan-note">Los valores son referenciales en pesos chilenos (CLP). El costo de procesamiento de menú con IA se absorbe en el setup. <a onClick={openModal} style={{ color: "var(--orange)", fontWeight: 700, cursor: "pointer" }}>Habla con un ejecutivo</a> para una propuesta a tu medida.</p>
          </div>
        </section>

        <section className="sec" id="ayuda">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">Ayuda</span>
              <h2>Empieza con confianza.</h2>
              <p>Resolvemos las dudas frecuentes y te dejamos una guía paso a paso para poner tu local en marcha en minutos.</p>
            </div>
            <div className="help-grid">
              <div className="faq reveal">
                {faqs.map((f, i) => {
                  const open = faqOpen === i
                  return (
                    <div key={f.q} className={`q${open ? " open" : ""}`}>
                      <button onClick={() => setFaqOpen(open ? null : i)}>
                        {f.q}
                        <span className="chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg></span>
                      </button>
                      <div className="a" style={{ maxHeight: open ? 500 : 0 }}><p>{f.a}</p></div>
                    </div>
                  )
                })}
              </div>
              <div className="guide reveal">
                <h3>Guía de onboarding</h3>
                <p className="s">Cuatro pasos para dejar tu local listo para recibir pedidos.</p>
                <ul className="steps">
                  <li><div className="sn">1</div><div><b>Sube tu menú PDF</b><span>La IA lo arma por ti; tú revisas y publicas.</span></div></li>
                  <li><div className="sn">2</div><div><b>Genera e imprime los QR</b><span>Un QR único por mesa, descargable en PDF.</span></div></li>
                  <li><div className="sn">3</div><div><b>Conecta tu cocina</b><span>Pantalla en tiempo real o impresión de boleta.</span></div></li>
                  <li><div className="sn">4</div><div><b>Invita a tus meseros</b><span>Reciben sus credenciales por correo automáticamente.</span></div></li>
                </ul>
                <button className="btn btn-primary" onClick={openModal} style={{ width: "100%", justifyContent: "center", marginTop: 22 }}>Contacta a un ejecutivo</button>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="cta-band reveal">
              <h2>Más mesas atendidas, menos errores, menos estrés.</h2>
              <p>Sin contratar más personal. Hablemos de cómo MESA se adapta a tu local.</p>
              <div className="hero-cta">
                <button className="btn btn-primary" onClick={openModal}>Contacta a un ejecutivo
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
                <a href="#planes" className="btn" style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}>Ver planes</a>
              </div>
            </div>
          </div>
        </section>

        <footer className="foot-wrap">
          <div className="wrap">
            <div className="foot">
              <div>
                <a href="#top" className="brand" aria-label="MESA inicio">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mesaLogo.src} alt="MESA" />
                </a>
                <p className="fd">Sistema de pedidos por QR para restaurantes y cafeterías. Más mesas atendidas, menos errores — sin contratar más personal.</p>
              </div>
              <div><h5>Producto</h5>
                <a href="#funcionalidades">Funcionalidades</a>
                <a href="#funcionalidades">Upload de menú con IA</a>
                <a href="#planes">Planes</a>
              </div>
              <div><h5>Ayuda</h5>
                <a href="#ayuda">Preguntas frecuentes</a>
                <a href="#ayuda">Guía de onboarding</a>
                <a onClick={openModal}>Contacto</a>
              </div>
              <div><h5>Empieza</h5>
                <Link href="/login">Iniciar sesión</Link>
                <a onClick={openModal}>Contacta a un ejecutivo</a>
              </div>
            </div>
            <div className="foot-bot">
              <span>© 2026 MESA · Chile</span>
              <span>Hecho para operar sin caos.</span>
            </div>
          </div>
        </footer>
      </div>

      <div
        className={`mesa-modal-bg${modalOpen ? " open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false)
        }}
      >
        <div className="modal">
          <button className="close" aria-label="Cerrar" onClick={() => setModalOpen(false)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          {!modalSent ? (
            <div>
              <h3>Contacta a un ejecutivo</h3>
              <p className="s">Cuéntanos de tu local y te contactamos con una propuesta a tu medida.</p>
              <div className="field"><label>Nombre del local</label><input type="text" placeholder="Café Aurora" /></div>
              <div className="field"><label>Tu nombre</label><input type="text" placeholder="Nombre y apellido" /></div>
              <div className="field"><label>Correo o teléfono</label><input type="text" placeholder="hola@local.cl / +56 9 ..." /></div>
              <div className="field"><label>¿Cuántas mesas tiene tu local?</label>
                <select><option>1 – 15 mesas</option><option>16 – 50 mesas</option><option>50 – 100 mesas</option><option>100+ o varias sucursales</option></select>
              </div>
              <button className="btn" onClick={() => setModalSent(true)}>Enviar solicitud</button>
            </div>
          ) : (
            <div className="ok">
              <div className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg></div>
              <h3>¡Solicitud enviada!</h3>
              <p className="s">Un ejecutivo de MESA te contactará a la brevedad.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
