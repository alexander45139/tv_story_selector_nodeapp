const mysql = require('mysql2/promise');

const credentials = {
	host: 'am2012.brighton.domains',
	user: 'am2012_main',
	password: 'Fer33doubleH?',
	database: 'am2012_tv_story_selector'
};

async function query(sql, params) {
	const connection = await mysql.createConnection(credentials);
	const [results, ] = await connection.execute(sql, params);
	return results;
}

module.exports = {
	query
}
