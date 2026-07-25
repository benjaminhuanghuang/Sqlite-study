# SQLite + Rust Setup

Install Rust on Mac

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Create project

```sh
cargo new rust_sqlite_demo
```

Import Rusqlite (https://crates.io/crates/rusqlite)

```toml
rusqlite = { version = "0.40.1", features = ["bundled"] }
```
