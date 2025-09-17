from flask import Blueprint, jsonify
user_bp = Blueprint("user", __name__)
@user_bp.route("/users/ping", methods=["GET"])
def users_ping():
    return jsonify({"ok": True})
