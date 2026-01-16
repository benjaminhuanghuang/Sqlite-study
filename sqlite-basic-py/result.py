import sqlite3

conn  = sqlite3.connect('a.db')   # create a.db if it not exist

c = conn.cursor()

c.execute("SELECT * FROM users")

items = c.fetchall()

for item in items:
  print(item)

conn.commit()
conn.close()
