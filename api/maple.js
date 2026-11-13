// api/maple.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const searchCache = new Map();

function readSearchCache(key) {
  const cached = searchCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeSearchCache(key, value) {
  // 서버리스 인스턴스가 오래 유지되어도 캐시가 무한히 커지지 않게 제한합니다.
  if (searchCache.size >= 500) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) searchCache.delete(oldestKey);
  }
  searchCache.set(key, { value, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const rawName = req.query.name;
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (!name) {
    return res.status(400).json({ error: '캐릭터 닉네임이 입력되지 않았습니다.' });
  }

  const cacheKey = name.toLocaleLowerCase('ko-KR');
  const cachedResult = readSearchCache(cacheKey);
  if (cachedResult) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(cachedResult);
  }

  const NEXON_API_KEY = process.env.NEXON_API_KEY;
  if (!NEXON_API_KEY) {
    return res.status(500).json({ error: '서버에 NEXON_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  try {
    // 넥슨 API 요청을 한꺼번에 보내면 일부 캐릭터 조회가 실패할 수 있어
    // 호출 간격을 두고 429/일시 오류는 재시도합니다.
    let lastNexonRequestAt = 0;
    let requestSchedule = Promise.resolve();
    const scheduleNexonRequest = () => {
      const scheduled = requestSchedule.then(async () => {
        const waitMs = Math.max(0, 350 - (Date.now() - lastNexonRequestAt));
        if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
        lastNexonRequestAt = Date.now();
      });
      requestSchedule = scheduled.catch(() => {});
      return scheduled;
    };
    const fetchNexon = async (url) => {
      let response;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await scheduleNexonRequest();
        response = await fetch(url, {
          headers: { 'x-nxopen-api-key': NEXON_API_KEY }
        });

        if (response.status !== 429 && response.status < 500) return response;
        if (attempt < 3) {
          const retryAfter = Number(response.headers.get('retry-after'));
          const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 500 * (attempt + 1);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
      return response;
    };

    // 1. 검색한 캐릭터의 ocid 조회
    const ocidRes = await fetchNexon(`https://open.api.nexon.com/maplestory/v1/id?character_name=${encodeURIComponent(name)}`);
    
    if (!ocidRes.ok) {
      const nexonError = await ocidRes.json().catch(() => ({}));
      const nexonCode = nexonError?.error?.name || nexonError?.error?.code || nexonError?.error_code || null;
      const codeMessages = {
        OPENAPI00003: '넥슨 API가 캐릭터 식별자를 찾지 못했습니다. 닉네임이 맞는지 확인해 주세요.',
        OPENAPI00004: '넥슨 API 요청 값이 유효하지 않습니다. 닉네임을 다시 확인해 주세요.',
        OPENAPI00005: '넥슨 API 키가 유효하지 않습니다. Vercel의 NEXON_API_KEY를 확인해 주세요.',
        OPENAPI00006: '넥슨 API 키에 메이플스토리가 등록되어 있는지 확인해 주세요.',
        OPENAPI00007: '넥슨 API 호출 한도를 초과했습니다. 잠시 기다린 뒤 다시 검색해 주세요.',
        OPENAPI00009: '넥슨 API에서 캐릭터 데이터를 준비 중입니다. 잠시 후 다시 검색해 주세요.',
        OPENAPI00010: '메이플스토리 API가 점검 중입니다. 잠시 후 다시 검색해 주세요.',
        OPENAPI00011: '넥슨 API가 점검 중입니다. 잠시 후 다시 검색해 주세요.'
      };
      const messages = {
        400: '넥슨 API가 캐릭터 조회를 거부했습니다. API 오류 코드와 닉네임을 확인해 주세요.',
        403: '넥슨 API 권한 오류입니다. Vercel의 NEXON_API_KEY 설정을 확인해 주세요.',
        429: '넥슨 API 호출 한도를 초과했습니다. 잠시 기다린 뒤 다시 검색해 주세요.',
        500: '넥슨 API 서버에서 오류가 발생했습니다. 잠시 후 다시 검색해 주세요.',
        503: '넥슨 API가 점검 중입니다. 잠시 후 다시 검색해 주세요.'
      };
      return res.status(ocidRes.status).json({
        error: codeMessages[nexonCode] || messages[ocidRes.status] || `넥슨 API 조회 실패 (HTTP ${ocidRes.status})`,
        nexonStatus: ocidRes.status,
        nexonCode
      });
    }
    
    const { ocid } = await ocidRes.json();

    // 2. 유니온 챔피언에 등록된 캐릭터 이름 조회
    let unionChampionNames = [];
    let unionChampionLookupSucceeded = false;
    try {
      const unionRes = await fetchNexon(`https://open.api.nexon.com/maplestory/v1/user/union-champion?ocid=${encodeURIComponent(ocid)}`);
      if (unionRes.ok) {
        unionChampionLookupSucceeded = true;
        const unionData = await unionRes.json();
        unionChampionNames = (unionData.union_champion || [])
          .map(champion => champion.champion_name)
          .filter(Boolean);
      }
    } catch (e) {
      console.warn('유니온 챔피언 조회 실패:', e.message);
    }

    // 3. Supabase에서 이 캐릭터가 속한 유저의 기존 캐릭터 목록 확인 (API 미지원 시 호환용)
    let registeredChars = [];
    if (supabaseUrl && supabaseKey) {
      // main_character이거나 account_characters에 포함된 유저를 찾음
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .or(`main_character.eq.${name},account_characters.cs.{${name}}`);

      if (users && users.length > 0) {
        // 해당 유저가 등록한 모든 캐릭터 모으기
        const user = users[0];
        registeredChars = [user.main_character, ...(user.account_characters || [])];
      }
    }

    // 유니온 조회에 성공하면 등록된 챔피언만 사용하고, API 실패 시 기존 등록 목록으로 대체
    const fallbackNames = registeredChars.length > 0 ? registeredChars : [name];
    let characterNames = Array.from(new Set(
      unionChampionLookupSucceeded ? unionChampionNames : fallbackNames
    ));

    // 4. 후보 캐릭터들의 상세 정보(레벨, 직업, 이미지) 순차 조회 (최대 10개)
    const candidateNames = characterNames.slice(0, 10);
    const results = (await Promise.all(candidateNames.map(async (cName) => {
      try {
        const cOcidRes = await fetchNexon(`https://open.api.nexon.com/maplestory/v1/id?character_name=${encodeURIComponent(cName)}`);
        if (!cOcidRes.ok) return null;
        const { ocid: cOcid } = await cOcidRes.json();

        const basicRes = await fetchNexon(`https://open.api.nexon.com/maplestory/v1/character/basic?ocid=${cOcid}`);
        if (!basicRes.ok) return null;
        const basic = await basicRes.json();

        return {
          name: basic.character_name,
          world: basic.world_name,
          job: basic.character_class,
          level: basic.character_level,
          image: basic.character_image
        };
      } catch (e) {
        console.warn(`캐릭터 상세 조회 실패 (${cName}):`, e.message);
        return null;
      }
    }))).filter(Boolean);

    // 레벨 높은 순 정렬 후 상위 5개 추출 (또는 등록된 순서 유지)
    results.sort((a, b) => b.level - a.level);
    const top5 = results.slice(0, 5);

    const result = {
      searchedName: name,
      top5: top5.length > 0 ? top5 : (unionChampionLookupSucceeded ? [] : [{ name, world: '-', job: '-', level: 0, image: '' }]),
      allCharacterNames: characterNames
    };
    writeSearchCache(cacheKey, result);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: '서버 내부 오류 발생', details: err.message });
  }
}
