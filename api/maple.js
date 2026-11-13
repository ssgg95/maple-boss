// api/maple.js
export default async function handler(req, res) {
  // CORS 설정 (필요한 경우)
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
    // 1. 넥슨 API: 릭터 ocid 조회
    const ocidRes = await fetch(`https://open.api.nexon.com/maplestory/v1/id?character_name=${encodeURIComponent(name)}`, {
      headers: { 'x-nxopen-api-key': NEXON_API_KEY }
    });
    
    if (!ocidRes.ok) {
      const errText = await ocidRes.text();
      return res.status(ocidRes.status).json({ error: '존재하지 않는 캐릭터이거나 넥슨 API 오류입니다.', details: errText });
    }
    
    const { ocid } = await ocidRes.json();

    // 2. 넥슨 API: 계정 내 캐릭터 조회 (같은 ocid로 묶인 전체 캐릭터 목록)
    // ※ 넥슨 오픈 API 명세에 따라 계정 캐릭터 조회 API 경로를 사용합니다.
    const listRes = await fetch(`https://open.api.nexon.com/maplestory/v1/user/character-list?ocid=${ocid}`, {
      headers: { 'x-nxopen-api-key': NEXON_API_KEY }
    });

    let allCharacterNames = [name];
    let characters = [];

    if (listRes.ok) {
      const listData = await listRes.json();
      // 계정 내 캐릭터 목록 (API 구조에 맞춰 처리)
      const rawChars = listData.character_list || [];
      allCharacterNames = rawChars.map(c => c.character_name);

      // 각 캐릭터의 기본 정보 및 코디(이미지) 조회 (상위 5개 등)
      // 여기서는 예시로 병렬 조회 처리
      const charDetails = await Promise.all(
        rawChars.slice(0, 5).map(async (c) => {
          // 캐릭터 기본 정보
          const basicRes = await fetch(`https://open.api.nexon.com/maplestory/v1/character/basic?ocid=${c.ocid}`, {
            headers: { 'x-nxopen-api-key': NEXON_API_KEY }
          });
          const basic = await basicRes.json();

          return {
            name: c.character_name,
            world: c.world_name,
            job: basic.character_class,
            level: basic.character_level,
            image: basic.character_image
          };
        })
      );
      characters = charDetails;
    } else {
      // 단일 캐릭터 정보만이라도 가져오기
      const basicRes = await fetch(`https://open.api.nexon.com/maplestory/v1/character/basic?ocid=${ocid}`, {
        headers: { 'x-nxopen-api-key': NEXON_API_KEY }
      });
      const basic = await basicRes.json();
      characters = [{
        name: name,
        world: basic.world_name,
        job: basic.character_class,
        level: basic.character_level,
        image: basic.character_image
      }];
    }

    return res.status(200).json({
      searchedName: name,
      top5: characters,
      allCharacterNames: allCharacterNames
    });

  } catch (err) {
    return res.status(500).json({ error: '서버 내부 오류 발생', details: err.message });
  }
}