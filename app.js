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

// 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
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

});

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
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '조회 실패');

    showSearchView();
    top5Characters = data.top5;
    activeCharName = top5Characters[0]?.name || '';

    // Supabase에서 해당 계정의 캐릭터들을 보유한 회원이 있는지 확인 (친구 설정 불러오기)
    const { data: matchedUsers } = await supabaseClient
      .from('users')
      .select('username, main_character, account_characters')
      .or(`main_character.eq.${queryName},account_characters.cs.{${queryName}}`);

    viewedOwner = matchedUsers && matchedUsers.length > 0 ? matchedUsers[0].username : null;

    if (viewedOwner) {
      const { data: settingRow } = await supabaseClient
        .from('boss_settings')
        .select('settings_json')
        .eq('username', viewedOwner)
        .single();
      bossSettings = normalizeBossSettings(settingRow?.settings_json || {});
    } else {
      bossSettings = {};
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
    const count = Object.keys(bossSettings[char.name] || {}).length;
    return `
      <button onclick="selectCharacterTab('${char.name}')"
        class="px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
          isActive ? 'border-amber-400 text-amber-400 bg-slate-800' : 'border-transparent text-slate-400 hover:text-slate-200'
        }">
        ${char.name} <span class="text-xs opacity-75">(${count})</span>
      </button>
    `;
  }).join('');
}

function selectCharacterTab(charName) {
  activeCharName = charName;
  renderTop5Cards();
  renderCharacterTabs();
  renderBossList();
  calculateSummary();
}

// 5. 보스 리스트 및 1/N 파티 인원 선택 렌더링
function renderBossList() {
  const grid = document.getElementById('bossListGrid');
  const charBosses = bossSettings[activeCharName] || {};
  const characterCount = Object.keys(charBosses).length;
  const totalCount = getTotalCrystalCount();
  const isReadOnly = viewedOwner && (!currentUser || currentUser.username !== viewedOwner);

  document.getElementById('selectedCharTitle').textContent = `⚔️ ${activeCharName} 주간 보스 설정 (${characterCount}/12)`;

  grid.innerHTML = getBossGroups().map(group => {
    const selectedBoss = group.find(boss => charBosses[boss.id] !== undefined);
    const isChecked = Boolean(selectedBoss);
    const selectedPartySize = selectedBoss ? charBosses[selectedBoss.id] : 1;
    const myShare = selectedBoss
      ? Math.floor(selectedBoss.price / selectedPartySize)
      : null;
    const disabled = isReadOnly || (!isChecked && (characterCount >= 12 || totalCount >= 90));

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

        <select ${!isChecked || isReadOnly ? 'disabled' : ''}
          onchange="changePartySize('${selectedBoss?.id || group[0].id}', this.value)"
          class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 disabled:opacity-40">
          ${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${selectedPartySize == n ? 'selected' : ''}>${n}인 (1/${n})</option>`).join('')}
        </select>
      </div>
    `;
  }).join('');
}

function toggleBoss(bossId, checked) {
  if (!bossSettings[activeCharName]) bossSettings[activeCharName] = {};
  const boss = BOSS_LIST.find(item => item.id === bossId);
  if (!boss) return;
  const group = BOSS_LIST.filter(item => item.name === boss.name);
  const existingBoss = group.find(item => bossSettings[activeCharName][item.id] !== undefined);

  if (checked) {
    if (!existingBoss && Object.keys(bossSettings[activeCharName]).length >= 12) {
      alert('캐릭터당 주간 보스는 최대 12개까지 선택할 수 있습니다.');
      renderBossList();
      return;
    }
    if (!existingBoss && getTotalCrystalCount() >= 90) {
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
  if (!existingBoss && Object.keys(bossSettings[activeCharName]).length >= 12) {
    alert('캐릭터당 주간 보스는 최대 12개까지 선택할 수 있습니다.');
    return;
  }
  if (!existingBoss && getTotalCrystalCount() >= 90) {
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
    count += Object.keys(charObj).length;
  });
  return count;
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
  let charMeso = 0;
  const priceMap = Object.fromEntries(BOSS_LIST.map(b => [b.id, b.price]));

  Object.entries(bossSettings).forEach(([cName, bosses]) => {
    Object.entries(bosses).forEach(([bId, partySize]) => {
      const share = Math.floor((priceMap[bId] || 0) / partySize);
      totalMeso += share;
      if (cName === activeCharName) charMeso += share;
    });
  });

  const count = getTotalCrystalCount();
  document.getElementById('totalMeso').textContent = `${totalMeso.toLocaleString()} 메소`;
  document.getElementById('selectedCharMeso').textContent = `소계: ${charMeso.toLocaleString()} 메소`;
  const counterEl = document.getElementById('crystalCounter');
  counterEl.textContent = `${count} / 90개`;
  counterEl.className = `text-xl font-bold ${count >= 90 ? 'text-rose-400' : 'text-emerald-400'}`;
}

// 7. Supabase DB에 내 보스 설정 영구 저장
async function saveMySettings() {
  if (!currentUser) return;
  const { error } = await supabaseClient
    .from('boss_settings')
    .upsert({
      username: currentUser.username,
      settings_json: bossSettings,
      updated_at: new Date().toISOString()
    });

  if (error) alert('저장 실패: ' + error.message);
  else alert('내 주간 보스 설정이 저장되었습니다! 이제 친구가 내 닉네임으로 검색하면 그대로 볼 수 있습니다.');
}

// 8. 초간단 회원가입 & 로그인 모달 로직
function openAuthModal(mode) {
  authMode = mode;
  document.getElementById('modalTitle').textContent = mode === 'login' ? '로그인' : '초간단 회원가입 (인증 없음)';
  document.getElementById('signupCharField').classList.toggle('hidden', mode === 'login');
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

function updateAuthUI() {
  const area = document.getElementById('authArea');
  if (currentUser) {
    area.innerHTML = `
      <span class="text-slate-300 font-medium">👋 ${currentUser.username}님</span>
      <button onclick="searchAccount('${currentUser.main_character}')" class="bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded text-xs">내 계정</button>
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
  try {
    return JSON.parse(localStorage.getItem(DAILY_LOG_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function initDailyLogControls() {
  const bossSelect = document.getElementById('dailyBossSelect');
  bossSelect.innerHTML = '<option value="">보스 선택 안 함</option>' + BOSS_LIST.map(boss =>
    `<option value="${boss.id}">${boss.name} ${boss.diff} · ${boss.price.toLocaleString()} 메소</option>`
  ).join('');
  document.getElementById('dailyBossParty').innerHTML = Array.from({ length: 6 }, (_, i) =>
    `<option value="${i + 1}">${i + 1}인</option>`
  ).join('');
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
    const hasLog = Boolean(logs[dateKey]);
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

    html += `<button type="button" title="${title}" onclick="selectCalendarDate('${dateKey}')" class="relative py-1.5 rounded-md ${badgeClass}">${day}${hasLog ? '<span class="absolute right-1 top-0.5 h-1 w-1 rounded-full bg-emerald-300"></span>' : ''}</button>`;
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
  document.getElementById('dailyBossSelect').value = log.bossId || '';
  document.getElementById('dailyBossParty').value = String(log.partySize || 1);
  document.getElementById('dailyMesoInput').value = log.meso || '';
  dailyItemDraft = (log.items || []).map(item => ({ ...item }));
  renderDailyItemRows(dailyItemDraft);
  document.getElementById('dailyLogStatus').textContent = log.updatedAt ? '저장된 기록을 불러왔어요.' : '';
  updateDailyBossPreview();
  updateSundayMaplePanel(dateKey);
  renderMiniCalendar();
  renderMonthlySummary();
}

function updateDailyBossPreview() {
  const boss = BOSS_LIST.find(item => item.id === document.getElementById('dailyBossSelect').value);
  const partySize = Number(document.getElementById('dailyBossParty').value || 1);
  document.getElementById('dailyBossValue').textContent = boss
    ? `내 몫 ${(boss.price / partySize).toLocaleString()} 메소`
    : '';
}

function renderDailyItemRows(items) {
  const rows = items.length ? items : [];
  document.getElementById('dailyItemRows').innerHTML = rows.map((item, index) => {
    const imageUrl = /^https:\/\//i.test(item.image || '') ? item.image : '';
    return `<div class="rounded-md border border-slate-700 bg-slate-800/70 p-2">
      <div class="flex gap-2">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-900 text-xl">
          <span id="dailyItemFallback${index}" class="${imageUrl ? 'hidden' : ''}">🎁</span>
          <img id="dailyItemImage${index}" src="${imageUrl}" alt="" class="${imageUrl ? '' : 'hidden'} h-full w-full object-contain" onerror="this.classList.add('hidden'); document.getElementById('dailyItemFallback${index}').classList.remove('hidden')" />
        </div>
        <div class="min-w-0 flex-1 space-y-1">
          <input value="${escapeHtml(item.name || '')}" oninput="updateDailyItem(${index}, 'name', this.value)" class="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs" placeholder="아이템 검색 (예: 생명의 연마석)" />
          <div id="dailyItemSearch${index}" class="max-h-28 space-y-1 overflow-y-auto"></div>
          <input value="${escapeHtml(item.image || '')}" oninput="updateDailyItem(${index}, 'image', this.value)" class="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[10px]" placeholder="아이템 이미지 URL (선택)" />
        </div>
        <button onclick="removeDailyItem(${index})" class="self-start px-1 text-slate-400 hover:text-rose-300" aria-label="아이템 삭제">✕</button>
      </div>
      <input type="number" min="0" value="${escapeHtml(item.price ?? '')}" oninput="updateDailyItem(${index}, 'price', this.value)" class="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs" placeholder="아이템 가격 (메소)" />
    </div>`;
  }).join('') || '<p class="text-[11px] text-slate-500">+ 아이템을 눌러 드랍 아이템을 추가하세요.</p>';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

let dailyItemDraft = [];
const dailyItemSearchTimers = {};
function addDailyItem() {
  dailyItemDraft.push({ name: '', image: '', price: '' });
  renderDailyItemRows(dailyItemDraft);
}

function updateDailyItem(index, field, value) {
  if (!dailyItemDraft[index]) return;
  dailyItemDraft[index][field] = value;
  if (field === 'image') {
    const image = document.getElementById(`dailyItemImage${index}`);
    const safeUrl = /^https:\/\//i.test(value) ? value : '';
    image.src = safeUrl;
    image.classList.toggle('hidden', !safeUrl);
    document.getElementById(`dailyItemFallback${index}`).classList.toggle('hidden', Boolean(safeUrl));
  }
  if (field === 'name') {
    dailyItemDraft[index].itemId = null;
    dailyItemDraft[index].image = '';
    document.getElementById(`dailyItemImage${index}`).classList.add('hidden');
    document.getElementById(`dailyItemFallback${index}`).classList.remove('hidden');
    clearTimeout(dailyItemSearchTimers[index]);
    const results = document.getElementById(`dailyItemSearch${index}`);
    if (value.trim().length < 2) {
      results.innerHTML = '';
      return;
    }
    results.innerHTML = '<span class="text-[10px] text-slate-400">아이템 검색 중...</span>';
    dailyItemSearchTimers[index] = setTimeout(() => searchDailyItemCatalog(index, value.trim()), 300);
  }
}

async function searchDailyItemCatalog(index, query) {
  const results = document.getElementById(`dailyItemSearch${index}`);
  if (!results) return;
  try {
    const url = `https://maplestory.io/api/KMS/latest/item/list?searchFor=${encodeURIComponent(query)}&count=8`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('아이템 검색에 실패했습니다.');
    const payload = await response.json();
    const items = Array.isArray(payload)
      ? payload
      : [payload.items, payload.results, payload.data].find(Array.isArray) || [];
    const matches = items.map(item => ({
      id: Number(item.id ?? item.itemId ?? item.item_id ?? item.ItemId),
      name: item.name ?? item.itemName ?? item.item_name ?? item.ItemName
    })).filter(item => Number.isInteger(item.id) && item.name);
    if (dailyItemDraft[index]?.name !== query || dailyItemDraft[index]?.itemId) return;

    if (!matches.length) {
      results.innerHTML = '<span class="text-[10px] text-slate-400">검색 결과가 없어요. 아이템 이름을 직접 입력할 수 있습니다.</span>';
      return;
    }
    results.innerHTML = matches.map(item => {
      const encodedName = encodeURIComponent(item.name).replace(/'/g, '%27');
      return `<button type="button" onclick="selectDailyItem(${index}, ${item.id}, '${encodedName}')" class="flex w-full items-center gap-2 rounded bg-slate-700 px-2 py-1 text-left text-[11px] hover:bg-slate-600">
        <img src="https://maplestory.io/api/KMS/latest/item/${item.id}/icon" alt="" class="h-7 w-7 object-contain" />
        <span>${escapeHtml(item.name)}</span>
      </button>`;
    }).join('');
  } catch (error) {
    results.innerHTML = '<span class="text-[10px] text-slate-400">아이템 아이콘 검색을 불러오지 못했어요.</span>';
  }
}

function selectDailyItem(index, itemId, encodedName) {
  clearTimeout(dailyItemSearchTimers[index]);
  const name = decodeURIComponent(encodedName);
  dailyItemDraft[index] = {
    ...dailyItemDraft[index],
    name,
    itemId,
    image: `https://maplestory.io/api/KMS/latest/item/${itemId}/icon`
  };
  renderDailyItemRows(dailyItemDraft);
}

function removeDailyItem(index) {
  dailyItemDraft.splice(index, 1);
  renderDailyItemRows(dailyItemDraft);
}

function saveDailyLog() {
  const logs = getDailyLogs();
  const bossId = document.getElementById('dailyBossSelect').value;
  const partySize = Number(document.getElementById('dailyBossParty').value || 1);
  const meso = Number(document.getElementById('dailyMesoInput').value || 0);
  const items = dailyItemDraft
    .filter(item => item.name.trim() || item.image.trim() || Number(item.price) > 0)
    .map(item => ({ name: item.name.trim(), itemId: item.itemId || null, image: item.image.trim(), price: Number(item.price) || 0 }));

  if (!bossId && meso === 0 && items.length === 0) {
    delete logs[selectedCalendarDate];
  } else {
    logs[selectedCalendarDate] = { bossId, partySize, meso, items, updatedAt: new Date().toISOString() };
  }
  localStorage.setItem(DAILY_LOG_STORAGE_KEY, JSON.stringify(logs));
  document.getElementById('dailyLogStatus').textContent = '이 브라우저에 저장했어요.';
  renderMiniCalendar();
  renderMonthlySummary();
}

function clearDailyLog() {
  const logs = getDailyLogs();
  delete logs[selectedCalendarDate];
  localStorage.setItem(DAILY_LOG_STORAGE_KEY, JSON.stringify(logs));
  document.getElementById('dailyBossSelect').value = '';
  document.getElementById('dailyBossParty').value = '1';
  document.getElementById('dailyMesoInput').value = '';
  dailyItemDraft = [];
  renderDailyItemRows(dailyItemDraft);
  updateDailyBossPreview();
  document.getElementById('dailyLogStatus').textContent = '선택한 날짜의 기록을 지웠어요.';
  renderMiniCalendar();
  renderMonthlySummary();
}

function getDailyLogTotal(log) {
  const boss = BOSS_LIST.find(item => item.id === log.bossId);
  const bossIncome = boss ? boss.price / (Number(log.partySize) || 1) : 0;
  const itemIncome = (log.items || []).reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const mesoIncome = Number(log.meso) || 0;
  return { bossIncome, itemIncome, mesoIncome, total: bossIncome + itemIncome + mesoIncome };
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
    const boss = BOSS_LIST.find(item => item.id === log.bossId);
    const itemNames = (log.items || []).map(item => item.name).filter(Boolean).join(', ');
    const description = [boss ? `${boss.name} ${boss.diff}` : '', itemNames].filter(Boolean).join(' · ');
    return `<div class="flex justify-between gap-2 border-t border-slate-700/70 pt-1"><span>${Number(date.slice(-2))}일${description ? ` · ${escapeHtml(description)}` : ''}</span><strong class="shrink-0 text-emerald-300">${Math.round(totals.total).toLocaleString()}</strong></div>`;
  });
  document.getElementById('monthlyTotal').textContent = `${Math.round(bossTotal + itemTotal + mesoTotal).toLocaleString()} 메소`;
  document.getElementById('monthlyBreakdown').textContent = `보스 ${Math.round(bossTotal).toLocaleString()} + 아이템 ${Math.round(itemTotal).toLocaleString()} + 메소 ${Math.round(mesoTotal).toLocaleString()}`;
  document.getElementById('monthlyRecordsList').innerHTML = rows.join('') || '<p class="text-slate-500">이번 달 기록이 아직 없어요.</p>';
}
