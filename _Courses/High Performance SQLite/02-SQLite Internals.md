# SQLite Internals

## dot Commands

```sh
sqlite3 test.sqlite

.tables
.headers on

.mode
.mode json

select * from uses;


.shell clear

.exit
```

## Pragmas

In SQLite, a PRAGMA is a special command used to query or change SQLite’s internal settings and behavior.

```sh
pragma page_size

```

## Virtual tables

```sh
sqlite> CREATE VIRTUAL TABLE temp.t1 USING csv(filename="sample.csv", header=true);
```
