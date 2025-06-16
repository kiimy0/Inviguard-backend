const axios = require('axios');
const chatModel = require('../models/chatModel');

// OCR text 기반으로 kobert_api 호출, result 저장
exports.analyzeOCRText = async (req, res) => {
    try {
        const { evidence_id } = req.params;
        if (!evidence_id) {
            return res.status(400).json({ message: 'evidence_id is required' });
        }

        const evidence = await chatModel.getEvidenceById(evidence_id);
        if (!evidence || !evidence.ocr_text) {
            return res.status(404).json({ message: 'OCR text not found' });
        }

        // OCR text 문장별로 분리 + 전처리
        const sentences = evidence.ocr_text
            .split('\n')                             // 줄 단위 분리
            .map(line => line.trim())                // 양쪽 공백 제거
            .filter(line =>
                line.length > 3 &&
                !/^\d{1,2}:\d{2}/.test(line) &&                         // 시각 제거
                !/^[<>\d\s+]+$/.test(line) &&                           // 기호/숫자 제거
                !/^[가-힣]{2,4}(씨|님)?$/.test(line) &&                  // 이름/호칭 제거
                !/^(.*)?(부서|팀|부장|과장|대리|사원)(.*)?$/.test(line) && // 직책/조직 정보 제거
                /[가-힣]/.test(line)                                    // 한글 포함
            )
            .join(' ')                              // 줄들을 공백 기준으로 합치기
            .split(/(?<=[.?!])\s+/)                 // 문장 단위로 분리
            .map(s => s.trim())                     // 각 문장 앞뒤 공백 제거
            .filter(s => s.length > 2);             // 너무 짧은 문장 제거

        const results = [];
        for (const sentence of sentences) {
            const response = await axios.post('http://localhost:8000/analyze', {
                text: sentence
            });

            const { harassment, types, severity } = response.data;

           /*// 예측된 괴롭힘 유형들을 EvidenceHarassment table에 저장
            for (const label of types) {    // 괴롭힘 유형 개수만큼 insert
                // category_name(label)을 기반으로 HarassmentCategory를 받아옴
                const category = await chatModel.getHarassmentCategoryByName(label);

                if (category) {
                    await chatModel.insertEvidenceHarassment({
                        evidence_id,
                        harassment_category_id: category.harassment_category_id, // 해당 category의 id
                        severity: severity,        // 모든 유형 같은 심각도 저장(1문장 -> 1심각도)
                        is_harassment: harassment // 괴롭힘 여부
                    });
                }
            }*/

            results.push({ sentence, harassment, types, severity });
        }

        res.status(200).json(results);
    } catch (err) {
        console.error('Error in model analysis:', err);
        res.status(500).json({ message: 'Model analysis failed' });
    }
};