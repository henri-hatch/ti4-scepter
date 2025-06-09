import sqlite3

def execute_query(db_path, query, params=None):
    """Execute a query on the database and return the result."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    if params:
        cursor.execute(query, params)
    else:
        cursor.execute(query)
    
    result = cursor.fetchall()
    conn.commit()
    conn.close()
    
    return result