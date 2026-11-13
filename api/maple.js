// api/maple.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { name } = req.query;
  if (!name) {
    return res.status(400).json({ error: '캐릭터 닉네임이 입력되지 않았습니다.' });
  }

  const NEXON_API_KEY = process.env.NEXON_API_KEY;
  if (!NEXON_API_KEY) {
    return res.status(500).json({ error: '서버에 NEXON_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  try {
    // 1. 검색한 캐릭터의 ocid 조회
    const ocidRes = await fetch(`https://open.api.nexon.com/maplestory/v1/id?character_name=${encodeURIComponent(name)}`, {
      headers: { 'x-nxopen-api-key': NEXON_API_KEY }
    });
    
    if (!ocidRes.ok) {
      return res.status(ocidRes.status).json({ error: '존재하지 않는 캐릭터이거나 넥슨 API 오류입니다.' });
    }
    
    const { ocid } = await ocidRes.json();

    // 2. Supabase에서 이 캐릭터가 속한 유저의 등록된 부캐 목록(account_characters) 확인
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

    // 기본은 검색한 닉네임, 만약 DB에 등록된 계정이라면 등록된 모든 부캐 포함
    let characterNames = Array.from(new Set([name, ...registeredChars]));

    // 3. 후보 캐릭터들의 상세 정보(레벨, 직업, 이미지) 병렬 조회 (최대 10개)
    const candidateNames = characterNames.slice(0, 10);
    const detailsPromises = candidateNames.map(async (cName) => {
      try {
        const cOcidRes = await fetch(`https://open.api.nexon.com/maplestory/v1/id?character_name=${encodeURIComponent(cName)}`, {
          headers: { 'x-nxopen-api-key': NEXON_API_KEY }
        });
        if (!cOcidRes.ok) return null;
        const { ocid: cOcid } = await cOcidRes.json();

        const basicRes = await fetch(`https://open.api.nexon.com/maplestory/v1/character/basic?ocid=${cOcid}`, {
          headers: { 'x-nxopen-api-key': NEXON_API_KEY }
        });
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
        return null;
      }
    });

    const results = (await Promise.all(detailsPromises)).filter(Boolean);

    // 레벨 높은 순 정렬 후 상위 5개 추출 (또는 등록된 순서 유지)
    results.sort((a, b) => b.level - a.level);
    const top5 = results.slice(0, 5);

    return res.status(200).json({
      searchedName: name,
      top5: top5.length > 0 ? top5 : [{ name, world: '-', job: '-', level: 0, image: '' }],
      allCharacterNames: characterNames
    });

  } catch (err) {
    return res.status(500).json({ error: '서버 내부 오류 발생', details: err.message });
  }
}