const chatModel = require('../models/chatModel');
const stateManager = require('../stateMachine/stateManager');

// 세션 생성, 처음에 보낼 챗봇 메시지를 세션에 저장하고 return
exports.createChatSession = async (user_id) => {
    // 1. 처음에 보내지는 step 1 챗봇 메세지를 BotAutoMessage에서 fetch
    const botFirstMessage = await chatModel.getBotAutoMessageByStep(1);
    const timestamp = new Date();

    // 2. 새로 생성할 세션의 step과 state를 botFirstMessage의 step_order와 state로 하기 위한 변수 step과 state정의
    const step = botFirstMessage.step_order;
    if (step === undefined) throw new Error("step_order not found in botFirstMessage");
    
    const state = botFirstMessage.state || null;
    
    // 3. 새로운 챗봇 대화 세션 생성
    console.log("Creating session with step:", step, "state:", state);
    const session_id = await chatModel.insertChatSession(user_id, step, state);
    
    // 4. step 1 챗봇 메세지를 ChatMessage 테이블에 저장
    const botMessageId = await chatModel.insertBotMessage(session_id, botFirstMessage.content, timestamp, state);
    
    return {
        session_id,
        bot_message: {
            id: botMessageId,
            session_id,
            sender: 'bot',
            content: botFirstMessage.content,
            timestamp,
            state
        }
    };
};

// 유저의 모든 챗봇 대화 세션 ID, 세션 제목 불러오기
exports.getAllChatSessions = async () => {
    // 일단 모든 세션 받아오기 (추후 유저 authentication 구현하면 아이디별 세션 필터링 추가)
    return await chatModel.fetchAllChatSessions();
};

// 세션 삭제
exports.deleteChatSession = async (session_id) => {
    console.log(`Deleting session: ${session_id}`);
    return await chatModel.deleteChatSession(session_id);
}

// 유저가 보낸 메세지 저장
exports.saveChatMessage = async (session_id, content, timestamp, inputKey) => {
    if (!timestamp || (!content && !inputKey)) {
        throw new Error('Either content or inputKey, and timestamp are required');
    }

    const actualInput = inputKey || content;
    const currentState = await chatModel.getCurrentState(session_id);

    // state 전이 판단
    const stateMeta = stateManager.getStateMetadata(currentState);

    // input_key 유형일 경우 입력값 보정
    const normalizeInputKey = (input) => {
        const map = {
            '시작하기': 'start',
            '예': 'yes',
            '네': 'yes',
            '아니요': 'no',
            '아니오': 'no',
            '사진·음성 증거 더 추가하기': 'additional_evidence_upload',
            '상황 설명 추가로 입력하기': 'additional_description',
            '분석 시작하기': 'start_evaluation'
        };
        return map[input.trim()] || input.trim();
    };

    const transitionKey = stateMeta?.expects === 'text'
        ? actualInput.trim().length > 0 ? 'description_provided' : 'no_description'
        : normalizeInputKey(actualInput);

    const nextState = stateManager.getNextState(currentState, transitionKey);

    // 유저 메세지 저장
    const messageId = await chatModel.insertChatMessage(session_id, actualInput, timestamp, currentState);

    // 상태 전이 발생 시: 다음 state 및 챗봇 메세지 DB 업데이트
    if (nextState && nextState !== currentState) {
        await chatModel.updateCurrentState(session_id, nextState);

        const botMsg = await chatModel.getBotAutoMessageByState(nextState);
        if (botMsg) {
            const botTimestamp = new Date();
            await chatModel.insertBotMessage(session_id, botMsg.content, botTimestamp, nextState);
            console.log("[DEBUG] Bot message inserted for state:", nextState);
        } else {
            console.warn("[DEBUG] No bot message found for state:", nextState);
        }
    } else {
        console.log("[DEBUG] No state transition occurred or nextState equals currentState");
    }

    return {
        user_message: {
            id: messageId,
            session_id: parseInt(session_id),
            sender: 'user',
            content: actualInput,
            timestamp,
            state: currentState
        }
    };
};


// 특정 세션에 보내진 메세지 받아오기
exports.getChatMessages = async (session_id, sender) => {
    return await chatModel.fetchChatMessages(session_id, sender);
};

// 증거 업로드
exports.uploadEvidence = async ({ session_id, file }) => {
    if (!file) throw new Error('File is required');
    
    const file_path = file.path;
    const file_type = file.mimetype;
    
    const evidenceId = await chatModel.insertEvidence({
        chat_session_id: Number(session_id),
        file_path,
        file_type,
        is_textual: null,         // 추후 user input받고 업데이트
        ocr_text: null,            // OCR 후에 업데이트
        evidence_description: null,        // 추후 user input받고 업데이트
    });
    
    const timestamp = new Date(); // 여기서 생성된 timestamp가 evidence 저장할 때 필드 값으로 쓰이진 않지만 return값으로 시간 정보 주기 위해 추가

    return {
        evidence_id: evidenceId,
        session_id,
        file_path: file_path,
        file_type: file_type,
        timestamp
    };
};

// 특정 세션에 제출된 증거 파일 목록 조회
exports.getEvidenceBySession = async (session_id) => {
    const evidenceList = await chatModel.fetchEvidenceBySessionId(session_id);
    return evidenceList;
};


// current step 업데이트
exports.updateCurrentStep = async (session_id, newStep) => {
    await chatModel.updateCurrentStep(session_id, newStep);
    return { success: true, message: `Step updated to ${newStep}` };
};

// current state 업데이트
exports.updateCurrentState = async (session_id, newState) => {
    await chatModel.updateCurrentState(session_id, newState);
    return { success: true, message: `State updated to ${newState}` };
};

// 전체 세션 괴롭힘 분석 요청
exports.analyzeSession = async (session_id) => {
    const evidenceData = await chatModel.getEvidenceHarassmentBySession(session_id);
    const messageData = await chatModel.getMessageHarassmentBySession(session_id);

    // EvidenceHarassment, ChatMessageHarassment이 있는지 확인 (두 테이블이 있어야 둘을 종합한 세션 분석을 할 수 있기 때문에)
    if (evidenceData.length === 0 || messageData.length === 0) {
        throw new Error("Both evidence and message harassment analyses must exist to evaluate the session.");
    }

    // harassment_category_id별 severity 더하기 (harassment_category_id가 같은 EvidenceHarassment, ChatMessageHarassment)
    const merged = {};
    for (const record of [...evidenceData, ...messageData]) {
        const categoryId = record.harassment_category_id;
        if (!merged[categoryId]) {
            merged[categoryId] = 0;
        }
        merged[categoryId] += record.severity;
    }

    // harasssment_category_id별 EvidenceHarassment, ChatMessageHarassment을 종합한 SessionEvalHarassment 테이블 생성
    const sessionEvalHarassmentRecords = Object.entries(merged).map(([categoryId, severity]) => ({
        harassment_category_id: Number(categoryId),
        severity
    }));

    const hasSeverity = sessionEvalHarassmentRecords.some(r => r.severity >= 0); // 심각도가 0과 같거나 크면
    const is_harassment = hasSeverity ? 1 : 0;
    const should_report = is_harassment;  // 일단은 간단하게 괴롭힘이 맞으면 신고 권장하는 것으로...
    const risk_score = sessionEvalHarassmentRecords.reduce((sum, r) => sum + r.severity, 0); // 위험지수 계산 방법?

    const sessionEvalResultId = await chatModel.insertSessionEvalResult({
        session_id,
        risk_score,
        is_harassment,
        should_report
    });

    for (const record of sessionEvalHarassmentRecords) {
        await chatModel.insertSessionEvalHarassment({
            session_eval_result_id: sessionEvalResultId,
            harassment_category_id: record.harassment_category_id,
            severity: record.severity
        });
    }

    return {
        session_eval_result_id: sessionEvalResultId,
        risk_score,
        is_harassment,
        should_report,
        details: sessionEvalHarassmentRecords
    };
};





// state/step progression까지 될 수 있게 쓴 saveChatMessage, uploadEvidence 함수. 복잡해지고 증거 파일처럼 여러 단계로 필드에 대한 데이터 받아야하는 request에는 오류가 많아서 사용 X
// exports.saveChatMessage = async (session_id, content, timestamp, inputKey) => {
//     if (!timestamp || (!content && !inputKey)) {
//         throw new Error('Either content or inputKey, and timestamp are required');
//     }

//     session_id = parseInt(session_id);

//     // 사용자 입력이 버튼 클릭일 때는 inputKey값을 받음. inputKey 없으면 content (일반적인 사용자 전송 메세지)
//     const actualInput = inputKey || content;

//     // ISO 8601 format의 timestamp를 db 저장 위해 변환 (MySQL DATETIME에 맞게)
//     const formattedTimestamp = new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');
//     let currentState = await chatModel.getCurrentState(session_id);
//     const currentStep = await chatModel.getCurrentStep(session_id);

//     // 1. 유저가 전송한 메세지 저장
//     const userMessageId = await chatModel.insertChatMessage(session_id, actualInput, formattedTimestamp, currentState);

//     // 2. current state의 'expects' 메타데이터 가져오기 (비정형 input도 받아야 하는 state인지 체크)
//     const currentStateMeta = stateManager.getStateMetadata(currentState);
//     const transitionKey = currentStateMeta?.expects === 'text'
//         ? actualInput.trim().length > 0 ? 'description_provided' : 'no_description' // 비정형 input을 받아오는 state e.g. 텍스트 없는 사진에 대한 설명 입력받는 state
//         : actualInput; // 프런트엔드에서 정형화된 input e.g. 'yes', 'file_uploaded' 받아오는 state

//     // 3.  transition key로 state machine(stateMachine.json)에 따라 다음 state 정하기
//     const nextState = stateManager.getNextState(currentState, transitionKey);
//     const botTimestamp = new Date();
    
//     if (nextState) {
//         // 4. nextState의 챗봇 메세지 받아오기
//         const botAutoMsg = await chatModel.getBotAutoMessageByState(nextState);
//         if (!botAutoMsg) throw new Error(`Bot message not found for state: ${nextState}`);

//         // 5. 챗봇 메세지를 ChatMessage 테이블에 저장
//         const botMessageId = await chatModel.insertBotMessage(session_id, botAutoMsg.content, botTimestamp, nextState);
//         // 6. ChatSession의 current_state를 nextState로 업데이트
//         await chatModel.updateCurrentState(session_id, nextState);

//         return {
//             user_message: {
//                 id: userMessageId,
//                 session_id: session_id,
//                 sender: 'user',
//                 content: actualInput,
//                 timestamp
//             },
//             bot_message: {
//                 id: botMessageId,
//                 session_id,
//                 sender: 'bot',
//                 content: botAutoMsg.content,
//                 timestamp: botTimestamp,
//                 state: nextState
//             }
//         };
//     } else { // 더 이상 state transition될 것이 없다면: 다음 step으로
//         // nextStep을 currentStep + 1로 정의
//         const nextStep = currentStep + 1;
        
//         // nextStep의 챗봇 메세지 받아오기
//         const botAutoMsg = await chatModel.getBotAutoMessageByStep(nextStep);
//         if (!botAutoMsg || !botAutoMsg.state) throw new Error(`Bot message for step: ${nextStep} is invalid`);
        
//         // currentState를 botAutoMsg의 state값으로 설정
//         currentState = botAutoMsg.state;
        
//         // ChatSession의 currentState 업데이트
//         await chatModel.updateCurrentState(session_id, currentState);
//         // ChatSession의 currentStep 업데이트
//         console.log("Step fallback triggered. Moving to next step:", nextStep); // 디버깅용
//         await chatModel.updateCurrentStep(session_id, nextStep);
//         const check = await chatModel.getCurrentStep(session_id); // 디버깅용
//         console.log("Updated current step: ", check); // 디버깅용
        
//         // 챗봇 메세지를 ChatMessage 테이블에 저장
//         console.log("Current step:", currentStep);
//         console.log("Next step:", nextStep);
//         console.log("botAutoMsg from next step:", botAutoMsg?.content);

//         const botMessageId = await chatModel.insertBotMessage(session_id, botAutoMsg.content, botTimestamp, currentState);

//         return {
//             user_message: {
//                 id: userMessageId,
//                 session_id: session_id,
//                 sender: 'user',
//                 content: actualInput,
//                 timestamp
//             },
//             bot_message: {
//                 id: botMessageId,
//                 session_id: session_id,
//                 sender: 'bot',
//                 content: botAutoMsg.content,
//                 timestamp: botTimestamp,
//                 state: currentState   
//             }
//         };
//     }
// };

// exports.uploadEvidence = async ({ message_id, is_textual, evidence_description, file }) => {
//     const session_id = await chatModel.getSessionIdByMessageId(message_id);
//     if (!session_id) throw new Error('Invalid message_id');

//     const filePath = file.path;
//     const fileType = file.mimetype;
//     const timestamp = new Date();

//     // 현재 state에 따라 증거 업로드 state progression
//     const currentState = await chatModel.getCurrentState(session_id);

    
//     let ocrText = null;
//     let isText = is_textual === 'true';
//     let inputKey;
    
//     // 1. currentState에 따라 적절한 inputKey 지정
//     if (currentState === 'wait_file_upload') {
//         inputKey = 'file_uploaded';
//     } else if (currentState === 'ask_is_textual') {
//         inputKey = isText ? 'yes' : 'no';
//     } else if ([
//         'no_text_ask_description',
//         'ocr_fail_ask_description',
//         'ask_description',
//         'ocr_success_ask_description'
//     ].includes(currentState)) {
//         inputKey = evidence_description?.trim() ? 'description_provided' : 'no_description';
//     } else {
//         throw new Error(`Invalid state for evidence upload: ${currentState}`);
//     }

//     // 2. 증거 파일을 DB에 저장
//     const evidenceId = await chatModel.insertEvidence({
//         session_id,
//         filePath,
//         fileType,
//         is_textual: isText,
//         ocrText, // 추후에 ocr 추가
//         description: evidence_description || null,
//         timestamp
//     });

//     // 3. saveChatMessage에 inputKey보내고 다음 챗봇 메세지 받기
//     const result = await exports.saveChatMessage(session_id, null, timestamp, inputKey);

//     return {
//         evidence_id: evidenceId,
//         session_id,
//         is_textual: isText,
//         ocr_text: ocrText || null,
//         evidence_description: evidence_description || null,
//         file_path: filePath,
//         file_type: fileType,
//         timestamp,
//         ...result
//     };
// };

// 팀원이 백엔드에서 자동으로 챗봇 메세지를 주는 코드가 주석처리 되어있어서 프론트에 챗봇 응답이 안 보인다고 하는데, 증거 분석 같이 여러 단계가 필요한 유저 인풋을 받을 때는 오류가 많이 나고 복잡해져서 유저 메세지 저장과 동시에 state progression이 되지 않고, saveChatMessage는 단순히 유저메세지를 저장하고, 챗봇 메세지는 getBotMessageByStep/getBotMessageByState로 받아오는 것으로 했잖아? 이게 주석에 적혀 있는데 왜 이해를 못했을까? 각 기능을 따로 분리시켜놓고 state/step progression은 프런트 로직으로 구현해야 할 필요성을 적어줘. 아니면 백엔드가 맡아야 하는 일이야?