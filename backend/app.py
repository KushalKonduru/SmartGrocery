from flask import Flask, send_from_directory, render_template
from flask_cors import CORS
import os

app = Flask(__name__,
            static_folder='../dist/assets',
            template_folder='../dist')
CORS(app)

# Explicit SPA routes (served by index.html)
@app.route('/achievements')
@app.route('/my-orders')
@app.route('/my-sales')
@app.route('/profile')
@app.route('/expenditure')
@app.route('/consumption')
@app.route('/analytics/expenditure')
@app.route('/analytics/consumption')
@app.route('/admin/users')
def spa_routes():
    return send_from_directory(app.template_folder, 'index.html')

# Serve React App
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.template_folder + '/' + path):
        return send_from_directory(app.template_folder, path)
    else:
        return send_from_directory(app.template_folder, 'index.html')

# Example API route
@app.route('/api/hello')
def hello():
    return {'message': 'Hello from Flask!'}

if __name__ == '__main__':
    app.run(debug=True, port=5000)
