const fs = require('fs');
const path = require('path');
const stateMachine = require('../stateMachine/stateMachine.json');

function getStateMessage(stateKey) {
    const state = stateMachine[stateKey];
    if (!state) {
        throw new Error(`Invalid state: ${stateKey}`);
    }
    return state.message;
}

function classifyTextInput(input) {
    if (!input || input.trim() === '') return 'no_description';

    const text = input.toLowerCase();
    const keywords = ['추가할 내용 없음', '설명 생략', '추가할 내용 없습니다'];

    return keywords.some(k => text.includes(k)) ? 'no_description' : 'description_provided';
}

function getNextState(currentState, userInput, systemEvent = null) {
    const state = stateMachine[currentState];
    if (!state) return null;

    // expects='system' 처리(OCR 성공/실패처럼 백엔드 처리 결과에 따라 state 바뀌어야 할 때)
    if (state.expects === 'system' && systemEvent) { // endpoint 구체적인 예시: GET /api/chat/state/next?currentState=run_ocr&systemEvent=ocr_success)
        return state.transitions?.[systemEvent] || null;
    }

    // intro 처리
    if (state.expects === 'input_key' && currentState === 'intro' && userInput === 'start') {
        return 'prompt_general_description';
    }

    // file 형식 입력 처리
    if (state.expects === 'file') { // endpoint 구체적인 예시: GET /api/chat/state/next?currentState=wait_file_upload&systemEvent=file_uploaded)
        return state.transitions?.[systemEvent] || null;
    }

    // text 입력 처리
    if (state.expects === 'text') {
        const key = classifyTextInput(userInput);
        return state.transitions?.[key] || null;
    }

    // 일반 input_key 처리
    if (state.expects === 'input_key') {
        return state.transitions?.[userInput] || null;
    }
}

function getStateMetadata(stateName) {
    return stateMachine[stateName] || null;
}


module.exports = {
    getStateMessage,
    classifyTextInput,
    getNextState,
    getStateMetadata
};
