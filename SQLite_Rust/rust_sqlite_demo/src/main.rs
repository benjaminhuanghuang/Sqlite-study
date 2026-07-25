use std::env;

use rusqlite::{Connection, Result};


fn main() {
    println!("Hello, world!");
}


fn connect_database() -> Result<Connection> {
    let db_path = env::current_dir().expect("Failed to get current directory").join("data/mysqlite.db3");
    
    // return the connection
    Connection::open(db_path)
}

fn create_table(conn: &Connection, table: &str) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS friends (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
        [],
    )?;
    Ok(())
}


#[cfg(test)]
mod rust_sqlite_demo_tests {
    use super::*;


    #[test]
    fn test_connect_database() -> Result<()> {
        connect_database()?;
        Ok(())
    }

    # [test]
    fn test_create_table() -> Result<()> {
        let conn = connect_database()?;
        create_table(&conn, "friends")?;

        conn.execute("SELECT * FROM friends", [])?;
        Ok(())
    }
}