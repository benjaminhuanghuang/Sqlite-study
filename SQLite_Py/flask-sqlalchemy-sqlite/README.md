# Flask + SQLite

```sh
python3 -m venv .venv
source ./.venv/bin/activate


pip install Flask
pip install flask-sqlalchemy

```

## Coding

```py
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///data/sqlite.db3'
db = SQLAlchemy(app)

```

## Create db

```sh
python
>>> from app import db
>>> db.create_all()
>>> exit()
```

## Run

```sh
flask run
```
