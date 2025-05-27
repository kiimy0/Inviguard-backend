const Tesseract = require('tesseract.js');
const path = require('path');

async function runOCR(imagePath) {
    try {
        const { data: { text } } = await Tesseract.recognize(
            imagePath,
            'kor',
            { logger: m => console.log(m) } // console에 진행상황 log
        );
        return text.trim();
    } catch (err) {
        console.error('OCR failed:', err);
        return null;
    }
}

module.exports = runOCR;
