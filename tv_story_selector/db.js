/* POSTGRE SQL */
/* const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    database: 'tv_story_selector',
    user: 'tv_story_user',
    pssword: 'user_123',
    port: 5432
});

module.exports = pool;
 */

/* MYSQL */
const mysql = require('mysql2/promise');

const credentials = {
	/*host: 'am2012.brighton.domains',
	user: 'am2012_main',
	password: 'Fer33doubleH?',
	database: 'am2012_tv_story_selector'*/

	host: '127.0.0.1',
	user: 'root',
	password: '',
	database: 'tv_story_selector'
};

async function query(sql, params) {
	const connection = await mysql.createConnection(credentials);
	const [results, ] = await connection.execute(sql, params);
	return results;
}

module.exports = {
	query
}
