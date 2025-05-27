const chatModel = require('../models/chatModel');
const stateManager = require('../stateMachine/stateManager');
// const tesseract = require("node-tesseract-ocr");

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

    // 유저 메세지 저장
    const messageId = await chatModel.insertChatMessage(session_id, actualInput, timestamp, currentState);

    return {
        user_message: {
            id: messageId,
            session_id: parseInt(session_id),
            sender: 'user',
            content: actualInput,
            timestamp
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