/* fish-svg.js — 어종 인라인 SVG (CSS 색상 변수와 연동) */
(function() {
  // 색상은 어종별 size_max + stage 기반
  const FISH_SVG = {
    gobies: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="28" ry="14" fill="#9ca3af"/>
      <path d="M22 30 L8 18 L10 30 L8 42 Z" fill="#9ca3af"/>
      <circle cx="62" cy="28" r="2" fill="#000"/>
    </svg>`,
    rockfish: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="32" ry="18" fill="#c24a3a"/>
      <path d="M18 30 L4 14 L8 30 L4 46 Z" fill="#c24a3a"/>
      <path d="M40 24 L48 14 M50 22 L58 12 M60 22 L70 14" stroke="#7a1a1a" stroke-width="2" fill="none"/>
      <circle cx="64" cy="26" r="2.5" fill="#000"/>
    </svg>`,
    mullet: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="34" ry="12" fill="#a8b8a0"/>
      <path d="M16 30 L2 22 L4 30 L2 38 Z" fill="#a8b8a0"/>
      <ellipse cx="35" cy="30" rx="3" ry="2" fill="#fff" opacity="0.6"/>
      <circle cx="64" cy="28" r="2" fill="#000"/>
    </svg>`,
    flatfish1: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="34" ry="22" fill="#d4b896"/>
      <path d="M16 30 L2 24 L6 30 L2 36 Z" fill="#d4b896"/>
      <circle cx="68" cy="22" r="2" fill="#000"/>
      <circle cx="68" cy="32" r="2" fill="#000"/>
    </svg>`,
    seabass: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="38" ry="16" fill="#6b7d6e"/>
      <path d="M12 30 L-2 16 L2 30 L-2 44 Z" fill="#6b7d6e"/>
      <ellipse cx="40" cy="26" rx="6" ry="3" fill="#fff" opacity="0.4"/>
      <circle cx="68" cy="28" r="2.5" fill="#000"/>
      <path d="M30 30 L42 30 M48 30 L60 30" stroke="#3d4d40" stroke-width="1" fill="none"/>
    </svg>`,
    blackbeam: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="32" ry="20" fill="#a85a4a"/>
      <path d="M18 30 L4 18 L8 30 L4 42 Z" fill="#a85a4a"/>
      <ellipse cx="42" cy="24" rx="4" ry="2" fill="#fff" opacity="0.5"/>
      <circle cx="66" cy="26" r="3" fill="#facc15"/>
      <circle cx="66" cy="26" r="1.5" fill="#000"/>
    </svg>`,
    greenling: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="30" ry="16" fill="#7a8c5e"/>
      <path d="M20 30 L6 18 L10 30 L6 42 Z" fill="#7a8c5e"/>
      <path d="M30 16 L34 4 M40 14 L46 2 M52 14 L58 2" stroke="#5a6c3e" stroke-width="2" fill="none"/>
      <circle cx="64" cy="28" r="2.5" fill="#000"/>
    </svg>`,
    conger: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 30 Q20 14 50 28 Q80 42 90 30 Q80 46 50 32 Q20 18 10 30 Z" fill="#5a4a3e"/>
      <circle cx="78" cy="28" r="2" fill="#facc15"/>
      <circle cx="78" cy="28" r="1" fill="#000"/>
    </svg>`,
    tuna: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="42" ry="20" fill="#3a5d8a"/>
      <path d="M8 30 L-6 12 L-2 30 L-6 48 Z" fill="#3a5d8a"/>
      <path d="M30 16 L40 0 M40 18 L52 0 M52 18 L64 0" stroke="#1a3d6a" stroke-width="3" fill="none"/>
      <path d="M40 30 Q50 30 56 38 L50 32 Z" fill="#facc15"/>
      <circle cx="72" cy="26" r="3" fill="#fff"/>
      <circle cx="72" cy="26" r="2" fill="#000"/>
    </svg>`,
    amberjack: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="40" ry="18" fill="#d4a04a"/>
      <path d="M10 30 L-4 14 L0 30 L-4 46 Z" fill="#d4a04a"/>
      <path d="M40 30 Q50 30 60 38" stroke="#7a4a1a" stroke-width="2" fill="none"/>
      <circle cx="70" cy="26" r="2.5" fill="#000"/>
    </svg>`,
    snapper: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="36" ry="22" fill="#c84040"/>
      <path d="M14 30 L0 16 L4 30 L0 44 Z" fill="#c84040"/>
      <ellipse cx="40" cy="22" rx="6" ry="3" fill="#fff" opacity="0.4"/>
      <circle cx="68" cy="24" r="3" fill="#fff"/>
      <circle cx="68" cy="24" r="2" fill="#000"/>
    </svg>`,
    cutlass: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 30 Q30 22 60 28 Q85 32 95 30 Q85 36 60 32 Q30 38 5 30 Z" fill="#a0b8c8"/>
      <path d="M85 28 L98 30 L85 32 Z" fill="#a0b8c8"/>
      <circle cx="78" cy="28" r="2" fill="#000"/>
    </svg>`,
    golden: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="30" rx="30" ry="18" fill="url(#goldenGrad)"/>
      <defs>
        <linearGradient id="goldenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fde68a"/>
          <stop offset="50%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#92400e"/>
        </linearGradient>
      </defs>
      <path d="M20 30 L6 18 L10 30 L6 42 Z" fill="#f59e0b"/>
      <path d="M30 22 Q40 26 50 22 M30 32 Q40 30 50 32" stroke="#92400e" stroke-width="1.5" fill="none"/>
      <circle cx="64" cy="26" r="3" fill="#fff"/>
      <circle cx="64" cy="26" r="2" fill="#000"/>
    </svg>`,
  };

  // 카드 뒷면 (플레어 카드)
  const CARD_BACK_SVG = `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="92" height="132" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="2"/>
    <pattern id="cardPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="2" fill="#f59e0b" opacity="0.3"/>
      <path d="M5 5 L15 15 M15 5 L5 15" stroke="#f59e0b" stroke-width="0.5" opacity="0.4"/>
    </pattern>
    <rect x="6" y="6" width="88" height="128" rx="6" fill="url(#cardPattern)"/>
    <text x="50" y="78" text-anchor="middle" font-family="serif" font-size="24" fill="#f59e0b" font-weight="bold">🎣</text>
  </svg>`;

  // 카드 앞면 (등급 색상 테두리)
  function cardFrontSVG(card) {
    const rarityColor = { common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', legendary: '#f59e0b' }[card.rarity] || '#9ca3af';
    return `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style="background:${rarityColor}22; border:2px solid ${rarityColor}; border-radius:8px;">
      <rect x="2" y="2" width="96" height="136" rx="8" fill="none" stroke="${rarityColor}" stroke-width="3"/>
      <text x="50" y="20" text-anchor="middle" font-size="10" fill="${rarityColor}" font-weight="bold">${card.rarity.toUpperCase()}</text>
      <text x="50" y="60" text-anchor="middle" font-size="22" fill="${rarityColor}" font-weight="bold">${card.name}</text>
      <text x="50" y="80" text-anchor="middle" font-size="9" fill="#94a3b8">${card.desc}</text>
      <circle cx="50" cy="110" r="12" fill="${rarityColor}" opacity="0.3"/>
      <text x="50" y="115" text-anchor="middle" font-size="14" fill="${rarityColor}">🎣</text>
    </svg>`;
  }

  // 사인파 효과음 (Web Audio)
  function playSound(type) {
    try {
      const ctx = window.__audioCtx || (window.__audioCtx = new (window.AudioContext || window.webkitAudioContext)());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      const sounds = {
        cast:    { freq: 440,  type: 'sine',     dur: 0.15, vol: 0.15, slide: -200 },
        bite:    { freq: 800,  type: 'square',   dur: 0.1,  vol: 0.2,  slide: 400 },
        hook:    { freq: 1200, type: 'sine',     dur: 0.08, vol: 0.2,  slide: -300 },
        reel:    { freq: 200,  type: 'sawtooth', dur: 0.05, vol: 0.05, slide: 0 },
        catch:   { freq: 880,  type: 'sine',     dur: 0.4,  vol: 0.25, slide: 880, slideTime: 0.3 },
        miss:    { freq: 200,  type: 'square',   dur: 0.3,  vol: 0.15, slide: -100 },
        perfect: { freq: 1320, type: 'sine',     dur: 0.3,  vol: 0.3,  slide: 1760, slideTime: 0.2 },
        reroll:  { freq: 600,  type: 'triangle', dur: 0.15, vol: 0.15, slide: 200 },
        evolve:  { freq: 440,  type: 'sine',     dur: 1.0,  vol: 0.3,  slide: 1760, slideTime: 0.8 },
        click:   { freq: 1000, type: 'square',   dur: 0.04, vol: 0.08, slide: 0 },
        saved:   { freq: 1320, type: 'sine',     dur: 0.5,  vol: 0.3,  slide: 0 },
        clear:   { freq: 523,  type: 'sine',     dur: 1.5,  vol: 0.3,  slide: 1047, slideTime: 1.0 },
      };
      const s = sounds[type] || sounds.click;
      osc.type = s.type;
      osc.frequency.setValueAtTime(s.freq, now);
      if (s.slide) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(50, s.freq + s.slide), now + (s.slideTime || s.dur));
      }
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(s.vol, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + s.dur);
      osc.start(now);
      osc.stop(now + s.dur + 0.05);
    } catch (e) {
      // 사운드 실패는 조용히 무시
    }
  }

  window.FISH_SVG = FISH_SVG;
  window.CARD_BACK_SVG = CARD_BACK_SVG;
  window.cardFrontSVG = cardFrontSVG;
  window.playSound = playSound;
})();