import sqlite3

conn  = sqlite3.connect('a.db')   # create a.db if it not exist

c = conn.cursor()

c.execute("DELETE FROM users WHERE rowid=6")


conn.commit()
conn.close()
