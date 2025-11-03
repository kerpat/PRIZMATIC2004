/**
 * Прямое подключение к PostgreSQL (замена Supabase клиента)
 * Используется для работы с VPS базой данных
 */

const { Pool } = require('pg');

// Настройка подключения из переменных окружения
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'prizmatic',
  user: process.env.DB_USER || 'prizmatic_user',
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Обработка ошибок подключения
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Выполнить SQL запрос
 * @param {string} query - SQL запрос
 * @param {Array} params - Параметры запроса
 * @returns {Promise<Object>} Результат запроса
 */
async function query(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return { data: result.rows, error: null, count: result.rowCount };
  } catch (error) {
    console.error('Database query error:', error);
    return { data: null, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * SELECT запрос с фильтрами
 */
class QueryBuilder {
  constructor(tableName) {
    this.table = tableName;
    this.selectFields = '*';
    this.whereConditions = [];
    this.orderByClause = null;
    this.limitValue = null;
    this.offsetValue = null;
    this.params = [];
    this.paramIndex = 1;
  }

  select(fields = '*') {
    this.selectFields = Array.isArray(fields) ? fields.join(', ') : fields;
    return this;
  }

  eq(field, value) {
    this.whereConditions.push(`${field} = $${this.paramIndex++}`);
    this.params.push(value);
    return this;
  }

  neq(field, value) {
    this.whereConditions.push(`${field} != $${this.paramIndex++}`);
    this.params.push(value);
    return this;
  }

  gt(field, value) {
    this.whereConditions.push(`${field} > $${this.paramIndex++}`);
    this.params.push(value);
    return this;
  }

  gte(field, value) {
    this.whereConditions.push(`${field} >= $${this.paramIndex++}`);
    this.params.push(value);
    return this;
  }

  lt(field, value) {
    this.whereConditions.push(`${field} < $${this.paramIndex++}`);
    this.params.push(value);
    return this;
  }

  lte(field, value) {
    this.whereConditions.push(`${field} <= $${this.paramIndex++}`);
    this.params.push(value);
    return this;
  }

  like(field, pattern) {
    this.whereConditions.push(`${field} LIKE $${this.paramIndex++}`);
    this.params.push(pattern);
    return this;
  }

  ilike(field, pattern) {
    this.whereConditions.push(`${field} ILIKE $${this.paramIndex++}`);
    this.params.push(pattern);
    return this;
  }

  in(field, values) {
    const placeholders = values.map(() => `$${this.paramIndex++}`).join(', ');
    this.whereConditions.push(`${field} IN (${placeholders})`);
    this.params.push(...values);
    return this;
  }

  isNull(field) {
    this.whereConditions.push(`${field} IS NULL`);
    return this;
  }

  isNotNull(field) {
    this.whereConditions.push(`${field} IS NOT NULL`);
    return this;
  }

  order(field, direction = 'ASC') {
    this.orderByClause = `ORDER BY ${field} ${direction.toUpperCase()}`;
    return this;
  }

  limit(count) {
    this.limitValue = count;
    return this;
  }

  offset(count) {
    this.offsetValue = count;
    return this;
  }

  single() {
    this.limitValue = 1;
    this.isSingle = true;
    return this;
  }

  async execute() {
    let sql = `SELECT ${this.selectFields} FROM ${this.table}`;
    
    if (this.whereConditions.length > 0) {
      sql += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }
    
    if (this.orderByClause) {
      sql += ` ${this.orderByClause}`;
    }
    
    if (this.limitValue) {
      sql += ` LIMIT ${this.limitValue}`;
    }
    
    if (this.offsetValue) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    const result = await query(sql, this.params);
    
    if (this.isSingle && result.data) {
      return { data: result.data[0] || null, error: result.error };
    }
    
    return result;
  }
}

/**
 * INSERT запрос
 */
async function insert(tableName, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  
  const sql = `
    INSERT INTO ${tableName} (${keys.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;
  
  const result = await query(sql, values);
  return { data: result.data?.[0] || null, error: result.error };
}

/**
 * UPDATE запрос
 */
async function update(tableName, data, conditions) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  
  const whereKeys = Object.keys(conditions);
  const whereValues = Object.values(conditions);
  const whereClause = whereKeys.map((key, i) => `${key} = $${i + 1 + values.length}`).join(' AND ');
  
  const sql = `
    UPDATE ${tableName}
    SET ${setClause}
    WHERE ${whereClause}
    RETURNING *
  `;
  
  const result = await query(sql, [...values, ...whereValues]);
  return { data: result.data || [], error: result.error, count: result.count };
}

/**
 * DELETE запрос
 */
async function deleteFrom(tableName, conditions) {
  const keys = Object.keys(conditions);
  const values = Object.values(conditions);
  const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
  
  const sql = `
    DELETE FROM ${tableName}
    WHERE ${whereClause}
    RETURNING *
  `;
  
  const result = await query(sql, values);
  return { data: result.data || [], error: result.error, count: result.count };
}

/**
 * Создать query builder для таблицы
 */
function from(tableName) {
  return new QueryBuilder(tableName);
}

/**
 * RPC вызов функции
 */
async function rpc(functionName, params = {}) {
  const keys = Object.keys(params);
  const values = Object.values(params);
  const placeholders = keys.map((key, i) => `${key} := $${i + 1}`).join(', ');
  
  const sql = `SELECT * FROM ${functionName}(${placeholders})`;
  
  return await query(sql, values);
}

module.exports = {
  query,
  from,
  insert,
  update,
  delete: deleteFrom,
  rpc,
  pool
};

