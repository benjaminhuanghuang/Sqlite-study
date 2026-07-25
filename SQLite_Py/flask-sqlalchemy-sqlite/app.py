from flask import Flask, render_template, request
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///friends.db3'
# init db
db = SQLAlchemy(app)

# Create model
class Friends(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

    def __repr__(self):
        return f'<Name %r>' % self.name
    db.create_all()




subscribers = []

@app.route('/')
def index():
    title = "John Elder's Blog"
    return render_template("index.html", title=title)

@app.route('/friends')
def about():
    title = "About John Elder!"
    names = ["John", "Mary", "Wes", "Sally"]
    return render_template("about.html", title=title)


@app.route('/about')
def about():
    title = "About John Elder!"
    names = ["John", "Mary", "Wes", "Sally"]
    return render_template("about.html", names=names, title=title)

@app.route('/subscribe')
def subscribe():
    title = "Subcribe To My Email Newsletter"
    return render_template("subscribe.html", title=title)

@app.route('/form', methods=["POST"])
def form():
    name = request.form.get("name")
    email = request.form.get("email")
    subscribers.append({"name": name, "email": email})
    return render_template("form.html", name=name, email=email) 