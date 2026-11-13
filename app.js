// app.js
const SUPABASE_URL = 'https://rmpwayrmhpfrnbcjixot.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MvNt1lBJZTTec8dLwBXtgg_UrLHrYjO';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 전역 상태 관리
let currentUser = null;        // 로그인한 사용자 정보 { username, main_character }
let viewedOwner = null;        // 현재 조회 중인 계정 주인 username (친구 포함)
let top5Characters = [];       // 현재 화면의 상위 5개 캐릭터 배열
let activeCharName = '';       // 현재 선택된 탭의 캐릭터 이름
let bossSettings = {};         // { "캐릭터명": { "boss_id": 파티인원(1~6) } }
let dailyBossClearStatus = {};
let bossClearScope = 'guest';
let dailyLootLogs = {};
let authMode = 'login';
let selectedCalendarDate = toLocalDateKey(new Date());
const DAILY_LOG_STORAGE_KEY = 'maple_daily_loot_logs';
const SUNDAY_MAPLE_EVENTS = {
  // 넥슨 공식 2026년 11월 15일 이벤트 안내 이미지
  '2026-11-15': {
    image: 'https://lwi.nexon.com/maplestory/2026/1022_board/261115_1K16FRPBN1G02THG.png',
    url: 'https://maplestory.nexon.com/News/Event/1409'
  }
};
const DAILY_QUOTES = [
  '오늘의 한 걸음이 다음 주의 나를 가볍게 한다.',
  '기록은 작은 성취를 눈에 보이게 만든다.',
  '꾸준함은 결국 가장 강한 스펙이 된다.',
  '오늘 할 수 있는 만큼이면 충분하다.',
  '천천히 가도 매일 가면 멀리 도착한다.',
  '작은 준비가 보스전의 여유를 만든다.',
  '쌓아 둔 노력은 필요한 순간에 빛난다.',
  '비교보다 중요한 건 어제보다 나아진 오늘이다.',
  '한 번의 기록이 다음 목표를 선명하게 한다.',
  '쉬어 가는 날도 오래 달리기 위한 과정이다.',
  '작은 성공을 놓치지 말고 다음 도전을 준비하자.',
  '내 페이스를 지키는 사람이 끝까지 강하다.',
  '오늘의 선택이 내일의 가능성을 넓힌다.',
  '모험은 준비한 만큼 더 즐거워진다.'
];
const MAPLESTORY_DATA_VERSION = '388';
const BOSS_DROP_CATALOG = [
  { group: '익셉셔널 해머', items: [
    { id: null, name: '익셉셔널 해머 (얼굴장식)', image: getHostedItemIconUrl('그외', '익셉셔널 해머 (얼굴장식)') },
    { id: null, name: '익셉셔널 해머 (눈장식)', image: getHostedItemIconUrl('그외', '익셉셔널 해머 (눈장식)') },
    { id: null, name: '익셉셔널 해머 (벨트)', image: getHostedItemIconUrl('그외', '익셉셔널 해머 (벨트)') },
    { id: null, name: '익셉셔널 해머 (귀고리)', image: getHostedItemIconUrl('그외', '익셉셔널 해머 (귀고리)') },
    { id: null, name: '익셉셔널 해머 (훈장)', image: getHostedItemIconUrl('그외', '익셉셔널 해머 (훈장)') },
    { id: null, name: '익셉셔널 해머 (포켓)' },
    { id: null, name: '익셉셔널 해머 (펜던트)' }
  ] },
  { group: '광휘의 보스 장비', items: [
    { id: null, name: '근원의 속삭임', image: 'https://mitemprice.kr/image/칠흑/근원의%20속삭임.png' },
    { id: null, name: '황홀한 악몽', image: 'https://mitemprice.kr/image/칠흑/황홀한%20악몽.png' },
    { id: null, name: '죽음의 맹세', image: 'https://mitemprice.kr/image/칠흑/죽음의%20맹세.png' },
    { id: null, name: '불멸의 유산', image: 'https://mitemprice.kr/image/칠흑/불멸의%20유산.png' },
    { id: null, name: '오만의 원죄', image: 'https://mitemprice.kr/image/그외/오만의%20원죄.png' },
    { id: null, name: '굶주리는 핏빛 원혼', image: 'https://mitemprice.kr/image/그외/굶주리는%20핏빛%20원혼.png' }
  ] },
  { group: '칠흑의 보스 장신구', items: [
    { id: 1012632, name: '루즈 컨트롤 머신 마크' },
    { id: 1022278, name: '마력이 깃든 안대' },
    { id: 1132308, name: '몽환의 벨트' },
    { id: 1032316, name: '커맨더 포스 이어링' },
    { id: 1122430, name: '고통의 근원' },
    { id: 1113306, name: '거대한 공포' },
    { id: 1182285, name: '창세의 뱃지' },
    { id: 1162080, name: '저주받은 적의 마도서' },
    { id: 1190555, name: '미트라의 분노 : 전사' },
    { id: 1672076, name: '블랙 하트' }
  ] },
  { group: '시드링 (4레벨)', items: [
    { id: 1113098, name: '리스트레인트 링 4레벨' },
    { id: 1113329, name: '컨티뉴어스 링 4레벨' }
  ] },
  { group: '연마석', items: [
    { id: 2539001, name: '생명의 연마석' },
    { id: null, name: '신념의 연마석', image: 'https://mitemprice.kr/image/그외/신념의%20연마석.png' }
  ] }
];

function getMapleItemIconUrl(itemId) {
  return `https://maplestory.io/api/KMS/${MAPLESTORY_DATA_VERSION}/item/${itemId}/icon`;
}

function getHostedItemIconUrl(folder, name) {
  return `https://mitemprice.kr/image/${encodeURIComponent(folder)}/${encodeURIComponent(`${name}.png`)}`;
}

// 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
  renderDailyQuote();
  setInterval(renderDailyQuote, 60_000);
  dailyLootLogs = readLocalDailyLogs();
  initDailyLogControls();
  renderMiniCalendar();
  selectCalendarDate(selectedCalendarDate);
  showHome();
  const savedUser = localStorage.getItem('maple_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    updateAuthUI();
  }

  document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchAccount();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeItemCatalogIndex !== null) closeDailyItemCatalog();
  });

});

function renderDailyQuote() {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const firstDay = Date.UTC(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((today - firstDay) / 86_400_000);
  const quote = DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
  const quoteElement = document.getElementById('todayQuote');
  const dateElement = document.getElementById('todayQuoteDate');
  if (quoteElement) quoteElement.textContent = quote;
  if (dateElement) dateElement.textContent = `${now.getMonth() + 1}월 ${now.getDate()}일`;
}

function showHome() {
  document.getElementById('searchInput').value = '';
  document.getElementById('homeSection').classList.remove('hidden');
  document.getElementById('statusBanner').classList.add('hidden');
  document.getElementById('top5Section').classList.add('hidden');
  document.getElementById('summarySection').classList.add('hidden');
  document.getElementById('bossSection').classList.add('hidden');
}

function showSearchView() {
  document.getElementById('homeSection').classList.add('hidden');
  document.getElementById('statusBanner').classList.remove('hidden');
  document.getElementById('top5Section').classList.remove('hidden');
  document.getElementById('summarySection').classList.remove('hidden');
}

function focusSearch() {
  const input = document.getElementById('searchInput');
  input.focus();
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// 1. SHA-256 비밀번호 해시 유틸리티
async function hashPassword(pw) {
  const msgBuffer = new TextEncoder().encode(pw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 2. 계정 통합 검색 (닉네임 -> 넥슨 API 상위 5캐릭 + Supabase 저장된 친구 보스 설정 로드)
async function searchAccount(overrideName) {
  const queryName = (overrideName || document.getElementById('searchInput').value).trim();
  if (!queryName) return alert('캐릭터 닉네임을 입력해주세요.');

  document.getElementById('searchInput').value = queryName;
  document.getElementById('viewingTitle').textContent = `'${queryName}' 계정 정보를 불러오는 중...`;

  try {
    // 넥슨 API 서버리스 함수 호출
    const res = await fetch(`/api/maple?name=${encodeURIComponent(queryName)}`);
    const responseText = await res.text();
    let data = {};
    try { data = JSON.parse(responseText); } catch (e) { /* API 경로 오류 등 비 JSON 응답 */ }
    if (!res.ok) {
      const errorCode = data.nexonCode ? ` (${data.nexonCode})` : '';
      throw new Error(`${data.error || `캐릭터 검색 실패 (HTTP ${res.status})`}${errorCode}`);
    }

    showSearchView();
    top5Characters = data.top5;
    activeCharName = top5Characters[0]?.name || '';

    // Supabase에서 해당 계정의 캐릭터들을 보유한 회원이 있는지 확인 (친구 설정 불러오기)
    const { data: matchedUsers } = await supabaseClient
      .from('users')
      .select('username, main_character, account_characters')
      .or(`main_character.eq.${queryName},account_characters.cs.{${queryName}}`);

    viewedOwner = matchedUsers && matchedUsers.length > 0 ? matchedUsers[0].username : null;
    loadDailyBossClearStatus(viewedOwner || `guest:${data.searchedName}`);

    let savedSettings = {};
    if (viewedOwner) {
      const { data: settingRow } = await supabaseClient
        .from('boss_settings')
        .select('settings_json')
        .eq('username', viewedOwner)
        .single();
      savedSettings = settingRow?.settings_json || {};
      if (savedSettings.__dailyBossClears) dailyBossClearStatus = savedSettings.__dailyBossClears;
      const hasSharedLogs = savedSettings.__dailyLootLogs && typeof savedSettings.__dailyLootLogs === 'object';
      const isMyAccount = currentUser?.username === viewedOwner;
      dailyLootLogs = hasSharedLogs ? savedSettings.__dailyLootLogs : (isMyAccount ? readLocalDailyLogs() : {});
      const { __weeklyClear, __dailyBossClears, __dailyLootLogs, ...savedBossSettings } = savedSettings;
      if (isMyAccount) storeDailyLogsLocally();
      bossSettings = normalizeBossSettings(savedBossSettings);
      if (isMyAccount && !hasSharedLogs && Object.keys(dailyLootLogs).length) {
        await persistViewedAccountData();
      }
    } else {
      bossSettings = {};
      dailyLootLogs = {};
    }

    // UI 업데이트
    const isMyAccount = currentUser && currentUser.username === viewedOwner;
    document.getElementById('viewingTitle').textContent = viewedOwner
      ? `👑 [${viewedOwner}] 님의 통합 계정 (${data.searchedName} 검색됨)`
      : `🔍 [${data.searchedName}] 계정 조회 결과 (미등록 계정 - 임시 계산 모드)`;
    
    document.getElementById('viewingSub').textContent = isMyAccount
      ? '내 계정입니다. 보스 및 파티 인원을 수정한 뒤 우측 저장 버튼을 눌러 DB에 반영하세요.'
      : '계정 내 상위 5개 캐릭터의 코디와 저장된 주간 보스 수익 내역입니다.';

    document.getElementById('saveBtn').classList.toggle('hidden', !isMyAccount);

    if (top5Characters.length === 0) {
      document.getElementById('viewingTitle').textContent = `⚠️ [${data.searchedName}] 계정에 유니온 챔피언 캐릭터가 없습니다.`;
      document.getElementById('viewingSub').textContent = '유니온 챔피언에 등록된 캐릭터만 표시됩니다.';
      document.getElementById('saveBtn').classList.add('hidden');
      document.getElementById('top5Container').innerHTML = '';
      document.getElementById('bossSection').classList.add('hidden');
      return;
    }

    renderTop5Cards();
    renderCharacterTabs();
    renderBossList();
    calculateSummary();
    selectCalendarDate(selectedCalendarDate);
  } catch (err) {
    alert(err.message);
  }
}

// 3. 상위 5개 캐릭터 코디 카드 렌더링
function renderTop5Cards() {
  const container = document.getElementById('top5Container');
  container.innerHTML = top5Characters.map((char, idx) => `
    <div onclick="selectCharacterTab('${char.name}')"
      class="cursor-pointer bg-slate-800 border ${char.name === activeCharName ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-700'} rounded-xl p-2 flex flex-col items-center text-center transition hover:border-slate-500">
      <span class="self-start text-[11px] font-bold px-2 py-0.5 rounded bg-slate-700 text-amber-300">TOP ${idx + 1}</span>
      <div class="h-44 sm:h-48 w-full overflow-hidden flex items-center justify-center -my-1">
        <img src="${char.image}" alt="${char.name}" class="w-64 h-64 max-w-none object-contain scale-[2.4]" />
      </div>
      <div class="font-bold text-sm text-slate-100">${char.name}</div>
      <div class="text-xs text-slate-400">Lv.${char.level} · ${char.world}</div>
      <div class="text-[11px] text-indigo-300 mt-0.5 truncate w-full">${char.job}</div>
    </div>
  `).join('');
}

// 4. 캐릭터 전환 탭 렌더링
function renderCharacterTabs() {
  const section = document.getElementById('bossSection');
  section.classList.remove('hidden');
  const tabs = document.getElementById('charTabs');

  tabs.innerHTML = top5Characters.map(char => {
    const isActive = char.name === activeCharName;
    const charBosses = bossSettings[char.name] || {};
    const count = getCharacterWeeklyBossCount(charBosses);
    const monthlyCount = Object.keys(charBosses).filter(isMonthlyBossId).length;
    return `
      <button onclick="selectCharacterTab('${char.name}')"
        class="px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
          isActive ? 'border-amber-400 text-amber-400 bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'
        }">
        ${char.name} <span class="text-xs opacity-75">(${count}/12${monthlyCount ? ` · 월간 ${monthlyCount}` : ''})</span>
      </button>
    `;
  }).join('');
}

function selectCharacterTab(charName) {
  activeCharName = charName;
  renderTop5Cards();
  renderCharacterTabs();
  renderBossList();
  renderDailyConfiguredBosses();
  calculateSummary();
}

// 5. 보스 리스트 및 1/N 파티 인원 선택 렌더링
function renderBossList() {
  const grid = document.getElementById('bossListGrid');
  const charBosses = bossSettings[activeCharName] || {};
  const characterCount = getCharacterWeeklyBossCount(charBosses);
  const monthlyCount = Object.keys(charBosses).filter(isMonthlyBossId).length;
  const totalCount = getTotalCrystalCount();
  const isReadOnly = isViewingOtherAccount();

  document.getElementById('selectedCharTitle').textContent = `⚔️ ${activeCharName} 보스 설정 (주간 ${characterCount}/12 · 월간 ${monthlyCount})`;
  const renderGroup = group => {
    const selectedBoss = group.find(boss => charBosses[boss.id] !== undefined);
    const isChecked = Boolean(selectedBoss);
    const selectedPartySize = selectedBoss ? charBosses[selectedBoss.id] : 1;
    const myShare = selectedBoss
      ? Math.floor(selectedBoss.price / selectedPartySize)
      : null;
    const isMonthly = isMonthlyBossId(group[0].id);
    const disabled = isReadOnly || (!isChecked && !isMonthly && (characterCount >= 12 || totalCount >= 90));

    return `
      <div class="flex items-center justify-between gap-3 bg-slate-900/70 border ${isChecked ? 'border-amber-500/50' : 'border-slate-700/70'} rounded-lg px-3 py-2">
        <div class="flex items-start gap-2.5 flex-1 min-w-0">
          <input type="checkbox" ${isChecked ? 'checked' : ''} ${disabled ? 'disabled' : ''}
            aria-label="${group[0].name} 선택"
            onchange="toggleBoss('${group[0].id}', this.checked)"
            class="w-4 h-4 mt-1 accent-amber-500 rounded" />
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium ${isChecked ? 'text-white' : 'text-slate-400'}">${group[0].name}</div>
            <div class="flex flex-wrap gap-1.5 mt-1.5">
              ${group.map(boss => `
                <button type="button" ${disabled ? 'disabled' : ''}
                  onclick="selectBossDifficulty('${boss.id}')"
                  aria-pressed="${selectedBoss?.id === boss.id}"
                  class="px-2 py-1 text-[11px] rounded-md border transition disabled:opacity-40 ${selectedBoss?.id === boss.id ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'}">
                  ${boss.diff}
                </button>
              `).join('')}
            </div>
            <div class="text-xs text-amber-400/90 font-mono mt-1">
              ${selectedBoss ? `${myShare.toLocaleString()} 메소` : '난이도를 선택하세요'}
            </div>
          </div>
        </div>

        <div class="flex shrink-0 flex-col items-end gap-2">
          <select ${!isChecked || isReadOnly ? 'disabled' : ''}
            onchange="changePartySize('${selectedBoss?.id || group[0].id}', this.value)"
            class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 disabled:opacity-40">
            ${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${selectedPartySize == n ? 'selected' : ''}>${n}인 (1/${n})</option>`).join('')}
          </select>
        </div>
      </div>
    `;
  };

  const groups = getBossGroups();
  const weeklyGroups = groups.filter(group => !isMonthlyBossId(group[0].id));
  const monthlyGroups = groups.filter(group => isMonthlyBossId(group[0].id));
  grid.innerHTML = `
    <div class="col-span-full -mb-1 text-sm font-bold text-sky-300">주간 보스</div>
    ${weeklyGroups.map(renderGroup).join('')}
    <div class="col-span-full mt-3 -mb-1 border-t border-slate-700 pt-3 text-sm font-bold text-violet-300">월간 보스</div>
    ${monthlyGroups.map(renderGroup).join('')}
  `;
  renderDailyConfiguredBosses();
}

function getDailyBossClearStorageKey() {
  return `maple_daily_boss_clears_${encodeURIComponent(bossClearScope)}`;
}

function loadDailyBossClearStatus(scope) {
  bossClearScope = scope || 'guest';
  try {
    dailyBossClearStatus = JSON.parse(localStorage.getItem(getDailyBossClearStorageKey()) || '{}');
  } catch {
    dailyBossClearStatus = {};
  }
}

function saveDailyBossClearStatus() {
  localStorage.setItem(getDailyBossClearStorageKey(), JSON.stringify(dailyBossClearStatus));
}

function renderDailyConfiguredBosses() {
  const container = document.getElementById('dailyConfiguredBosses');
  if (!container) return;
  const isReadOnly = viewedOwner && (!currentUser || currentUser.username !== viewedOwner);
  const configured = Object.keys(bossSettings[activeCharName] || {})
    .filter(bossId => !isMonthlyBossId(bossId))
    .map(bossId => ({ boss: BOSS_LIST.find(item => item.id === bossId), partySize: bossSettings[activeCharName][bossId] }))
    .filter(entry => entry.boss);
  const dateStatus = dailyBossClearStatus[selectedCalendarDate] || {};
  const charStatus = dateStatus[activeCharName] || {};
  const allCleared = configured.length > 0 && configured.every(({ boss }) => Boolean(charStatus[boss.id]));
  const allCheckbox = document.getElementById('clearAllDailyBosses');
  if (allCheckbox) {
    allCheckbox.checked = allCleared;
    allCheckbox.disabled = Boolean(isReadOnly) || configured.length === 0;
  }
  container.innerHTML = configured.length
    ? configured.map(({ boss, partySize }) => `<label class="flex items-center justify-between gap-3 rounded-lg border border-slate-700/70 bg-slate-800/70 px-3 py-2.5 text-sm text-slate-200">
        <span class="min-w-0">${boss.name} · ${boss.diff} <span class="text-slate-400">(${partySize}인)</span></span>
        <span class="flex shrink-0 items-center gap-2 font-semibold text-emerald-300"><input type="checkbox" ${charStatus[boss.id] ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''} onchange="toggleDailyBossCleared('${boss.id}', this.checked)" class="h-4 w-4 accent-emerald-500" /> 클리어</span>
      </label>`).join('')
    : '<p class="rounded border border-slate-700/70 bg-slate-800/50 px-2 py-2 text-[11px] text-slate-500">이 캐릭터에 설정된 주간 보스가 없습니다.</p>';
}

function toggleDailyBossCleared(bossId, checked) {
  if (isViewingOtherAccount()) return;
  if (!dailyBossClearStatus[selectedCalendarDate]) dailyBossClearStatus[selectedCalendarDate] = {};
  if (!dailyBossClearStatus[selectedCalendarDate][activeCharName]) dailyBossClearStatus[selectedCalendarDate][activeCharName] = {};
  dailyBossClearStatus[selectedCalendarDate][activeCharName][bossId] = checked;
  saveDailyBossClearStatus();
  renderDailyConfiguredBosses();
  persistViewedAccountData();
}

function setAllDailyBossesCleared(checked) {
  if (isViewingOtherAccount()) return;
  if (!dailyBossClearStatus[selectedCalendarDate]) dailyBossClearStatus[selectedCalendarDate] = {};
  if (!dailyBossClearStatus[selectedCalendarDate][activeCharName]) dailyBossClearStatus[selectedCalendarDate][activeCharName] = {};
  Object.keys(bossSettings[activeCharName] || {}).filter(bossId => !isMonthlyBossId(bossId))
    .forEach(bossId => { dailyBossClearStatus[selectedCalendarDate][activeCharName][bossId] = checked; });
  saveDailyBossClearStatus();
  renderDailyConfiguredBosses();
  persistViewedAccountData();
}

function toggleBoss(bossId, checked) {
  if (!bossSettings[activeCharName]) bossSettings[activeCharName] = {};
  const boss = BOSS_LIST.find(item => item.id === bossId);
  if (!boss) return;
  const group = BOSS_LIST.filter(item => item.name === boss.name);
  const existingBoss = group.find(item => bossSettings[activeCharName][item.id] !== undefined);

  if (checked) {
    if (!existingBoss && !isMonthlyBossId(bossId) && getCharacterWeeklyBossCount(bossSettings[activeCharName]) >= 12) {
      alert('캐릭터당 주간 보스는 최대 12개까지 선택할 수 있습니다.');
      renderBossList();
      return;
    }
    if (!existingBoss && !isMonthlyBossId(bossId) && getTotalCrystalCount() >= 90) {
      alert('계정당 주간 결정석 최대 한도(90개)에 도달했습니다.');
      renderBossList();
      return;
    }
    group.forEach(item => delete bossSettings[activeCharName][item.id]);
    bossSettings[activeCharName][bossId] = 1;
  } else {
    group.forEach(item => delete bossSettings[activeCharName][item.id]);
  }
  renderCharacterTabs();
  renderBossList();
  calculateSummary();
}

function selectBossDifficulty(bossId) {
  if (!bossSettings[activeCharName]) bossSettings[activeCharName] = {};
  const boss = BOSS_LIST.find(item => item.id === bossId);
  if (!boss) return;

  const group = BOSS_LIST.filter(item => item.name === boss.name);
  const existingBoss = group.find(item => bossSettings[activeCharName][item.id] !== undefined);
  if (!existingBoss && !isMonthlyBossId(bossId) && getCharacterWeeklyBossCount(bossSettings[activeCharName]) >= 12) {
    alert('캐릭터당 주간 보스는 최대 12개까지 선택할 수 있습니다.');
    return;
  }
  if (!existingBoss && !isMonthlyBossId(bossId) && getTotalCrystalCount() >= 90) {
    return alert('계정당 주간 결정석 최대 한도(90개)에 도달했습니다.');
  }

  const partySize = existingBoss ? bossSettings[activeCharName][existingBoss.id] : 1;
  group.forEach(item => delete bossSettings[activeCharName][item.id]);
  bossSettings[activeCharName][bossId] = partySize;
  renderCharacterTabs();
  renderBossList();
  calculateSummary();
}

function changePartySize(bossId, size) {
  if (bossSettings[activeCharName]?.[bossId] !== undefined) {
    bossSettings[activeCharName][bossId] = Number(size);
    renderBossList();
    calculateSummary();
  }
}

// 6. 전체 결정석 개수(90개 한도) 및 1/N 합산 계산
function getTotalCrystalCount() {
  let count = 0;
  Object.values(bossSettings).forEach(charObj => {
    count += Object.keys(charObj).filter(bossId => !isMonthlyBossId(bossId)).length;
  });
  return count;
}

function isMonthlyBossId(bossId) {
  return BOSS_LIST.find(boss => boss.id === bossId)?.diff.includes('(월간)') || false;
}

function getCharacterWeeklyBossCount(charBosses = {}) {
  return Object.keys(charBosses).filter(bossId => !isMonthlyBossId(bossId)).length;
}

function getBossGroups() {
  const groups = new Map();
  BOSS_LIST.forEach(boss => {
    if (!groups.has(boss.name)) groups.set(boss.name, []);
    groups.get(boss.name).push(boss);
  });
  return Array.from(groups.values());
}

// 기존 저장값에 같은 보스의 여러 난이도가 들어 있으면 보상이 가장 높은 하나로 정리합니다.
function normalizeBossSettings(settings) {
  const normalized = {};
  const bossById = Object.fromEntries(BOSS_LIST.map(boss => [boss.id, boss]));
  const removedBossIds = new Set(['akechi', 'princess_no']);

  Object.entries(settings || {}).forEach(([charName, savedBosses]) => {
    const selectedByBossName = new Map();
    const unknownBosses = {};

    Object.entries(savedBosses || {}).forEach(([bossId, partySize]) => {
      const boss = bossById[bossId];
      if (!boss) {
        if (!removedBossIds.has(bossId)) unknownBosses[bossId] = partySize;
        return;
      }

      const previous = selectedByBossName.get(boss.name);
      if (!previous || boss.price > previous.boss.price) {
        selectedByBossName.set(boss.name, { boss, partySize });
      }
    });

    normalized[charName] = {
      ...unknownBosses,
      ...Object.fromEntries(Array.from(selectedByBossName.values(), ({ boss, partySize }) => [boss.id, partySize]))
    };
  });

  return normalized;
}

function calculateSummary() {
  let totalMeso = 0;
  let monthlyMeso = 0;
  let charMeso = 0;
  const priceMap = Object.fromEntries(BOSS_LIST.map(b => [b.id, b.price]));

  Object.entries(bossSettings).forEach(([cName, bosses]) => {
    Object.entries(bosses).forEach(([bId, partySize]) => {
      const share = Math.floor((priceMap[bId] || 0) / partySize);
      if (isMonthlyBossId(bId)) monthlyMeso += share;
      else totalMeso += share;
      if (cName === activeCharName) charMeso += share;
    });
  });

  const count = getTotalCrystalCount();
  document.getElementById('totalMeso').textContent = `${totalMeso.toLocaleString()} 메소`;
  document.getElementById('monthlyBossMeso').textContent = `${monthlyMeso.toLocaleString()} 메소`;
  document.getElementById('selectedCharMeso').textContent = `소계: ${charMeso.toLocaleString()} 메소`;
  const counterEl = document.getElementById('crystalCounter');
  counterEl.textContent = `${count} / 90개`;
  counterEl.className = `text-xl font-bold ${count >= 90 ? 'text-rose-400' : 'text-emerald-400'}`;
}

// 7. Supabase DB에 내 보스 설정 영구 저장
async function saveMySettings() {
  if (!currentUser) return;
  const { error } = await persistViewedAccountData(true);

  if (error) alert('저장 실패: ' + error.message);
  else alert('내 주간 보스 설정이 저장되었습니다! 이제 친구가 내 닉네임으로 검색하면 그대로 볼 수 있습니다.');
}

// 8. 초간단 회원가입 & 로그인 모달 로직
function openAuthModal(mode) {
  authMode = mode;
  document.getElementById('modalTitle').textContent = mode === 'login' ? '로그인' : '초간단 회원가입 (인증 없음)';
  document.getElementById('signupCharField').classList.toggle('hidden', mode === 'login');
  document.getElementById('policyConsentField').classList.toggle('hidden', mode === 'login');
  document.getElementById('policyConsent').checked = false;
  document.getElementById('authModal').classList.remove('hidden');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
}

async function submitAuth() {
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  const mainChar = document.getElementById('authMainChar').value.trim();

  if (!username || !password) return alert('아이디와 비밀번호를 입력하세요.');
  const password_hash = await hashPassword(password);

  if (authMode === 'signup') {
    if (!document.getElementById('policyConsent').checked) return alert('회원가입을 계속하려면 이용약관에 동의해 주세요.');
    if (!mainChar) return alert('대표 캐릭터 닉네임을 입력하세요.');
    
    // 넥슨 API 호출 및 방어 코드 (JSON 파싱 에러 방지)
    let characterNames = [mainChar];
    try {
      const mapleRes = await fetch(`/api/maple?name=${encodeURIComponent(mainChar)}`);
      const text = await mapleRes.text();
      const mapleData = JSON.parse(text);
      if (mapleRes.ok && mapleData.allCharacterNames) {
        characterNames = mapleData.allCharacterNames;
      }
    } catch (e) {
      console.warn('부캐 자동 수집 중 경고 (대표 캐릭터만 등록됩니다):', e);
    }

    const { error } = await supabaseClient.from('users').insert({
      username,
      password_hash,
      main_character: mainChar,
      account_characters: characterNames
    });

    if (error) return alert('가입 실패 (중복된 아이디일 수 있습니다): ' + error.message);
    alert('가입 완료! 자동 로그인됩니다.');
    currentUser = { username, main_character: mainChar };
  
  } else {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password_hash', password_hash)
      .single();

    if (error || !data) return alert('아이디 또는 비밀번호가 일치하지 않습니다.');
    currentUser = { username: data.username, main_character: data.main_character };
  }

  localStorage.setItem('maple_user', JSON.stringify(currentUser));
  closeAuthModal();
  updateAuthUI();
  showHome();
}

function logout() {
  currentUser = null;
  localStorage.removeItem('maple_user');
  updateAuthUI();
  showHome();
}

async function withdrawAccount() {
  if (!currentUser) return;
  const password = prompt('본인 확인을 위해 비밀번호를 입력해 주세요.');
  if (password === null) return;
  if (!password) return alert('비밀번호를 입력해 주세요.');

  const username = currentUser.username;
  const passwordHash = await hashPassword(password);
  const { data: verifiedUser, error: verifyError } = await supabaseClient
    .from('users')
    .select('username')
    .eq('username', username)
    .eq('password_hash', passwordHash)
    .single();
  if (verifyError || !verifiedUser) return alert('비밀번호가 맞지 않거나 계정을 확인할 수 없습니다.');

  if (!confirm('회원탈퇴하면 서버에 저장된 보스 설정과 날짜별 기록이 삭제됩니다. 탈퇴할까요?')) return;

  const { error: settingsError } = await supabaseClient
    .from('boss_settings')
    .delete()
    .eq('username', username);
  if (settingsError) return alert(`저장 기록 삭제 실패: ${settingsError.message}`);

  const { data: deletedUsers, error: userError } = await supabaseClient
    .from('users')
    .delete()
    .eq('username', username)
    .eq('password_hash', passwordHash)
    .select('username');
  if (userError || !deletedUsers?.length) {
    return alert(`회원정보를 삭제하지 못했습니다.${userError ? ` ${userError.message}` : ' Supabase 삭제 권한 설정을 확인해 주세요.'}`);
  }

  localStorage.removeItem('maple_user');
  localStorage.removeItem('maple_daily_loot_logs');
  localStorage.removeItem(`maple_daily_boss_clears_${encodeURIComponent(username)}`);
  currentUser = null;
  viewedOwner = null;
  bossSettings = {};
  dailyBossClearStatus = {};
  dailyLootLogs = {};
  updateAuthUI();
  showHome();
  alert('회원탈퇴가 완료됐고 계정의 서버 저장 기록을 삭제했습니다.');
}

function updateAuthUI() {
  const area = document.getElementById('authArea');
  if (currentUser) {
    area.innerHTML = `
      <span class="text-slate-300 font-medium">👋 ${currentUser.username}님</span>
      <button onclick="searchAccount('${currentUser.main_character}')" class="bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded text-xs">내 계정</button>
      <button onclick="withdrawAccount()" class="bg-slate-700 hover:bg-rose-700 px-2.5 py-1 rounded text-xs text-rose-200">회원탈퇴</button>
      <button onclick="logout()" class="bg-rose-600/80 hover:bg-rose-600 px-2.5 py-1 rounded text-xs">로그아웃</button>
    `;
  } else {
    area.innerHTML = `
      <button onclick="openAuthModal('login')" class="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg">로그인</button>
      <button onclick="openAuthModal('signup')" class="bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg font-medium">초간단 가입</button>
    `;
  }
}

// 9. 우측 캘린더, 썬데이 메이플 및 날짜별 획득 기록
function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDailyLogs() {
  return dailyLootLogs;
}

function readLocalDailyLogs() {
  try {
    return JSON.parse(localStorage.getItem(DAILY_LOG_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function storeDailyLogsLocally() {
  localStorage.setItem(DAILY_LOG_STORAGE_KEY, JSON.stringify(dailyLootLogs));
}

async function persistViewedAccountData(showError = false) {
  const ownsViewedAccount = Boolean(currentUser && currentUser.username === viewedOwner);
  if (!ownsViewedAccount) {
    if (!viewedOwner && !currentUser) storeDailyLogsLocally();
    return { error: null, localOnly: true };
  }
  storeDailyLogsLocally();

  const { error } = await supabaseClient
    .from('boss_settings')
    .upsert({
      username: currentUser.username,
      settings_json: {
        ...bossSettings,
        __dailyBossClears: dailyBossClearStatus,
        __dailyLootLogs: dailyLootLogs
      },
      updated_at: new Date().toISOString()
    });
  if (error && showError) alert('저장 실패: ' + error.message);
  return { error, localOnly: false };
}

function initDailyLogControls() {
  renderDailyItemRows([]);
}

function changeCalendarMonth(offset) {
  const [year, month] = selectedCalendarDate.split('-').map(Number);
  const current = new Date(year, month - 1, 1);
  current.setMonth(current.getMonth() + offset);
  const newYear = current.getFullYear();
  const newMonth = String(current.getMonth() + 1).padStart(2, '0');
  const maxDay = new Date(newYear, current.getMonth() + 1, 0).getDate();
  const selectedDay = Math.min(Number(selectedCalendarDate.slice(-2)), maxDay);
  selectedCalendarDate = `${newYear}-${newMonth}-${String(selectedDay).padStart(2, '0')}`;
  renderMiniCalendar();
  selectCalendarDate(selectedCalendarDate);
}

function renderMiniCalendar() {
  const [year, month] = selectedCalendarDate.split('-').map(Number);
  const monthIndex = month - 1;
  const todayKey = toLocalDateKey(new Date());
  const logs = getDailyLogs();
  document.getElementById('calendarMonthTitle').textContent = `${year}년 ${month}월`;

  const firstDay = new Date(year, monthIndex, 1).getDay();
  const lastDate = new Date(year, monthIndex + 1, 0).getDate();
  const grid = document.getElementById('calendarGrid');
  let html = Array.from({ length: firstDay }, () => '<div></div>').join('');

  for (let day = 1; day <= lastDate; day++) {
    const date = new Date(year, monthIndex, day);
    const dateKey = toLocalDateKey(date);
    const dayOfWeek = date.getDay();
    const isSelected = dateKey === selectedCalendarDate;
    const log = logs[dateKey];
    const hasLog = Boolean(log);
    let badgeClass = 'bg-slate-700/40 text-slate-300 hover:bg-slate-600';
    let title = '날짜별 기록 입력';

    if (dayOfWeek === 0) {
      badgeClass = 'bg-rose-500/25 border border-rose-500/60 text-rose-300 font-bold hover:bg-rose-500/40';
      title = '썬데이 메이플 · 날짜별 기록';
    } else if (dayOfWeek === 4) {
      badgeClass = 'bg-sky-500/25 border border-sky-500/60 text-sky-300 font-bold hover:bg-sky-500/40';
      title = '주간 보스 · 결정석 초기화 · 날짜별 기록';
    }
    if (isSelected) badgeClass += ' ring-2 ring-amber-400';
    if (dateKey === todayKey) badgeClass += ' shadow-[inset_0_0_0_1px_rgba(251,191,36,0.65)]';

    const total = hasLog ? getDailyLogTotal(log).total : 0;
    const compactTotal = total ? formatCompactMeso(total) : '';
    const mesoHunted = Number(log?.meso) || 0;
    const compactHuntedMeso = mesoHunted ? formatCompactMeso(mesoHunted) : '';
    const showSeparateTotal = compactTotal && Math.round(total) !== Math.round(mesoHunted);
    const recordedItems = log?.items || [];
    const itemNames = recordedItems.map(item => item.name).filter(Boolean).join(', ');
    const topItem = recordedItems.reduce((best, item) =>
      !best || (Number(item.price) || 0) > (Number(best.price) || 0) ? item : best, null);
    const topItemImage = topItem?.image || (topItem?.itemId ? getMapleItemIconUrl(topItem.itemId) : '');
    const logHint = hasLog ? ` · 합계 ${Math.round(total).toLocaleString()} 메소${mesoHunted ? ` · 사냥 메소 ${Math.round(mesoHunted).toLocaleString()}` : ''}${itemNames ? ` · ${itemNames}` : ''}` : '';

    const itemIcon = topItemImage
      ? `<img src="${escapeHtml(topItemImage)}" alt="${escapeHtml(topItem.name || '획득 아이템')}" title="${escapeHtml(topItem.name || '획득 아이템')}" class="h-4 w-4 object-contain" onerror="this.classList.add('hidden')" />`
      : (topItem ? '<span class="text-[11px] leading-4" title="획득 아이템">🎁</span>' : '');
    html += `<button type="button" title="${escapeHtml(`${title}${logHint}`)}" onclick="selectCalendarDate('${dateKey}')" class="relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm font-semibold transition sm:text-base ${badgeClass}"><span>${day}</span>${showSeparateTotal ? `<span class="max-w-full truncate text-[9px] leading-3 text-emerald-200 sm:text-[10px]">총${compactTotal}</span>` : ''}${compactHuntedMeso ? `<span class="max-w-full truncate text-[9px] leading-3 text-amber-200 sm:text-[10px]">⛏${compactHuntedMeso}</span>` : (compactTotal ? `<span class="max-w-full truncate text-[9px] leading-3 text-emerald-200 sm:text-[10px]">${compactTotal}</span>` : '')}${itemIcon}${hasLog ? '<span class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-300"></span>' : ''}</button>`;
  }
  grid.innerHTML = html;
}

function getNextSundayKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + ((7 - date.getDay()) % 7));
  return toLocalDateKey(date);
}

function updateSundayMaplePanel(dateKey) {
  const sundayKey = getNextSundayKey(dateKey);
  const [year, month, day] = sundayKey.split('-').map(Number);
  const event = SUNDAY_MAPLE_EVENTS[sundayKey];
  const title = document.getElementById('sundayMapleTitle');
  const summary = document.getElementById('sundayMapleSummary');
  const image = document.getElementById('sundayMapleImage');
  const link = document.getElementById('sundayMapleLink');
  title.textContent = `썬데이 메이플 · ${month}월 ${day}일`;
  link.href = event?.url || 'https://maplestory.nexon.com/News/Event';

  if (event) {
    summary.textContent = '이번 주 이벤트 상세 내용';
    image.src = event.image;
    image.classList.remove('hidden');
  } else {
    summary.textContent = '세부 혜택은 넥슨 공식 이벤트 공지에서 확인해 주세요.';
    image.removeAttribute('src');
    image.classList.add('hidden');
  }
}

function selectCalendarDate(dateKey) {
  selectedCalendarDate = dateKey;
  const log = getDailyLogs()[dateKey] || {};
  const [year, month, day] = dateKey.split('-').map(Number);
  document.getElementById('dailyLogTitle').textContent = `${year}년 ${month}월 ${day}일 획득 기록`;
  renderDailyConfiguredBosses();
  document.getElementById('dailyMesoInput').value = log.meso || '';
  dailyItemDraft = (log.items || []).map(item => ({ ...item }));
  renderDailyItemRows(dailyItemDraft);
  document.getElementById('dailyLogStatus').textContent = log.updatedAt ? '저장된 기록을 불러왔어요.' : '';
  const isReadOnly = isViewingOtherAccount();
  document.getElementById('dailyMesoInput').disabled = Boolean(isReadOnly);
  document.getElementById('dailyAddItemButton').disabled = Boolean(isReadOnly);
  document.getElementById('dailySaveButton').disabled = Boolean(isReadOnly);
  document.getElementById('dailyClearButton').disabled = Boolean(isReadOnly);
  ['dailyAddItemButton', 'dailySaveButton', 'dailyClearButton'].forEach(id => {
    document.getElementById(id).classList.toggle('opacity-50', Boolean(isReadOnly));
    document.getElementById(id).classList.toggle('cursor-not-allowed', Boolean(isReadOnly));
  });
  updateSundayMaplePanel(dateKey);
  renderMiniCalendar();
  renderMonthlySummary();
}

function renderDailyItemRows(items) {
  const rows = items.length ? items : [];
  const isReadOnly = isViewingOtherAccount();
  document.getElementById('dailyItemRows').innerHTML = rows.map((item, index) => {
    const imageUrl = /^https:\/\//i.test(item.image || '')
      ? item.image.replace('/KMS/latest/', `/KMS/${MAPLESTORY_DATA_VERSION}/`)
      : '';
    return `<div class="rounded-xl border border-slate-700 bg-slate-800/70 p-3 sm:p-4">
      <div class="flex items-center gap-3">
        <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-900 text-2xl sm:h-20 sm:w-20">
          <span id="dailyItemFallback${index}" class="${imageUrl ? 'hidden' : ''}">🎁</span>
          <img id="dailyItemImage${index}" src="${imageUrl}" alt="" class="${imageUrl ? '' : 'hidden'} h-full w-full object-contain" onerror="this.classList.add('hidden'); document.getElementById('dailyItemFallback${index}').classList.remove('hidden')" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-base font-bold text-slate-100 sm:text-lg">${escapeHtml(item.name || '아이템을 선택하세요')}</p>
          <button type="button" ${isReadOnly ? 'disabled' : ''} onclick="openDailyItemCatalog(${index})" class="mt-2 rounded-lg border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50">${item.name ? '아이템 변경' : '아이템 고르기'}</button>
        </div>
        <button ${isReadOnly ? 'disabled' : ''} onclick="removeDailyItem(${index})" class="self-start rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-700 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50" aria-label="아이템 삭제">✕</button>
      </div>
      <input type="number" min="0" ${isReadOnly ? 'disabled' : ''} value="${escapeHtml(item.price ?? '')}" oninput="updateDailyItemPrice(${index}, this.value)" class="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 sm:text-base disabled:opacity-60" placeholder="아이템 가격 (메소)" />
      <p id="dailyItemPricePreview${index}" class="mt-2 text-sm font-semibold text-amber-200">${item.price ? escapeHtml(formatKoreanMeso(item.price)) : '금액을 입력하면 만·억 단위로 표시돼요.'}</p>
    </div>`;
  }).join('') || '<p class="text-[11px] text-slate-500">+ 아이템을 눌러 드랍 아이템을 추가하세요.</p>';
}

function isViewingOtherAccount() {
  return Boolean(viewedOwner && (!currentUser || currentUser.username !== viewedOwner));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

let dailyItemDraft = [];
const dailyItemSearchTimers = {};
let activeItemCatalogIndex = null;
let itemCatalogQuery = '';

function renderBossDropCatalog() {
  return `<div class="space-y-6">
    ${BOSS_DROP_CATALOG.map(group => `<section>
      <h3 class="mb-3 text-base font-bold text-violet-200 sm:text-lg">${group.group}</h3>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9">${group.items.map(renderItemCatalogTile).join('')}</div>
    </section>`).join('')}
  </div>`;
}

function renderItemCatalogTile(item) {
  const encodedName = encodeURIComponent(item.name).replace(/'/g, '%27');
  const itemId = Number.isInteger(item.id) ? item.id : 'null';
  const imageUrl = item.image || (Number.isInteger(item.id) ? getMapleItemIconUrl(item.id) : '');
  const imageMarkup = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)} 아이콘" loading="lazy" class="h-16 w-16 object-contain sm:h-20 sm:w-20" onerror="this.classList.add('hidden'); this.previousElementSibling.classList.remove('hidden'); this.previousElementSibling.classList.add('flex')" />`
    : '';
  return `<button type="button" title="${escapeHtml(item.name)} 선택" onclick="selectDailyItem(${activeItemCatalogIndex}, ${itemId}, '${encodedName}', '${encodeURIComponent(imageUrl)}')" class="flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 p-3 text-center transition hover:border-amber-400 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 sm:p-4">
    <span class="${imageUrl ? 'hidden' : 'flex'} h-16 w-16 items-center justify-center text-3xl sm:h-20 sm:w-20">${item.name.startsWith('익셉셔널 해머') ? '🔨' : '🎁'}</span>
    ${imageMarkup}
    <span class="line-clamp-2 min-h-10 w-full text-xs font-medium leading-5 text-slate-100 sm:text-sm">${escapeHtml(item.name)}</span>
  </button>`;
}

function addDailyItem() {
  if (viewedOwner && (!currentUser || currentUser.username !== viewedOwner)) return;
  dailyItemDraft.push({ name: '', image: '', price: '' });
  renderDailyItemRows(dailyItemDraft);
  openDailyItemCatalog(dailyItemDraft.length - 1);
}

function updateDailyItemPrice(index, value) {
  if (isViewingOtherAccount()) return;
  if (dailyItemDraft[index]) dailyItemDraft[index].price = value;
  const preview = document.getElementById(`dailyItemPricePreview${index}`);
  if (preview) preview.textContent = value ? formatKoreanMeso(value) : '금액을 입력하면 만·억 단위로 표시돼요.';
}

function openDailyItemCatalog(index) {
  if (isViewingOtherAccount()) return;
  if (!dailyItemDraft[index]) return;
  activeItemCatalogIndex = index;
  itemCatalogQuery = '';
  const search = document.getElementById('itemCatalogSearch');
  search.value = '';
  document.getElementById('itemCatalogResults').innerHTML = renderBossDropCatalog();
  document.getElementById('itemCatalogModal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  setTimeout(() => search.focus(), 0);
}

function closeDailyItemCatalog() {
  clearTimeout(dailyItemSearchTimers.catalog);
  document.getElementById('itemCatalogModal').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  activeItemCatalogIndex = null;
}

function updateItemCatalogSearch(value) {
  clearTimeout(dailyItemSearchTimers.catalog);
  itemCatalogQuery = value.trim();
  const results = document.getElementById('itemCatalogResults');
  if (itemCatalogQuery.length < 2) {
    results.innerHTML = renderBossDropCatalog();
    return;
  }
  results.innerHTML = '<p class="py-10 text-center text-base text-slate-400">한국어 아이템 이름과 아이콘을 검색 중...</p>';
  dailyItemSearchTimers.catalog = setTimeout(() => searchDailyItemCatalog(itemCatalogQuery), 300);
}

async function searchDailyItemCatalog(query) {
  const results = document.getElementById('itemCatalogResults');
  if (!results) return;
  try {
    const url = `https://maplestory.io/api/KMS/${MAPLESTORY_DATA_VERSION}/item/list?searchFor=${encodeURIComponent(query)}&count=8`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('아이템 검색에 실패했습니다.');
    const payload = await response.json();
    const items = Array.isArray(payload)
      ? payload
      : [payload.items, payload.results, payload.data].find(Array.isArray) || [];
    const apiMatches = items.map(item => ({
      id: Number(item.id ?? item.itemId ?? item.item_id ?? item.ItemId),
      name: item.name ?? item.itemName ?? item.item_name ?? item.ItemName
    })).filter(item => Number.isInteger(item.id) && item.name);
    const normalizedQuery = query.replace(/\s/g, '').toLowerCase();
    const catalogMatches = BOSS_DROP_CATALOG.flatMap(group => group.items)
      .filter(item => item.name.replace(/\s/g, '').toLowerCase().includes(normalizedQuery));
    const matches = [...catalogMatches, ...apiMatches]
      .filter((item, position, all) => all.findIndex(candidate =>
        item.id != null && candidate.id != null ? candidate.id === item.id : candidate.name === item.name
      ) === position)
      .slice(0, 12);
    if (itemCatalogQuery !== query || activeItemCatalogIndex === null) return;

    if (!matches.length) {
      results.innerHTML = '<p class="py-10 text-center text-base text-slate-400">검색 결과가 없어요. 이름을 다시 확인해 주세요.</p>';
      return;
    }
    results.innerHTML = `<div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9">${matches.map(renderItemCatalogTile).join('')}</div>`;
  } catch (error) {
    if (itemCatalogQuery === query && activeItemCatalogIndex !== null) {
      results.innerHTML = '<p class="py-10 text-center text-base text-rose-300">아이템 검색을 불러오지 못했어요. 잠시 후 다시 검색해 주세요.</p>';
    }
  }
}

function selectDailyItem(index, itemId, encodedName, encodedImage = '') {
  if (isViewingOtherAccount()) return;
  clearTimeout(dailyItemSearchTimers[index]);
  const name = decodeURIComponent(encodedName);
  dailyItemDraft[index] = {
    ...dailyItemDraft[index],
    name,
    itemId,
    image: itemId ? getMapleItemIconUrl(itemId) : decodeURIComponent(encodedImage)
  };
  closeDailyItemCatalog();
  renderDailyItemRows(dailyItemDraft);
}

function removeDailyItem(index) {
  if (isViewingOtherAccount()) return;
  clearTimeout(dailyItemSearchTimers.catalog);
  if (activeItemCatalogIndex === index) closeDailyItemCatalog();
  dailyItemDraft.splice(index, 1);
  renderDailyItemRows(dailyItemDraft);
}

function saveDailyLog() {
  if (viewedOwner && (!currentUser || currentUser.username !== viewedOwner)) return;
  const meso = Number(document.getElementById('dailyMesoInput').value || 0);
  const clearedBosses = getClearedConfiguredBossEntries(selectedCalendarDate);
  const items = dailyItemDraft
    .filter(item => item.name.trim() || item.image.trim() || Number(item.price) > 0)
    .map(item => ({ name: item.name.trim(), itemId: item.itemId || null, image: item.image.trim(), price: Number(item.price) || 0 }));

  if (clearedBosses.length === 0 && meso === 0 && items.length === 0) {
    delete dailyLootLogs[selectedCalendarDate];
  } else {
    dailyLootLogs[selectedCalendarDate] = {
      bosses: clearedBosses,
      bossId: clearedBosses[0]?.bossId || '',
      partySize: clearedBosses[0]?.partySize || 1,
      meso,
      items,
      updatedAt: new Date().toISOString()
    };
  }
  document.getElementById('dailyLogStatus').textContent = currentUser?.username === viewedOwner
    ? '저장 중...'
    : '이 브라우저에 저장했어요.';
  renderMiniCalendar();
  renderMonthlySummary();
  persistViewedAccountData().then(({ error, localOnly }) => {
    document.getElementById('dailyLogStatus').textContent = error
      ? `계정 저장 실패: ${error.message}`
      : localOnly ? '이 브라우저에 저장했어요.' : '계정에 저장했어요. 친구도 볼 수 있어요.';
  });
}

function getClearedConfiguredBossEntries(dateKey) {
  const statusByCharacter = dailyBossClearStatus[dateKey] || {};
  const entries = [];
  Object.entries(statusByCharacter).forEach(([charName, status]) => {
    Object.entries(status || {}).forEach(([bossId, isCleared]) => {
      const partySize = bossSettings[charName]?.[bossId];
      if (!isCleared || partySize === undefined || isMonthlyBossId(bossId)) return;
      entries.push({ bossId, partySize: Number(partySize) || 1, characterName: charName });
    });
  });
  return entries;
}

function clearDailyLog() {
  if (viewedOwner && (!currentUser || currentUser.username !== viewedOwner)) return;
  delete dailyLootLogs[selectedCalendarDate];
  delete dailyBossClearStatus[selectedCalendarDate];
  saveDailyBossClearStatus();
  renderDailyConfiguredBosses();
  document.getElementById('dailyMesoInput').value = '';
  dailyItemDraft = [];
  renderDailyItemRows(dailyItemDraft);
  document.getElementById('dailyLogStatus').textContent = '선택한 날짜의 기록을 지우는 중...';
  renderMiniCalendar();
  renderMonthlySummary();
  persistViewedAccountData().then(({ error, localOnly }) => {
    document.getElementById('dailyLogStatus').textContent = error
      ? `계정 저장 실패: ${error.message}`
      : localOnly ? '선택한 날짜의 기록을 지웠어요.' : '기록을 삭제하고 계정에 저장했어요.';
  });
}

function getDailyLogTotal(log) {
  const bossEntries = Array.isArray(log.bosses) && log.bosses.length
    ? log.bosses
    : (log.bossId ? [{ bossId: log.bossId, partySize: log.partySize }] : []);
  const bossIncome = bossEntries.reduce((sum, entry) => {
    const boss = BOSS_LIST.find(item => item.id === (typeof entry === 'string' ? entry : entry.bossId));
    const partySize = Number(typeof entry === 'string' ? log.partySize : entry.partySize) || 1;
    return sum + (boss ? boss.price / partySize : 0);
  }, 0);
  const itemIncome = (log.items || []).reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const mesoIncome = Number(log.meso) || 0;
  return { bossIncome, itemIncome, mesoIncome, total: bossIncome + itemIncome + mesoIncome };
}

function formatCompactMeso(value) {
  const amount = Math.max(0, Number(value) || 0);
  if (amount >= 1_000_000_000_000) return `${(amount / 1_000_000_000_000).toFixed(1).replace(/\.0$/, '')}조`;
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1).replace(/\.0$/, '')}억`;
  if (amount >= 10_000) return `${Math.round(amount / 10_000).toLocaleString()}만`;
  return Math.round(amount).toLocaleString();
}

function formatKoreanMeso(value) {
  let amount = Math.max(0, Math.floor(Number(value) || 0));
  if (!amount) return '0 메소';
  const parts = [];
  const jo = Math.floor(amount / 1_000_000_000_000);
  amount %= 1_000_000_000_000;
  const eok = Math.floor(amount / 100_000_000);
  amount %= 100_000_000;
  const man = Math.floor(amount / 10_000);
  amount %= 10_000;
  if (jo) parts.push(`${jo.toLocaleString()}조`);
  if (eok) parts.push(`${eok.toLocaleString()}억`);
  if (man) parts.push(`${man.toLocaleString()}만`);
  if (amount) parts.push(`${amount.toLocaleString()}`);
  return `${parts.join(' ')} 메소 · ${Math.floor(Number(value)).toLocaleString()} 메소`;
}

function renderMonthlySummary() {
  const monthPrefix = selectedCalendarDate.slice(0, 7);
  const logs = getDailyLogs();
  const entries = Object.entries(logs)
    .filter(([date]) => date.startsWith(monthPrefix))
    .sort(([a], [b]) => a.localeCompare(b));
  let bossTotal = 0;
  let itemTotal = 0;
  let mesoTotal = 0;
  const rows = entries.map(([date, log]) => {
    const totals = getDailyLogTotal(log);
    bossTotal += totals.bossIncome;
    itemTotal += totals.itemIncome;
    mesoTotal += totals.mesoIncome;
    const itemNames = (log.items || []).map(item => item.name).filter(Boolean).join(', ');
    const description = itemNames;
    return `<div class="flex flex-col gap-1 rounded-lg border border-slate-700/70 bg-slate-800/50 p-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3"><span class="min-w-0 text-sm leading-5 text-slate-200">${Number(date.slice(-2))}일${description ? ` · ${escapeHtml(description)}` : ''}</span><strong class="shrink-0 text-sm text-emerald-300">${Math.round(totals.total).toLocaleString()} 메소</strong></div>`;
  });
  document.getElementById('monthlyTotal').textContent = `${Math.round(bossTotal + itemTotal + mesoTotal).toLocaleString()} 메소`;
  document.getElementById('monthlyBreakdown').textContent = `보스 수입 합계 ${Math.round(bossTotal).toLocaleString()} · 아이템 ${Math.round(itemTotal).toLocaleString()} · 사냥 메소 ${Math.round(mesoTotal).toLocaleString()}`;
  document.getElementById('monthlyRecordsList').innerHTML = rows.join('') || '<p class="text-slate-500">이번 달 기록이 아직 없어요.</p>';
}
