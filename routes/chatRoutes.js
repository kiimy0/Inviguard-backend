const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const upload = require('../middleware/upload');

// 챗봇 대화 세션 생성
router.post('/sessions', chatController.createChatSession);

// 챗봇 대화 세션 제목 목록 조회
router.get('/sessions', chatController.getAllChatSessions);

// 챗봇 대화 세션 삭제
router.delete('/sessions/:session_id', chatController.deleteChatSession);

// 유저가 전송한 메세지 저장
router.post('/sessions/:session_id/messages', chatController.saveChatMessage);

// 챗봇 메세지 step/state 별로 불러오기
router.get('/bot-message/step/:step', chatController.getBotMessageByStep);
router.get('/bot-message/state/:state', chatController.getBotMessageByState);

// 세션 대화 복원
router.get('/sessions/:session_id/messages', chatController.getChatMessages);

// 증거 파일 제출 (사진/오디오 파일, request 당 하나의 파일만 업로드)
router.post('/sessions/:session_id/evidence', upload.single('file'), chatController.uploadEvidence);

// 증거 파일 is_textual 저장
router.put('/evidence/:evidence_id/textuality', chatController.updateEvidenceTextuality);

// 증거 파일 evidence_description 저장
router.put('/evidence/:evidence_id/description', chatController.updateEvidenceDescription);

// 이미지 증거 OCR
router.put('/evidence/:evidence_id/ocr', chatController.runOCROnEvidence);

// 특정 세션에 제출된 증거 파일 목록 조회
router.get('/sessions/:session_id/evidence', chatController.getEvidenceBySession);

module.exports = router;