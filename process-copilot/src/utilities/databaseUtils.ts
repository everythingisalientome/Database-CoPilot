import * as mssql from 'mssql';



//const DB_CONTEXT_QUERY = "with descriptions as ( select ' /*' + cast(ep.value as varchar(1000)) + '*/ ' as [value], obj.name as table_name, col.name as column_name, case when minor_id = 0 then 'TABLE' else 'COLUMN' end as description_type from sys.extended_properties ep inner join sys.objects obj on obj.object_id = ep.major_id /*decode minor_id as coulmn id*/ left join sys.columns col on col.object_id = ep.major_id and col.column_id = ep.minor_id where ep.name = 'Description' ), foreignKeysRelations as ( /*  get all foreign keys relations in current database  */ select distinct t.name as sourceTableName, c.name as sourceColumnName, rt.name as targetTableName, fc.name as targetColumnName, ' /* references ' + rt.name + '.' + fc.name + ' */ ' as [value] from sys.columns c inner join sys.foreign_key_columns fkc on fkc.parent_object_id = c.object_id and fkc.parent_column_id = c.column_id inner join sys.columns fc on fc.object_id = fkc.referenced_object_id and fc.column_id = fkc.referenced_column_id inner join sys.tables t on t.object_id = fkc.parent_object_id inner join sys.tables rt on rt.object_id = fkc.referenced_object_id where c.object_id in ( select object_id from sys.tables where type = 'U' ) ) select '-- Table ' + t.table_schema + '.[' + t.table_name + '] ' + coalesce(td.[value], '') + ' (' + stuff( ( select ', [' + c.column_name + '] ' + data_type + case when character_maximum_length is not null then '(' + cast(character_maximum_length as varchar(10)) + ')' else '' end + case when is_nullable = 'NO' then ' not null' else '' end + coalesce(cd.[value], '') + coalesce(fkr.[value], '') from information_schema.columns c left join descriptions cd on cd.table_name = c.table_name and cd.column_name = c.column_name and cd.description_type = 'COLUMN' left join foreignKeysRelations fkr on fkr.sourceTableName = c.table_name and fkr.sourceColumnName = c.column_name where c.table_name = t.table_name order by ordinal_position for xml path('') ), 1, 2, '' ) + ');' from information_schema.tables t left join descriptions td on td.table_name = t.table_name and td.description_type = 'TABLE' where table_type = 'BASE TABLE' order by t.table_schema, t.table_name";
const DB_CONTEXT_QUERY = "with foreingKeysRelations as ( /*  get all foreign keys relations in current database  */ select distinct t.name as sourceTableName, c.name as sourceColumnName, rt.name as targetTableName, fc.name as targetColumnName, ' /* references ' + rt.name + '.' + fc.name + ' */ ' as [value] from sys.columns c inner join sys.foreign_key_columns fkc on fkc.parent_object_id = c.object_id and fkc.parent_column_id = c.column_id inner join sys.columns fc on fc.object_id = fkc.referenced_object_id and fc.column_id = fkc.referenced_column_id inner join sys.tables t on t.object_id = fkc.parent_object_id inner join sys.tables rt on rt.object_id = fkc.referenced_object_id where c.object_id in ( select object_id from sys.tables where type = 'U' ) ) select '-- Table ' + t.table_schema + '.[' + t.table_name + '] (' + stuff( ( select ', [' + c.column_name + '] ' + data_type + case when character_maximum_length is not null then '(' + cast(character_maximum_length as varchar(10)) + ')' else '' end + case when is_nullable = 'NO' then ' not null' else '' end from information_schema.columns c where c.table_name = t.table_name order by ordinal_position for xml path('') ), 1, 2, '' ) + ')' as TableDescription from information_schema.tables t where table_type = 'BASE TABLE' order by t.table_schema, t.table_name";
/**
 * Gets the database Pool.
 * @returns The database context.
 */
export async function getDatabasePool(): Promise<mssql.ConnectionPool> {
    try {
        
        const config: mssql.config = {
            user: "user",
            password: "password",
            server: "192.168.0.1",
            port: 11000,
            database: "WideWorldImporters",
            options: {
                //encrypt: true, // Use encryption for the connection
                trustServerCertificate: true, // Trust the server certificate (useful for self-signed certificates)
                enableArithAbort: true // Required for SQL Server compatibility
            }
        };
        const pool = await mssql.connect(config);
        return pool;
    } catch (err) {
        console.error('Database connection failed: ', err);
        throw err;
    }
}

/**
 * Gets the database context.
 * @param pool The database connection pool.
 * @returns The database context.
 */
export async function getDatabaseContext(pool: mssql.ConnectionPool): Promise<mssql.IResult<any>> {
    try {
        const result = await pool.request().query(DB_CONTEXT_QUERY);
        return result;
    } catch (err) {
        console.error('Query execution failed: ', err);
        throw err;
    }
}


/**
 * Runs a query against the database.
 * @param pool The database connection pool.
 * @param query The SQL query to run.
 * @returns The query result.
 */
export async function runQuery(pool: mssql.ConnectionPool, query: string): Promise<mssql.IResult<any>> {
    try {
        const result = await pool.request().query(query);
        return result;
    } catch (err) {
        console.error('Query execution failed: ', err);
        throw err;
    }
}