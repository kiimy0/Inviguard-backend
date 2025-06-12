const chatModel = require('../models/chatModel');
const runOCR = require('../services/ocrService'); 
const chatService = require('../services/chatService.js')
const stateManager = require('../stateMachine/stateManager');

const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


// 챗봇 대화 세션 생성
exports.createChatSession = async (req, res) => {
    try {
        const {user_id} = req.body;
        if (!user_id) {
            return res.status(400).json({ message: 'user_id is required'});
        }

        const result = await chatService.createChatSession(user_id);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating chat session: ', error);
        res.status(500).json({ message: 'Server Error'});
    }
};

// 유저의 모든 챗봇 대화 세션 ID, 세션 제목 불러오기
exports.getAllChatSessions = async (req, res) => {
    try {
        // 1. 일단 모든 세션 받아오기 (추후 유저 authentication 구현하면 아이디별 세션 필터링 추가)
        const sessions = await chatModel.fetchAllChatSessions();
        res.status(200).json(sessions);
    } catch (error) {
        console.error('Error fetching user chat sessions: ', error);
        res.status(500).json({ message: 'Server Error'});
    }
};

// 챗봇 대화 세션 삭제
exports.deleteChatSession = async (req, res) => {
    try {
        const { session_id } = req.params;

        if (!session_id) {
            return res.status(400).json({ message: 'session_id is required' });
        }

        await chatService.deleteChatSession(session_id);

        res.status(200).json({ message: `Chat session ${session_id} deleted successfully.` });
    } catch (error) {
        console.error('Error deleting chat session: ', error);
        res.status(500).json({ message: 'Server Error' });
    }
};


// 유저가 전송한 메세지 저장
exports.saveChatMessage = async (req, res) => {
    try {
        const { content, timestamp, inputKey } = req.body;
        const { session_id } = req.params;

        const result = await chatService.saveChatMessage(session_id, content, timestamp, inputKey);
        res.status(201).json(result);
    } catch (err) {
        console.error('Error saving chat message: ', err);
        res.status(500).json({ message: err.message || 'Server error'});
    }
};

// 세션 대화 복원 (sender 명시되어있지 않다면 세션의 모든 메세지 받아옴)
exports.getChatMessages = async (req, res) => {
    try {
        const { session_id } = req.params;
        const { sender } = req.query;

        const messages = await chatModel.fetchChatMessages(session_id, sender);
        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching chat messages: ', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 증거 파일 업로드
exports.uploadEvidence = async (req, res) => {
    try {
        const { session_id } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        const result = await chatService.uploadEvidence({
            session_id,
            file
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error uploading evidence:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
};

// 증거 파일 is_textual인지 user input받고 저장 (is_textual은 boolean이어야 함)
exports.updateEvidenceTextuality = async (req, res) => {
    try {
        const { evidence_id } = req.params;
        const { is_textual } = req.body;

        if (typeof is_textual !== 'boolean') {
            return res.status(400).json({ message: 'is_textual must be a boolean.' });
        }

        await chatModel.updateEvidenceTextuality(evidence_id, is_textual);
        res.status(200).json({ message: 'Textuality updated successfully.' });
    } catch (error) {
        console.error('Error updating textuality:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
};

// 증거 파일 evidence_description user한테 입력받고 저장
exports.updateEvidenceDescription = async (req, res) => {
    try {
        const { evidence_id } = req.params;
        const { evidence_description } = req.body;

        if (!evidence_description || typeof evidence_description !== 'string') {
            return res.status(400).json({ message: 'Valid evidence description is required.' });
        }

        await chatModel.updateEvidenceDescription(evidence_id, evidence_description);
        res.status(200).json({ message: 'Evidence description updated successfully.' });
    } catch (error) {
        console.error('Error updating evidence description:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
};

// 이미지 증거 OCR하고 결과 ocr_text필드에 저장
exports.runOCROnEvidence = async (req, res) => {
    try {
        const { evidence_id } = req.params;
        if (!evidence_id) {
            return res.status(400).json({ message: 'evidence_id is required' });
        }

        // 1. 증거의 file path 찾기
        const evidence = await chatModel.getEvidenceById(evidence_id);
        if (!evidence || !evidence.file_path) {
            return res.status(404).json({ message: 'Evidence not found or file path missing' });
        }

        // 2. OCR 실행
        const text = await runOCR(evidence.file_path);
        if (!text || text.length === 0) {
            return res.status(200).json({ message: 'No text extracted from image.' });
        }

        // 3. OCR 결과 DB에 저장
        await chatModel.updateEvidenceOCRText(evidence_id, text);

        return res.status(200).json({
            message: 'OCR successful',
            ocr_text: text
        });

    } catch (error) {
        console.error('Error running OCR:', error);
        res.status(500).json({ message: 'OCR failed' });
    }
};

// 특정 세션에 제출된 증거 파일 목록 조회
exports.getEvidenceBySession = async (req, res) => {
    try {
        const { session_id } = req.params;
        if (!session_id) {
            return res.status(400).json({ message: 'session_id is required' });
        }

        const evidenceList = await chatService.getEvidenceBySession(session_id);
        res.status(200).json(evidenceList);
    } catch (error) {
        console.error('Error fetching evidence:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


// 챗봇 자동 메세지 조회 - step 기준
exports.getBotMessageByStep = async (req, res) => {
    try {
        const { step } = req.params;
        if (!step) {
            return res.status(400).json({ message: 'Step parameter is required.' });
        }

        const message = await chatModel.getBotAutoMessageByStep(Number(step));
        if (!message) {
            return res.status(404).json({ message: 'Bot message not found for this step.' });
        }

        res.status(200).json(message);
    } catch (error) {
        console.error('Error fetching bot message by step:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 챗봇 자동 메세지 조회 - state 기준
exports.getBotMessageByState = async (req, res) => {
    try {
        const { state } = req.params;
        const metadata = stateManager.getStateMetadata(state);

        if (!metadata || !metadata.message) {
            return res.status(404).json({ message: 'Bot message not found for this state.'});
        }
        res.status(200).json({ content: metadata.message, state });
    } catch (error) {
        console.error('Error fetching bot message by state:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


// current step 업데이트
exports.updateCurrentStep = async (req, res) => {
    try {
        const { session_id } = req.params;
        const { newStep } = req.body;

        if (!newStep) {
            return res.status(400).json({ message: 'newStep is required.' });
        }

        const result = await chatService.updateCurrentStep(session_id, newStep);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating step:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// current state 업데이트
exports.updateCurrentState = async (req, res) => {
    try {
        const { session_id } = req.params;
        const { newState } = req.body;

        if (!newState) {
            return res.status(400).json({ message: 'newState is required.' });
        }

        const result = await chatService.updateCurrentState(session_id, newState);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating state:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 다음 state 받기 (endpoint 구체적인 예시: GET /api/chat/state/next?currentState=ask_is_textual&input=yes)
exports.getNextState = (req, res) => {
    const { currentState, input, systemEvent } = req.query;

    if (!currentState || (!input && !systemEvent)) {
        return res.status(400).json({ message: 'currentState and input or systemEvent are required.' });
    }

    try {
        const nextState = stateManager.getNextState(currentState, input, systemEvent);
        if (!nextState) {
            return res.status(404).json({ message: 'Next state not found.' });
        }
        res.status(200).json({ nextState });
    } catch (error) {
        console.error('Error determining next state:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// state 정보 받아오기
exports.getStateInfo = (req, res) => {
    const { stateName } = req.params;

    try {
        const state = stateManager.getStateMetadata(stateName);
        if (!state) {
            return res.status(404).json({ message: 'State not found.' });
        }
        res.status(200).json(state);
    } catch (error) {
        console.error('Error fetching state info:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 개별 증거 evidence_description 괴롭힘 분석 요청 (OpenAI API로 분석)
exports.analyzeEvidenceDescription = async (req, res) => {
    const evidence_id = req.params.evidence_id;

    try {
        const evidence = await chatModel.getEvidenceById(evidence_id);
        if (!evidence || !evidence.evidence_description) {
            return res.status(400).json({ message: 'No valid evidence_description found for analysis.' });
        }

        const prompt = `
            다음은 괴롭힘 유형과 설명입니다:
            - CENSURE: 경멸, 비난, 조롱 표현
            - HATE: 특정 집단에 대한 혐오
            - DISCRIMINATION: 차별 정당화 또는 편견 표현
            - SEXUAL: 성적 대상화, 성희롱, 음란 표현
            - VIOLENCE: 물리적·심리적 위협, 폭력성
            - ABUSE: 욕설, 모욕, 감정적 폭력
            - CRIME: 범죄 행위의 조장 또는 정당화
            - VERBAL_ATTACK: 비하적 언어, 인신공격
            - EXCESSIVE_WORKLOAD: 과도한 업무 부과
            - UNFAIR_WORK_ORDERS: 부당한 업무 지시, 원래 업무 외 지시
            - WORK_EXCLUSION: 부당한 업무 배제, 따돌림
            - OBSTRUCTION_OF_WORK: 고의적 업무 방해
            - INAPPROPRIATE_HR_ACTION: 불합리한 인사조치
            - ECONOMIC_PRESSURE: 회식비 강요 등 경제적 부담
            - SOCIAL_ISOLATION: 직장 내 고립, 따돌림

            심각도 등급은 다음과 같습니다:
            - -1: 특이사항 없음 (문제 없는 일반적인 표현)
            - 0: 비우호적 표현 (불쾌감 유발 가능)
            - 1: 괴롭힘 표현 (명백한 괴롭힘)

            아래의 텍스트를 분석하고, 해당 텍스트가 부도덕한지 여부(is_immoral), 괴롭힘 유형(types)의 목록, 심각도(severity)를 반환하세요. 결과는 다음 JSON 형식으로 출력하세요:

            {
            "is_immoral": 1,
            "types": ["HATE", "CENSURE"],
            "severity": 1
            }

            텍스트: ${evidence.evidence_description}
        `;

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: 'You are a workplace harassment detection assistant.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.2
        });

        const resultText = response.choices[0].message.content;

        // OpenAI 답변 parsing
        let result;
        try {
            result = JSON.parse(resultText);
        } catch (err) {
            return res.status(500).json({ message: "Failed to parse OpenAI response.", raw: resultText });
        }

        if (!Array.isArray(result.types)) {
            return res.status(500).json({ message: "Invalid response: types must be an array", raw: resultText });
        }

        // 괴롭형 유형별 EvidenceHarassment 테이블에 저장
        for (const type of result.types) {
            const category = await chatModel.getHarassmentCategoryByName(type);
            if (category) {
                await chatModel.insertEvidenceHarassment({
                    evidence_id,
                    harassment_category_id: category.harassment_category_id,
                    severity: result.severity,
                    is_harassment: result.is_immoral
                });
            }
        }

        return res.status(200).json(result);

    }  catch (error) {
        console.error("Error in analyzeEvidenceDescription:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};


// 상황 설명 메세지 괴롭힘 분석 요청 (OpenAI API로 분석)
exports.analyzeMessage = async (req, res) => {
    const message_id = req.params.message_id;

    try {
        const message = await chatModel.getChatMessageById(message_id);

        if (!message || !message.content) {
            return res.status(400).json({ message: 'No valid message found for analysis.' });
        }

        const prompt = `
            다음은 괴롭힘 유형과 설명입니다:
            - CENSURE: 경멸, 비난, 조롱 표현
            - HATE: 특정 집단에 대한 혐오
            - DISCRIMINATION: 차별 정당화 또는 편견 표현
            - SEXUAL: 성적 대상화, 성희롱, 음란 표현
            - VIOLENCE: 물리적·심리적 위협, 폭력성
            - ABUSE: 욕설, 모욕, 감정적 폭력
            - CRIME: 범죄 행위의 조장 또는 정당화
            - VERBAL_ATTACK: 비하적 언어, 인신공격
            - EXCESSIVE_WORKLOAD: 과도한 업무 부과
            - UNFAIR_WORK_ORDERS: 부당한 업무 지시, 원래 업무 외 지시
            - WORK_EXCLUSION: 부당한 업무 배제, 따돌림
            - OBSTRUCTION_OF_WORK: 고의적 업무 방해
            - INAPPROPRIATE_HR_ACTION: 불합리한 인사조치
            - ECONOMIC_PRESSURE: 회식비 강요 등 경제적 부담
            - SOCIAL_ISOLATION: 직장 내 고립, 따돌림

            심각도 등급은 다음과 같습니다:
            - -1: 특이사항 없음 (문제 없는 일반적인 표현)
            - 0: 비우호적 표현 (불쾌감 유발 가능)
            - 1: 괴롭힘 표현 (명백한 괴롭힘)

            다음 텍스트를 분석하세요. 다음과 같은 JSON 형식으로 is_immoral, types (괴롭힘 유형 리스트), severity를 반환하세요.

            {
            "is_immoral": 1,
            "types": ["HATE", "CENSURE"],
            "severity": 1
            }

            텍스트: ${message.content}
        `;

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: 'You are a workplace harassment detection assistant.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.2
        });

        const resultText = response.choices[0].message.content;

        let result;
        try {
            result = JSON.parse(resultText);
        } catch (err) {
            return res.status(500).json({ message: "Failed to parse OpenAI response.", raw: resultText });
        }

        if (!Array.isArray(result.types)) {
            return res.status(500).json({ message: "Invalid response: types must be an array", raw: resultText });
        }

        for (const type of result.types) {
            const category = await chatModel.getHarassmentCategoryByName(type);
            if (category) {
                await chatModel.insertChatMessageHarassment({
                    chat_message_id: message_id,
                    harassment_category_id: category.harassment_category_id,
                    severity: result.severity,
                    is_harassment: result.is_immoral
                });
            }
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error("Error in analyzeMessage:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// 전체 세션 괴롭힘 분석 요청
exports.analyzeSession = async (req, res) => {
    const { session_id } = req.params;
    try {
        const result = await chatService.analyzeSession(Number(session_id));
        res.status(201).json(result);
    } catch (err) {
        console.error("Error analyzing session:", err);
        res.status(500).json({ message: err.message || 'Internal Server Error' });
    }
};