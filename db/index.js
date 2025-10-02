const { Pool } = require('pg');
const { DATABASE } = require('../config/constants');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: async () => {
    const client = await pool.connect();
    const query = client.query;
    const release = client.release;
    
    // Set a timeout of 30 seconds, after which we will log this client's last query (only in development)
    const timeout = setTimeout(() => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Database client checked out for more than 30 seconds');
        console.warn(`Last query: ${client.lastQuery?.[0] || 'None'}`);
      }
    }, DATABASE.CLIENT_TIMEOUT_WARNING);
    
    // Monkey patch the query method to keep track of the last query executed
    client.query = (...args) => {
      client.lastQuery = args;
      return query.apply(client, args);
    };
    
    client.release = () => {
      // Clear the timeout
      clearTimeout(timeout);
      // Set the methods back to their old implementation
      client.query = query;
      client.release = release;
      return release.apply(client);
    };
    
    return client;
  }
};
