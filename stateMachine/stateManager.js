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

function getNextState(currentState, userInput) {
    const state = stateMachine[currentState];
    if (!state || !state.transitions) return null;
    return state.transitions[userInput] || null;
}


function getStateMetadata(stateName) {
    return stateMachine[stateName] || null;
}

module.exports = {
    getStateMessage,
    getNextState,
    getStateMetadata,
};
