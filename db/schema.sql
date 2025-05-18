CREATE TABLE User (
	user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE ChatSession (
	chat_session_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    started_at DATETIME,
    ended_at DATETIME,
    session_title VARCHAR(255),
    current_step INT,
    current_state VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES User(user_id)
);

CREATE TABLE ChatMessage (
	chat_message_id INT AUTO_INCREMENT PRIMARY KEY,
    chat_session_id INT,
    sender ENUM('user', 'bot') NOT NULL,
    content TEXT,
    timestamp DATETIME,
    FOREIGN KEY (chat_session_id) REFERENCES ChatSession(chat_session_id)
);

CREATE TABLE Evidence (
	evidence_id INT AUTO_INCREMENT PRIMARY KEY,
    chat_session_id INT,
    file_path VARCHAR(500),
    file_type VARCHAR(100),
    is_textual BOOLEAN,
    evidence_description TEXT,
    ocr_text TEXT,
    timestamp TIME,
    FOREIGN KEY (chat_session_id) REFERENCES ChatSession(chat_session_id)
);

CREATE TABLE HarassmentCategory (
	harassment_category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE ChatMessageHarassment (
	chat_message_harassment_id INT AUTO_INCREMENT PRIMARY KEY,
    chat_message_id INT,
    harassment_category_id INT,
    weight DOUBLE,
    state VARCHAR(50),
    FOREIGN KEY (chat_message_id) REFERENCES ChatMessage(chat_message_id),
    FOREIGN KEY (harassment_category_id) REFERENCES HarassmentCategory(harassment_category_id)
);

CREATE TABLE EvidenceHarassment (
	evidence_harassment_id INT AUTO_INCREMENT PRIMARY KEY,
    evidence_id INT,
    harassment_category_id INT,
    weight DOUBLE,
    FOREIGN KEY (evidence_id) REFERENCES Evidence(evidence_id),
    FOREIGN KEY (harassment_category_id) REFERENCES HarassmentCategory(harassment_category_id)
);

CREATE TABLE SessionEvalResult (
    session_eval_result_id INT AUTO_INCREMENT PRIMARY KEY,
    chat_session_id INT NOT NULL,
    risk_score INT,
    should_report BOOLEAN,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_session_id) REFERENCES ChatSession(chat_session_id)
);

CREATE TABLE SessionEvalHarassment (
    session_eval_harassment_id INT AUTO_INCREMENT PRIMARY KEY,
    session_eval_result_id INT,
    harassment_category_id INT,
    weight DOUBLE,
    FOREIGN KEY (session_eval_result_id) REFERENCES SessionEvalResult(session_eval_result_id),
    FOREIGN KEY (harassment_category_id) REFERENCES HarassmentCategory(harassment_category_id)
);


CREATE TABLE Report (
	report_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    chat_session_id INT,
    submitted_at DATETIME,
    status VARCHAR(100),
    evidence_included BOOLEAN,
    FOREIGN KEY (user_id) REFERENCES User(user_id),
    FOREIGN KEY (chat_session_id) REFERENCES ChatSession(chat_session_id)
);

CREATE TABLE BotAutoMessage (
    bot_auto_message_id INT AUTO_INCREMENT PRIMARY KEY,
    step_order INT NOT NULL,
    content TEXT NOT NULL,
    state VARCHAR(50)
);
