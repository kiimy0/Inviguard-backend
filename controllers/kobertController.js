const axios = require('axios');
const chatModel = require('../models/chatModel');

// OCR text 기반으로 kobert_api 호출, result 저장
exports.analyzeOCRText = async (req, res) => {
    try {
        // evidence_id 유효성 검사
        const { evidence_id } = req.params;
        if (!evidence_id) { // 없을 경우 멘트 출력
            return res.status(400).json({ message: 'evidence_id is required' });
        }

        // DB에서 OCR text 조회
        const evidence = await chatModel.getEvidenceById(evidence_id);
        if (!evidence || !evidence.ocr_text) {  // 조회 실패
            return res.status(404).json({ message: 'OCR text not found' });
        }

        // FastAPI KoBERT model 호출 -> OCR text를 FastAPI server에 POST
        const response = await axios.post('http://localhost:8000/analyze', {
            text: evidence.ocr_text
        });

        // result destructuring
        const { harassment, types, severity } = response.data;

        // 예측된 괴롭힘 유형들을 EvidenceHarassment table에 저장
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
        }

        // client 응답 반환
        res.status(200).json({
            message: 'Analysis complete',   // 분석 완료 message
            harassment,
            types,
            severity,
        });

    } catch (err) {
        console.error('Error in model analysis:', err);
        res.status(500).json({ message: 'Model analysis failed' });
    }
};