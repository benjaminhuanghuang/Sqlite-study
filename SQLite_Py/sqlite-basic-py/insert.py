import sqlite3

conn  = sqlite3.connect('a.db')   # create a.db if it not exist

c = conn.cursor()

## Insert one
c.execute("INSERT INTO users VALUES ('ben', 'huang', 'ben@gmail.com')")


## Insert many
users = [
  ('aa', 'aa', 'aa@gmail.com'),
  ('bb', 'bb', 'bb@gmail.com'),
  ('cc', 'cc', 'cc@gmail.com'),
  ]


c.executemany("INSERT INTO users VALUES (?, ?, ?)", users)


conn.commit()
conn.close()
