# models.py
from datetime import datetime, time
from yourapp import db  # ajuste o import do seu app

class Strategy(db.Model):
    __tablename__ = "strategies"
    id = db.Column(db.Integer, primary_key=True)
    bot_id = db.Column(db.Integer, db.ForeignKey("bots.id"), nullable=False)

    # dados de negócio
    name = db.Column(db.String(120), nullable=False)
    pattern = db.Column(db.String(40), nullable=False)        # ex: "low-mults"
    need = db.Column(db.Integer, nullable=False, default=3)   # ex: 3 seguidos <2.0
    action = db.Column(db.String(60), nullable=False)         # ex: "entry_2.5x"

    # mensagens
    use_default_message = db.Column(db.Boolean, nullable=False, default=True)
    custom_message = db.Column(db.Text, nullable=True)        # "::pre::... ::confirm::..."

    # janela de operação (opcional)
    start_time = db.Column(db.Time, nullable=True)            # ex: time(9,0)
    end_time = db.Column(db.Time, nullable=True)              # ex: time(22,0)

    # status e métricas
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    wins = db.Column(db.Integer, nullable=False, default=0)
    losses = db.Column(db.Integer, nullable=False, default=0)
    wins_no_gale = db.Column(db.Integer, nullable=False, default=0)
    wins_with_gale = db.Column(db.Integer, nullable=False, default=0)
    total_signals = db.Column(db.Integer, nullable=False, default=0)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def as_dict(self):
        return {
            "id": self.id,
            "bot_id": self.bot_id,
            "name": self.name,
            "pattern": self.pattern,
            "need": self.need,
            "action": self.action,
            "use_default_message": self.use_default_message,
            "custom_message": self.custom_message,
            "start_time": self.start_time.isoformat() if isinstance(self.start_time, time) and self.start_time else None,
            "end_time": self.end_time.isoformat() if isinstance(self.end_time, time) and self.end_time else None,
            "is_active": self.is_active,
            "wins": self.wins,
            "losses": self.losses,
            "wins_no_gale": self.wins_no_gale,
            "wins_with_gale": self.wins_with_gale,
            "total_signals": self.total_signals,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
