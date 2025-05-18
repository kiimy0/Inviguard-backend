const chatModel = require('../models/chatModel');
// const runOCR = require('../services/ocrService'); // 임시로 적어두기, 실제로 OCR 테스팅하진 않음
const path = require('path');
const chatService = require('../services/chatService.js')


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
        const { message_id } = req.params;
        const { is_textual, evidence_description } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: '업로드된 파일이 없습니다.'});
        }

        // 해당 message_id로 session_id 확인
        const session_id = await chatModel.getSessionIdByMessageId(message_id);
        if (!session_id) {
            return res.status(400).json({ message: 'Invalid message_id: session not found.' });
        }

        const currentState = await chatModel.getCurrentState(session_id);
        if (currentState !== 'wait_file_upload') {
            return res.status(400).json({ message: 'File upload is not allowed in the current state.' });
        }

        const result = await chatService.uploadEvidence({
            message_id,
            is_textual,
            evidence_description,
            file
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error uploading evidence:', error);
        res.status(500).json({ message: error.messsage || 'Server error' });
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

