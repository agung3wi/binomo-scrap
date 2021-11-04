const db = require('knex')({
    client: 'pg',
    connection: {
        host: 'demooke.com',
        user: 'postgres',
        password: 'Digta123!',
        database: 'binomo'
    }
});
module.exports = db