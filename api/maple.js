// api/maple.js
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
    // 1. 캐릭터 ocid 조회
    const ocidRes = await fetch(`https://open.api.nexon.com/maplestory/v1/id?character_name=${encodeURIComponent(name)}`, {
      headers: { 'x-nxopen-api-key': NEXON_API_KEY }
    });
    
    if (!ocidRes.ok) {
      return res.status(ocidRes.status).json({ error: '존재하지 않는 캐릭터이거나 넥슨 API 오류입니다.' });
    }
    
    const { ocid } = await ocidRes.json();

    // 2. 계정 내 캐릭터 목록 조회 (메이플ID 기준 묶인 캐릭터들)
    const listRes = await fetch(`https://open.api.nexon.com/maplestory/v1/user/character-list?ocid=${ocid}`, {
      headers: { 'x-nxopen-api-key': NEXON_API_KEY }
    });

    let targetCharacters = []; // { character_name, world_name, ... }
    let allCharacterNames = [name];

    if (listRes.ok) {
      const listData = await listRes.json();
      const rawList = listData.account_list?.[0]?.character_list || listData.character_list || [];
      
      if (rawList.length > 0) {
        targetCharacters = rawList;
        allCharacterNames = rawList.map(c => c.character_name);
      }
    }

    // 만약 목록 API에서 안 가져와지면 검색한 단일 캐릭터로 fallback
    if (targetCharacters.length === 0) {
      targetCharacters = [{ character_name: name }];
    }

    // 3. 캐릭터들의 상세 정보(레벨, 직업, 코디 이미지) 병렬 조회 (상위 최대 5개)
    const top5Details = await Promise.all(
      targetCharacters.slice(0, 5).map(async (charObj) => {
        const cName = charObj.character_name;
        
        // 부캐들 각각의 ocid 다시 조회
        const cOcidRes = await fetch(`https://open.api.nexon.com/maplestory/v1/id?character_name=${encodeURIComponent(cName)}`, {
          headers: { 'x-nxopen-api-key': NEXON_API_KEY }
        });
        if (!cOcidRes.ok) return null;
        const { ocid: cOcid } = await cOcidRes.json();

        // 기본 정보 조회 (레벨, 직업, 이미지 등)
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
      })
    );

    const validTop5 = top5Details.filter(Boolean);

    return res.status(200).json({
      searchedName: name,
      top5: validTop5.length > 0 ? validTop5 : [{ name, world: '알 수 없음', job: '-', level: 0, image: '' }],
      allCharacterNames: allCharacterNames
    });

  } catch (err) {
    return res.status(500).json({ error: '서버 내부 오류 발생', details: err.message });
  }
}