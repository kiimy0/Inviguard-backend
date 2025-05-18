const db = require('./config/db');

(async () => {
    try {
        const [rows] = await db.query('SELECT 1 + 1 AS result');
        console.log('MySQL connection success! Result:', rows[0].result);
    } catch (err) {
        console.error('DB connection failed:', err);
    }
})();