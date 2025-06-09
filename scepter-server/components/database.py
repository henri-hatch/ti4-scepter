import sqlite3
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)

class DatabaseError(Exception):
    """Custom exception for database operations"""
    pass

@contextmanager
def get_db_connection(db_path):
    """Context manager for database connections"""
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row  # Enable column access by name
        yield conn
    except sqlite3.Error as e:
        if conn:
            conn.rollback()
        logger.error(f"Database error: {e}")
        raise DatabaseError(f"Database operation failed: {e}")
    finally:
        if conn:
            conn.close()

def execute_query(db_path, query, params=None, fetch_one=False, fetch_all=True):
    """
    Execute a query on the database and return the result.
    
    Args:
        db_path: Path to the SQLite database
        query: SQL query to execute
        params: Parameters for the query
        fetch_one: If True, return only the first row
        fetch_all: If True, return all rows (ignored if fetch_one is True)
    
    Returns:
        Query results or None for non-SELECT queries
    """
    try:
        with get_db_connection(db_path) as conn:
            cursor = conn.cursor()
            
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            # Determine if this is a SELECT query
            query_type = query.strip().upper().split()[0]
            
            if query_type == 'SELECT':
                if fetch_one:
                    result = cursor.fetchone()
                    return dict(result) if result else None
                elif fetch_all:
                    results = cursor.fetchall()
                    return [dict(row) for row in results]
                else:
                    return None
            else:
                # For INSERT, UPDATE, DELETE queries
                conn.commit()
                return cursor.rowcount
                
    except sqlite3.Error as e:
        logger.error(f"Query execution failed: {query[:50]}... Error: {e}")
        raise DatabaseError(f"Query execution failed: {e}")

def execute_script(db_path, script):
    """Execute a SQL script (multiple statements)"""
    try:
        with get_db_connection(db_path) as conn:
            conn.executescript(script)
            conn.commit()
    except sqlite3.Error as e:
        logger.error(f"Script execution failed: {e}")
        raise DatabaseError(f"Script execution failed: {e}")

def table_exists(db_path, table_name):
    """Check if a table exists in the database"""
    query = "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    result = execute_query(db_path, query, (table_name,), fetch_one=True)
    return result is not None