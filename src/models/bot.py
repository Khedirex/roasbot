from datetime import datetime
from .user import db

class Bot(db.Model):
    __tablename__ = "bots"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, default="Bot")
    game_type = db.Column(db.String(50), nullable=False, default="aviator")
    casino_site = db.Column(db.String(120))
    telegram_token = db.Column(db.String(256))
    telegram_chat_id = db.Column(db.String(128))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "game_type": self.game_type,
            "casino_site": self.casino_site,
            "telegram_token": self.telegram_token,
            "telegram_chat_id": self.telegram_chat_id,
            "is_active": self.is_active,
            "created_at": (self.created_at.isoformat() if self.created_at else None),
        }
