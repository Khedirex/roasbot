from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from src.models.user import db

class Bot(db.Model):
    __tablename__ = 'bots'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    game_type = db.Column(db.String(50), nullable=False)  # mines, aviator, etc
    casino_site = db.Column(db.String(50), nullable=False)  # blaze, smashup, 1win, etc
    telegram_token = db.Column(db.String(200), nullable=False)
    telegram_chat_id = db.Column(db.String(50), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamento com estratégias
    strategies = db.relationship('Strategy', backref='bot', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'game_type': self.game_type,
            'casino_site': self.casino_site,
            'telegram_token': self.telegram_token,
            'telegram_chat_id': self.telegram_chat_id,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Strategy(db.Model):
    __tablename__ = 'strategies'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    bot_id = db.Column(db.Integer, db.ForeignKey('bots.id'), nullable=False)
    pattern = db.Column(db.Text, nullable=False)  # Padrão da estratégia (ex: "red-red-black")
    action = db.Column(db.String(50), nullable=False)  # Ação a tomar (ex: "bet_red")
    start_time = db.Column(db.String(5))  # Formato HH:MM
    end_time = db.Column(db.String(5))    # Formato HH:MM
    custom_message = db.Column(db.Text)   # Mensagem personalizada
    use_default_message = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)
    
    # Métricas
    total_signals = db.Column(db.Integer, default=0)
    wins = db.Column(db.Integer, default=0)
    losses = db.Column(db.Integer, default=0)
    wins_no_gale = db.Column(db.Integer, default=0)
    wins_with_gale = db.Column(db.Integer, default=0)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        win_rate = (self.wins / self.total_signals * 100) if self.total_signals > 0 else 0
        win_rate_no_gale = (self.wins_no_gale / self.total_signals * 100) if self.total_signals > 0 else 0
        win_rate_with_gale = (self.wins_with_gale / self.total_signals * 100) if self.total_signals > 0 else 0
        
        return {
            'id': self.id,
            'name': self.name,
            'bot_id': self.bot_id,
            'pattern': self.pattern,
            'action': self.action,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'custom_message': self.custom_message,
            'use_default_message': self.use_default_message,
            'is_active': self.is_active,
            'total_signals': self.total_signals,
            'wins': self.wins,
            'losses': self.losses,
            'wins_no_gale': self.wins_no_gale,
            'wins_with_gale': self.wins_with_gale,
            'win_rate': round(win_rate, 2),
            'win_rate_no_gale': round(win_rate_no_gale, 2),
            'win_rate_with_gale': round(win_rate_with_gale, 2),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class GameResult(db.Model):
    __tablename__ = 'game_results'
    
    id = db.Column(db.Integer, primary_key=True)
    strategy_id = db.Column(db.Integer, db.ForeignKey('strategies.id'), nullable=False)
    game_data = db.Column(db.Text, nullable=False)  # JSON com dados do jogo
    signal_sent = db.Column(db.Boolean, default=False)
    result = db.Column(db.String(20))  # win, loss, pending
    used_gale = db.Column(db.Boolean, default=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'strategy_id': self.strategy_id,
            'game_data': self.game_data,
            'signal_sent': self.signal_sent,
            'result': self.result,
            'used_gale': self.used_gale,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }

