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

// 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
  renderMiniCalendar();
  const savedUser = localStorage.getItem('maple_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    updateAuthUI();
    searchAccount(currentUser.main_character);
  }

  document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchAccount();
  });
});

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
      class="cursor-pointer bg-slate-800 border ${char.name === activeCharName ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-700'} rounded-xl p-3 flex flex-col items-center text-center transition hover:border-slate-500">
      <span class="self-start text-[11px] font-bold px-2 py-0.5 rounded bg-slate-700 text-amber-300">TOP ${idx + 1}</span>
      <img src="${char.image}" alt="${char.name}" class="w-40 h-40 object-contain my-1 scale-110" />
      <div class="font-bold text-sm text-slate-100 mt-1">${char.name}</div>
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
  const totalCount = getTotalCrystalCount();
  const isReadOnly = viewedOwner && (!currentUser || currentUser.username !== viewedOwner);

  document.getElementById('selectedCharTitle').textContent = `⚔️ ${activeCharName} 주간 보스 설정`;

  grid.innerHTML = getBossGroups().map(group => {
    const selectedBoss = group.find(boss => charBosses[boss.id] !== undefined);
    const isChecked = Boolean(selectedBoss);
    const selectedPartySize = selectedBoss ? charBosses[selectedBoss.id] : 1;
    const myShare = selectedBoss
      ? Math.floor(selectedBoss.price / selectedPartySize)
      : null;
    const disabled = isReadOnly || (!isChecked && totalCount >= 90);

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
    if (!existingBoss && getTotalCrystalCount() >= 90) return alert('계정당 주간 결정석 최대 한도(90개)에 도달했습니다.');
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
  searchAccount(currentUser.main_character);
}

function logout() {
  currentUser = null;
  localStorage.removeItem('maple_user');
  updateAuthUI();
  document.getElementById('saveBtn').classList.add('hidden');
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

// 9. 우측 미니 캘린더 렌더링 (일요일: 썬데이 메이플 / 목요일: 주간 보스·결정석 초기화)
function renderMiniCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  document.getElementById('calendarMonthTitle').textContent = `${year}년 ${month + 1}월`;

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const grid = document.getElementById('calendarGrid');

  let html = '';
  for (let i = 0; i < firstDay; i++) {
    html += `<div></div>`;
  }

  for (let d = 1; d <= lastDate; d++) {
    const dayOfWeek = new Date(year, month, d).getDay();
    const isToday = d === today;
    let badgeClass = 'bg-slate-700/40 text-slate-300';
    let titleAttr = '';

    if (dayOfWeek === 0) {
      badgeClass = 'bg-rose-500/25 border border-rose-500/60 text-rose-300 font-bold';
      titleAttr = '썬데이 메이플';
    } else if (dayOfWeek === 4) {
      badgeClass = 'bg-sky-500/25 border border-sky-500/60 text-sky-300 font-bold';
      titleAttr = '주간 보스 · 결정석 90개 초기화';
    }

    if (isToday) {
      badgeClass += ' ring-2 ring-amber-400';
    }

    html += `
      <div title="${titleAttr}" class="py-1.5 rounded-md ${badgeClass}">
        ${d}
      </div>
    `;
  }
  grid.innerHTML = html;
}
