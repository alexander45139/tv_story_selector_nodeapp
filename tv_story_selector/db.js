const odbc = require('odbc');

async function query(sql, params) {
    const connectionString = 'Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=../TV Story Selector.accdb';

    try {
        const connection = await odbc.connect(connectionString);
        const results = await connection.query(sql, params);
        await connection.close();
    } catch (err) {
        console.error('Error:', err);
    }
}




//const mysql = require('mysql2/promise');

//const credentials = {
//	/*host: 'am2012.brighton.domains',
//	user: 'am2012_main',
//	password: 'Fer33doubleH?',
//	database: 'am2012_tv_story_selector'*/

//	host: '127.0.0.1',
//	user: 'root',
//	password: '',
//	database: 'tv_story_selector'
//};

//async function query(sql, params) {
//	const connection = await mysql.createConnection(credentials);
//	const [results, ] = await connection.execute(sql, params);
//	return results;
//}

//module.exports = {
//	query
//}
