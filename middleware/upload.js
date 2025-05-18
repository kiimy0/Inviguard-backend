const multer = require('multer');
const path = require('path');

// 업로드된 파일 저장할 공간 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/evidence/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + Math.round(Math.random() * 1E9); // 파일 이름 중복 방지 위해 Math.round()로 큰 숫자 추가
        const ext = path.extname(file.originalname); // 업로드된 파일 이름에서 file extension(파일 확장자)추출
        cb(null, file.fieldname + '-' + uniqueSuffix + ext); // callback해서 multer에 파일 이름을 무엇으로 할 지 알림
    }
});

// 파일 타입별 필터링
const fileFilter = (req, file, cb) => {
    // 일단 이미지랑 오디오 파일만 받기
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('이미지나 오디오 파일만 업로드 가능합니다'), false);
    }
}

const upload = multer({ storage: storage, fileFilter: fileFilter});

module.exports = upload;