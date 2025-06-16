-- Complete Database Schema Information in Single Column
-- All table, column, and relationship information concatenated into one column

WITH TableInfo AS (
    -- Get basic table information
    SELECT 
        t.TABLE_SCHEMA,
        t.TABLE_NAME,
        t.TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES t
    WHERE t.TABLE_TYPE = 'BASE TABLE'
),

ColumnInfo AS (
    -- Get detailed column information
    SELECT 
        c.TABLE_SCHEMA,
        c.TABLE_NAME,
        c.COLUMN_NAME,
        c.ORDINAL_POSITION,
        c.DATA_TYPE,
        CASE 
            WHEN c.CHARACTER_MAXIMUM_LENGTH IS NOT NULL 
            THEN c.DATA_TYPE + '(' + CAST(c.CHARACTER_MAXIMUM_LENGTH AS VARCHAR(10)) + ')'
            WHEN c.NUMERIC_PRECISION IS NOT NULL AND c.NUMERIC_SCALE IS NOT NULL
            THEN c.DATA_TYPE + '(' + CAST(c.NUMERIC_PRECISION AS VARCHAR(10)) + ',' + CAST(c.NUMERIC_SCALE AS VARCHAR(10)) + ')'
            WHEN c.NUMERIC_PRECISION IS NOT NULL
            THEN c.DATA_TYPE + '(' + CAST(c.NUMERIC_PRECISION AS VARCHAR(10)) + ')'
            ELSE c.DATA_TYPE
        END AS FULL_DATA_TYPE,
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT,
        CASE WHEN tc.CONSTRAINT_TYPE = 'PRIMARY KEY' THEN 'PK' 
             WHEN tc.CONSTRAINT_TYPE = 'UNIQUE' THEN 'UQ' 
             ELSE '' END AS CONSTRAINT_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS c
    LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
        ON c.TABLE_SCHEMA = kcu.TABLE_SCHEMA 
        AND c.TABLE_NAME = kcu.TABLE_NAME 
        AND c.COLUMN_NAME = kcu.COLUMN_NAME
    LEFT JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc 
        ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME 
        AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
    WHERE c.TABLE_SCHEMA NOT IN ('information_schema', 'sys')
),

ForeignKeyInfo AS (
    -- Get foreign key relationships
    SELECT 
        fk.name AS FK_NAME,
        SCHEMA_NAME(fk.schema_id) AS FK_SCHEMA,
        OBJECT_NAME(fk.parent_object_id) AS FK_TABLE,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS FK_COLUMN,
        SCHEMA_NAME(pk.schema_id) AS REFERENCED_SCHEMA,
        OBJECT_NAME(fk.referenced_object_id) AS REFERENCED_TABLE,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS REFERENCED_COLUMN,
        fk.delete_referential_action_desc AS DELETE_ACTION,
        fk.update_referential_action_desc AS UPDATE_ACTION
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc 
        ON fk.object_id = fkc.constraint_object_id
    INNER JOIN sys.objects pk 
        ON fk.referenced_object_id = pk.object_id
)

-- Main query - Everything in one concatenated column
SELECT 
    'TABLE: ' + ti.TABLE_SCHEMA + '.' + ti.TABLE_NAME + 
    ' | COLUMN: ' + ci.COLUMN_NAME + 
    ' (' + CAST(ci.ORDINAL_POSITION AS VARCHAR(3)) + ')' +
    ' | TYPE: ' + ci.FULL_DATA_TYPE + 
    ' | NULLABLE: ' + ci.IS_NULLABLE + 
    CASE WHEN ci.COLUMN_DEFAULT IS NOT NULL 
         THEN ' | DEFAULT: ' + ci.COLUMN_DEFAULT 
         ELSE '' END +
    CASE WHEN ci.CONSTRAINT_TYPE <> '' 
         THEN ' | CONSTRAINT: ' + ci.CONSTRAINT_TYPE 
         ELSE '' END +
    CASE WHEN fki.FK_NAME IS NOT NULL 
         THEN ' | FK: ' + fki.FK_COLUMN + ' -> ' + 
              fki.REFERENCED_SCHEMA + '.' + fki.REFERENCED_TABLE + '.' + fki.REFERENCED_COLUMN +
              ' (DEL: ' + fki.DELETE_ACTION + ', UPD: ' + fki.UPDATE_ACTION + ')'
         ELSE '' END AS SCHEMA_INFO

FROM TableInfo ti
LEFT JOIN ColumnInfo ci 
    ON ti.TABLE_SCHEMA = ci.TABLE_SCHEMA 
    AND ti.TABLE_NAME = ci.TABLE_NAME
LEFT JOIN ForeignKeyInfo fki 
    ON ci.TABLE_SCHEMA = fki.FK_SCHEMA 
    AND ci.TABLE_NAME = fki.FK_TABLE 
    AND ci.COLUMN_NAME = fki.FK_COLUMN

ORDER BY 
    ti.TABLE_SCHEMA,
    ti.TABLE_NAME,
    ci.ORDINAL_POSITION;
