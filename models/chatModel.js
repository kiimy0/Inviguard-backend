const db = require('../config/db.js');

// 챗봇 대화 세션 생성
async function insertChatSession(user_id, initialStep, initialState) {
    const started_at = new Date();

    // 1. 날짜 포맷: YYYY-MM-DD (시간 생략)
    const dateStr = started_at.toISOString().split('T')[0]; // e.g., "2025-06-13"
    const session_title = `{dateStr} 채팅`;

    // 2. 세션 생성, session_title은 세션 생성 날짜로
    const [result] = await db.query(
        `INSERT INTO ChatSession (user_id, session_title, started_at, current_step, current_state) 
        VALUES (?, ?, ?, ?, ?)`,
        [user_id, session_title, started_at, initialStep, initialState]
    );

    return result.insertId;  // 생성된 session id를 return (insertId 속성으로 INSERT문 실행 후 삽입된 행의 ID를 얻을 수 있음)
}

// 모든 챗봇 대화 세션 fetch
async function fetchAllChatSessions() {
    const [rows] = await db.query(
        `SELECT chat_session_id AS session_id, session_title
        FROM ChatSession
        ORDER BY started_at DESC` // 최근에 생성된 대화 세션 순서로
    );
    return rows;
}

// 챗봇 대화 세션 삭제
async function deleteChatSession(session_id) {
    await db.query('DELETE FROM ChatSession WHERE chat_session_id = ?', [session_id]);
}

// 유저가 전송한 메세지 저장
async function insertChatMessage(session_id, content, timestamp, state) {
    const [result] = await db.query(
        'INSERT INTO ChatMessage (chat_session_id, sender, content, timestamp, state) VALUES (?, ?, ?, ?, ?)',
        [session_id, 'user', content, timestamp, state]
    );
    return result.insertId; // 생성된 message id를 return
}

// 세션 대화 복원 (sender 명시되어있지 않다면 세션의 모든 메세지 받아옴)
async function fetchChatMessages(session_id, sender = null) {
    let query = `
        SELECT 
        chat_message_id AS id, 
        chat_session_id AS session_id, 
        sender, 
        content, 
        timestamp,
        state
        FROM ChatMessage
        WHERE chat_session_id = ?
    `;
    const params = [session_id];

    // sender가 명시되어 있다면 query에 조건으로 추가
    if (sender) {
        query += ' AND sender = ?';
        params.push(sender);
    }

    query += ' ORDER BY timestamp ASC';

    const [rows] = await db.query(query, params);
    return rows;
}

// BotAutoMessage(정해진 챗봇 멘트)를 ChatMessage에 저장
async function insertBotMessage(session_id, content, timestamp, state) {
    const [result] = await db.query(
        'INSERT INTO ChatMessage (chat_session_id, sender, content, timestamp, state) VALUES (?, ?, ?, ?, ?)',
        [session_id, 'bot', content, timestamp, state]
    );
    return result.insertId; // 생성된 챗봇 메세지 message id를 return
}

// 단계(step)에 맞는 BotAutoMessage를 불러옴
async function getBotAutoMessageByStep(step) {
    const [rows] = await db.query(
        'SELECT * FROM BotAutoMessage WHERE step_order = ? LIMIT 1',
        [step]
    );
    return rows[0];
}

// 상태(state)에 맞는 BotAutoMessage를 불러옴
async function getBotAutoMessageByState(state) {
    const [rows] = await db.query(
        'SELECT * FROM BotAutoMessage WHERE state = ? LIMIT 1',
        [state]
    );
    return rows[0];
}

// 챗봇 대화 세션의 current step 받아옴
async function getCurrentStep(session_id) {
    const [rows] = await db.query(
        'SELECT current_step FROM ChatSession WHERE chat_session_id= ?',
        [session_id]
    );

    console.log("[DEBUG] Rows in getCurrentStep: ", rows);
    return rows[0]?.current_step;
}

// 챗봇 대화 세션의 current step 업데이트
async function updateCurrentStep(session_id, newStep) {
    await db.query(
        'UPDATE ChatSession SET current_step = ? WHERE chat_session_id= ?',
        [newStep, session_id]
    );
}

// 증거 파일 저장
async function insertEvidence({ chat_session_id, file_path, file_type, is_textual, ocr_text, evidence_description }) {
    const [result] = await db.query(
        `INSERT INTO Evidence (chat_session_id, file_path, file_type, is_textual, ocr_text, evidence_description, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [chat_session_id, file_path, file_type, is_textual, ocr_text, evidence_description]
    );
    return result.insertId;
}

// 증거 파일 is_textual인지 user input받고 boolean 저장
async function updateEvidenceTextuality(evidence_id, is_textual) {
    const query = `
        UPDATE Evidence
        SET is_textual = ?
        WHERE evidence_id = ?
    `;
    await db.query(query, [is_textual, evidence_id]);
}

// 증거 파일 evidence_description user한테 입력받고 저장
async function updateEvidenceDescription(evidence_id, evidence_description) {
    const query = `
        UPDATE Evidence
        SET evidence_description = ?
        WHERE evidence_id = ?
    `;
    await db.query(query, [evidence_description, evidence_id]);
}


// 챗봇 대화 세션의 current state 받아옴 (state는 sub-step들이 필요한 step에서 어떤 상황인지를 나타냄 e.g. 세션의 current_step:3(증거 제출)일 때 current_state는 'ask_is_textual')
async function getCurrentState(session_id) {
    const [rows] = await db.query(
        'SELECT current_state FROM ChatSession WHERE chat_session_id = ?',
        [session_id]
    );
    return rows[0]?.current_state;
}

// 챗봇 대화 세션의 current state 업데이트
async function updateCurrentState(session_id, newState) {
    await db.query(
        'UPDATE ChatSession SET current_state = ? WHERE chat_session_id = ?',
        [newState, session_id]
    );
}

// evidence_id로 evidence 받아옴
async function getEvidenceById(evidence_id) {
    const [rows] = await db.query(
        'SELECT * FROM Evidence WHERE evidence_id = ?',
        [evidence_id]
    );
    return rows[0]; 
}

// evidence의 ocr_text 업데이트
async function updateEvidenceOCRText(evidence_id, ocrText) {
    await db.query(
        `UPDATE Evidence SET ocr_text = ? WHERE evidence_id = ?`,
        [ocrText, evidence_id]
    );
}

// 특정 세션에 제출된 증거 파일 목록 조회
async function fetchEvidenceBySessionId(session_id) {
    const [rows] = await db.query(
        `SELECT evidence_id, chat_session_id AS session_id, file_path, file_type, is_textual, ocr_text, evidence_description, timestamp
            FROM Evidence
            WHERE chat_session_id = ?
            ORDER BY timestamp ASC`,
        [session_id]
    );
    return rows;
}

// 괴롭힘 유형 name으로 조회
async function getHarassmentCategoryByName(name) {
    const [rows] = await db.query(
        "SELECT * FROM HarassmentCategory WHERE name = ?",
        [name]
    );
    return rows[0];
}

// EvidenceHarassment 생성
async function insertEvidenceHarassment({ evidence_id, harassment_category_id, severity, is_harassment }) {
    await db.query(
        `INSERT INTO EvidenceHarassment (evidence_id, harassment_category_id, severity, is_harassment)
        VALUES (?, ?, ?, ?)`,
        [evidence_id, harassment_category_id, severity, is_harassment]
    );
}


// session_id로 EvidenceHarassment 조회
async function getEvidenceHarassmentBySession(session_id) {
    const [rows] = await db.query(`
        SELECT eh.harassment_category_id, eh.severity
        FROM EvidenceHarassment eh
        JOIN Evidence e ON eh.evidence_id = e.evidence_id
        WHERE e.chat_session_id = ?
    `, [session_id]);
    return rows;
}

// session_id로 상황 설명하는 내용의 메세지 조회
async function getDescriptionMessagesBySessionId(session_id) {
    return await db.query(
        `SELECT * FROM ChatMessage 
        WHERE chat_session_id = ? 
        AND sender = 'user'
        AND state IN ('prompt_general_description', 'prompt_additional_description')`,
        [session_id]
    );
}

// ChatMessageHarassment 생성
async function insertChatMessageHarassment({ chat_message_id, harassment_category_id, severity, is_harassment }) {
    const query = `
        INSERT INTO ChatMessageHarassment (chat_message_id, harassment_category_id, severity, is_harassment)
        VALUES (?, ?, ?, ?)
    `;
    const values = [chat_message_id, harassment_category_id, severity, is_harassment];
    await db.query(query, values);
}

// chat_message_id로 ChatMessage 조회
async function getChatMessageById(chat_message_id) {
    const query = `SELECT * FROM ChatMessage WHERE chat_message_id = ?`;
    const [rows] = await db.query(query, [chat_message_id]);
    return rows.length > 0 ? rows[0] : null;
}

// session_id로 ChatMessageHarassment 조회
async function getMessageHarassmentBySession(session_id) {
    const [rows] = await db.query(`
        SELECT mh.harassment_category_id, mh.severity
        FROM ChatMessageHarassment mh
        JOIN ChatMessage cm ON mh.chat_message_id = cm.chat_message_id
        WHERE cm.chat_session_id = ?
    `, [session_id]);
    return rows;
}


async function insertSessionEvalHarassment({ session_eval_result_id, harassment_category_id, severity }) {
    await db.query(`
        INSERT INTO SessionEvalHarassment (session_eval_result_id, harassment_category_id, severity)
        VALUES (?, ?, ?)
    `, [session_eval_result_id, harassment_category_id, severity]);
}

async function insertSessionEvalResult({ session_id, risk_score, is_harassment, should_report }) {
    const [result] = await db.query(`
        INSERT INTO SessionEvalResult (chat_session_id, risk_score, is_harassment, should_report)
        VALUES (?, ?, ?, ?)
    `, [session_id, risk_score, is_harassment, should_report]);
    return result.insertId;
}




module.exports = {
    insertChatSession,
    fetchAllChatSessions,
    deleteChatSession,
    insertChatMessage,
    fetchChatMessages,
    insertBotMessage,
    getBotAutoMessageByStep,
    getBotAutoMessageByState,
    getCurrentStep,    
    updateCurrentStep,
    getCurrentState,
    updateCurrentState,
    insertEvidence,
    updateEvidenceTextuality,
    updateEvidenceDescription,
    getEvidenceById,
    updateEvidenceOCRText,
    fetchEvidenceBySessionId,
    getHarassmentCategoryByName,
    insertEvidenceHarassment,
    getEvidenceHarassmentBySession,
    getDescriptionMessagesBySessionId,
    insertChatMessageHarassment,
    getChatMessageById,
    getMessageHarassmentBySession,
    insertSessionEvalHarassment,
    insertSessionEvalResult
};
