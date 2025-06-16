const express = require('express');
const router = express.Router();
const kobertController = require('../controllers/kobertController');

// OCR 텍스트 분석 요청
router.post('/evidence/:evidence_id/analyze', kobertController.analyzeOCRText);

module.exports = router;