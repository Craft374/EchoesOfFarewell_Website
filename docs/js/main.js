(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const safe = (fn) => { try { return fn(); } catch { /* storage 차단 환경 */ } };

  const root = document.documentElement;
  root.classList.add('js');

  // 모션 줄이기 / 데이터 절약 / 저속 네트워크면 연출을 줄이고 영상 로딩을 막는다
  const conn = navigator.connection || {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const slow = reduced || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  if (reduced || slow) root.classList.add('lite');

  // 언어 (저장값 > 브라우저 언어)
  const setLang = (l) => {
    root.dataset.lang = l;
    root.lang = l;
    $('#lang').textContent = l === 'ko' ? 'EN' : 'KO'; // 누르면 바뀔 언어를 표시
  };
  const saved = safe(() => localStorage.getItem('eof-lang'));
  setLang(saved || ((navigator.language || 'ko').startsWith('ko') ? 'ko' : 'en'));
  $('#lang').onclick = () => {
    const l = root.dataset.lang === 'ko' ? 'en' : 'ko';
    setLang(l);
    safe(() => localStorage.setItem('eof-lang', l)); // 직접 고른 경우에만 저장
  };

  // 갤러리 + 라이트박스
  const shots = $('#shots');
  const lb = $('#lb');
  for (let i = 2; i <= 12; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<img src="assets/img/shots/s${i}.webp" alt="Gameplay screenshot ${i - 1}" loading="lazy">`;
    b.onclick = () => { const im = $('img', lb); im.src = `assets/img/shots/s${i}.webp`; im.alt = $('img', b).alt; lb.showModal(); };
    shots.append(b);
  }
  lb.onclick = () => lb.close(); // 어디를 눌러도 닫기 (닫기 버튼 포함)

  // 스크롤 등장 + 영상 지연 로딩
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  $$('.reveal').forEach((el) => io.observe(el));

  const vio = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.src) v.src = v.dataset.src;
      v.play().catch(() => {});
    } else v.pause();
  }), { threshold: 0.25 });
  if (!slow) $$('video[data-src]').forEach((v) => vio.observe(v));
  else $$('video[data-src]').forEach((v) => { v.controls = true; v.src = v.dataset.src; }); // preload=none 이라 재생 버튼을 눌러야 받는다

  // 히어로: 정령 입자 + 패럴랙스
  if (!root.classList.contains('lite')) {
    const sp = $('.spirits');
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('i');
      p.style.cssText = `left:${Math.random() * 100}%;--x:${(Math.random() - .5) * 120}px;--d:${9 + Math.random() * 10}s;--t:-${Math.random() * 14}s`;
      sp.append(p);
    }
    const layers = $$('[data-parallax]');
    let tick = false;
    addEventListener('scroll', () => {
      if (tick || scrollY > innerHeight) return;
      tick = true;
      requestAnimationFrame(() => {
        layers.forEach((l) => { l.style.transform = `translateY(${scrollY * l.dataset.parallax}px)`; });
        tick = false;
      });
    }, { passive: true });
  }
})();
