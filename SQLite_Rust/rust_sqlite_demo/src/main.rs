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

 


#[cfg(test)]
mod rust_sqlite_demo_tests {
    use super::*;


    #[test]
    fn test_connect_database() -> Result<()> {
        connect_database()?;
        Ok(())
    }
}