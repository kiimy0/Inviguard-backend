const chatModel = require('../models/chatModel');
const runOCR = require('../services/ocrService'); // 임시로 적어두기, 실제로 OCR 테스팅하진 않음
const path = require('path');
const chatService = require('../services/chatService.js')
const stateManager = require('../stateMachine/stateManager');



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
        // 1장 업로드
        /* const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        const result = await chatService.uploadEvidence({
            session_id,
            file
        });
        
        res.status(201).json(result);*/

        // 여러장 업로드
        const files = req.files;
        
        if(!files || files.length === 0){
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        const results = [];
        for (const file of files){
            const result = await chatService.uploadEvidence({session_id, file});
            results.push(result);
        }

        res.status(201).json(results);

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
        if (!state) {
            return res.status(400).json({ message: 'State parameter is required.' });
        }

        const message = await chatModel.getBotAutoMessageByState(state);
        if (!message) {
            return res.status(404).json({ message: 'Bot message not found for this state.' });
        }

        res.status(200).json(message);
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
    const { currentState, input } = req.query;

    if (!currentState || !input) {
        return res.status(400).json({ message: 'currentState and input are required.' });
    }

    try {
        const nextState = stateManager.getNextState(currentState, input);
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
