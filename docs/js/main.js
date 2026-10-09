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
  if (slow) root.classList.add('lite');

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
  for (let i = 1; i <= 12; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<img src="assets/img/shots/s${i}.webp" alt="Gameplay screenshot ${i}" loading="lazy">`;
    b.onclick = () => { const im = $('img', lb); im.src = `assets/img/shots/s${i}.webp`; im.alt = $('img', b).alt; lb.showModal(); };
    shots.append(b);
  }
  lb.onclick = () => lb.close(); // 어디를 눌러도 닫기 (닫기 버튼 포함)

  // 행사 안내 팝업: 닫으면 이번 접속 동안, '오늘은 그만 보기'면 오늘 하루 숨김
  const notice = $('#notice');
  if (notice) {
    const today = new Date().toDateString();
    const hidden = safe(() => localStorage.getItem('eof-notice') === today || sessionStorage.getItem('eof-notice'));
    if (!hidden) setTimeout(() => !notice.open && notice.showModal(), 700);
    notice.addEventListener('close', () => safe(() => sessionStorage.setItem('eof-notice', '1'))); // 닫으면 이번 접속 동안 숨김
    $('[data-close]', notice).onclick = () => notice.close();
    $('[data-skip]', notice).onclick = () => { safe(() => localStorage.setItem('eof-notice', today)); notice.close(); };
    notice.addEventListener('click', (e) => { // 바깥(배경) 클릭 — 안쪽 여백은 제외
      const r = notice.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) notice.close();
    });
  }

  // 스크롤 등장 + 영상 지연 로딩
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  $$('.reveal').forEach((el) => io.observe(el));

  // 반복 구간이 튀지 않게: 시작은 페이드 인, 끝은 페이드 아웃 (배경은 검정)
  const fade = (v) => {
    const d = v.duration, t = v.currentTime;
    v.style.opacity = d ? Math.max(0, Math.min(1, t / 0.5, (d - t) / 0.5)) : 1;
    if (!v.paused) requestAnimationFrame(() => fade(v));
  };
  const vio = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.src) v.src = v.dataset.src;
      v.play().then(() => fade(v)).catch(() => {});
    } else { v.pause(); v.style.opacity = ''; }
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
