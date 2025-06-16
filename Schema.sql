-- Complete Database Schema Information Query
-- This query returns tables, columns, data types, constraints, and relationships in one result set

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
        CASE WHEN tc.CONSTRAINT_TYPE = 'PRIMARY KEY' THEN 'YES' ELSE 'NO' END AS IS_PRIMARY_KEY,
        CASE WHEN tc.CONSTRAINT_TYPE = 'UNIQUE' THEN 'YES' ELSE 'NO' END AS IS_UNIQUE
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
),

IndexInfo AS (
    -- Get index information
    SELECT 
        SCHEMA_NAME(t.schema_id) AS INDEX_SCHEMA,
        t.name AS TABLE_NAME,
        i.name AS INDEX_NAME,
        i.type_desc AS INDEX_TYPE,
        i.is_unique AS IS_UNIQUE_INDEX,
        STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS INDEX_COLUMNS
    FROM sys.tables t
    INNER JOIN sys.indexes i ON t.object_id = i.object_id
    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.type > 0  -- Exclude heaps
    GROUP BY SCHEMA_NAME(t.schema_id), t.name, i.name, i.type_desc, i.is_unique
)

-- Main query combining all information
SELECT 
    ti.TABLE_SCHEMA,
    ti.TABLE_NAME,
    ti.TABLE_TYPE,
    ci.COLUMN_NAME,
    ci.ORDINAL_POSITION,
    ci.FULL_DATA_TYPE,
    ci.IS_NULLABLE,
    ci.COLUMN_DEFAULT,
    ci.IS_PRIMARY_KEY,
    ci.IS_UNIQUE,
    
    -- Foreign Key Information
    fki.FK_NAME,
    fki.REFERENCED_SCHEMA,
    fki.REFERENCED_TABLE,
    fki.REFERENCED_COLUMN,
    fki.DELETE_ACTION,
    fki.UPDATE_ACTION,
    
    -- Index Information
    STRING_AGG(DISTINCT CONCAT(ii.INDEX_NAME, ' (', ii.INDEX_TYPE, ')'), '; ') AS INDEXES,
    
    -- Relationship Summary
    CASE 
        WHEN fki.FK_NAME IS NOT NULL 
        THEN CONCAT('FK: ', fki.FK_COLUMN, ' -> ', fki.REFERENCED_SCHEMA, '.', fki.REFERENCED_TABLE, '.', fki.REFERENCED_COLUMN)
        ELSE NULL 
    END AS RELATIONSHIP_SUMMARY

FROM TableInfo ti
LEFT JOIN ColumnInfo ci 
    ON ti.TABLE_SCHEMA = ci.TABLE_SCHEMA 
    AND ti.TABLE_NAME = ci.TABLE_NAME
LEFT JOIN ForeignKeyInfo fki 
    ON ci.TABLE_SCHEMA = fki.FK_SCHEMA 
    AND ci.TABLE_NAME = fki.FK_TABLE 
    AND ci.COLUMN_NAME = fki.FK_COLUMN
LEFT JOIN IndexInfo ii 
    ON ci.TABLE_SCHEMA = ii.INDEX_SCHEMA 
    AND ci.TABLE_NAME = ii.TABLE_NAME

GROUP BY 
    ti.TABLE_SCHEMA,
    ti.TABLE_NAME,
    ti.TABLE_TYPE,
    ci.COLUMN_NAME,
    ci.ORDINAL_POSITION,
    ci.FULL_DATA_TYPE,
    ci.IS_NULLABLE,
    ci.COLUMN_DEFAULT,
    ci.IS_PRIMARY_KEY,
    ci.IS_UNIQUE,
    fki.FK_NAME,
    fki.FK_COLUMN,
    fki.REFERENCED_SCHEMA,
    fki.REFERENCED_TABLE,
    fki.REFERENCED_COLUMN,
    fki.DELETE_ACTION,
    fki.UPDATE_ACTION

ORDER BY 
    ti.TABLE_SCHEMA,
    ti.TABLE_NAME,
    ci.ORDINAL_POSITION;
